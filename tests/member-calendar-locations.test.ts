import { describe, expect, it } from "vitest";
import {
  directionsUrl,
  isMappableLocation,
  isUrlLocation,
  locationHref,
  mapsEmbedUrl,
} from "../src/lib/member-calendar/locations";

describe("isMappableLocation (PRD 009, R4.1)", () => {
  it.each([
    "1610 Coliseum Dr, Hampton, VA 23666",
    "Marine Corps Museum",
    "National Museum of the Marine Corps, 18900 Jefferson Davis Hwy, Triangle, VA",
    "Café Rio, Herndon VA",
    "Zoo Boo, Virginia Zoo",
  ])("maps %s", (location) => {
    expect(isMappableLocation(location)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "Online",
    "online!",
    "(Virtual)",
    "TBD",
    "To be announced",
    "N/A",
    "See description",
    "https://zoom.us/j/123456",
    "www.example.org/event",
    "meet.google.com/abc-defg-hij",
    "Zoom call",
    "Discord voice channel",
    "Microsoft Teams",
    "12345",
  ])("skips %j", (location) => {
    expect(isMappableLocation(location)).toBe(false);
  });

  it("never maps Virtual-chapter events", () => {
    expect(isMappableLocation("123 Main St, Richmond, VA", "virtual")).toBe(false);
    expect(isMappableLocation("123 Main St, Richmond, VA", "central")).toBe(true);
  });
});

describe("location URLs", () => {
  it("detects and links URL locations", () => {
    expect(isUrlLocation("https://zoom.us/j/1")).toBe(true);
    expect(isUrlLocation("twitch.tv/gbva")).toBe(true);
    expect(isUrlLocation("Richmond Raceway")).toBe(false);
    expect(locationHref("Join at https://zoom.us/j/1 tonight")).toBe("https://zoom.us/j/1");
    expect(locationHref("twitch.tv/gbva")).toBe("https://twitch.tv/gbva");
  });

  it("builds Embed and directions URLs with encoded text", () => {
    expect(mapsEmbedUrl("KEY", " Café Rio, Herndon VA ")).toBe(
      "https://www.google.com/maps/embed/v1/place?key=KEY&q=Caf%C3%A9+Rio%2C+Herndon+VA",
    );
    expect(directionsUrl("Marine Corps Museum")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Marine+Corps+Museum",
    );
    expect(directionsUrl("Marine Corps Museum", { lat: 38.5, lng: -77.3 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Marine+Corps+Museum&origin=38.5%2C-77.3",
    );
  });
});
