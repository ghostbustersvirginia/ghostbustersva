/**
 * Centralised site configuration.
 * Edit values here instead of scattering magic strings across components.
 */

export const siteConfig = {
  title: "Ghostbusters Virginia",
  description: "",
  copyright: `© ${new Date().getFullYear()} Ghostbusters Virginia. All rights reserved.`,


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
