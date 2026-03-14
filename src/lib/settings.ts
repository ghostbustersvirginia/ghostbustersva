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
  contactPhone: string;
  ledScrollbarText: string;
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
 * for optional values, but fails loudly when required settings content is missing.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const entries = await getCollection("settings");

  if (entries.length === 0) {
    throw new Error(
      "[settings] Missing required site settings entry at src/content/settings/site.json",
    );
  }

  if (entries.length > 1) {
    throw new Error(
      `[settings] Expected exactly one settings entry, found ${entries.length}. Keep only src/content/settings/site.json.`,
    );
  }

  const d = entries[0].data;
  const coreNavItems: NavItem[] =
    d.navItems && d.navItems.length > 0
      ? d.navItems.map((n: { label: string; href: string; external?: boolean }) => ({
          label: n.label,
          href: n.href,
          external: n.external ?? false,
        }))
      : defaultNavItems;

  return {
    siteName: d.siteName || siteConfig.title,
    siteDescription: d.siteDescription || siteConfig.description,
    donateUrl: d.donateUrl ?? "",
    storeUrl: d.storeUrl ?? "",
    contactEmail: d.contactEmail ?? "",
    contactPhone: d.contactPhone ?? "",
    ledScrollbarText: d.ledScrollbarText ?? "",
    socialLinks: d.socialLinks ?? [],
    navLogo: d.navLogo || "/images/logo.png",
    navTitle: d.navTitle || "Ghostbusters",
    navSubtitle: d.navSubtitle || "Virginia",
    navItems: coreNavItems,
    footerCopyrightText: d.footerCopyrightText || d.footerText || siteConfig.copyright,
    codeOfConductUrl: d.codeOfConductUrl || "/code-of-conduct",
    codeOfConductLabel: d.codeOfConductLabel || "Code of Conduct",
    footerLogos: d.footerLogos && d.footerLogos.length > 0 ? d.footerLogos : defaultFooterLogos,
  };
}
