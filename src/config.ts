/**
 * Centralised site configuration.
 * Edit values here instead of scattering magic strings across components.
 */

export const siteConfig = {
  title: "Ghostbusters Virginia",
  description:
    "Virginia's community Ghostbusters franchise — events, media, and how to join the team.",
  copyright: `© ${new Date().getFullYear()} Ghostbusters Virginia. All rights reserved.`,

  /** Navigation links shown in the header (and optionally the footer). */
  nav: [
    { label: "About", href: "/about" },
    { label: "Join", href: "/join" },
    { label: "Events", href: "/events" },
    { label: "Media", href: "/media" },
    { label: "Contact", href: "/contact" },
    { label: "Donate", href: "/donate" },
  ],

  /** Footer logo images — paths relative to /images */
  footerLogos: [
    {
      src: "/images/sony-ghost-corps-franchise-letter.png",
      alt: "Ghost Corps Certified Franchise",
    },
    {
      src: "/images/irs-501c3-determination-letter.png",
      alt: "IRS 501(c)(3) non-profit organization",
    },
  ],
} as const;
