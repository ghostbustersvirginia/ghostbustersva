# Developer Onboarding & Conventions

A practical guide for anyone working on the Ghostbusters Virginia demo website.

> **Prerequisites:** Node.js (LTS), npm, Git. See the [README](../README.md) for setup instructions.

---

## Repo Structure at a Glance

```
src/
├── pages/          → File-based routing. Each .astro file = one URL.
├── layouts/        → BaseLayout.astro wraps every page (<head>, header, footer).
├── components/     → Shared components used across pages.
│   └── ui/         → Design-system primitives (Button, Panel, StatusPill, etc.).
├── content/        → Markdown/JSON content collections.
│   ├── events/     → Event listings (Markdown).
│   ├── gallery/    → Gallery entries (Markdown).
│   ├── settings/   → Site-wide settings (JSON, CMS singleton).
│   └── page-copy/  → CMS-editable page text for About, Join, Contact, Donate.
├── lib/            → Shared TypeScript utilities (events, images, page-copy, settings, etc.).
├── styles/         → Global CSS. theme.css holds all design tokens.
└── content.config.ts → Zod schemas that validate content frontmatter.
images/             → Source images (processed by Astro's image pipeline at build).
public/             → Static files served as-is (robots.txt).
docs/               → Documentation, PRDs, and technical guides.
tests/              → Vitest unit tests.
```

### How Pages & Routes Work

Astro uses **file-based routing**. A file at `src/pages/about.astro` becomes the `/about` URL. There is no router config to maintain.

Every page imports `BaseLayout` which provides the `<head>`, skip-link, header, footer, and global styles.

### Content Collections

Content lives in `src/content/` and is validated by Zod schemas in `src/content.config.ts`:

| Collection | Format   | Purpose                                      |
| ---------- | -------- | -------------------------------------------- |
| `events`   | Markdown | Event listings with dates, locations, status |
| `gallery`  | Markdown | Photo gallery entries                        |
| `settings` | JSON     | Site-wide settings (CMS singleton)           |
| `pageCopy` | JSON     | CMS-editable page text (About, Join, etc.)   |

Each page that uses `pageCopy` loads it via `getPageCopy()` from `src/lib/page-copy.ts` with inline fallbacks, so the site works even if CMS data hasn't been seeded.

### CMS (Keystatic)

Editors manage content at `/admin` (redirects to `/keystatic`). Keystatic is configured in `keystatic.config.ts` and stores content as flat files committed to Git. See the [CMS Editor Guide](../cms-guide.md) for the editor workflow and [CMS Admin Setup](cms-admin-setup.md) for the technical auth runbook.

---

## Component Conventions

### When to Create a Reusable Component

Create a component in `src/components/` (or `src/components/ui/`) when:

- The same UI pattern appears on **two or more pages**.
- The piece has its own **props, slots, or logic** (not just markup).
- It's a design-system primitive (buttons, panels, pills, cards).

### When Page-Specific Code Is Fine

Keep markup inline in the page file when:

- It's unique to that page and unlikely to be reused.
- Extracting it would just create a single-use wrapper with no benefit.

### Component Patterns

- **Astro components** (`.astro`) are the default. Use them for everything that doesn't need client-side interactivity.
- **React components** (`.tsx`) are used sparingly for interactive UI that requires client-side state (e.g., `GhostParticles.tsx`, `HeroSection.tsx`). Don't reach for React unless Astro components can't do the job.
- **Preferred:** New or modified reusable components should have a JSDoc comment at the top explaining what they do, ideally with an `@example`. This isn't enforced across the entire codebase today, but is the convention to follow for new work.
- Use `interface Props` to type all component props.

### Naming

- Components: `PascalCase.astro` or `PascalCase.tsx`
- Pages: `kebab-case.astro`
- Content files: `kebab-case.md`
- Lib utilities: `kebab-case.ts`

---

## Styling & Theme System

### Where Tokens Live

All design tokens are CSS custom properties defined in `src/styles/theme.css`. This file is imported once by `BaseLayout.astro` and available everywhere.

Tokens cover: colors, typography, spacing, radii, shadows, transitions, and breakpoints.

### How to Use Tokens

Always reference tokens instead of hardcoding values:

```css
/* ✅ Good */
color: var(--color-text);
background: var(--color-surface);
padding: var(--space-xl);
font-family: var(--font-heading);
border-radius: var(--radius-md);

/* ❌ Bad */
color: #e2e6ec;
background: #111820;
padding: 1.5rem;
font-family: "Orbitron", sans-serif;
border-radius: 0.5rem;
```

### Adding or Modifying Tokens

1. Add/edit the custom property in `src/styles/theme.css` under the appropriate section (colours, typography, spacing, etc.).
2. Use semantic naming: `--color-{purpose}` not `--color-{hex-description}`.
3. If the token serves a specific UI role, add it to the semantic roles section (bottom of the `:root` block).
4. Update this doc or the theme PRD if you're adding a new category.

### Key Token Groups

| Prefix                           | Purpose              | Example                                  |
| -------------------------------- | -------------------- | ---------------------------------------- |
| `--color-bg` / `--color-surface` | Backgrounds          | `--color-surface-alt`                    |
| `--color-text`                   | Text colours         | `--color-text-muted`                     |
| `--color-accent`                 | Brand red            | `--color-accent-hover`                   |
| `--color-accent-atmospheric`     | Supernatural green   | `--color-glow-atmospheric`               |
| `--color-action-*`               | Button / interactive | `--color-action-primary-hover`           |
| `--color-hover-*`                | Hover states         | `--color-hover-border`                   |
| `--font-*`                       | Font families        | `--font-heading`, `--font-mono`          |
| `--text-*`                       | Font sizes (scale)   | `--text-sm`, `--text-2xl`                |
| `--space-*`                      | Spacing              | `--space-md`, `--space-3xl`              |
| `--radius-*`                     | Border radii         | `--radius-sm`, `--radius-full`           |
| `--shadow-*`                     | Box shadows + glow   | `--shadow-glow`, `--shadow-panel`        |
| `--transition-*`                 | Timing               | `--transition-fast`, `--transition-base` |

### Breakpoints

Breakpoints are documented as comments in `theme.css` (CSS can't use custom properties in `@media` queries). Use them directly:

```css
@media (min-width: 768px) {
  /* tablet → desktop */
}
@media (min-width: 1024px) {
  /* desktop → wide */
}
```

### Reduced Motion

`theme.css` includes a `prefers-reduced-motion` media query that disables animations globally. Any component that adds animation must also respect the `[data-reduce-motion="true"]` attribute set by the user's manual toggle (see `MotionToggle.astro`).

---

## Layout & Section Patterns

Follow these patterns so the site stays visually consistent:

### Page Structure

```astro
<BaseLayout title="Page Name" description="...">
  <section class="container page" aria-labelledby="page-title">
    <h1 id="page-title" class="page-title">Page Title</h1>
    <p class="page-intro">One-line summary.</p>

    <Panel heading="Section Name">
      <!-- content -->
    </Panel>
  </section>
</BaseLayout>
```

- Wrap page content in `<section class="container page">`.
- Use `Panel` for distinct content sections.
- Always provide `aria-labelledby` on sections and `id` on the heading.

### Cards

Event cards and similar repeating items use `EventCard.astro` (or create a new card component if the pattern differs). Cards should use `Panel` or follow its visual pattern (surface background, border, hover glow).

### Buttons

Use `Button.astro` with `variant="primary"` or `variant="secondary"`. It renders as `<a>` when you pass `href`, `<button>` otherwise. For external links, add `external` to get `target="_blank"` and a screen-reader hint.

### Lists & Bullets

Styled lists use `--color-bullet` for markers. Keep list markup semantic (`<ul>`, `<ol>`, `<dl>`).

### Dividers

Use `<hr class="divider">` between logical sections within a Panel. The `divider` class uses `--color-divider-structural`.

---

## Development Workflow

During the demo phase, keep things simple:

1. Run `npm run check` before committing to catch issues early.
2. Write clear commit messages using [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add event countdown component
fix: correct gallery image alt fallback
docs: update deployment guide
chore: bump Astro to 5.18
refactor: extract event date formatting
test: add splitEventsByStatus edge cases
```

3. Keep commits small and focused — one logical change per commit.

> **If the project moves forward:** We would adopt a more structured workflow — feature branches (`feat/short-description`), pull requests with code review, and a review checklist before merging. For now, we keep the process lightweight so it's not overwhelming.

### Quality Checklist

Before committing, verify:

- [ ] `npm run check` passes
- [ ] No hardcoded colors, fonts, or spacing — tokens are used
- [ ] Semantic HTML (correct heading levels, landmarks, labels)
- [ ] Keyboard navigation works for any interactive elements
- [ ] Content schema changes are reflected in `content.config.ts`
- [ ] No new dependencies added without justification
- [ ] Responsive — works on mobile and desktop

---

## Tech Stack Summary

| Layer         | Tool                                | Notes                                  |
| ------------- | ----------------------------------- | -------------------------------------- |
| Framework     | Astro (static output)               | `@astrojs/node` adapter for CMS routes |
| CMS           | Keystatic                           | Git-backed, browser admin at `/admin`  |
| Language      | TypeScript (strict)                 | No `any` without a comment             |
| Styling       | CSS custom properties               | All tokens in `theme.css`              |
| Content       | Markdown + JSON Content Collections | Zod-validated schemas                  |
| Interactivity | React (minimal)                     | Only where client state is needed      |
| Testing       | Vitest                              | Unit tests in `tests/`                 |
| Linting       | ESLint + Prettier                   | Run `npm run check`                    |
| Hosting       | Vercel (static deploy)              | Auto-deploy on push to `main`          |

---

## Further Reading

- [CMS Editor Guide](../cms-guide.md) — content editing via the browser
- [CMS Admin Setup](cms-admin-setup.md) — hosted auth configuration
- [README](../README.md) — project overview and setup
- [AI Usage Guide](ai-usage.md) — how AI tools are used here
- [Deployment Guide](deployment.md) — deploy process and rebuild schedule
- [PRD Workflow](prds/README.md) — how features are planned
- [AGENT.md](../AGENT.md) — AI project guide
- [copilot-instructions.md](../copilot-instructions.md) — AI coding rules
