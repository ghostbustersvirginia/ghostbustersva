/**
 * CMS settings helper — loads site settings from the Keystatic-managed
 * content collection, with a safe fallback to src/config.ts defaults.
 *
 * Usage in .astro files:
 *   import { getSiteSettings } from "../lib/settings";
 *   const settings = await getSiteSettings();
 *
 * PRD 012: Keystatic CMS Integration
 */
import { getCollection } from "astro:content";
import { siteConfig } from "../config";

export interface NavItem {
  label: string;
  href: string;
  external: boolean;
}

export interface FooterLogo {
  src: string;
  alt: string;
}

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  donateUrl: string;
  storeUrl: string;
  contactEmail: string;
  socialLinks: { platform: string; url: string }[];
  // Navbar
  navLogo: string;
  navTitle: string;
  navSubtitle: string;
  navItems: NavItem[];
  // Footer
  footerCopyrightText: string;
  codeOfConductUrl: string;
  codeOfConductLabel: string;
  footerLogos: FooterLogo[];
}

/** Default nav items derived from the static siteConfig. */
const defaultNavItems: NavItem[] = siteConfig.nav.map((n) => ({
  label: n.label,
  href: n.href,
  external: false,
}));

/** Default footer logos from siteConfig. */
const defaultFooterLogos: FooterLogo[] = siteConfig.footerLogos.map((l) => ({
  src: l.src,
  alt: l.alt,
}));

/**
 * Load CMS-managed site settings. Falls back to siteConfig defaults
 * if the settings collection is empty or fails to load.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const entries = await getCollection("settings");
    const entry = entries[0];
    if (entry) {
      const d = entry.data;
      return {
        siteName: d.siteName || siteConfig.title,
        siteDescription: d.siteDescription || siteConfig.description,
        donateUrl: d.donateUrl ?? "",
        storeUrl: d.storeUrl ?? "",
        contactEmail: d.contactEmail ?? "",
        socialLinks: d.socialLinks ?? [],
        // Navbar — fall back to static config when CMS array is empty
        navLogo: d.navLogo || "/images/logo.png",
        navTitle: d.navTitle || "Ghostbusters",
        navSubtitle: d.navSubtitle || "Virginia",
        navItems:
          d.navItems && d.navItems.length > 0
            ? d.navItems.map((n: { label: string; href: string; external?: boolean }) => ({
                label: n.label,
                href: n.href,
                external: n.external ?? false,
              }))
            : defaultNavItems,
        // Footer
        footerCopyrightText: d.footerCopyrightText || d.footerText || siteConfig.copyright,
        codeOfConductUrl: d.codeOfConductUrl || "/code-of-conduct",
        codeOfConductLabel: d.codeOfConductLabel || "Code of Conduct",
        footerLogos: d.footerLogos && d.footerLogos.length > 0 ? d.footerLogos : defaultFooterLogos,
      };
    }
  } catch {
    // Fallback silently — CMS data may not be available during build
  }

  return {
    siteName: siteConfig.title,
    siteDescription: siteConfig.description,
    donateUrl: "",
    storeUrl: "",
    contactEmail: "",
    socialLinks: [],
    navLogo: "/images/logo.png",
    navTitle: "Ghostbusters",
    navSubtitle: "Virginia",
    navItems: defaultNavItems,
    footerCopyrightText: siteConfig.copyright,
    codeOfConductUrl: "/code-of-conduct",
    codeOfConductLabel: "Code of Conduct",
    footerLogos: defaultFooterLogos,
  };
}
