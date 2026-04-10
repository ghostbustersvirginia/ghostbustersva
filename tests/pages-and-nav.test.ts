import { beforeEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "../src/config";

const { getCollectionMock } = vi.hoisted(() => ({
  getCollectionMock: vi.fn(),
}));

vi.mock("astro:content", () => ({
  getCollection: getCollectionMock,
}));

import { getSiteSettings } from "../src/lib/settings";
import { getPageCopy } from "../src/lib/page-copy";

describe("site settings (no dynamic generated pages)", () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it("returns core nav items from settings content without dynamic page merging", async () => {
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
    // No more dynamic generated pages appended — only core nav items
    expect(settings.navItems.map((item) => item.href)).toEqual(["/about", "/donate"]);
  });

  it("throws when settings collection is empty", async () => {
    getCollectionMock.mockResolvedValue([]);

    await expect(getSiteSettings()).rejects.toThrow("[settings] Missing required site settings");
  });

  it("falls back to safe default logo when navLogo path is invalid", async () => {
    getCollectionMock.mockImplementation(async (name: string) => {
      if (name === "settings") {
        return [
          {
            id: "site",
            data: {
              siteName: "Ghostbusters Virginia",
              siteDescription: "Community charity franchise",
              navItems: [{ label: "About", href: "/about", external: false }],
              navLogo: "javascript:alert(1)",
              socialLinks: [],
              footerLogos: [],
            },
          },
        ];
      }
      return [];
    });

    const settings = await getSiteSettings();
    expect(settings.navLogo).toBe("/images/logo.png");
  });

  it("falls back to default footer logos when all settings logo paths are invalid", async () => {
    getCollectionMock.mockImplementation(async (name: string) => {
      if (name === "settings") {
        return [
          {
            id: "site",
            data: {
              siteName: "Ghostbusters Virginia",
              siteDescription: "Community charity franchise",
              navItems: [{ label: "About", href: "/about", external: false }],
              socialLinks: [],
              footerLogos: [
                { src: "mailto:test@example.com", alt: "Bad 1" },
                { src: "https://example.com/logo.png", alt: "Bad 2" },
              ],
            },
          },
        ];
      }
      return [];
    });

    const settings = await getSiteSettings();
    expect(settings.footerLogos).toEqual(siteConfig.footerLogos);
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
