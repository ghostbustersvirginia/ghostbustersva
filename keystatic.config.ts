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
  },
  collections: {
    /**
     * Events collection — mirrors src/content/events/ and the Zod schema
     * in src/content.config.ts.
     */
    events: collection({
      label: "Events",
      slugField: "title",
      path: "src/content/events/*",
      format: { contentField: "body" },
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
          label: "Body",
          description: "Optional detailed description of the event (Markdown).",
          extension: "md",
        }),
      },
    }),

    /**
     * Gallery collection — mirrors src/content/gallery/ and the Zod schema
     * in src/content.config.ts.
     */
    gallery: collection({
      label: "Media / Gallery",
      slugField: "title",
      path: "src/content/gallery/*",
      format: { contentField: "body" },
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
          label: "Body",
          description: "Optional additional details about this gallery entry.",
          extension: "md",
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
          description: "Image path relative to / (e.g. /images/news/proton-pets.jpeg).",
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
        footerText: fields.text({
          label: "Footer Text",
          description: "Copyright or legal text shown in the site footer.",
          multiline: true,
        }),
      },
    }),
  },
});
