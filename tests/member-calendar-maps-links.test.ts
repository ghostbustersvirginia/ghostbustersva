import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveMapLocation,
  findMapsLinks,
  isShortMapsLink,
  parseMapsUrl,
} from "../src/lib/member-calendar/maps-links";
import {
  followShortLink,
  resolveShortLinks,
} from "../src/lib/member-calendar/server/maps-resolver";

describe("findMapsLinks", () => {
  it("finds bare and linked Maps URLs, trimming punctuation and unwrapping redirects", () => {
    const description =
      "Venue (https://maps.app.goo.gl/q4c3ozU8W6hJAh597). Tickets: https://example.com/t " +
      '<a href="https://www.google.com/url?q=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FNorfolk%2BScope&amp;sa=D">map</a>';
    expect(findMapsLinks(null, description)).toEqual([
      "https://maps.app.goo.gl/q4c3ozU8W6hJAh597",
      "https://www.google.com/maps/place/Norfolk+Scope",
    ]);
  });

  it("checks the location field before the description and de-duplicates", () => {
    const link = "https://maps.app.goo.gl/3YWFuR65LnkyBp1B8";
    expect(findMapsLinks(link, `See ${link}`)).toEqual([link]);
    expect(isShortMapsLink(link)).toBe(true);
    expect(isShortMapsLink("https://goo.gl/maps/abc")).toBe(true);
    expect(isShortMapsLink("https://www.google.com/maps/place/X")).toBe(false);
  });
});

describe("parseMapsUrl", () => {
  it.each([
    [
      "https://maps.google.com/?q=Norfolk+Scope+Arena,+201+E+Brambleton+Ave,+Norfolk,+VA+23510&ftid=0x1:0x2",
      "Norfolk Scope Arena, 201 E Brambleton Ave, Norfolk, VA 23510",
    ],
    [
      "https://www.google.com/maps/place/2806+Idlewood+Dr,+Charlottesville,+VA+22901/@38.0872508,-78.4686097,976m/data=!3m1",
      "2806 Idlewood Dr, Charlottesville, VA 22901",
    ],
    ["https://www.google.com/maps/search/Virginia+Zoo/", "Virginia Zoo"],
    [
      "https://www.google.com/maps/dir/?api=1&destination=Marine+Corps+Museum",
      "Marine Corps Museum",
    ],
  ])("reads %s", (url, expected) => {
    expect(parseMapsUrl(url)?.query).toBe(expected);
  });

  it("falls back to coordinates, and returns null for place-ID-only links", () => {
    expect(parseMapsUrl("https://www.google.com/maps/@38.08,-78.46,15z")).toEqual({
      query: "38.08,-78.46",
      label: null,
    });
    expect(
      parseMapsUrl(
        "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x89b6469ce5fac673:0xbebd1c41c1c0cf0f?entry=s",
      ),
    ).toBeNull();
  });
});

describe("deriveMapLocation", () => {
  const short = "https://maps.app.goo.gl/EFw64nrHzKDxNTPi9";
  const resolved = new Map([
    [short, "https://maps.google.com/?q=Fredericksburg+Convention+Center,+Fredericksburg,+VA"],
  ]);

  it("prefers a mappable location field", () => {
    expect(
      deriveMapLocation({
        location: "Marine Corps Museum",
        description: short,
        chapter: "nova",
        resolvedLinks: resolved,
      }),
    ).toEqual({ mapQuery: "Marine Corps Museum", mapLabel: "Marine Corps Museum", mapUrl: short });
  });

  it("uses a resolved short link from the location field or description", () => {
    const expected = {
      mapQuery: "Fredericksburg Convention Center, Fredericksburg, VA",
      mapLabel: "Fredericksburg Convention Center, Fredericksburg, VA",
      mapUrl: short,
    };
    expect(
      deriveMapLocation({
        location: short,
        description: null,
        chapter: null,
        resolvedLinks: resolved,
      }),
    ).toEqual(expected);
    expect(
      deriveMapLocation({
        location: "",
        description: `Where: (${short})`,
        chapter: null,
        resolvedLinks: resolved,
      }),
    ).toEqual(expected);
  });

  it("keeps an unresolved or place-ID link for Open in Google Maps", () => {
    expect(deriveMapLocation({ location: short, description: null, chapter: null })).toEqual({
      mapQuery: null,
      mapLabel: null,
      mapUrl: short,
    });
  });

  it("never maps Virtual events, and returns nothing without a location", () => {
    expect(
      deriveMapLocation({ location: "Virginia Zoo", description: short, chapter: "virtual" }),
    ).toEqual({ mapQuery: null, mapLabel: null, mapUrl: null });
    expect(deriveMapLocation({ location: "Online", description: "", chapter: null })).toEqual({
      mapQuery: null,
      mapLabel: null,
      mapUrl: null,
    });
  });
});

describe("followShortLink / resolveShortLinks", () => {
  afterEach(() => vi.unstubAllGlobals());

  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

  it("follows Google redirects and returns the full Maps URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect("https://maps.google.com/?q=Norfolk+Scope"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(followShortLink("https://maps.app.goo.gl/abc")).resolves.toBe(
      "https://maps.google.com/?q=Norfolk+Scope",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("refuses redirects to non-Google hosts or plain http", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirect("https://evil.example/x")));
    await expect(followShortLink("https://maps.app.goo.gl/abc")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirect("http://maps.google.com/?q=x")));
    await expect(followShortLink("https://maps.app.goo.gl/abc")).resolves.toBeNull();
  });

  it("only resolves short links, without Redis configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(redirect("https://maps.google.com/?q=Zoo"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await resolveShortLinks([
      "https://maps.app.goo.gl/one",
      "https://www.google.com/maps/place/X",
      "https://maps.app.goo.gl/one",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get("https://maps.app.goo.gl/one")).toBe("https://maps.google.com/?q=Zoo");
  });
});
