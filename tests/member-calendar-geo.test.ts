import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  distanceMiles,
  formatDistance,
  groupVenues,
  isWithin,
  parseHome,
  parseLatLng,
  venueChapter,
} from "../src/lib/member-calendar/geo";
import {
  geocodeOnce,
  geocodeVenues,
  GeocoderConfigError,
} from "../src/lib/member-calendar/server/geocoder";

const RICHMOND = { lat: 37.5407, lng: -77.436 };
const NORFOLK = { lat: 36.8508, lng: -76.2859 };
const FAIRFAX = { lat: 38.8462, lng: -77.3064 };

describe("distances (PRD 009, R7.4)", () => {
  it("computes straight-line miles", () => {
    expect(distanceMiles(RICHMOND, NORFOLK)).toBeGreaterThan(75);
    expect(distanceMiles(RICHMOND, NORFOLK)).toBeLessThan(85);
    expect(distanceMiles(RICHMOND, RICHMOND)).toBe(0);
    expect(formatDistance(0.4)).toBe("<1 mi away");
    expect(formatDistance(23.4)).toBe("~23 mi away");
  });

  it("applies the Within filter only to located events", () => {
    expect(isWithin(NORFOLK, RICHMOND, 50)).toBe(false);
    expect(isWithin(NORFOLK, RICHMOND, 100)).toBe(true);
    expect(isWithin(null, RICHMOND, 25)).toBe(true); // no location: kept
    expect(isWithin(NORFOLK, null, 25)).toBe(true); // no home: no filter
    expect(isWithin(NORFOLK, RICHMOND, null)).toBe(true); // "Any distance"
  });

  it("reads lat,lng queries", () => {
    expect(parseLatLng("38.0872508,-78.4686097")).toEqual({ lat: 38.0872508, lng: -78.4686097 });
    expect(parseLatLng("Norfolk Scope")).toBeNull();
    expect(parseLatLng("123,456")).toBeNull();
  });
});

describe("groupVenues (R5.5)", () => {
  const ev = (id: string, chapter: "nova" | "central" | null) => ({
    id,
    title: id,
    chapter,
    start: "2026-12-01",
  });

  it("groups by place ID, then by matching coordinates", () => {
    const venues = groupVenues([
      { event: ev("a", "nova"), geo: { ...FAIRFAX, placeId: "p1", label: "Hotel" } },
      { event: ev("b", "nova"), geo: { ...FAIRFAX, placeId: "p1", label: "Hotel" } },
      { event: ev("c", "central"), geo: { ...RICHMOND, placeId: null, label: null } },
      { event: ev("d", null), geo: { ...RICHMOND, placeId: null, label: null } },
      { event: ev("e", "central"), geo: { ...NORFOLK, placeId: "p2", label: "Scope" } },
    ]);
    expect(venues.map((v) => v.events.map((e) => e.id))).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(venueChapter(venues[0])).toBe("nova");
    expect(venueChapter(venues[1])).toBeNull(); // mixed chapters → General color
  });
});

describe("parseHome (R7.3)", () => {
  it("accepts valid stored locations and ignores bad data", () => {
    const home = parseHome(
      JSON.stringify({ label: "23510", lat: 36.85, lng: -76.29, savedAt: "x", within: 50 }),
    );
    expect(home).toMatchObject({ label: "23510", lat: 36.85, lng: -76.29, within: 50 });
    expect(parseHome(JSON.stringify({ lat: 36.85, lng: -76.29, within: 7 }))?.within).toBeNull();
    expect(parseHome(JSON.stringify({ lat: 200, lng: 0 }))).toBeNull();
    expect(parseHome("{bad")).toBeNull();
    expect(parseHome(null)).toBeNull();
  });
});

describe("geocoder (R5.3, R7.2)", () => {
  const ok = (overrides: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({
        status: "OK",
        results: [
          {
            place_id: "place-1",
            formatted_address: "201 E Brambleton Ave, Norfolk, VA 23510, USA",
            geometry: { location: NORFOLK },
            address_components: [{ short_name: "US", types: ["country", "political"] }],
            ...overrides,
          },
        ],
      }),
    );

  beforeEach(() => {
    process.env.GOOGLE_GEOCODING_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_GEOCODING_KEY;
  });

  it("returns coordinates, place ID and label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodeOnce("Norfolk Scope")).resolves.toEqual({
      ...NORFOLK,
      placeId: "place-1",
      label: "201 E Brambleton Ave, Norfolk, VA 23510, USA",
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("address")).toBe("Norfolk Scope");
    expect(url.searchParams.get("components")).toBeNull();
  });

  it("restricts home lookups to the US", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ address_components: [{ short_name: "CA", types: ["country"] }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodeOnce("Toronto", { usOnly: true })).resolves.toBeNull();
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("components")).toBe("country:US");
  });

  it("handles no results, API errors, and a missing key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ZERO_RESULTS" }))),
    );
    await expect(geocodeOnce("Nowhere")).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: "REQUEST_DENIED",
              error_message: "API keys with referer restrictions cannot be used with this API.",
            }),
          ),
      ),
    );
    // A key problem is a configuration error, reported to the member as "maps unavailable".
    await expect(geocodeOnce("x")).rejects.toBeInstanceOf(GeocoderConfigError);
    await expect(geocodeVenues(["Venue"])).rejects.toBeInstanceOf(GeocoderConfigError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "UNKNOWN_ERROR" }))),
    );
    // A one-off failure counts as "no location" for now (not cached).
    await expect(geocodeVenues(["Flaky venue"])).resolves.toEqual(new Map([["Flaky venue", null]]));

    delete process.env.GOOGLE_GEOCODING_KEY;
    await expect(geocodeOnce("x")).rejects.toBeInstanceOf(GeocoderConfigError);
  });

  it("parses coordinate queries without calling Google, and respects the budget", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const results = await geocodeVenues(["38.08,-78.46", "Venue A", "Venue B", "Venue A"], 1);
    expect(results.get("38.08,-78.46")).toEqual({
      lat: 38.08,
      lng: -78.46,
      placeId: null,
      label: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // budget of 1 new lookup
    expect(results.has("Venue A")).toBe(true);
    expect(results.has("Venue B")).toBe(false); // left for a later request
  });
});
