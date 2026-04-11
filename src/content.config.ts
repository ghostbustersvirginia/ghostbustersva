/**
 * Astro Content Collections configuration.
 *
 * Defines schemas for markdown-based content (events, gallery)
 * and data-only content (settings, videos, and news).
 * See: https://docs.astro.build/en/guides/content-collections/
 */
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { isApprovedInternalPath, isSafeHref, isSafeExternalUrl } from "./lib/links";

const safeExternalUrl = z
  .string()
  .url()
  .refine((value) => isSafeExternalUrl(value), "URLs must use http:// or https:// protocols.");

const safeInternalPath = z
  .string()
  .trim()
  .refine(
    (value) => isApprovedInternalPath(value),
    "Use an internal path beginning with / (for example: /about).",
  );

const safeHref = z
  .string()
  .trim()
  .refine(
    (value) => isSafeHref(value),
    "Use an internal path or an allowed protocol (https, http, mailto, tel).",
  );

const events = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** ISO date string, e.g. "2026-04-15" */
      date: z.coerce.date(),
      /** Optional end date for multi-day events */
      endDate: z.coerce.date().optional(),
      /** Short summary shown in list views */
      summary: z.string(),
      /** Optional location / venue */
      location: z.string().optional(),
      /** Optional street address */
      address: z.string().optional(),
      /** Optional local content image (Astro image() schema) */
      image: image().optional(),
      /** Optional external URL for the event (http/https only) */
      url: safeExternalUrl.optional(),
      /**
       * Optional explicit event status override.
       * If omitted or empty, status is derived from date/endDate at build time.
       * Empty string is treated as undefined.
       */
      status: z
        .union([z.enum(["upcoming", "past"]), z.literal("")])
        .optional()
        .transform((val) => (val === "" ? undefined : val)),
      /**
       * Legacy status flag retained for backwards compatibility.
       * Prefer `status` for explicit overrides.
       */
      past: z.boolean().optional(),
    }),
});

const gallery = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Local content image (Astro image() schema) */
      image: image(),
      alt: z.string(),
      /** Optional date the photo was taken */
      date: z.coerce.date().optional(),
    }),
});

/** Site settings singleton stored as JSON at src/content/settings/site.json. */
const settings = defineCollection({
  loader: glob({ pattern: "site.json", base: "src/content/settings" }),
  schema: z.object({
    siteName: z.string(),
    siteDescription: z.string(),
    donateUrl: z
      .union([safeExternalUrl, z.literal("")])
      .optional()
      .transform((val) => (val === "" ? undefined : val)),
    paypalUrl: z
      .union([safeExternalUrl, z.literal("")])
      .optional()
      .transform((val) => (val === "" ? undefined : val)),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    contactFormActionUrl: safeExternalUrl.optional(),
    ledScrollbarText: z.string().optional(),
    socialLinks: z
      .array(
        z.object({
          platform: z.string(),
          url: safeExternalUrl,
        }),
      )
      .optional()
      .default([]),
    reducedMotionToggleLabel: z.string().optional(),
    reducedMotionToggleTitle: z.string().optional(),
    reducedMotionToggleEnabledLabel: z.string().optional(),

    // Navbar
    navLogo: z.string().optional(),
    navTitle: z.string().optional(),
    navSubtitle: z.string().optional(),
    navItems: z
      .array(
        z.object({
          label: z.string(),
          href: safeHref,
          external: z.boolean().optional().default(false),
          group: z.enum(["primary", "more"]).optional().default("primary"),
        }),
      )
      .optional()
      .default([]),

    // Footer
    footerCopyrightText: z.string().optional(),
    codeOfConductUrl: safeInternalPath.optional(),
    codeOfConductLabel: z.string().optional(),
    footerLogos: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
        }),
      )
      .optional()
      .default([]),
    footerDisclaimerText: z.string().optional(),

    // Legacy field — kept for backwards compat, prefer footerCopyrightText
    footerText: z.string().optional(),
  }),
});

/** Videos collection — YouTube videos shown on the Press page. */
const videos = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/videos" }),
  schema: z.object({
    title: z.string(),
    youtubeId: z.string(),
    date: z.string().optional(),
  }),
});

/** News collection — press/news links shown on the Press page. */
const news = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string().optional(),
    url: z.string().url(),
    source: z.string(),
    image: z.string().optional(),
    excerpt: z.string(),
  }),
});

const homePageCopy = z.object({
  page: z.literal("home"),
  heroTitleText: z.string(),
  heroTitleAccent: z.string(),
  heroTagline: z.string(),
  heroLogoSrc: z.string().optional(),
  heroLogoAlt: z.string().optional(),
  missionHeading: z.string().optional(),
  missionSubtitle: z.string().optional(),
  missionBody: z.string().optional(),
  impactStats: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        countTarget: z.string().optional(),
        countSuffix: z.string().optional(),
      }),
    )
    .optional(),
  impactStatsAriaLabel: z.string().optional(),
  galleryHeading: z.string().optional(),
  gallerySubtitle: z.string().optional(),
  eventsHeading: z.string().optional(),
  eventsSubtitle: z.string().optional(),
  noUpcomingEventsTitle: z.string().optional(),
  noUpcomingEventsBody: z.string().optional(),
  noUpcomingEventsContactText: z.string().optional(),
  noUpcomingEventsContactHref: safeInternalPath.optional(),
  eventsCtaLabel: z.string().optional(),
  eventsCtaHref: safeInternalPath.optional(),
  galleryCtaLabel: z.string().optional(),
  galleryCtaHref: safeInternalPath.optional(),
  joinHeading: z.string().optional(),
  joinSubtitle: z.string().optional(),
  joinImage: z.string().optional(),
  joinImageAlt: z.string().optional(),
  joinQuoteLineOne: z.string().optional(),
  joinQuoteLineTwo: z.string().optional(),
  joinCtaLabel: z.string().optional(),
  joinCtaHref: safeInternalPath.optional(),
  supportHeading: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const aboutPageCopy = z.object({
  page: z.literal("about"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  whoWeAreBodyOne: z.string().optional(),
  whoWeAreBodyTwo: z.string().optional(),
  whoWeAreBodyThree: z.string().optional(),
  whoWeAreBodyFour: z.string().optional(),
  missionHeading: z.string().optional(),
  missionCardTitle: z.string().optional(),
  missionItems: z.array(z.string()).min(1),
  missionCtaLabel: z.string().optional(),
  missionCtaHref: safeInternalPath.optional(),
  teamImage: z.string().optional(),
  teamImageAlt: z.string().optional(),
  divisionsImage: z.string().optional(),
  divisionsImageAlt: z.string().optional(),
  communityImage: z.string().optional(),
  communityImageAlt: z.string().optional(),
  togetherImage: z.string().optional(),
  togetherImageAlt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const joinPageCopy = z.object({
  page: z.literal("join"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  quoteLineOne: z.string().optional(),
  quoteLineTwo: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().optional(),
  whatWeLookForHeading: z.string().optional(),
  whatWeLookForText: z.string().optional(),
  whatWeLookForImage: z.string().optional(),
  whatWeLookForImageAlt: z.string().optional(),
  requiredGearHeading: z.string().optional(),
  requiredGearItems: z.array(z.string()).min(1),
  beltGizmoItems: z.array(z.string()).min(1),
  showBeltGizmoSublist: z.boolean().optional().default(true),
  howToApplyHeading: z.string().optional(),
  applyText: z.string().optional(),
  applyLinkLabel: z.string().optional(),
  applyLinkUrl: safeExternalUrl.optional(),
  notePrefix: z.string().optional(),
  noteText: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const eventsPageCopy = z.object({
  page: z.literal("events"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  upcomingHeading: z.string().optional(),
  pastHeading: z.string().optional(),
  noUpcomingEventsTitle: z.string().optional(),
  emptyText: z.string().optional(),
  noUpcomingEventsContactText: z.string().optional(),
  noUpcomingEventsContactHref: safeInternalPath.optional(),
  eventCtaText: z.string().optional(),
  eventCtaLabel: z.string().optional(),
  eventCtaHref: safeInternalPath.optional(),
  showMoreLabel: z.string().optional(),
  showLessLabel: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const pressPageCopy = z.object({
  page: z.literal("press"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  pressKitTitle: z.string().optional(),
  pressKitBody: z.string().optional(),
  pressKitCtaLabel: z.string().optional(),
  charityKitTitle: z.string().optional(),
  charityKitBody: z.string().optional(),
  charityKitCtaLabel: z.string().optional(),
  pressKitHeading: z.string().optional(),
  galleryHeading: z.string().optional(),
  newsHeading: z.string().optional(),
  showMoreGalleryLabel: z.string().optional(),
  showLessGalleryLabel: z.string().optional(),
  showMoreNewsLabel: z.string().optional(),
  showLessNewsLabel: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const contactPageCopy = z.object({
  page: z.literal("contact"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  showLedScrollbar: z.boolean().optional(),
  ledPlacement: z.enum(["after-social", "before-booking"]).optional(),
  bookingHeading: z.string().optional(),
  bookingSectionHeading: z.string().optional(),
  contactFormDescription: z.string().optional(),
  contactFormSubmitLabel: z.string().optional(),
  bookingImage: z.string().optional(),
  bookingImageAlt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const donatePageCopy = z.object({
  page: z.literal("donate"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  donationHeading: z.string().optional(),
  donationText: z.string().optional(),
  donationCardHeading: z.string().optional(),
  donationItems: z.array(z.string()).min(1).optional(),
  donationCtaLabel: z.string().optional(),
  donationImage: z.string().optional(),
  donationImageAlt: z.string().optional(),
  communityHeading: z.string().optional(),
  communityText: z.string().optional(),
  communityCtaLabel: z.string().optional(),
  communityCtaHref: safeInternalPath.optional(),
  communityImage: z.string().optional(),
  communityImageAlt: z.string().optional(),
  volunteerHeading: z.string().optional(),
  volunteerText: z.string().optional(),
  volunteerCtaLabel: z.string().optional(),
  volunteerCtaHref: safeInternalPath.optional(),
  volunteerImage: z.string().optional(),
  volunteerImageAlt: z.string().optional(),
  initiativeHeading: z.string().optional(),
  initiativeTitle: z.string().optional(),
  initiativeText: z.string().optional(),
  initiativeDetailText: z.string().optional(),
  initiativeLinkLabel: z.string().optional(),
  initiativeLinkUrl: safeExternalUrl.optional(),
  initiativeImage: z.string().optional(),
  initiativeImageAlt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const codeOfConductPageCopy = z.object({
  page: z.literal("code-of-conduct"),
  pageTitle: z.string(),
  pageIntro: z.string(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string(),
      }),
    )
    .min(1),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const pageCopy = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/page-copy" }),
  schema: z.discriminatedUnion("page", [
    homePageCopy,
    aboutPageCopy,
    joinPageCopy,
    eventsPageCopy,
    pressPageCopy,
    contactPageCopy,
    donatePageCopy,
    codeOfConductPageCopy,
  ]),
});

export const collections = { events, gallery, videos, news, settings, pageCopy };
