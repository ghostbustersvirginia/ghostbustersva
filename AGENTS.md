# AGENTS.md — AI Agent Guide

> Consolidated quick-reference for AI coding agents. Authoritative sources:
> decision order → `copilot-instructions.md` → `AGENT.md` → `docs/prds/README.md`

## Architecture Overview

Static Astro site (output: `"static"`) deployed on Vercel. The **only server-rendered routes** are the Keystatic admin UI (`/keystatic`, `/admin`), which Astro's Keystatic integration handles automatically — no manual SSR config is needed. Do not add SSR/API routes.

**React exists solely for Keystatic.** Keep `@astrojs/react` in `astro.config.mjs` and `dependencies`, but do not use React components or islands anywhere outside of Keystatic internals.

## Content Architecture (Two-Tier)

| Collection | Format | Location | Managed via |
|---|---|---|---|
| `events`, `gallery` | Markdown | `src/content/{collection}/` | CMS / code |
| `settings` | `site.json` | `src/content/settings/` | CMS only |
| `videos`, `news` | JSON files | `src/content/{collection}/` | CMS only |
| `pageCopy` | JSON files | `src/content/page-copy/{page}.json` | CMS only |

`pageCopy` uses a **discriminated union** schema keyed on `page:` — each page (home, about, events, etc.) has its own strongly-typed JSON file. Access it via `getPageCopy("home")` from `src/lib/page-copy.ts`.

Site-wide settings (nav, footer, social links, etc.) are loaded via `getSiteSettings()` from `src/lib/settings.ts`, which falls back to `src/config.ts` defaults when CMS fields are absent.

## Key `src/lib/` Helpers

- `settings.ts` — `getSiteSettings()`: CMS settings with `src/config.ts` fallback
- `page-copy.ts` — `getPageCopy(slug)`: typed per-page editable copy
- `events.ts` — `deriveEventStatus()`, `splitEventsByStatus()`: event up/past logic (evaluated at **build time**, `America/New_York` timezone; daily rebuilds keep it accurate)
- `links.ts` — `isSafeExternalUrl()`, `isSafeCmsHref()`: URL validators used in content schemas
- `images.ts` — `getResponsiveImageAttrs()`: srcset/sizes builder for `public/images/`

## Design Tokens & Styling

All visual values live in `src/styles/theme.css` as CSS custom properties (e.g. `--color-accent: #0000ff`, `--font-display: "Elan Bold"`). Never hardcode colors, spacing, or typography. Reuse primitives from `src/components/ui/` (Button, Panel, PageHeader, SectionHeading, StatusPill, SocialLinks, Lightbox) before creating new ones.

- No `text-transform: uppercase` outside logo assets
- Always include `prefers-reduced-motion` guards on animations
- WCAG 2.2 AA contrast and keyboard focus required on all interactive elements

## Developer Commands

```bash
npm run dev          # local dev server
npm run build        # production static build
npm run check        # full validation: typecheck + lint + format:check + test
npm run typecheck    # astro check (TypeScript)
npm run test         # vitest run (unit tests in tests/ and src/**/*.test.ts)
```

Run `npm run check` before finishing any substantial change.

## Tests

Vitest, Node environment. Tests cover **pure logic only** — `src/lib/` functions such as event status derivation, link validation, and lightbox utilities. No page-render or integration tests. When adding logic to `src/lib/`, add corresponding unit tests.

## Content Schema Changes

Editing `src/content.config.ts` requires mirroring the change in `keystatic.config.ts` (the Keystatic field definitions) and updating any relevant `src/content/page-copy/*.json` or `src/content/settings/site.json` files. The two configs must stay in sync.

## PRD Workflow

Non-trivial features need a PRD at `docs/prds/NNN-short-description.md` before implementation. Trivial fixes (typos, copy edits, small bugs) can skip the PRD. See `docs/prds/README.md` for the template.

## LED Scrollbar (`src/components/LEDScrollbar.astro`)

Rendering is fully delegated to the **`readyled`** package (`github:ghostbustersva/readyled`, `node_modules/readyled`). The component owns only the outer `.led-scrollbar` housing styles; readyled handles canvas rasterisation, LED painting, and CSS step-animation.

**How the integration works:**

- The `.astro` frontmatter converts props → `data-led-*` attributes on a bare `<div class="led-scrollbar">`.
- The `<script>` reads those attributes, writes readyled's **six CSS custom properties** (`--readyled-pixel-size`, `--readyled-pixel-gap`, `--readyled-pixel-color`, `--readyled-pixel-glow`, `--readyled-bg-color`, `--readyled-pixel-off-color`) onto **`document.documentElement`** (readyled always reads from there), then calls `readyLED({ target: el, ... })`.
- `scrollSpeed` (ms per column) is derived from the `scrollRate` (px/s) prop: `scrollSpeed = (pixelSize + pixelGap) / scrollRate × 1000`.
- readyled CSS is imported with `@import "readyled/dist/readyled.css"` inside a **`<style is:global>`** block — required because readyled creates `.readyled-sign` / `.readyled-sign-track` DOM nodes dynamically (Astro's scoped CSS would never match them).
- `prefers-reduced-motion` and `.reduce-motion` guards target `.readyled-sign-track.ready { animation: none }` in the same global block.

**Do not** add `readyled`-prefixed CSS rules to `theme.css` or scoped `<style>` blocks — they will be silently ignored.

## Keystatic CMS Environment

Local dev uses `storage: { kind: "local" }` automatically (no env vars needed). Production GitHub-backed mode requires:
```
PUBLIC_KEYSTATIC_GITHUB_REPO=owner/repo
PUBLIC_KEYSTATIC_BRANCH_PREFIX=  # optional
```

