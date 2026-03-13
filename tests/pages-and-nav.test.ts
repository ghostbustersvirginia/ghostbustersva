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

  it("throws when CMS settings collection is empty", async () => {
    getCollectionMock.mockResolvedValue([]);

    await expect(getSiteSettings()).rejects.toThrow("[settings] Missing required site settings");
  });
});

describe("page copy helper", () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it("returns matching page copy entry", async () => {
    getCollectionMock.mockResolvedValue([
      {
        id: "home",
        data: { page: "home", heroTitleText: "Welcome", heroTitleAccent: "Home" },
      },
      { id: "about", data: { page: "about", pageTitle: "About" } },
    ]);

    const copy = await getPageCopy("home");
    expect(copy).not.toBeNull();
    expect(copy.heroTitleText).toBe("Welcome");
    expect(copy.heroTitleAccent).toBe("Home");
  });

  it("throws for missing page slug", async () => {
    getCollectionMock.mockResolvedValue([
      {
        id: "home",
        data: { page: "home", heroTitleText: "Welcome", heroTitleAccent: "Home" },
      },
    ]);

    await expect(getPageCopy("about")).rejects.toThrow(
      '[page-copy] Missing required entry for page "about"',
    );
  });

  it("throws when collection fails to load", async () => {
    getCollectionMock.mockRejectedValue(new Error("Collection not found"));

    await expect(getPageCopy("home")).rejects.toThrow("Collection not found");
  });
});
