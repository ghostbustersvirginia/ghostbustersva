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
import { getSafeCmsHref, getSafeImageAssetPath } from "./links";

export type NavItemGroup = "primary" | "more";

export interface NavItem {
  label: string;
  href: string;
  external: boolean;
  group: NavItemGroup;
}

export interface FooterLogo {
  src: string;
  alt: string;
}

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  donateUrl: string;
  paypalUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactFormActionUrl: string;
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
  footerDisclaimerText: string;
  reducedMotionToggleLabel: string;
  reducedMotionToggleTitle: string;
  reducedMotionToggleEnabledLabel: string;
}

/** Default nav items derived from the static siteConfig. */
const defaultNavItems: NavItem[] = siteConfig.nav.map((n) => ({
  label: n.label,
  href: n.href,
  external: false,
  group: "primary",
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
      ? d.navItems
          .map((n: { label: string; href: string; external?: boolean; group?: NavItemGroup }) => {
            const href = getSafeCmsHref(n.href);
            if (!href) return null;

            return {
              label: n.label,
              href,
              external: n.external ?? false,
              group: n.group === "more" ? "more" : "primary",
            };
          })
          .filter((item): item is NavItem => Boolean(item))
      : defaultNavItems;

  const safeNavLogo = getSafeImageAssetPath(d.navLogo) || "/images/logo.png";
  const safeFooterLogos =
    d.footerLogos && d.footerLogos.length > 0
      ? d.footerLogos
          .map((logo: { src: string; alt: string }) => {
            const src = getSafeImageAssetPath(logo.src);
            if (!src) return null;
            return {
              src,
              alt: logo.alt,
            };
          })
          .filter((logo): logo is FooterLogo => Boolean(logo))
      : [];

  return {
    siteName: d.siteName || siteConfig.title,
    siteDescription: d.siteDescription || siteConfig.description,
    donateUrl: d.donateUrl ?? "",
    paypalUrl: d.paypalUrl ?? "",
    contactEmail: d.contactEmail ?? "",
    contactPhone: d.contactPhone ?? "",
    contactFormActionUrl: d.contactFormActionUrl ?? "",
    ledScrollbarText: d.ledScrollbarText ?? "",
    socialLinks: d.socialLinks ?? [],
    navLogo: safeNavLogo,
    navTitle: d.navTitle || "Ghostbusters",
    navSubtitle: d.navSubtitle || "Virginia",
    navItems: coreNavItems,
    footerCopyrightText: d.footerCopyrightText || d.footerText || siteConfig.copyright,
    codeOfConductUrl: d.codeOfConductUrl || "/code-of-conduct",
    codeOfConductLabel: d.codeOfConductLabel || "Code of Conduct",
    footerLogos: safeFooterLogos.length > 0 ? safeFooterLogos : defaultFooterLogos,
    footerDisclaimerText: d.footerDisclaimerText || "",
    reducedMotionToggleLabel: d.reducedMotionToggleLabel || "",
    reducedMotionToggleTitle: d.reducedMotionToggleTitle || "",
    reducedMotionToggleEnabledLabel: d.reducedMotionToggleEnabledLabel || "",
  };
}
