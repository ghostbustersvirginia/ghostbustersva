# PRD Workflow

This directory contains **Product Requirement Documents (PRDs)** — one per feature or significant change.

## Purpose

PRDs keep work focused, scoped, and reviewable. Every non-trivial feature should have a PRD before implementation begins.

## Naming Convention

```
NNN-short-description.md
```

- `NNN` — zero-padded sequential number (e.g., `001`, `002`)
- `short-description` — 2-4 word kebab-case summary

**Examples:**

- `001-initial-project-setup.md`
- `002-contact-form-integration.md`
- `003-motion-effects.md`

## PRD Template

```md
# PRD NNN: Title

**Status:** draft | in-progress | complete
**Author:** [name or handle]
**Date:** YYYY-MM-DD

## Goal

What are we building and why?

## Scope

- What's included
- What's explicitly excluded

## Requirements

1. Requirement one
2. Requirement two

## Design Notes

Any wireframes, colour references, interaction notes.

## Acceptance Criteria

- [ ] Criterion one
- [ ] Criterion two

## Notes

Anything else relevant.
```

## Workflow

1. Create a new PRD file following the naming convention.
2. Fill out the template with enough detail to work from.
3. Implement the feature in small commits, referencing the PRD.
4. When done, update the PRD status to `complete`.
5. Commit the status update with the final code changes.
6. Delete the completed PRD file to keep `docs/prds/` focused on active work.

## Design System PRDs

Some PRDs define foundational design system elements (theme tokens, base components, motion primitives). These must be implemented in a reusable way and not tied to a single page.

These PRDs should:

- Create reusable components
- Avoid page-specific hardcoding
- Prefer tokens and configuration over fixed values
- Be safe and accessible by default
