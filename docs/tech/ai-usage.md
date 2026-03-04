# AI Usage Guide

How we use AI tools in this project, and the guardrails that keep things consistent.

---

## How We Use AI Here

AI is a productivity tool, not the decision-maker. The workflow is:

1. **Write a PRD first.** Every non-trivial feature starts with a Product Requirement Document in `docs/prds/`. The PRD defines scope, requirements, and acceptance criteria before any code is written.
2. **Then execute with AI assistance.** Use AI to implement what the PRD specifies — not to freelance new features.

### Tool Roles

| Tool                | Role                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Copilot**  | In-editor AI for code completion, refactoring, inline suggestions, and multi-file agent tasks. Follows `copilot-instructions.md` for repo-specific rules.                                |
| **Other AI agents** | Autonomous agents for larger tasks (implement a full PRD, refactor across files, write tests). Should follow `AGENT.md` for project context and `copilot-instructions.md` for standards. |

Both tools read the same instruction files, so they produce consistent output.

### Instruction Files

| File                      | Purpose                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AGENT.md`                | Project vision, tone, page map, tech constraints, and roadmap. The main AI project guide for this repo.                |
| `copilot-instructions.md` | Coding standards, file organisation, commit conventions, and explicit "do not" rules. Loaded automatically by Copilot. |

These files are checked into the repo so every contributor (human or AI) works from the same playbook.

---

## Writing Effective Prompts

When asking AI to make changes, give it enough context to match this repo's conventions:

### Do

- **Reference the PRD.** "Implement PRD 012 — the requirements and acceptance criteria are in `docs/prds/012-feature-name.md`."
- **Be specific about scope.** "Add a `location` field to the event schema and display it on EventCard" is better than "improve events."
- **Point to examples.** "Follow the same pattern as `Panel.astro` — typed Props, JSDoc, scoped styles using tokens."
- **Ask for incremental changes.** One component, one page section, one schema update at a time.

### Don't

- Don't ask AI to "redesign the site" or "make it look better" without a PRD.
- Don't let it pick its own libraries — specify what to use or say "no new dependencies."
- Don't skip review. Always read AI-generated code before committing.

### Example Prompts

```
Create a new Astro component at src/components/ui/Badge.astro.
It should accept a `label` string prop and render a small chip using
--color-chip-text, --color-chip-border, and --color-chip-bg tokens.
Follow the same structure as StatusPill.astro (JSDoc, typed Props, scoped styles).
```

```
Add a new event in src/content/events/example-event-2026.md.
Use the schema from content.config.ts. Set date to 2026-08-15,
location to "Richmond, VA", and include a summary.
```

---

## What AI Should NOT Do

These are hard rules. If AI output violates any of them, reject it.

### No Major Changes Without a PRD

AI should not redesign pages, restructure the routing, introduce new content collections, or change the design direction without an approved PRD. Small fixes and typo corrections are fine.

### No Dependency Sprawl

Do not add npm packages without explicit justification. This project intentionally keeps dependencies minimal (Astro, React for islands, Framer Motion for the hero, Splide for carousels). A new library needs a reason.

### No Breaking Accessibility

- All interactive elements must be keyboard-navigable.
- All images must have meaningful `alt` text.
- Colour contrast must meet WCAG AA.
- Animations must respect `prefers-reduced-motion` and the manual motion toggle.
- Semantic HTML is required (correct headings, landmarks, ARIA labels).

### No Hardcoded Styles

Colors, fonts, spacing, radii, and shadows must use design tokens from `theme.css`. AI loves to inline hex values — catch and fix this in review.

### No Secrets in Code

AI should never emit API keys, tokens, passwords, or credentials into source files. Environment variables go in `.env` (which is git-ignored).

### No Generated Files Committed

`dist/`, `.astro/`, `node_modules/` are all git-ignored. AI should not create or commit build artifacts.

---

## Reviewing AI-Generated Code

Quick checklist when reviewing AI-generated changes:

- [ ] Does it match the PRD scope? (No scope creep)
- [ ] Are design tokens used instead of hardcoded values?
- [ ] Is the HTML semantic and accessible?
- [ ] Are new reusable components typed with `interface Props`? (JSDoc is preferred but not strictly required for every component)
- [ ] Were any dependencies added? If so, is there a reason?
- [ ] Does `npm run check` pass?
- [ ] Does it look right on mobile and desktop?

---

## Further Reading

- [AGENT.md](../AGENT.md) — project vision document that AI agents reference
- [copilot-instructions.md](../copilot-instructions.md) — repo-level AI coding rules
- [Developer Onboarding](contributing.md) — conventions and patterns for all contributors
- [PRD Workflow](prds/README.md) — how to write and manage PRDs
