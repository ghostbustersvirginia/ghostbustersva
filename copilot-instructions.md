# Copilot Instructions — Ghostbusters Virginia

Repo-level operating rules for AI-assisted work.

## Decision Order (follow in this exact order)

1. `docs/prds/` (active PRD scope and acceptance criteria)
2. `AGENT.md` (product vision and constraints)
3. This file (`copilot-instructions.md`) for implementation guardrails

If rules conflict, follow the highest item in this list and note the conflict in your response.

## Delivery Rules

- **PRD-first for non-trivial work.** Any new feature, redesign, or refactor must have a PRD in `docs/prds/` before implementation.
- **Small direct fixes are allowed without a PRD.** Typos, copy edits, tiny bug fixes, and low-risk maintenance can be done directly.
- **No scope creep.** Implement only what the request/PRD asks for.
- **Small, focused changes.** Prefer minimal diffs and reusable patterns already in the repo.

## Platform Constraints

- Static Astro site + Keystatic CMS (git-backed content).
- No backend, database, SSR, or API surface unless a PRD explicitly requires it.
- Astro-first UI: use `.astro` components; avoid client-side JS unless clearly necessary.
- Do not add React islands or animation libraries without explicit PRD approval.
- Keystatic exception: keep `@astrojs/react` integrated in `astro.config.mjs` and keep `@astrojs/react` in dependencies, because Keystatic admin (`/keystatic`) requires a React renderer.

## Design System and Accessibility (March 2026 baseline)

- Follow existing theme tokens and UI primitives in `src/styles/theme.css` and `src/components/ui/`.
- Be mindful of motion — keep animations purposeful and non-distracting.
- Always respect `prefers-reduced-motion` and the site-wide reduced-motion toggle.
- Transitions are allowed on interactive elements (links, buttons, interactive cards) and thematic accents (e.g. the LED scrollbar).
- No all-caps UI text (`text-transform: uppercase` is disallowed outside logo assets).
- Body text uses dark text tokens (do not use blue/yellow/green/red for body copy).
- Keep contrast and focus states WCAG 2.2 AA compliant.
- Use semantic HTML and keyboard-accessible interactions.

## Styling and Component Rules

- Use existing theme tokens in `src/styles/theme.css`; avoid hardcoded visual values.
- Reuse existing UI primitives in `src/components/ui/` before creating new ones.
- Keep components simple, typed, and consistent with current Astro patterns.
- Do not introduce new design patterns if current components already cover the need.

## Content and Schema Rules

- Content lives in Astro content collections under `src/content/`.
- Respect current collection formats:
  - events/gallery/pages: markdown
  - settings/news/videos: json
- Any schema change in `src/content.config.ts` must include updates to relevant docs and usage points.

## Code Quality Rules

- TypeScript strict mode; avoid `any` unless truly unavoidable.
- Preserve accessibility and performance in every change.
- Avoid new dependencies unless necessary and justified by the task/PRD.
- Do not commit generated artifacts (`dist/`, `.astro/`, `node_modules/`).

## Validation Checklist

Before finishing substantial work, run:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm run test`

Or run `npm run check` for full validation.

## File Organization Quick Reference

- Site config: `src/config.ts`
- Layouts: `src/layouts/`
- Components: `src/components/`
- Pages/routes: `src/pages/`
- Content: `src/content/{collection}/`
- Docs: `docs/`
- PRDs: `docs/prds/`

## Explicit Do-Not List

- Do not redesign pages, navigation, or information architecture without a PRD.
- Do not add particle effects, parallax, or motion libraries without PRD approval.
- Do not hardcode colors/spacing/typography where tokens exist.
- Do not modify schemas, slugs, or reserved routes casually.
- Do not install packages "just in case".
