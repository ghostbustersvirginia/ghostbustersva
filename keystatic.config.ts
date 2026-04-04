/**
 * Keystatic CMS configuration.
 * PRD 012: Keystatic CMS Integration
 *
 * Defines collections and singletons that mirror existing Astro content
 * collections, enabling non-technical users to manage content via a
 * browser-based admin UI at /keystatic.
 *
 * @see https://keystatic.com/docs/configuration
 */
import { config, fields, collection, singleton } from "@keystatic/core";

const keystaticGithubRepo = import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO;
const keystaticBranchPrefix = import.meta.env.PUBLIC_KEYSTATIC_BRANCH_PREFIX;

const parseGithubRepo = (value: string) => {
  const [owner, name] = value.split("/");
  if (!owner || !name) return null;
  return { owner, name };
};

const githubRepoConfig = keystaticGithubRepo ? parseGithubRepo(keystaticGithubRepo) : null;

const internalPathValidation = {
  pattern: {
    regex: /^\/(?!\/)[^\s]*$/,
    message: "Use an internal path that begins with / (for example: /about).",
  },
};

const cmsHrefValidation = {
  pattern: {
    regex: /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+)$/,
    message: "Use an internal path (/path) or an allowed URL protocol (https, http, mailto, tel).",
  },
};

// Validation for external HTTPS-only links used for public CTA fields.
const externalHttpsValidation = {
  pattern: {
    regex: /^https:\/\/[^\s]+$/,
    message: "Use a secure external URL starting with https://",
  },
};

const storage = githubRepoConfig
  ? {
      kind: "github" as const,
      repo: githubRepoConfig,
      ...(keystaticBranchPrefix ? { branchPrefix: keystaticBranchPrefix } : {}),
    }
  : {
      kind: "local" as const,
    };

export default config({
  storage,
  ui: {
    brand: { name: "Ghostbusters Virginia CMS" },
    navigation: {
      Content: ["events", "gallery", "videos", "news"],
      Pages: [
        "homePageCopy",
        "aboutPageCopy",
        "joinPageCopy",
        "eventsPageCopy",
        "pressPageCopy",
        "contactPageCopy",
        "donatePageCopy",
        "codeOfConductPageCopy",
      ],
      Settings: ["settings"],
    },
  },
  collections: {
    /**
     * Events collection — mirrors src/content/events/ and the Zod schema
     * in src/content.config.ts.
     *
     * No body/content field — editors use structured fields only.
     * The events page renders title, date, location, summary, and image.
     */
    events: collection({
      label: "Events",
      slugField: "title",
      path: "src/content/events/*",
      format: { contentField: "body" },
      entryLayout: "form",
      columns: ["date", "location", "status"],
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "Event name displayed in listings and the page heading.",
            validation: { isRequired: true },
          },
        }),
        date: fields.date({
          label: "Date",
          description: "Event start date (YYYY-MM-DD).",
          validation: { isRequired: true },
        }),
        endDate: fields.date({
          label: "End Date",
          description: "Optional end date for multi-day events.",
        }),
        summary: fields.text({
          label: "Summary",
          description: "Short summary shown in event list views.",
          multiline: true,
          validation: { isRequired: true },
        }),
        location: fields.text({
          label: "Location",
          description: "Venue name and city (e.g. 'Richmond Raceway, Richmond, VA').",
        }),
        address: fields.text({
          label: "Address",
          description: "Optional street address for the venue.",
        }),
        image: fields.image({
          label: "Event Image",
          description: "Upload an image for this event.",
          directory: "public/images/events",
          publicPath: "/images/events/",
        }),
        url: fields.url({
          label: "Event URL",
          description: "External link to the event page (e.g. Facebook event).",
        }),
        status: fields.select({
          label: "Status",
          description:
            "Explicit status override. If left as 'Auto (date-based)', status is derived from the event date at build time.",
          options: [
            { label: "Auto (date-based)", value: "" },
            { label: "Upcoming", value: "upcoming" },
            { label: "Past", value: "past" },
          ],
          defaultValue: "",
        }),
        past: fields.checkbox({
          label: "Legacy Past Flag",
          description:
            "Legacy flag for backwards compatibility. Prefer using the Status field above.",
          defaultValue: false,
        }),
        body: fields.markdoc({
          label: "Extra Details (optional)",
          description:
            "Optional notes. This content is kept for CMS markdown compatibility and is not displayed on the site.",
          extension: "md",
        }),
      },
    }),

    /**
     * Gallery collection — photo gallery entries shown on the Media page.
     *
     * Form-only layout — editors fill in structured fields, no free-form body.
     */
    gallery: collection({
      label: "Gallery",
      slugField: "title",
      path: "src/content/gallery/*",
      format: { contentField: "body" },
      entryLayout: "form",
      columns: ["image", "alt", "date"],
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "Caption or title for this gallery entry.",
            validation: { isRequired: true },
          },
        }),
        image: fields.image({
          label: "Gallery Image",
          description: "Upload a photo for the gallery.",
          directory: "public/images/gallery",
          publicPath: "/images/gallery/",
          validation: { isRequired: true },
        }),
        alt: fields.text({
          label: "Alt Text",
          description: "Accessible description of the image for screen readers.",
          validation: { isRequired: true },
        }),
        date: fields.date({
          label: "Date",
          description: "Optional date the photo was taken.",
        }),
        body: fields.markdoc({
          label: "Extra Details (optional)",
          description:
            "Optional notes. This content is kept for CMS markdown compatibility and is not displayed on the site.",
          extension: "md",
        }),
      },
    }),

    /**
     * Videos collection — YouTube videos shown in the Videos section
     * of the Media page. Replaces the hardcoded array.
     */
    videos: collection({
      label: "Videos",
      slugField: "title",
      path: "src/content/videos/*",
      format: { data: "json" },
      columns: ["youtubeId"],
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "Video title displayed below the thumbnail.",
            validation: { isRequired: true },
          },
        }),
        youtubeId: fields.text({
          label: "YouTube Video ID",
          description:
            "The ID from the YouTube URL. For https://www.youtube.com/watch?v=nkb_sAiDSRU, the ID is 'nkb_sAiDSRU'.",
          validation: { isRequired: true },
        }),
        date: fields.date({
          label: "Date",
          description: "When the video was published. Used for sorting (newest first).",
        }),
      },
    }),

    /**
     * News collection — press/news links shown in the "In the News"
     * section of the Media page. Replaces the hardcoded array.
     */
    news: collection({
      label: "News",
      slugField: "title",
      path: "src/content/news/*",
      format: { data: "json" },
      columns: ["source", "date"],
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "Headline of the news article or feature.",
            validation: { isRequired: true },
          },
        }),
        date: fields.date({
          label: "Date",
          description: "Publication date (YYYY-MM-DD).",
          validation: { isRequired: true },
        }),
        location: fields.text({
          label: "Location",
          description: "Where the story is about (e.g. 'Woodbridge, Va.').",
        }),
        url: fields.url({
          label: "Article URL",
          description: "Link to the original article or post.",
          validation: { isRequired: true },
        }),
        source: fields.text({
          label: "Source",
          description: "Publication name (e.g. '13 News Now', 'Facebook').",
          validation: { isRequired: true },
        }),
        image: fields.image({
          label: "Thumbnail Image",
          description: "Thumbnail shown next to the news link.",
          directory: "public/images/news",
          publicPath: "/images/news/",
        }),
        excerpt: fields.text({
          label: "Excerpt",
          description: "A short snippet from the article.",
          multiline: true,
          validation: { isRequired: true },
        }),
      },
    }),
  },

  singletons: {
    homePageCopy: singleton({
      label: "Home Page",
      path: "src/content/page-copy/home",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "home" }),
        heroTitleText: fields.text({
          label: "Hero Title Text",
          description: "Main heading text before the visual accent.",
          validation: { isRequired: true },
        }),
        heroTitleAccent: fields.text({
          label: "Hero Title Accent",
          description: "Accented heading text displayed in highlighted style.",
          validation: { isRequired: true },
        }),
        heroTagline: fields.text({
          label: "Hero Tagline",
          multiline: true,
          validation: { isRequired: true },
        }),
        heroLogoSrc: fields.text({
          label: "Hero Logo Path",
          description: "Path to the logo image in the hero section (e.g. /images/logo.png).",
        }),
        heroLogoAlt: fields.text({ label: "Hero Logo Alt Text" }),
        missionHeading: fields.text({ label: "Mission Heading" }),
        missionSubtitle: fields.text({ label: "Mission Subtitle", multiline: true }),
        missionBody: fields.text({ label: "Mission Body", multiline: true }),
        impactStats: fields.array(
          fields.object({
            value: fields.text({
              label: "Value",
              description: "Display value (e.g. '2001', '501c3', '50+').",
              validation: { isRequired: true },
            }),
            label: fields.text({
              label: "Label",
              description: "Description below the number.",
              validation: { isRequired: true },
            }),
            countTarget: fields.text({
              label: "Count Target",
              description:
                "Numeric target for count-up animation (leave empty for non-numeric stats).",
            }),
            countSuffix: fields.text({
              label: "Count Suffix",
              description: "Suffix appended after count animation (e.g. '+').",
            }),
          }),
          {
            label: "Impact Stats",
            description: "Key metrics displayed in the mission section.",
            itemLabel: (props) => props.fields.label.value || "Stat",
          },
        ),
        impactStatsAriaLabel: fields.text({
          label: "Impact Stats Aria Label",
          description: "Screen reader label for the impact stats section.",
        }),
        galleryHeading: fields.text({ label: "Gallery Heading" }),
        gallerySubtitle: fields.text({ label: "Gallery Subtitle", multiline: true }),
        galleryCtaLabel: fields.text({ label: "Gallery CTA Label" }),
        galleryCtaHref: fields.text({
          label: "Gallery CTA URL",
          validation: internalPathValidation,
        }),
        eventsHeading: fields.text({ label: "Events Heading" }),
        eventsSubtitle: fields.text({ label: "Events Subtitle", multiline: true }),
        noUpcomingEventsTitle: fields.text({
          label: "No Events Card Title",
          description: "Shown on the Home page only when there are no active or upcoming events.",
        }),
        noUpcomingEventsBody: fields.text({
          label: "No Events Card Body",
          description: "Shown on the Home page only when there are no active or upcoming events.",
          multiline: true,
        }),
        noUpcomingEventsContactText: fields.text({
          label: "No Events Card Contact Text",
          description: "Shown on the Home page only when there are no active or upcoming events.",
          multiline: true,
        }),
        noUpcomingEventsContactHref: fields.text({
          label: "No Events Card Contact URL",
          description:
            "Link used in the No Events card; shown only when there are no active or upcoming events.",
          validation: internalPathValidation,
        }),
        eventsCtaLabel: fields.text({ label: "Events CTA Label" }),
        eventsCtaHref: fields.text({
          label: "Events CTA URL",
          validation: internalPathValidation,
        }),
        joinHeading: fields.text({ label: "Join Heading" }),
        joinSubtitle: fields.text({ label: "Join Subtitle", multiline: true }),
        joinImage: fields.image({
          label: "Join Section Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        joinImageAlt: fields.text({ label: "Join Section Image Alt" }),
        joinQuoteLineOne: fields.text({ label: "Join Quote Line 1", multiline: true }),
        joinQuoteLineTwo: fields.text({ label: "Join Quote Line 2", multiline: true }),
        joinCtaLabel: fields.text({ label: "Join CTA Label" }),
        joinCtaHref: fields.text({
          label: "Join CTA URL",
          validation: internalPathValidation,
        }),
        supportHeading: fields.text({ label: "Support Section Heading" }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    aboutPageCopy: singleton({
      label: "About Page",
      path: "src/content/page-copy/about",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "about" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        whoWeAreBodyOne: fields.text({ label: "Who We Are — Paragraph 1", multiline: true }),
        whoWeAreBodyTwo: fields.text({ label: "Who We Are — Paragraph 2", multiline: true }),
        whoWeAreBodyThree: fields.text({ label: "Who We Are — Paragraph 3", multiline: true }),
        whoWeAreBodyFour: fields.text({ label: "Who We Are — Paragraph 4", multiline: true }),
        teamImage: fields.image({
          label: "Who We Are Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        teamImageAlt: fields.text({ label: "Who We Are Image Alt Text" }),
        divisionsImage: fields.image({
          label: "Divisions Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        divisionsImageAlt: fields.text({ label: "Divisions Image Alt Text" }),
        communityImage: fields.image({
          label: "Community Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        communityImageAlt: fields.text({ label: "Community Image Alt Text" }),
        togetherImage: fields.image({
          label: "Together Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        togetherImageAlt: fields.text({ label: "Together Image Alt Text" }),
        missionHeading: fields.text({ label: "Mission Section Heading" }),
        missionCardTitle: fields.text({ label: "Mission Card Title" }),
        missionItems: fields.array(fields.text({ label: "Mission Item" }), {
          label: "Mission Items",
          itemLabel: (props) => props.value || "Item",
        }),
        missionCtaLabel: fields.text({ label: "Mission CTA Label" }),
        missionCtaHref: fields.text({
          label: "Mission CTA URL",
          validation: internalPathValidation,
        }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    joinPageCopy: singleton({
      label: "Join Page",
      path: "src/content/page-copy/join",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "join" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        quoteLineOne: fields.text({ label: "Quote Line 1", multiline: true }),
        quoteLineTwo: fields.text({ label: "Quote Line 2", multiline: true }),
        heroImage: fields.image({
          label: "How To Apply Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        heroImageAlt: fields.text({ label: "How To Apply Image Alt Text" }),
        whatWeLookForHeading: fields.text({ label: "What We Look For Heading" }),
        whatWeLookForText: fields.text({ label: "What We Look For Text", multiline: true }),
        whatWeLookForImage: fields.image({
          label: "What We Look For Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        whatWeLookForImageAlt: fields.text({ label: "What We Look For Image Alt Text" }),
        requiredGearHeading: fields.text({ label: "Required Gear Heading" }),
        requiredGearItems: fields.array(fields.text({ label: "Required Gear Item" }), {
          label: "Required Gear Items",
          itemLabel: (props) => props.value || "Item",
        }),
        beltGizmoItems: fields.array(fields.text({ label: "Belt Gizmo Item" }), {
          label: "Belt Gizmo Items",
          itemLabel: (props) => props.value || "Item",
        }),
        showBeltGizmoSublist: fields.checkbox({
          label: "Show Belt Gizmo Sub-list",
          description: "Show the belt gizmo sub-list below the required gear list.",
          defaultValue: true,
        }),
        howToApplyHeading: fields.text({ label: "How to Apply Heading" }),
        applyText: fields.text({ label: "Apply Section Text", multiline: true }),
        applyLinkLabel: fields.text({ label: "Apply Link Label" }),
        applyLinkUrl: fields.url({ label: "Apply Link URL" }),
        notePrefix: fields.text({
          label: "Note Prefix",
          description: "Bold prefix text for the background check note (e.g. 'Please Note:').",
        }),
        noteText: fields.text({ label: "Background Check Note", multiline: true }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    eventsPageCopy: singleton({
      label: "Events Page",
      path: "src/content/page-copy/events",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "events" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        upcomingHeading: fields.text({ label: "Upcoming Events Heading" }),
        pastHeading: fields.text({ label: "Past Events Heading" }),
        noUpcomingEventsTitle: fields.text({ label: "No Upcoming Events Title" }),
        emptyText: fields.text({ label: "Empty State Text" }),
        noUpcomingEventsContactText: fields.text({
          label: "No Upcoming Events Contact Text",
          multiline: true,
        }),
        noUpcomingEventsContactHref: fields.text({
          label: "No Upcoming Events Contact URL",
          validation: internalPathValidation,
        }),
        eventCtaText: fields.text({
          label: "Bottom CTA Text",
          multiline: true,
        }),
        eventCtaLabel: fields.text({ label: "Bottom CTA Label" }),
        eventCtaHref: fields.text({
          label: "Bottom CTA URL",
          validation: internalPathValidation,
        }),
        showMoreLabel: fields.text({ label: "Show More Button Label" }),
        showLessLabel: fields.text({ label: "Show Less Button Label" }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    pressPageCopy: singleton({
      label: "Press Page",
      path: "src/content/page-copy/press",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "press" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        pressKitTitle: fields.text({ label: "Press Kit Card Title" }),
        pressKitBody: fields.text({ label: "Press Kit Card Body", multiline: true }),
        pressKitCtaLabel: fields.text({ label: "Press Kit CTA Label" }),
        charityKitTitle: fields.text({ label: "Charity Kit Card Title" }),
        charityKitBody: fields.text({ label: "Charity Kit Card Body", multiline: true }),
        charityKitCtaLabel: fields.text({ label: "Charity Kit CTA Label" }),
        pressKitHeading: fields.text({ label: "Press Kit Section Heading" }),
        galleryHeading: fields.text({ label: "Gallery Heading" }),
        newsHeading: fields.text({ label: "News Heading" }),
        showMoreGalleryLabel: fields.text({ label: "Show More Gallery Label" }),
        showLessGalleryLabel: fields.text({ label: "Show Less Gallery Label" }),
        showMoreNewsLabel: fields.text({ label: "Show More News Label" }),
        showLessNewsLabel: fields.text({ label: "Show Less News Label" }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    contactPageCopy: singleton({
      label: "Contact Page",
      path: "src/content/page-copy/contact",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "contact" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        showLedScrollbar: fields.checkbox({
          label: "Show LED Scrollbar",
          description: "Display the LED marquee on the contact page.",
          defaultValue: true,
        }),
        ledPlacement: fields.select({
          label: "LED Scrollbar Placement",
          description: "Choose where the LED marquee appears on the contact page.",
          options: [
            { label: "After Social Links", value: "after-social" },
            { label: "Before Booking Section", value: "before-booking" },
          ],
          defaultValue: "after-social",
        }),
        bookingHeading: fields.text({ label: "Booking Section Heading" }),
        bookingSectionHeading: fields.text({ label: "Booking Form Section Heading" }),
        contactFormDescription: fields.text({
          label: "Contact Form Description",
          multiline: true,
        }),
        contactFormSubmitLabel: fields.text({ label: "Contact Form Submit Label" }),
        bookingImage: fields.image({
          label: "Booking Section Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        bookingImageAlt: fields.text({ label: "Booking Image Alt Text" }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    donatePageCopy: singleton({
      label: "Donate Page",
      path: "src/content/page-copy/donate",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "donate" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        donationHeading: fields.text({ label: "Donation Section Heading" }),
        donationText: fields.text({ label: "Donation Section Text", multiline: true }),
        donationCardHeading: fields.text({ label: "Donation Card Heading" }),
        donationItems: fields.array(fields.text({ label: "Donation Item" }), {
          label: "Donation Card Items",
          itemLabel: (props) => props.value || "Item",
        }),
        donationCtaLabel: fields.text({ label: "Donate CTA Label" }),
        donationImage: fields.image({
          label: "Donation Section Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        donationImageAlt: fields.text({ label: "Donation Section Image Alt Text" }),
        communityHeading: fields.text({ label: "Community Partners Heading" }),
        communityText: fields.text({ label: "Community Partners Text", multiline: true }),
        communityCtaLabel: fields.text({ label: "Community CTA Label" }),
        communityCtaHref: fields.text({
          label: "Community CTA URL",
          validation: internalPathValidation,
        }),
        communityImage: fields.image({
          label: "Community Partners Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        communityImageAlt: fields.text({ label: "Community Partners Image Alt Text" }),
        volunteerHeading: fields.text({ label: "Volunteer Heading" }),
        volunteerText: fields.text({ label: "Volunteer Text", multiline: true }),
        volunteerCtaLabel: fields.text({ label: "Volunteer CTA Label" }),
        volunteerCtaHref: fields.text({
          label: "Volunteer CTA URL",
          validation: internalPathValidation,
        }),
        volunteerImage: fields.image({
          label: "Volunteer Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        volunteerImageAlt: fields.text({ label: "Volunteer Image Alt Text" }),
        initiativeHeading: fields.text({ label: "Community Initiatives Heading" }),
        initiativeTitle: fields.text({ label: "Initiative Title" }),
        initiativeText: fields.text({ label: "Initiative Intro Text", multiline: true }),
        initiativeDetailText: fields.text({
          label: "Initiative Detail Text",
          multiline: true,
        }),
        initiativeLinkLabel: fields.text({ label: "Initiative CTA Label" }),
        initiativeLinkUrl: fields.text({
          label: "Initiative CTA URL",
          validation: externalHttpsValidation,
        }),
        initiativeImage: fields.image({
          label: "Initiative Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
        initiativeImageAlt: fields.text({ label: "Initiative Image Alt Text" }),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    codeOfConductPageCopy: singleton({
      label: "Code of Conduct",
      path: "src/content/page-copy/code-of-conduct",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "code-of-conduct" }),
        pageTitle: fields.text({ label: "Page Title", validation: { isRequired: true } }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        sections: fields.array(
          fields.object({
            heading: fields.text({
              label: "Heading",
              validation: { isRequired: true },
            }),
            body: fields.text({
              label: "Body",
              multiline: true,
              validation: { isRequired: true },
            }),
          }),
          {
            label: "Sections",
            description: "Each section of the Code of Conduct.",
            itemLabel: (props) => props.fields.heading.value || "Section",
          },
        ),
        metaTitle: fields.text({ label: "Meta Title", description: "Browser tab title." }),
        metaDescription: fields.text({
          label: "Meta Description",
          description: "SEO meta description for search engines.",
          multiline: true,
        }),
        ogTitle: fields.text({
          label: "OG Title",
          description: "Title shown when shared on social media.",
        }),
        ogDescription: fields.text({
          label: "OG Description",
          description: "Description shown when shared on social media.",
          multiline: true,
        }),
        ogImage: fields.image({
          label: "Social Share Image",
          directory: "public/images",
          publicPath: "/images/",
        }),
      },
    }),

    /**
     * Site settings singleton — editable global configuration.
     * Stored as a JSON file so it can be read by components at build time.
     */
    settings: singleton({
      label: "Site Settings",
      path: "src/content/settings/site",
      format: { data: "json" },
      schema: {
        siteName: fields.text({
          label: "Site Name",
          description: "The name of the site displayed in the header and metadata.",
          validation: { isRequired: true },
        }),
        siteDescription: fields.text({
          label: "Site Description",
          description: "Default meta description used across pages.",
          multiline: true,
          validation: { isRequired: true },
        }),
        donateUrl: fields.url({
          label: "Donate URL",
          description: "Link to the donation page or payment processor.",
        }),
        contactEmail: fields.text({
          label: "Contact Email",
          description: "Public contact email address.",
        }),
        contactPhone: fields.text({
          label: "Contact Phone",
          description: "Public phone number displayed on the contact page.",
        }),
        contactFormActionUrl: fields.text({
          label: "Contact Form Action URL",
          description: "Secure endpoint used by the contact form submission.",
          validation: externalHttpsValidation,
        }),
        ledScrollbarText: fields.text({
          label: "LED Scrollbar Text",
          description:
            "Message shown on the scrolling LED sign on the contact page. Keep it short — it repeats on a loop.",
        }),
        socialLinks: fields.array(
          fields.object({
            platform: fields.text({
              label: "Platform",
              description: "Social media platform name (e.g. Facebook, Instagram, TikTok).",
              validation: { isRequired: true },
            }),
            url: fields.url({
              label: "URL",
              description: "Full URL to the social media profile.",
              validation: { isRequired: true },
            }),
          }),
          {
            label: "Social Links",
            description: "Links to social media profiles.",
            itemLabel: (props) => props.fields.platform.value || "New Link",
          },
        ),

        // ── Navbar ──
        navLogo: fields.text({
          label: "Nav Logo Path",
          description: "Path to the logo image displayed in the header (e.g. /images/logo.png).",
          defaultValue: "/images/logo.png",
        }),
        navTitle: fields.text({
          label: "Nav Title",
          description: "Primary text next to the logo (e.g. 'Ghostbusters').",
          defaultValue: "Ghostbusters",
        }),
        navSubtitle: fields.text({
          label: "Nav Subtitle",
          description: "Secondary text below the title (e.g. 'Virginia').",
          defaultValue: "Virginia",
        }),
        navItems: fields.array(
          fields.object({
            label: fields.text({
              label: "Label",
              description: "Text shown in the navigation.",
              validation: { isRequired: true },
            }),
            href: fields.text({
              label: "URL",
              description: "Link path (e.g. /about) or full URL for external links.",
              validation: { isRequired: true, ...cmsHrefValidation },
            }),
            external: fields.checkbox({
              label: "Opens in New Tab",
              description: "Check if this link goes to an external site.",
              defaultValue: false,
            }),
            group: fields.select({
              label: "Header Group",
              description: "Choose where this link appears in header navigation.",
              options: [
                { label: "Primary", value: "primary" },
                { label: "More Menu", value: "more" },
              ],
              defaultValue: "primary",
            }),
          }),
          {
            label: "Navigation Items",
            description:
              "Links shown in the header and footer navigation. Drag to reorder. Use Header Group to place items in the More menu.",
            itemLabel: (props) => props.fields.label.value || "New Link",
          },
        ),

        // ── Footer ──
        footerCopyrightText: fields.text({
          label: "Footer Copyright Text",
          description: "Copyright or legal text shown in the site footer.",
          multiline: true,
        }),
        codeOfConductUrl: fields.text({
          label: "Code of Conduct URL",
          description: "Path or URL for the Code of Conduct link in the footer.",
          defaultValue: "/code-of-conduct",
          validation: internalPathValidation,
        }),
        codeOfConductLabel: fields.text({
          label: "Code of Conduct Label",
          description: "Link text for the Code of Conduct.",
          defaultValue: "Code of Conduct",
        }),
        footerLogos: fields.array(
          fields.object({
            src: fields.text({
              label: "Image Path",
              description:
                "Path to the logo image (e.g. /images/sony-ghost-corps-franchise-letter.png).",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt Text",
              description: "Accessible description of the logo.",
              validation: { isRequired: true },
            }),
          }),
          {
            label: "Footer Logos",
            description: "Partner/franchise logos displayed in the footer.",
            itemLabel: (props) => props.fields.alt.value || "New Logo",
          },
        ),
        footerDisclaimerText: fields.text({
          label: "Footer Disclaimer Text",
          description: "Trademark/non-affiliation disclaimer shown at the bottom of the footer.",
          multiline: true,
        }),
        reducedMotionToggleLabel: fields.text({
          label: "Reduced Motion Toggle Label",
          description: "Visible label for the reduced motion toggle button.",
        }),
        reducedMotionToggleTitle: fields.text({
          label: "Reduced Motion Toggle Title",
          description: "Tooltip/title attribute for the reduced motion toggle button.",
        }),
        reducedMotionToggleEnabledLabel: fields.text({
          label: "Reduced Motion Enabled Label",
          description: "Label shown when reduced motion mode is enabled.",
        }),
      },
    }),
  },
});
