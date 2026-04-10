# Ghostbusters Virginia — Website

> **⚠️ NOT YET OFFICIAL**
> This site is a **demo / prototype** built to seek approval from **Ghostbusters Virginia (GBVA)** Virginia's community Ghostbusters franchise.

Built with [Astro](https://astro.build), TypeScript, and markdown-based content.

**New here?** Start with [How This Website Works](#how-this-website-works) if you're non-technical.

## Docs by Audience

- **Ghostbusters team / non-developers:** This README (sections above: overview, ownership, updates, contacts).
- **Developers / technical setup:** `README.md`, `AGENT.md`, `copilot-instructions.md`, and `docs/prds/README.md`.
- **AI and planning docs:** `AGENT.md`, `copilot-instructions.md`, and `docs/prds/`.

---

## How This Website Works

This is a **static website** — think of it like a brochure that gets regenerated whenever we make changes, rather than a live app with a database behind it.

- **Core pages** (Home, About, Events, Media, Join, Contact, Donate) are built from template files and deployed as plain HTML.
- **Content** (events, gallery, page copy, settings) is stored as markdown and JSON files in `src/content/` and edited directly — no login required.
- When a developer pushes changes to the `main` branch, the site automatically rebuilds and deploys within minutes.
- The site rebuilds on a daily schedule so time-sensitive content (like event status) stays current.

Content lives in this repository as plain files. Edit them directly and push to `main` to trigger a rebuild.

---

## Ownership & Accounts

> **Note:** While this is still a demo, accounts and infrastructure are managed by the project creator. If the project is approved and moves to official status, ownership would transfer to the Ghostbusters Virginia organization so no single person is a single point of failure.

| Resource    | Current State                 |
| ----------- | ----------------------------- |
| Domain      | TBD — pending approval        |
| GitHub repo | Personal account (demo phase) |
| Hosting     | Vercel (demo deployment)      |

---

## How Updates Happen

| What                             | How                                                                        |
| -------------------------------- | -------------------------------------------------------------------------- |
| Add/edit an event                | Edit or create a file in `src/content/events/` and push to `main`          |
| Add gallery photos               | Edit or create a file in `src/content/gallery/` and push to `main`         |
| Change site-wide settings        | Edit `src/content/settings/site.json` and push to `main`                   |
| Change page copy (text/content)  | Edit the relevant JSON file in `src/content/page-copy/` and push to `main` |
| Change page layout/UX (template) | Edit the `.astro` file in `src/pages/`                                     |
| Deploy                           | Push to `main` — deploy is automatic via Vercel                            |

> **If the project moves forward:** We would adopt a feature-branch → pull-request → code-review workflow to keep changes clean and reviewable. For now during the demo phase, changes are committed directly to keep things simple.

---

## Who to Contact / How to Request Changes

- **Want something changed on the site?** Open a GitHub Issue describing what you need, or message the project lead directly.
- **Found a bug?** Open a GitHub Issue with what you saw, what you expected, and what page it was on.
- **Want to help?** Review [AGENT.md](AGENT.md), [copilot-instructions.md](copilot-instructions.md), and [PRD Workflow](docs/prds/README.md).

---

## Team Quick Start

1. Edit content files directly in `src/content/` (events, gallery, page copy, or settings).
2. Commit your changes and push to `main`.
3. Wait for Vercel to rebuild (usually a few minutes).
4. Check the live site.

For day-to-day team use, this is all you need.

---

## Technical Docs (Developers)

- [.env.example](.env.example) — environment variable template
- [PRD Workflow](docs/prds/README.md)
- [AGENT.md](AGENT.md) — AI project guide
- [copilot-instructions.md](copilot-instructions.md) — implementation guardrails

### Internal Package: readyled

This project uses an internal package, `readyled` (`github:ghostbustersva/readyled`), to render the LED marquee.

- Purpose: centralize LED sign rendering logic (font readiness, canvas rasterization, LED image generation, and scroll animation).
- Integration point: `src/components/LEDScrollbar.astro` (Astro wrapper + package bridge).
- Required assets from package: `readyled/dist/readyled.js` and `readyled/dist/readyled.css`.

If dev server errors with missing `readyled/dist/readyled.css`, install dependencies and restart dev:

```bash
npm install
npm run dev
```

For handoff stability, keep `package-lock.json` committed and avoid changing the `readyled` dependency source unless there is a clear need.

---

## Content Editing

Content is stored as plain files in this repository. Edit them directly using a code editor or the GitHub web UI, then push to `main` to trigger a rebuild. No login required.

### Where Content Lives

| Content         | Location                         | Format   |
| --------------- | -------------------------------- | -------- |
| Events          | `src/content/events/`            | Markdown |
| Gallery entries | `src/content/gallery/`           | Markdown |
| Videos          | `src/content/videos/`            | JSON     |
| News            | `src/content/news/`              | JSON     |
| Page copy       | `src/content/page-copy/`         | JSON     |
| Site settings   | `src/content/settings/site.json` | JSON     |
| Images          | `public/images/`                 | JPG/PNG  |

### What Each File Controls

| Section       | What it controls                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Events        | Event listings — title, date, location, summary, images, status                                                             |
| Gallery       | Photo gallery entries — image, title, alt text, date                                                                        |
| Videos        | YouTube videos shown on the Media page                                                                                      |
| News          | Press coverage / news links shown on the Media page                                                                         |
| Page copy     | Per-page text fields for home/about/join/events/media/contact/donate/code-of-conduct (in `src/content/page-copy/`)          |
| Site Settings | Global values: site name/description, donate URL, contact email/phone, LED scrollbar text, nav/footer content, social links |

### Branch Workflow

For any content change:

1. Create a new branch off `main` (example: `content-home-hero-copy`).
2. Edit the relevant files.
3. Commit and push the branch.
4. Open a Pull Request on GitHub from that branch to `main`.
5. Review the Vercel preview deployment linked in the PR checks.
6. Click **Merge** — Vercel deploys `main` to production.

Committing directly to `main` is also allowed during the demo phase for small changes.

> **Image note:** `public/images/` is the single source of truth for site images.
