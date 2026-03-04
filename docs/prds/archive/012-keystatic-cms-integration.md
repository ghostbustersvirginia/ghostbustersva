# PRD 012: Keystatic CMS Integration

**Status:** complete
**Author:** GitHub Copilot
**Date:** 2026-03-01

## Goal

Integrate [Keystatic](https://keystatic.com) CMS into the Astro project so non-technical users can create and edit events, media/gallery entries, page content, and global site settings through a browser-based admin UI — without modifying code or needing a development environment.

Keystatic is a git-based CMS that stores all content as files in the repository, keeping the project free of external databases, paid services, and vendor lock-in.

## Scope

### Included

- Keystatic installation and official Astro integration
- CMS admin route at `/keystatic`
- Keystatic config with structured schemas for:
  - **Events** — title, date, endDate, summary, location, address, image, url, status
  - **Media / Gallery** — title, image, alt, date
  - **Site Settings** — site name, description, donate URL, store URL, social links, footer text
- Image upload support with predictable storage in `public/images/`
- Integration with existing Astro content collections (events, gallery)
- Astro output mode remains `static` with `@astrojs/node` adapter (Keystatic admin route uses on-demand server rendering while all other pages stay statically generated)
- Documentation for editors (README section + standalone CMS guide)

### Excluded

- Authentication beyond Keystatic defaults (local-mode, no auth required)
- Full migration of all existing content immediately (can be phased)
- Visual redesign of frontend pages
- Removal of existing content collections — Keystatic augments them, not replaces

## Requirements

1. Install `@keystatic/core` and `@keystatic/astro` packages.
2. Create `/keystatic.config.ts` at the project root defining collections and singletons.
3. Register the Keystatic integration in `astro.config.mjs`.
4. Astro output remains `static`. The `@astrojs/node` adapter enables on-demand rendering for Keystatic's admin routes while all other pages continue to be statically generated.
5. Keystatic collections must mirror existing Zod schemas in `src/content.config.ts` so content remains compatible.
6. Uploaded images must be stored under `public/images/` in a predictable subfolder structure.
7. A `settings` singleton must provide editable global config (site name, donate URL, store URL, social links, footer text).
8. Do not break any existing pages or content.
9. CMS must work in local development via `npm run dev` with no additional services.

## Design Notes

- **Output mode:** Keystatic requires at least one server-rendered route (`/keystatic`). The `@astrojs/node` adapter provides this capability while all existing pages remain statically generated via `output: "static"`. This is the minimal change needed.
- **Content storage:** Keystatic reads/writes Markdown and JSON/YAML files directly in the repo. Events and gallery content will continue to live in `src/content/events/` and `src/content/gallery/`. Settings will be a JSON singleton at `src/content/settings/site.json`.
- **Local mode:** In this phase we use Keystatic's local mode (filesystem-only, no GitHub App). This is free and requires zero infrastructure. A future PRD can add GitHub mode for cloud editing if needed.
- **Image handling:** Keystatic's image field stores uploaded images in dedicated subdirectories: `public/images/events/` for event images and `public/images/gallery/` for gallery photos. Existing images in `public/images/` remain unchanged.

## Acceptance Criteria

- [x] `npm run dev` starts without errors and all existing pages render correctly
- [x] Visiting `/keystatic` in the browser opens the Keystatic admin dashboard
- [x] Events can be created, edited, and deleted through the CMS
- [x] Gallery entries can be created, edited, and deleted through the CMS
- [x] Site settings can be edited through the CMS
- [x] Images can be uploaded through the CMS and appear in `public/images/`
- [x] Content created via the CMS is immediately reflected in the Astro build
- [x] `npm run build` completes without errors
- [x] Existing content (events, gallery) continues to work unchanged
- [x] README includes a CMS Usage section
- [x] A standalone CMS guide exists at `docs/cms-guide.md`
- [x] BaseLayout reads site name and description from CMS settings
- [x] Footer reads copyright/footer text from CMS settings
- [x] Settings seeded with real social links, store URL, and contact email

## Notes

- Keystatic local mode writes directly to the filesystem. In production (Vercel static deploy), the CMS admin route will not be available — it is a development/editing tool only. This is fine for the current workflow where a developer runs the site locally and commits changes.
- A future PRD could add Keystatic GitHub mode to allow editing via a deployed admin UI authenticated through GitHub OAuth.
- The `settings` singleton is a new concept — existing `src/config.ts` hardcodes values. The singleton provides a CMS-editable alternative. BaseLayout and Footer now read from the singleton via `src/lib/settings.ts`, with automatic fallback to `siteConfig` defaults.
- Navigation links and footer logos remain in `src/config.ts` as structural config (not CMS-editable). Only content-oriented values (site name, description, social links, store URL, etc.) are managed via the CMS.
