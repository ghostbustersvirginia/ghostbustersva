# AGENT.md — AI Project Guide

**Last reviewed:** 2026-02-27 · **Owner:** GBVA project lead

This file is the plain-language guide AI tools use when generating code or docs in this repo.

## Vision

Build a fast, accessible, content-driven **demo website** for **Ghostbusters Virginia** — a community Ghostbusters franchise. The site should feel atmospheric and on-brand (dark theme, Ghostbusters red accents) while being welcoming, easy to navigate, and performant on any device. This build serves as a proof-of-concept to demonstrate what the finished product would look like.

## Tone

- **Fun but professional.** We're Ghostbusters — we can be playful, but the site should feel trustworthy and community-focused.
- **Inclusive.** Content should be welcoming to fans of all ages and backgrounds.
- **Clear.** No jargon, no walls of text. Every page has a purpose.

## Page Map

| Route      | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `/`        | Hero, quick intro, CTA to join                 |
| `/about`   | Who we are, mission, history                   |
| `/events`  | Upcoming + past events from content collection |
| `/media`   | Photos and videos from events                  |
| `/join`    | How to become a member                         |
| `/contact` | Contact form / info                            |
| `/donate`  | Donation info and CTA (integration TBD)        |

## Already Implemented

These features have been built and are present in the codebase:

- **Motion & effects**: Ambient ghost-particle orbs (`GhostParticles.tsx`), animated hero with typewriter heading (`HeroSection.tsx`), and a user-accessible motion toggle (`MotionToggle.astro`). All animations respect `prefers-reduced-motion`.
- **Gallery lightbox**: Click-to-expand image viewer on the media page (`Lightbox.astro`, `src/lib/lightbox.ts`).

## Future Enhancements

These are ideas for after the demo is approved — do NOT implement until a PRD is written and approved:

- **Sound effects**: Optional ambient sounds with a clear mute control. Muted by default.
- **Contact form integration**: Replace placeholder with a real form (Formspree, Netlify Forms, etc.).
- **Donation integration**: Connect to a real payment flow (PayPal, Stripe, etc.).
- **Event detail pages**: Individual pages for each event rendered from markdown.
- **SEO enhancements**: Open Graph images, structured data, sitemap.
- **Analytics**: Privacy-respecting analytics (Plausible, Fathom).
- **Blog / news section**: Content collection for news posts.
- **Store link**: External link to merchandise store (e.g., TeePublic) once approved.

## Development Workflow

1. **Write a PRD** in `docs/prds/` before starting any feature.
2. **Implement** the feature in small, focused commits.
3. **Run checks** (`npm run check`) before committing.
4. **Mark the PRD as complete** by adding a `status: complete` note at the top.

> **Future process:** If the project is approved and more contributors come on board, we would adopt a feature-branch → pull-request → merge-to-`main` workflow to keep work clean and reviewable. For now, the demo is developed simply and directly.

## Tech Stack & Constraints

- Astro (static output, no SSR)
- TypeScript (strict)
- Markdown content collections
- **Keystatic CMS** — git-backed browser editor at `/admin` with GitHub App auth in production, local file mode in dev
- **Astro components** (`.astro`) for all static UI; **React islands** (`.tsx` with `client:load`) used sparingly for interactive elements that need client-side state (e.g., `HeroSection.tsx`, `GhostParticles.tsx`)
- **Framer Motion** for animation in React islands
- Hosted on **Vercel** (static adapter, auto-deploy on push to `main`)
- No backend or database — content is stored as flat files committed to Git
- Accessibility is a hard requirement, not a nice-to-have
