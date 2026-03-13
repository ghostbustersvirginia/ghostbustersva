# AGENT.md — AI Project Guide

**Last reviewed:** 2026-03-10 · **Owner:** GBVA project lead

Short context for AI tools. Keep this file lightweight and defer detailed rules to canonical docs.

## Project Goal

Build a fast, accessible, content-driven **demo site** for Ghostbusters Virginia.

- Tone: fun but professional, inclusive, clear.
- UX: simple, trustworthy, easy to navigate.
- Performance + accessibility are hard requirements.

## Routes in Scope

- `/`, `/about`, `/events`, `/media`, `/join`, `/contact`, `/donate`

## Non-Negotiable Constraints

- Static Astro site + Keystatic CMS.
- No backend/database/SSR unless a PRD explicitly requires it.
- Astro-first components; avoid client JS unless clearly necessary.
- No decorative motion.

## Working Rules (Summary)

1. For non-trivial changes, start with a PRD in `docs/prds/`.
2. Keep changes small and scoped.
3. Run `npm run check` before final handoff on substantial changes.

## Canonical Sources (do not duplicate here)

- Implementation guardrails: `copilot-instructions.md`
- PRD process: `docs/prds/README.md`
- Editor workflow and day-to-day content updates: `README.md`

## Future Ideas (PRD required first)

- Contact/donation integrations
- Event detail pages
- SEO + analytics improvements
- Optional new content surfaces (for example news/blog expansion)
