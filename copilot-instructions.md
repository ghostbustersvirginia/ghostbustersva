# Copilot Instructions — Ghostbusters Virginia

These are the repo-level instructions for AI-assisted development.

## Core Principles

1. **Small PRDs, small commits.** Every feature or change gets a short PRD in `/docs/prds/` before work begins. Each PRD is completed and committed before moving to the next.
2. **Accessibility and performance first.** Never ship a feature that harms a11y or degrades load times. Use semantic HTML, ARIA where needed, and test with keyboard navigation.
3. **No big refactors without a PRD.** If you want to restructure something, write a PRD explaining why, what changes, and what the migration path looks like.
4. **Keep it static.** This is a static Astro site with a git-backed CMS (Keystatic). Do not add a backend, database, or server-rendered pages unless a PRD explicitly calls for it.
5. **Content lives in collections.** Events and gallery items use `.md` files; page copy and settings use `.json` files. All are Astro Content Collections validated by Zod schemas in `src/content.config.ts`.
6. **Astro-first, React only when needed.** Use `.astro` components for static UI. React islands (`.tsx` with `client:load`) are only for elements requiring client-side state (e.g., `HeroSection.tsx`, `GhostParticles.tsx`).

## Code Style

- TypeScript strict mode. No `any` unless absolutely necessary (and commented why).
- Use Astro components (`.astro`) for pages and layouts. React (`.tsx`) only for interactive islands that need client-side state.
- Follow the Prettier config in `.prettierrc`. Run `npm run format` before committing.
- Follow ESLint rules. Run `npm run lint` before committing.

## Commit Standards

- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Keep commits small and focused. One logical change per commit.
- Link to the relevant PRD in the commit body when applicable.

## File Organisation

- Site config (nav, footer logos, metadata) → `src/config.ts`
- Layouts → `src/layouts/`
- Components → `src/components/`
- Pages → `src/pages/`
- Content → `src/content/{collection}/`
- Documentation → `docs/`
- PRDs → `docs/prds/`

## Testing

- Write unit tests in `tests/` using Vitest.
- Keep tests minimal and meaningful — test behaviour, not implementation.
- Run `npm run check` to validate everything before committing.

## What NOT To Do

- Don't add animations, transitions, or sound effects without a PRD.
- Don't install new dependencies without justification.
- Don't modify the content collection schemas without updating the README.
- Don't commit generated files (`dist/`, `.astro/`, `node_modules/`).
