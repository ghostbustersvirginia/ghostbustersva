import { describe, it, expect } from "vitest";
import { siteConfig } from "../src/config";
import siteSettings from "../src/content/settings/site.json";

describe("siteConfig", () => {
  it("has a non-empty title", () => {
    expect(siteConfig.title).toBeTruthy();
  });

  it("footer logos include both required images", () => {
    const alts = siteConfig.footerLogos.map((l) => l.alt);
    expect(alts).toContain("Ghost Corps Certified Franchise");
    expect(alts).toContain("IRS 501(c)(3) non-profit organization");
  });
});

describe("site.json navItems", () => {
  it("nav contains About link", () => {
    const about = siteSettings.navItems.find((n) => n.label === "About");
    expect(about).toBeDefined();
    expect(about?.href).toBe("/about");
  });

  it("nav contains all expected links", () => {
    const labels = siteSettings.navItems.map((n) => n.label);
    expect(labels).toContain("About");
    expect(labels).toContain("Join");
    expect(labels).toContain("Events");
    expect(labels).toContain("Press");
    expect(labels).toContain("Contact");
    expect(labels).toContain("Donate");
  });
});
