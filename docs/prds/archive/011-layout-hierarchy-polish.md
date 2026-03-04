# PRD 011: Layout, Hierarchy & Visual Polish

**Status:** draft
**Author:** Copilot
**Date:** 2026-02-26

## Goal

Bring the entire Ghostbusters Virginia site to a cohesive, production-ready level of visual polish by standardising layout systems, typographic hierarchy, spacing rhythm, component patterns, responsive behaviour, and accessibility across all pages.

Previous PRDs established individual design primitives (PRD 002), typography (PRD 003), page-specific redesigns (PRDs 004–008), motion effects (PRD 009), and the colour token system (PRD 010). This PRD addresses the **systemic inconsistencies** that emerged as those pieces were assembled independently — the "fit and finish" pass that turns a collection of well-designed parts into a unified product.

### Problems This PRD Solves

1. **Duplicated page-level boilerplate** — `.page`, `.page-title`, `.intro`, `.section-heading`, `.section-heading::after`, `.divider`, `.glow`, `.glow-breathe`, `.lightbox`, `.sr-only`, and responsive breakpoints for `.page-title` are copy-pasted identically across 7+ page files and `theme.css` instead of being defined once.
2. **Inconsistent section spacing** — `padding-block` on pages uses `var(--text-3xl)` (a font-size token, not a spacing token) for vertical rhythm; homepage sections use `padding-block: 3rem`; there is no shared spacing scale.
3. **No shared spacing/size token scale** — Gaps use raw `rem` values (`0.75rem`, `1.5rem`, `2rem`, `1.25rem`) with no token vocabulary, making consistency accidental.
4. **Section heading styles are redefined per page** — `.section-heading` and its `::after` pseudo-element are identically duplicated in `index.astro`, `events.astro`, and `media.astro`. Any future page must copy the same block.
5. **Inconsistent page title treatment** — Seven pages define identical `.page-title` styles locally. The homepage has no equivalent (the hero handles it), creating a disconnect.
6. **Divider inconsistency** — Three different divider implementations exist: `.divider` (about, contact — centered, narrow), `.mission-divider` (index — full-width), and header/footer divider (red structural gradient). No shared component or class.
7. **Glow text (`.glow`) duplicated in two files** — Both `about.astro` and `index.astro` define identical `.glow` styles with the `glow-breathe` animation.
8. **`.sr-only` defined four times** — In `theme.css`, `Header.astro`, `Footer.astro`, and `Button.astro`.
9. **Inconsistent card patterns** — Event cards on the homepage (`event-card`, `event-card__link`) use different class names, structure, and padding than event cards on the events page (`event-item`, `event-link`). Swag cards differ between `index.astro` and `donate.astro`.
10. **Hero button duplication** — `HeroSection.css` redefines `.btn`, `.btn--primary`, and introduces `.btn--ghost` separately from `Button.astro`, creating two parallel button systems.
11. **Inconsistent responsive breakpoints** — Mobile breakpoints use `640px`, `600px`, `480px`, and `768px` without a defined scale. Some cards go horizontal at `600px`, others at `640px`.
12. **No consistent max-width for readable content** — Some text blocks use `max-width: 54rem`, others have none. Line lengths on wide screens vary unpredictably.
13. **Missing tablet treatment** — Most pages jump directly from single-column mobile to full desktop. No intermediate states for 768–1024px range.
14. **Lightbox component duplicated** — The lightbox overlay HTML, styles, and JS are duplicated between `index.astro` (home gallery) and `media.astro` with slight variations (home has prev/next arrows; media supports video).
15. **Toggle/show-more buttons defined twice** — `events.astro` and `media.astro` both define identical styled toggle buttons with different class names (`.toggle-btn` vs `.gallery-toggle__btn`).
16. **No section spacing between adjacent sections** — Some homepage sections crowd against each other with only `padding-block: 3rem`, while the gap between hero and first section is implicitly handled by the hero's own padding.
17. **Code of Conduct is unstyled relative to other pages** — Uses raw `<div class="conduct-item">` cards that replicate Panel behaviour without using `Panel.astro`, and `h2` elements inside use `--color-accent-hover` (red) rather than `--color-heading-section` (green), breaking the hierarchy rules from PRD 010.
18. **Quote block defined locally twice** — `.join-quote` appears in both `join.astro` and `index.astro` with near-identical styles.
19. **No standardised empty state** — `.empty-state` is defined locally in `events.astro` and `media.astro` with slightly different styles.
20. **Page intro text inconsistency** — About, Join, Contact, Donate, Events, and Code of Conduct use `.intro` (centered, `--text-base`). Media uses `.page-intro` (`--text-lg`). Homepage has no page-level intro.

## Scope

### Included

- Global utility classes extracted to `theme.css` or a new `global.css`
- Spacing token scale
- Responsive breakpoint token scale
- Shared section heading, page title, divider, glow-text, quote, and empty-state styles
- Lightbox extraction into a shared component
- Event card component unification
- Swag card pattern unification
- Toggle button pattern unification
- Code of Conduct page migration to Panel component
- Hero button alignment with Button.astro tokens
- Content max-width and readability guardrails
- Responsive behaviour standardisation
- Accessibility improvements (contrast, focus, reduced motion)
- `.sr-only` deduplication

### Excluded

- New pages or content
- Brand identity changes (colours, fonts, logo)
- New component introductions beyond what exists
- Motion/animation changes (covered by PRD 009)
- Colour token changes (covered by PRD 010)
- Performance optimisation or bundle splitting
- SEO or meta-tag changes

## Requirements

### 1. Define Spacing Token Scale

Add a spacing scale to `/src/styles/theme.css` under a new **"Spacing tokens"** section. All `gap`, `padding`, and `margin` values across the site must reference these tokens.

```css
/* -------------------------------------------------- */
/* Spacing tokens                                      */
/* -------------------------------------------------- */
--space-xs: 0.25rem; /*  4px */
--space-sm: 0.5rem; /*  8px */
--space-md: 0.75rem; /* 12px */
--space-lg: 1rem; /* 16px */
--space-xl: 1.5rem; /* 24px */
--space-2xl: 2rem; /* 32px */
--space-3xl: 3rem; /* 48px */
--space-4xl: 4rem; /* 64px */
--space-5xl: 6rem; /* 96px */

/* Content max-widths */
--content-width-narrow: 40rem; /* ~640px — single-column text */
--content-width-mid: 54rem; /* ~864px — readable prose */
--content-width-wide: var(--max-width); /* 72rem — full layout */
```

### 2. Define Responsive Breakpoint Scale

Standardise breakpoints. Document them in `theme.css` as comments and use consistently across all pages.

```css
/* -------------------------------------------------- */
/* Breakpoints (reference — use in @media queries)     */
/* -------------------------------------------------- */
/* --bp-sm: 480px    — small phones → larger phones   */
/* --bp-md: 640px    — phones → small tablets          */
/* --bp-lg: 768px    — tablets → desktop               */
/* --bp-xl: 1024px   — desktop → wide desktop          */
/* --bp-2xl: 1280px  — wide desktop                    */
```

**Rules:**

- Stacked → 2-column transitions happen at `--bp-lg` (768px)
- 2-column → 3-column transitions happen at `--bp-xl` (1024px)
- Grid `auto-fill` / `auto-fit` breakpoints within cards should use `minmax()` with consistent minimum widths, not explicit column-count media queries where possible
- Remove the isolated `600px` breakpoint used by homepage event cards; align to `768px`

### 3. Extract Shared Global Utility Classes

Move the following duplicated styles into `theme.css` (or a new `global-utilities.css` imported alongside it) so they are defined **once** and available to all pages:

| Class                               | Current Locations                                            | Notes                                        |
| ----------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `.page`                             | about, join, contact, donate, events, media, code-of-conduct | Page container with flex column layout       |
| `.page-title`                       | about, join, contact, donate, events, media, code-of-conduct | Page heading style (Orbitron, green, glow)   |
| `.intro` / `.page-intro`            | about, join, contact, donate, events, media, code-of-conduct | Unify as `.page-intro` with consistent size  |
| `.section-heading` + `::after`      | index, events, media                                         | Section heading with green underline         |
| `.section-subtitle`                 | index                                                        | Shared subtitle style below section headings |
| `.divider`                          | about, contact                                               | Content-level divider                        |
| `.glow` + `@keyframes glow-breathe` | about, index                                                 | Glowing bold text                            |
| `.sr-only`                          | theme.css, Header, Footer, Button                            | Keep only in `theme.css`                     |
| `.empty-state`                      | events, media                                                | Empty placeholder message                    |
| `.lightbox` + associated elements   | index, media                                                 | Extract to shared styles or component        |
| `.section-cta`                      | index (3 instances)                                          | CTA row below sections                       |

**Implementation:**

- Define all shared classes in `theme.css` under clearly labelled sections
- Remove the local duplicate `<style>` definitions from each page
- Where page-specific overrides are needed, use the local `<style>` block to extend — not redefine — the shared class

### 4. Deduplicate `.sr-only`

Keep the single definition in `theme.css`. Remove the duplicate definitions from `Header.astro`, `Footer.astro`, and `Button.astro`.

### 5. Standardise Page Layout Structure

Every non-homepage page must follow this structural pattern:

```
<BaseLayout title="…">
  <section class="container page" aria-labelledby="…">
    <h1 class="page-title">…</h1>
    <p class="page-intro">…</p>
    <!-- Panels / content sections -->
  </section>
</BaseLayout>
```

**Rules for `.page`:**

```css
.page {
  padding-block: var(--space-4xl) var(--space-5xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}
```

- `padding-block` uses spacing tokens, not font-size tokens
- Gap between child elements is `--space-xl` (1.5rem) consistently
- On mobile (`< --bp-md`), `padding-block` reduces to `--space-3xl var(--space-4xl)`

### 6. Standardise Section Heading Pattern

Define `.section-heading` globally with its `::after` underline decoration. All section headings on the homepage, events page, and media page must use this single definition.

```css
.section-heading {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-wider);
  color: var(--color-heading-section);
  text-shadow: 0 0 10px var(--color-glow-atmospheric);
  border-bottom: none;
  padding-bottom: var(--space-md);
  margin-bottom: var(--space-xl);
  position: relative;
  text-align: left;
}

.section-heading::after {
  /* green gradient underline */
}
```

Where a page needs center-aligned headings (homepage), apply `text-align: center` via a local class or modifier, not a redefinition.

The homepage currently uses `font-size: 1.6rem` for `.section-heading` — normalise this to `var(--text-xl)` to match events and media.

### 7. Standardise Page Title Treatment

Define `.page-title` globally once. The current definition is:

```css
.page-title {
  font-family: var(--font-heading);
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-wider);
  color: var(--color-heading-section);
  text-shadow: 0 0 12px var(--color-glow-atmospheric);
  text-align: center;
  line-height: var(--leading-tight);
}

@media (max-width: 640px) {
  .page-title {
    font-size: var(--text-2xl);
  }
}
```

This identical block exists in 7 page files. Extract once to `theme.css`.

### 8. Standardise Page Intro Text

Unify `.intro` and `.page-intro` into a single `.page-intro` class:

```css
.page-intro {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  text-align: center;
  max-width: var(--content-width-mid);
  margin-inline: auto;
}
```

Media page currently uses `--text-lg` — normalise to `--text-base` for consistency. If a page needs larger intro text, use a modifier class.

### 9. Standardise Content Dividers

Define two global divider classes:

**`.divider` — Content-level separator (green, centered, subtle)**

```css
.divider {
  border: none;
  height: 1px;
  margin: var(--space-xl) auto;
  max-width: 12rem;
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-border) 30%,
    var(--color-glow-atmospheric-strong) 50%,
    var(--color-border) 70%,
    transparent
  );
  opacity: 0.5;
}
```

**`.divider--full` — Full-width section separator (green)**

```css
.divider--full {
  max-width: 100%;
  margin: var(--space-lg) 0;
}
```

Remove `.mission-divider` from `index.astro` and replace with `.divider.divider--full`.

### 10. Standardise Glow Text

Extract `.glow` and `@keyframes glow-breathe` to `theme.css`:

```css
.glow {
  color: var(--color-text);
  font-weight: var(--weight-semibold);
  text-shadow:
    0 0 6px var(--color-glow-green),
    0 0 14px var(--color-glow-green);
  animation: glow-breathe 3s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%,
  100% {
    text-shadow:
      0 0 4px var(--color-glow-green),
      0 0 10px var(--color-glow-green);
  }
  50% {
    text-shadow:
      0 0 8px var(--color-glow-green),
      0 0 20px var(--color-glow-green);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
```

Remove the duplicated `.glow` / `glow-breathe` definitions from `about.astro` and `index.astro`.

### 11. Standardise Blockquote / Quote Pattern

Extract `.quote-block` from the current `.join-quote` pattern (duplicated in `join.astro` and `index.astro`):

```css
.quote-block {
  border-left: 3px solid var(--color-accent);
  padding: var(--space-xl);
  background: var(--color-surface);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  box-shadow: var(--shadow-panel);
}

.quote-block p {
  font-family: var(--font-body);
  font-style: italic;
  font-size: var(--text-lg);
  line-height: var(--leading-normal);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.quote-block p:last-child {
  margin-bottom: 0;
}
```

Replace `.join-quote` in both files with `.quote-block`.

### 12. Unify Event Card Component

Currently two divergent implementations exist:

| Element               | Homepage (index.astro)        | Events Page (events.astro)    |
| --------------------- | ----------------------------- | ----------------------------- |
| Container class       | `.event-card`                 | `.event-item`                 |
| Link class            | `.event-card__link`           | `.event-link`                 |
| Image class           | `.event-img`                  | `.event-link__image`          |
| Info wrapper          | `.event-info`                 | `.event-link__body`           |
| Horizontal breakpoint | `600px`                       | `640px`                       |
| Padding               | `1.25rem` (via `.event-info`) | `1.25rem` (via `.event-link`) |

**Resolution:** Unify both to a single shared event card pattern. Define the shared styles globally and use them in both locations.

Choose the events page naming convention (`.event-item`, `.event-link`, etc.) as the canonical pattern since it follows BEM more consistently. Refactor the homepage event section to use the same class names and structure.

### 13. Unify Swag Card Pattern

The swag grid and `.swag-item` styles are duplicated between `index.astro` and `donate.astro` with identical CSS. Extract to `theme.css` as a shared `.swag-grid` / `.swag-item` pattern.

### 14. Unify Toggle / Show-More Button

`.toggle-btn` (events) and `.gallery-toggle__btn` (media) are identical. Extract a shared `.toggle-btn` class to `theme.css`.

### 15. Extract Lightbox to Shared Component

Create `/src/components/ui/Lightbox.astro` that encapsulates:

- The dialog overlay markup
- Close button
- Prev/next navigation arrows
- Image display
- Video iframe display
- Caption
- All associated styles
- Keyboard handling (Escape, arrow keys)

Both `index.astro` and `media.astro` will use this component instead of inline lightbox markup. The component accepts configuration props:

- `id: string` — unique ID for multiple lightboxes
- `showNav?: boolean` — whether to show prev/next arrows (default: true)
- `showVideo?: boolean` — whether to support video playback (default: false)

### 16. Align Hero Buttons with Button.astro

`HeroSection.css` redefines `.btn` and `.btn--primary` with slightly different sizing (`padding: 0.75rem 1.75rem`, `font-size: var(--text-base)`) compared to `Button.astro` (`padding: 0.625rem 1.5rem`, `font-size: var(--text-sm)`).

**Resolution:**

- Add a `.btn--lg` size modifier to `Button.astro` for use in hero contexts
- Remove the `.btn` redefinition from `HeroSection.css`
- Keep `.btn--ghost` in `HeroSection.css` as a hero-specific variant (it's only used there)
- Hero CTA markup should use `Button.astro` rendered with appropriate `variant` and `size` props, or at minimum consume the same global `.btn` tokens

### 17. Migrate Code of Conduct to Panel.astro

The Code of Conduct page defines `.conduct-item` cards that replicate Panel behaviour without using the component. The `h2` headings inside use `--color-accent-hover` (red) which violates PRD 010's hierarchy rules (section headings should be green atmospheric, not red).

**Resolution:**

- Replace each `.conduct-item` with `<Panel heading="…" headingLevel={2}>`
- Remove the local `.conduct-item` styles
- The Panel heading is already styled with `--color-text-muted` and uppercase treatment; this is appropriate for the Code of Conduct section titles
- If a distinct heading colour is desired for these items, use `--color-heading-section` (green) per PRD 010 Rule 1

### 18. Standardise Panel Body Text

Multiple pages override Panel body text styles locally:

```css
.page :global(.panel) p {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  margin-bottom: 1rem;
}
```

This block is duplicated in `about.astro`, `join.astro`, `contact.astro`, and `donate.astro`. Move this to the Panel component's own styles so it's inherited automatically.

### 19. Standardise Responsive Behaviour

#### Grid Column Rules

| Context                     | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
| --------------------------- | --------------- | ------------------- | ----------------- |
| Event cards (image + info)  | Stacked         | Side-by-side        | Side-by-side      |
| News cards (image + info)   | Stacked         | Side-by-side        | Side-by-side      |
| Gallery grid                | 1 column        | 2 columns           | 3 columns         |
| Video grid                  | 1 column        | 2 columns           | 3 columns         |
| Swag grid                   | 2 columns       | 3 columns           | 5 columns         |
| Social links grid           | 1 column        | 2 columns           | auto-fit          |
| Region columns (contact)    | 1 column        | 3 columns           | 3 columns         |
| Gear columns (join)         | 1 column        | 2 columns           | 2 columns         |
| Mission columns (index)     | 1 column        | 2 columns           | 2 columns         |
| Join layout (image + quote) | Stacked         | Side-by-side        | Side-by-side      |

#### Rules:

- All card-to-horizontal transitions use `--bp-lg` (768px) consistently — remove the `600px` breakpoint
- Gallery and video grids add a middle `2-column` state at `--bp-lg` before jumping to 3 columns at `--bp-xl` — currently they jump from 1 to 3 at `768px` with no tablet intermediate
- Swag grid: keep `2 → 3 → 5` progression but align breakpoints to the token scale (`--bp-sm: 480px`, `--bp-lg: 768px`)

#### Mobile Hero:

The current mobile hero treatment (PRD 009) is well-designed. Preserve:

- Content anchored to bottom over darkened overlay
- Chips hidden
- CTAs stacked vertically, full-width
- Primary CTA reordered first via `order: -1`

### 20. Standardise Content Readability

**Rules:**

- Body text blocks (paragraphs, list items) must not exceed `--content-width-mid` (54rem / ~70ch) in line length. Apply `max-width` to prose containers, not individual elements.
- `.page-intro` / `.section-subtitle` already constrain width — ensure all instances use the same `max-width: var(--content-width-mid)`.
- Panel body content naturally constrains via Panel width and padding — no additional max-width needed inside panels.

### 21. Standardise Empty States

Define a single `.empty-state` class globally:

```css
.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-style: italic;
  padding-block: var(--space-3xl);
}
```

Remove the local definitions from `events.astro` and `media.astro`.

### 22. Accessibility Improvements

1. **Reduced motion coverage** — Ensure `html[data-reduce-motion="true"]` rules also suppress the `.glow-breathe` animation (currently only the `@media (prefers-reduced-motion)` query handles it; the JS toggle should too).
2. **Focus styles on toggle buttons** — `.toggle-btn` and `.gallery-toggle__btn` do not define `:focus-visible` styles. Add them.
3. **Lightbox focus trap** — The current lightbox implementations do not trap focus within the dialog. When open, `Tab` can escape to background content. Add a focus-trap utility.
4. **Button disabled state clarity** — `Button.astro` uses `opacity: 0.5` for disabled state. Consider adding a `cursor: not-allowed` tooltip or `title` attribute for clarity.
5. **Skip-link z-index** — `.skip-link` has `z-index: 1000` but the header has `z-index: 100`. Verify skip-link appears above the header when focused.
6. **Lightbox close button** — Uses `&times;` character. Add explicit SVG icon with proper sizing for better hit target on mobile.

### 23. Standardise Note / Callout Pattern

The Join page defines a `.note` callout component locally:

```css
.note {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
}
```

Extract this to a shared `.callout` class in `theme.css` for reuse across pages.

## Design Rules

### Layout Hierarchy

```
Page
  └── .container (max-width: --max-width, padding-inline)
       └── .page (flex column, gap: --space-xl)
            ├── .page-title
            ├── .page-intro
            ├── Panel / section content
            └── Panel / section content
```

For the homepage:

```
Page
  └── HeroSection (full-bleed via own container)
  └── .container.section (per homepage section)
       ├── .section-heading
       ├── .section-subtitle
       └── Section-specific content
```

### Spacing Rules

| Context                                        | Token                                     |
| ---------------------------------------------- | ----------------------------------------- |
| Between page title and intro                   | `--space-lg` (inherited from `.page` gap) |
| Between panels / major sections on inner pages | `--space-xl` (inherited from `.page` gap) |
| Between homepage sections                      | `--space-3xl` (section padding-block)     |
| Inside Panel body                              | `--space-xl` (Panel padding)              |
| Between items in a list                        | `--space-md` to `--space-lg`              |
| Between CTA and preceding content              | `--space-xl`                              |
| Page top padding                               | `--space-4xl`                             |
| Page bottom padding                            | `--space-5xl`                             |

### Typography Hierarchy

| Element                    | Font                     | Size                                | Weight   | Colour                                          |
| -------------------------- | ------------------------ | ----------------------------------- | -------- | ----------------------------------------------- |
| Page title (`h1`)          | Orbitron                 | `--text-4xl` (mobile: `--text-2xl`) | Bold     | `--color-heading-section` + green glow          |
| Section heading (`h2`)     | Orbitron                 | `--text-xl`                         | Bold     | `--color-heading-section` + green glow          |
| Sub-section heading (`h3`) | Orbitron                 | `--text-lg`                         | Semibold | `--color-heading-section`                       |
| Panel heading              | Orbitron                 | `--text-sm`                         | Semibold | `--color-text-muted` (uppercase)                |
| Body text                  | Inter                    | `--text-base`                       | Normal   | `--color-text-muted`                            |
| Supporting text / notes    | Inter                    | `--text-sm`                         | Normal   | `--color-text-muted` (italic where appropriate) |
| Labels / pills             | Share Tech Mono          | `--text-xs`                         | Normal   | Per status                                      |
| Dates / technical readouts | Share Tech Mono or Inter | `--text-sm`                         | Normal   | `--color-text`                                  |

### Component Patterns

All card-like containers must share these baseline traits:

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-panel);

/* Hover */
border-color: var(--color-hover-border);
box-shadow: var(--shadow-hover), var(--shadow-panel);
```

This applies to: Panel, event cards, gallery cards, video cards, news cards, swag cards, social link cards, conduct items, quote blocks.

### Divider Usage

| Type                                      | Gradient                             | Use                               |
| ----------------------------------------- | ------------------------------------ | --------------------------------- |
| **Structural** (header/footer)            | Red (`--color-divider-structural`)   | Always-visible site chrome        |
| **Section** (`.section-heading::after`)   | Green (`--color-divider-section`)    | Below section headings            |
| **Content** (`.divider`)                  | Green/border blend, centered, narrow | Between paragraphs within a Panel |
| **Full-width content** (`.divider--full`) | Green/border blend, full width       | Between major content blocks      |

## Implementation Plan

Execute in this order. Each phase can be one or more commits.

### Phase 1: Token Foundation

- [ ] Add spacing token scale (`--space-xs` through `--space-5xl`) to `theme.css`
- [ ] Add content width tokens (`--content-width-narrow`, `--content-width-mid`) to `theme.css`
- [ ] Add breakpoint documentation comments to `theme.css`
- [ ] Verify build passes — no visual changes

### Phase 2: Extract Global Utilities

- [ ] Move `.page-title` to `theme.css`, remove from all 7 page files
- [ ] Unify `.intro` / `.page-intro` as `.page-intro` in `theme.css`, remove from all page files
- [ ] Move `.page` layout class to `theme.css`, remove from all 7 page files
- [ ] Move `.section-heading` + `::after` to `theme.css`, remove from `index.astro`, `events.astro`, `media.astro`
- [ ] Move `.section-subtitle` to `theme.css`, remove from `index.astro`
- [ ] Move `.section-cta` to `theme.css`, remove from `index.astro`
- [ ] Move `.divider` and add `.divider--full` to `theme.css`, remove from `about.astro`, `contact.astro`, `index.astro`
- [ ] Move `.glow` + `@keyframes glow-breathe` to `theme.css`, remove from `about.astro`, `index.astro`
- [ ] Move `.quote-block` (from `.join-quote`) to `theme.css`, update `join.astro` and `index.astro`
- [ ] Move `.empty-state` to `theme.css`, remove from `events.astro`, `media.astro`
- [ ] Move `.callout` (from `.note`) to `theme.css`, update `join.astro`
- [ ] Deduplicate `.sr-only` — keep in `theme.css`, remove from `Header.astro`, `Footer.astro`, `Button.astro`
- [ ] Verify build passes and all pages render identically

### Phase 3: Component Standardisation

- [ ] Add default body text styles to `Panel.astro` (absorb the repeated `:global(.panel) p` overrides)
- [ ] Migrate Code of Conduct `.conduct-item` cards to `<Panel>` components; fix `h2` colour from red to Panel heading pattern
- [ ] Unify event card markup — refactor homepage event section to use the same class names and structure as `events.astro`
- [ ] Extract shared swag grid/card styles to `theme.css`; remove duplicates from `index.astro` and `donate.astro`
- [ ] Extract shared toggle button `.toggle-btn` styles to `theme.css`; update `events.astro` and `media.astro`
- [ ] Add `.btn--lg` size modifier to `Button.astro`; refactor `HeroSection.css` to remove duplicate `.btn` / `.btn--primary` definitions and use the global styles
- [ ] Verify build passes and all components render correctly

### Phase 4: Lightbox Extraction

- [ ] Create `/src/components/ui/Lightbox.astro` with shared markup, styles, and keyboard handling
- [ ] Refactor `index.astro` to use the shared Lightbox component
- [ ] Refactor `media.astro` to use the shared Lightbox component (with video support)
- [ ] Add focus-trap utility to Lightbox (Tab cycles within dialog when open)
- [ ] Verify lightbox works on both pages with keyboard navigation, Escape close, and arrow key cycling

### Phase 5: Spacing & Layout Normalisation

- [ ] Replace all raw `rem` spacing values in page files with spacing tokens (`--space-*`)
- [ ] Normalise `.page` `padding-block` to use `--space-4xl` / `--space-5xl` instead of `var(--text-3xl)`
- [ ] Normalise homepage `.section` `padding-block` to `--space-3xl`
- [ ] Ensure consistent gap between all page children (panels, sections)
- [ ] Add `max-width: var(--content-width-mid)` to prose containers where line length exceeds ~75ch
- [ ] Verify build passes and pages render with improved rhythm

### Phase 6: Responsive Behaviour

- [ ] Remove the `600px` breakpoint from homepage event cards; align card-to-horizontal transition to `768px`
- [ ] Add tablet intermediate (2-column) state to gallery grid and video grid at `768px` (currently jumps from 1 to 3)
- [ ] Align all breakpoints to the documented scale (`480px`, `640px`, `768px`, `1024px`, `1280px`)
- [ ] Verify mobile, tablet, and desktop sizes render correctly on all pages
- [ ] Test: no horizontal overflow at any width; no cramped or excessively sparse layouts

### Phase 7: Accessibility Polish

- [ ] Verify `.glow-breathe` animation is suppressed by both `@media (prefers-reduced-motion)` and `html[data-reduce-motion="true"]`
- [ ] Add `:focus-visible` styles to `.toggle-btn` / `.gallery-toggle__btn`
- [ ] Improve Lightbox close button hit target (min 44×44px touch area)
- [ ] Verify skip-link z-index stacking is correct
- [ ] Confirm all interactive elements have visible focus styling
- [ ] Run contrast checks on section heading green glow against dark background — ensure decorative glow does not reduce effective contrast of adjacent text

### Phase 8: Validation

- [ ] Grep for remaining raw `padding-block: var(--text-` usage — confirm zero results
- [ ] Grep for `.page-title {` definitions outside `theme.css` — confirm zero results
- [ ] Grep for `.sr-only` definitions outside `theme.css` — confirm zero results
- [ ] Grep for `.section-heading {` definitions outside `theme.css` — confirm zero results
- [ ] Visual review of every page at 375px, 768px, 1024px, and 1440px widths
- [ ] Verify all lightbox interactions on Home and Media pages
- [ ] Verify motion toggle and `prefers-reduced-motion` still work correctly
- [ ] Build passes with zero errors

## Acceptance Criteria

### Global Utilities

- [ ] `.page`, `.page-title`, `.page-intro`, `.section-heading`, `.section-subtitle`, `.section-cta`, `.divider`, `.glow`, `.quote-block`, `.empty-state`, `.callout`, `.sr-only` are each defined **once** in `theme.css`
- [ ] No page file redefines any of the above classes (local overrides extend, not redefine)
- [ ] Spacing tokens (`--space-xs` through `--space-5xl`) exist in `theme.css`
- [ ] Content width tokens exist in `theme.css`

### Component Consistency

- [ ] Event cards use the same class names and structure on the homepage and events page
- [ ] Swag grid uses the same styles on the homepage and donate page
- [ ] Toggle/show-more buttons use a single shared `.toggle-btn` class
- [ ] Code of Conduct uses `<Panel>` components instead of custom `.conduct-item` cards
- [ ] Panel body text styles are defined in `Panel.astro`, not repeated per-page
- [ ] `Button.astro` has a `.btn--lg` modifier; hero buttons do not redefine `.btn` base styles

### Layout & Spacing

- [ ] All `padding`, `gap`, and `margin` values reference `--space-*` tokens
- [ ] All breakpoints align to the documented scale (480, 640, 768, 1024, 1280)
- [ ] No `600px` breakpoint remains in the codebase
- [ ] Body text line length does not exceed ~75ch on wide screens

### Lightbox

- [ ] A shared `Lightbox.astro` component exists and is used by both Home and Media pages
- [ ] Lightbox traps focus when open
- [ ] Lightbox supports keyboard navigation (Escape, Arrow keys)

### Responsive

- [ ] Gallery and video grids have a 2-column tablet state
- [ ] Event and news cards transition to horizontal at `768px` consistently
- [ ] No horizontal overflow at any viewport width 320px–1440px

### Accessibility

- [ ] `.glow-breathe` stops under both `prefers-reduced-motion` and `data-reduce-motion`
- [ ] All toggle buttons have `:focus-visible` styles
- [ ] Lightbox close button meets 44×44px minimum touch target

### Build

- [ ] Zero build errors
- [ ] Zero visual regressions (pages look the same or better, never worse)
- [ ] Existing motion toggle and reduced-motion support still work

## Notes

- This PRD intentionally avoids colour changes — PRD 010 handles all colour token work. If PRD 010 is not yet implemented, this PRD's extraction work should use the same hardcoded values currently in place and add a note to migrate once PRD 010 lands.
- The homepage is the most complex page and will require the most refactoring. Most inner pages (about, join, contact, donate, code-of-conduct) are structurally simple and will primarily benefit from the boilerplate extraction.
- The `HeroSection.css` button redefinitions are the highest-risk deduplication since the hero buttons have intentionally different sizing. The `.btn--lg` modifier approach preserves the size difference while eliminating the parallel system.
- The Lightbox extraction is the largest component-level refactor. Both existing implementations are similar but have differences (home has prev/next, media has video support). The shared component must support the superset of features.
- After this PRD, any new page should require **zero** local style definitions for page title, intro, section headings, dividers, or empty states — they all come from the global stylesheet.
- This PRD should be executed **after** PRD 010 (colour tokens) to avoid conflicts.
