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
    brand: {
      name: "Ghostbusters Virginia CMS",
    },
    navigation: {
      // Page-copy singletons — editors update titles, intros, and descriptions
      Pages: [
        "homePageCopy",
        "aboutPageCopy",
        "joinPageCopy",
        "eventsPageCopy",
        "mediaPageCopy",
        "contactPageCopy",
        "donatePageCopy",
      ],
      // Collections with entries — events, photos, videos, press links
      Content: ["events", "gallery", "videos", "news"],
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
      columns: ["date", "location"],
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "The name of the event.",
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
            "Optional extra text — currently not shown on the website. Use Summary for the visible description.",
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
      columns: ["alt", "date"],
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
          description: "Optional notes — not currently displayed on the site.",
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
        date: fields.text({
          label: "Date",
          description: "Publication date (e.g. 'November 27, 2024').",
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
    /**
     * About page copy — editable text for the About page.
     */
    aboutPageCopy: singleton({
      label: "About Page",
      path: "src/content/page-copy/about",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "about" }),
        pageTitle: fields.text({
          label: "Page Title",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        missionItems: fields.array(
          fields.text({ label: "Mission Item", validation: { isRequired: true } }),
          { label: "Mission Items", itemLabel: (props) => props.value || "New Item" },
        ),
        protonPetsImage: fields.text({
          label: "Proton Pets Image Path",
          description:
            "Image path relative to / (e.g. /images/news/ghostbusters-virginia-proton-pets-rescue.jpeg).",
        }),
        protonPetsImageAlt: fields.text({
          label: "Proton Pets Image Alt Text",
        }),
        protonPetsText: fields.text({
          label: "Proton Pets Description",
          multiline: true,
        }),
        protonPetsLinkLabel: fields.text({ label: "Proton Pets Link Label" }),
        protonPetsLinkUrl: fields.url({ label: "Proton Pets Link URL" }),
      },
    }),

    /**
     * Join page copy — editable text for the Join page.
     */
    joinPageCopy: singleton({
      label: "Join Page",
      path: "src/content/page-copy/join",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "join" }),
        pageTitle: fields.text({
          label: "Page Title",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        quoteLineOne: fields.text({
          label: "Quote Line 1",
          multiline: true,
        }),
        quoteLineTwo: fields.text({
          label: "Quote Line 2",
          multiline: true,
        }),
        whatWeLookForText: fields.text({
          label: "What We Look For (Intro Text)",
          multiline: true,
        }),
        requiredGearItems: fields.array(
          fields.text({ label: "Gear Item", validation: { isRequired: true } }),
          { label: "Required Gear", itemLabel: (props) => props.value || "New Item" },
        ),
        beltGizmoItems: fields.array(
          fields.text({ label: "Gizmo", validation: { isRequired: true } }),
          { label: "Belt Gizmo Examples", itemLabel: (props) => props.value || "New Item" },
        ),
        applyText: fields.text({
          label: "How to Apply Text",
          multiline: true,
        }),
        applyLinkLabel: fields.text({ label: "Apply Link Label" }),
        applyLinkUrl: fields.url({ label: "Apply Link URL" }),
        noteText: fields.text({
          label: "Background Check Note",
          multiline: true,
        }),
      },
    }),

    /**
     * Events page copy — editable title and intro text for the Events page.
     */
    eventsPageCopy: singleton({
      label: "Events Page",
      path: "src/content/page-copy/events",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "events" }),
        pageTitle: fields.text({
          label: "Page Title",
          defaultValue: "Events",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          description: "Short description shown below the page title.",
          multiline: true,
          defaultValue: "Meet the team, support local charities, and see the Ecto in person.",
          validation: { isRequired: true },
        }),
        upcomingHeading: fields.text({
          label: "Upcoming Section Heading",
          defaultValue: "Upcoming Events",
        }),
        pastHeading: fields.text({
          label: "Past Section Heading",
          defaultValue: "Past Events",
        }),
        emptyText: fields.text({
          label: "Empty State Text",
          description: "Shown when there are no events.",
          defaultValue: "No events yet — check back soon!",
        }),
      },
    }),

    /**
     * Media page copy — editable title and intro text for the Media page.
     */
    mediaPageCopy: singleton({
      label: "Media Page",
      path: "src/content/page-copy/media",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "media" }),
        pageTitle: fields.text({
          label: "Page Title",
          defaultValue: "Media",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          description: "Short description shown below the page title.",
          multiline: true,
          defaultValue:
            "Photos, videos, and press coverage from our events. Click any photo to enlarge.",
          validation: { isRequired: true },
        }),
        videosHeading: fields.text({
          label: "Videos Section Heading",
          defaultValue: "Videos",
        }),
        galleryHeading: fields.text({
          label: "Gallery Section Heading",
          defaultValue: "Photo Gallery",
        }),
        newsHeading: fields.text({
          label: "News Section Heading",
          defaultValue: "In the News",
        }),
      },
    }),

    /**
     * Contact page copy — editable text for the Contact page.
     */
    contactPageCopy: singleton({
      label: "Contact Page",
      path: "src/content/page-copy/contact",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "contact" }),
        pageTitle: fields.text({
          label: "Page Title",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        bookUsText: fields.text({
          label: "Book Us Text",
          multiline: true,
        }),
        serviceAreasText: fields.text({
          label: "Service Areas Intro",
          multiline: true,
        }),
        regions: fields.array(
          fields.object({
            title: fields.text({ label: "Region Title", validation: { isRequired: true } }),
            areas: fields.array(fields.text({ label: "Area", validation: { isRequired: true } }), {
              label: "Areas",
              itemLabel: (props) => props.value || "New Area",
            }),
          }),
          {
            label: "Service Regions",
            itemLabel: (props) => props.fields.title.value || "New Region",
          },
        ),
        ctaCallout: fields.text({ label: "CTA Callout" }),
        ctaAside: fields.text({ label: "CTA Aside" }),
        footnoteText: fields.text({
          label: "Footnote Text",
          multiline: true,
        }),
      },
    }),

    /**
     * Donate page copy — editable text for the Donate page.
     */
    donatePageCopy: singleton({
      label: "Donate Page",
      path: "src/content/page-copy/donate",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "donate" }),
        pageTitle: fields.text({
          label: "Page Title",
          validation: { isRequired: true },
        }),
        pageIntro: fields.text({
          label: "Page Intro",
          multiline: true,
          validation: { isRequired: true },
        }),
        supportPanelText: fields.text({
          label: "Support Panel Text",
          multiline: true,
        }),
        protonPetsText: fields.text({
          label: "Proton Pets Description",
          multiline: true,
        }),
        protonPetsLinkLabel: fields.text({ label: "Proton Pets Link Label" }),
        protonPetsLinkUrl: fields.url({ label: "Proton Pets Link URL" }),
        swagPanelText: fields.text({
          label: "Swag Panel Text",
          multiline: true,
        }),
        swagNote: fields.text({
          label: "Swag Note",
          multiline: true,
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
        storeUrl: fields.url({
          label: "Store URL",
          description: "Link to the merchandise store (e.g. TeePublic).",
        }),
        contactEmail: fields.text({
          label: "Contact Email",
          description: "Public contact email address.",
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
              validation: { isRequired: true },
            }),
            external: fields.checkbox({
              label: "Opens in New Tab",
              description: "Check if this link goes to an external site.",
              defaultValue: false,
            }),
          }),
          {
            label: "Navigation Items",
            description: "Links shown in the header and footer navigation. Drag to reorder.",
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
      },
    }),

    /**
     * Home page copy — editable text for the homepage hero, mission,
     * gallery, events, join, and swag sections.
     */
    homePageCopy: singleton({
      label: "Home Page",
      path: "src/content/page-copy/home",
      format: { data: "json" },
      schema: {
        page: fields.text({ label: "Page ID", defaultValue: "home" }),

        // ── Hero ──
        heroTitle: fields.text({
          label: "Hero Title",
          description: "Main heading displayed over the hero image.",
          validation: { isRequired: true },
        }),
        heroTagline: fields.text({
          label: "Hero Tagline",
          description: "Subtitle text below the hero title.",
          multiline: true,
          validation: { isRequired: true },
        }),
        heroPurposeItems: fields.array(
          fields.text({ label: "Item", validation: { isRequired: true } }),
          {
            label: "Hero Purpose Items",
            description: "Short fact pills displayed below the tagline (e.g. '501c3 Nonprofit').",
            itemLabel: (props) => props.value || "New Item",
          },
        ),
        heroImage: fields.text({
          label: "Hero Background Image",
          description: "Path to the hero background image (e.g. /images/hero.jpg).",
        }),
        heroPrimaryCtaLabel: fields.text({
          label: "Primary CTA Label",
          description: "Text for the primary hero button.",
          defaultValue: "Join the Team",
        }),
        heroPrimaryCtaHref: fields.text({
          label: "Primary CTA URL",
          description: "Link for the primary hero button.",
          defaultValue: "/join",
        }),
        heroSecondaryCtaLabel: fields.text({
          label: "Secondary CTA Label",
          description: "Text for the secondary hero button.",
          defaultValue: "See Our Events",
        }),
        heroSecondaryCtaHref: fields.text({
          label: "Secondary CTA URL",
          description: "Link for the secondary hero button.",
          defaultValue: "/events",
        }),

        // ── Mission ──
        missionHeading: fields.text({
          label: "Mission Heading",
          validation: { isRequired: true },
        }),
        missionSubtitle: fields.text({
          label: "Mission Subtitle",
          multiline: true,
          validation: { isRequired: true },
        }),
        missionBodyParagraphs: fields.array(
          fields.text({
            label: "Paragraph",
            multiline: true,
            validation: { isRequired: true },
          }),
          {
            label: "Mission Body Paragraphs",
            description:
              'Left-column body text. Each item is a paragraph. Supports <strong class="glow"> for emphasis.',
            itemLabel: (props) => (props.value || "New Paragraph").slice(0, 60),
          },
        ),
        missionListItems: fields.array(
          fields.text({ label: "Item", validation: { isRequired: true } }),
          {
            label: "Mission List Items",
            description: "Right-column bullet points (e.g. 'Visit children's hospitals').",
            itemLabel: (props) => props.value || "New Item",
          },
        ),

        // ── Gallery ──
        galleryHeading: fields.text({
          label: "Gallery Heading",
          defaultValue: "Out in the Field",
        }),
        gallerySubtitle: fields.text({
          label: "Gallery Subtitle",
          multiline: true,
          defaultValue:
            "From charity fundraisers and hospital visits to comic conventions and community parades.",
        }),
        galleryCtaLabel: fields.text({
          label: "Gallery CTA Label",
          defaultValue: "See All Media",
        }),
        galleryCtaHref: fields.text({
          label: "Gallery CTA URL",
          defaultValue: "/media",
        }),

        // ── Upcoming Events ──
        eventsHeading: fields.text({
          label: "Events Heading",
          defaultValue: "Upcoming Events",
        }),
        eventsSubtitle: fields.text({
          label: "Events Subtitle",
          multiline: true,
          defaultValue:
            "Meet the team, support local charities, and see the Ecto in person. Check out where we'll be next — we'd love to see you there.",
        }),
        eventsCtaLabel: fields.text({
          label: "Events CTA Label",
          defaultValue: "See Past Events",
        }),
        eventsCtaHref: fields.text({
          label: "Events CTA URL",
          defaultValue: "/events",
        }),

        // ── Join ──
        joinHeading: fields.text({
          label: "Join Heading",
          defaultValue: "Join the Team",
        }),
        joinSubtitle: fields.text({
          label: "Join Subtitle",
          multiline: true,
          defaultValue:
            "Whether you're a lifelong Ghosthead or just getting started, there's a place for you in our franchise. Join a community of fans who build props, attend events, visit hospitals, and raise money for charity — all while having a blast.",
        }),
        joinImage: fields.text({
          label: "Join Image Path",
          description: "Path to the image shown in the join section.",
          defaultValue: "/images/ghostbusters-virginia-movie-premiere.jpg",
        }),
        joinImageAlt: fields.text({
          label: "Join Image Alt Text",
          defaultValue:
            "Three Ghostbusters Virginia members in full uniforms posing at a movie premiere event",
        }),
        joinQuoteLineOne: fields.text({
          label: "Join Quote Line 1",
          multiline: true,
          defaultValue:
            "Do you believe in UFOs, astral projections, mental telepathy, ESP, clairvoyance, spirit photography, telekinetic movement, full trance mediums, the Loch Ness monster and the theory of Atlantis?",
        }),
        joinQuoteLineTwo: fields.text({
          label: "Join Quote Line 2",
          multiline: true,
          defaultValue:
            "Ready to get out there and start busting some ghosts? Excellent news rookie, we have openings!",
        }),
        joinCtaLabel: fields.text({
          label: "Join CTA Label",
          defaultValue: "Join Now",
        }),
        joinCtaHref: fields.text({
          label: "Join CTA URL",
          defaultValue: "/join",
        }),

        // ── Swag ──
        swagHeading: fields.text({
          label: "Swag Heading",
          defaultValue: "Support the Mission",
        }),
        swagSubtitle: fields.text({
          label: "Swag Subtitle",
          multiline: true,
          defaultValue:
            "Every purchase helps fund our charity work, community events, and hospital visits across Virginia. Grab some gear and wear your support — we're ready to believe you!",
        }),
        swagCtaLabel: fields.text({
          label: "Swag CTA Label",
          defaultValue: "Visit Our Store",
        }),
        swagCtaHref: fields.text({
          label: "Swag CTA URL",
          defaultValue: "https://www.teepublic.com/user/ghostbustersva",
        }),
      },
    }),
  },
});
