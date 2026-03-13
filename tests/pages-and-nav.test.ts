import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCollectionMock } = vi.hoisted(() => ({
  getCollectionMock: vi.fn(),
}));

vi.mock("astro:content", () => ({
  getCollection: getCollectionMock,
}));

import { getSiteSettings } from "../src/lib/settings";
import { getPageCopy } from "../src/lib/page-copy";

describe("site settings (no dynamic CMS pages)", () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it("returns core nav items from CMS settings without dynamic page merging", async () => {
    getCollectionMock.mockImplementation(async (name: string) => {
      if (name === "settings") {
        return [
          {
            id: "site",
            data: {
              siteName: "Ghostbusters Virginia",
              siteDescription: "Community charity franchise",
              navItems: [
                { label: "About", href: "/about", external: false },
                { label: "Donate", href: "/donate", external: false },
              ],
              socialLinks: [],
              footerLogos: [],
            },
          },
        ];
      }
      return [];
    });

    const settings = await getSiteSettings();
    // No more dynamic CMS pages appended — only core nav items
    expect(settings.navItems.map((item) => item.href)).toEqual(["/about", "/donate"]);
  });

  it("falls back to static config nav items when CMS settings is empty", async () => {
    getCollectionMock.mockResolvedValue([]);

    const settings = await getSiteSettings();
    expect(settings.navItems.length).toBeGreaterThan(0);
    expect(settings.navItems[0].label).toBe("About");
  });
});

describe("page copy helper", () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it("returns matching page copy entry", async () => {
    getCollectionMock.mockResolvedValue([
      { id: "home", data: { page: "home", heroTitle: "Welcome" } },
      { id: "about", data: { page: "about", pageTitle: "About" } },
    ]);

    const copy = await getPageCopy("home");
    expect(copy).not.toBeNull();
    expect(copy?.heroTitle).toBe("Welcome");
  });

  it("returns null for missing page slug", async () => {
    getCollectionMock.mockResolvedValue([
      { id: "home", data: { page: "home", heroTitle: "Welcome" } },
    ]);

    const copy = await getPageCopy("nonexistent");
    expect(copy).toBeNull();
  });

  it("returns null when collection fails to load", async () => {
    getCollectionMock.mockRejectedValue(new Error("Collection not found"));

    const copy = await getPageCopy("home");
    expect(copy).toBeNull();
  });
});
