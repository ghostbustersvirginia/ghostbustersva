import { describe, it, expect } from "vitest";
import { siteConfig } from "../src/config";

describe("siteConfig", () => {
  it("has a non-empty title", () => {
    expect(siteConfig.title).toBeTruthy();
  });

  it("nav contains About link", () => {
    const about = siteConfig.nav.find((n) => n.label === "About");
    expect(about).toBeDefined();
    expect(about?.href).toBe("/about");
  });

  it("nav contains all expected links", () => {
    const labels = siteConfig.nav.map((n) => n.label);
    expect(labels).toContain("About");
    expect(labels).toContain("Join");
    expect(labels).toContain("Events");
    expect(labels).toContain("Press");
    expect(labels).toContain("Contact");
    expect(labels).toContain("Donate");
  });

  it("footer logos include both required images", () => {
    const alts = siteConfig.footerLogos.map((l) => l.alt);
    expect(alts).toContain("Ghost Corps Certified Franchise");
    expect(alts).toContain("IRS 501(c)(3) non-profit organization");
  });
});
