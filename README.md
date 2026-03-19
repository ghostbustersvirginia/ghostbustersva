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
- **CMS Pages** are editor-created markdown pages that automatically become site routes at deploy time.
- **Content** is managed through a browser CMS login at `/admin`.
- When a developer pushes changes to the `main` branch, the site automatically rebuilds and deploys within minutes.
- The site rebuilds on a daily schedule so time-sensitive content (like event status) stays current.

Content still lives in this repository as files (git-based CMS workflow).

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

| What                      | How                                             |
| ------------------------- | ----------------------------------------------- |
| Add/edit an event         | Use the CMS at `/admin`                         |
| Add gallery photos        | Use the CMS at `/admin`                         |
| Change site-wide settings | Use the CMS at `/admin` → Site Settings         |
| Change core page text     | Edit the `.astro` file in `src/pages/`          |
| Create a brand-new page   | Use CMS Pages collection (no code changes)      |
| Change page layout/UX     | Edit the `.astro` file in `src/pages/`          |
| Deploy                    | Push to `main` — deploy is automatic via Vercel |

> **If the project moves forward:** We would adopt a feature-branch → pull-request → code-review workflow to keep changes clean and reviewable. For now during the demo phase, changes are committed directly to keep things simple.

> **CMS available:** Editors should use `/admin`. Maintainers can also access `/keystatic` directly.

---

## Who to Contact / How to Request Changes

- **Want something changed on the site?** Open a GitHub Issue describing what you need, or message the project lead directly.
- **Found a bug?** Open a GitHub Issue with what you saw, what you expected, and what page it was on.
- **Want to help?** Review [AGENT.md](AGENT.md), [copilot-instructions.md](copilot-instructions.md), and [PRD Workflow](docs/prds/README.md).

---

## Team Quick Start

1. Sign in at `/admin`.
2. Update events, media, or settings.
3. Save changes and wait for deploy.
4. Check the live site.

For day-to-day team use, this is all you need.

---

## Technical Docs (Developers)

- [.env.example](.env.example) — required CMS auth variable template
- [PRD Workflow](docs/prds/README.md)
- [AGENT.md](AGENT.md) — AI project guide
- [copilot-instructions.md](copilot-instructions.md) — implementation guardrails

---

## CMS Usage

The site includes **Keystatic CMS** — a browser-based content editor that lets you create and edit events, gallery entries, and site settings without touching code.

### How to Access

1. Open `/admin` on the deployed site.
2. Click **Sign in with GitHub**.
3. You need **write access** to the `ghostbustersva` repo — ask the project lead if you don't have it.
4. Use sections in the sidebar for Events, Gallery, Videos, News, CMS Pages, and Site Settings.

### What You Can Edit

| Section       | What it controls                                                |
| ------------- | --------------------------------------------------------------- |
| Events        | Event listings — title, date, location, summary, images, status |
| Gallery       | Photo gallery entries — image, title, alt text, date            |
| Videos        | YouTube videos shown on the Media page                          |
| News          | Press coverage / news links shown on the Media page             |
| CMS Pages     | New standalone pages (title, slug, body, optional hero + CTA)   |
| Site Settings | Site name, description, donate URL, store URL, social links     |

### Create a New CMS Page

1. Open **CMS Pages** in `/admin`.
2. Click **Create**.
3. Fill in **Title**, **Slug**, and **Page Content**.
4. Keep slug single-level (example: `volunteer`) and avoid reserved slugs (`about`, `events`, `media`, `contact`, `donate`, `admin`, `keystatic`, `api`, `code-of-conduct`).
5. Set **Published = true** to make the page routable.
6. Optional: enable **Show in Navigation** and add **Navigation Label**.
7. Click **Save** and wait for deploy.

### Where Content is Stored

All content is stored as files in this repository:

| Content         | Location                         | Format   |
| --------------- | -------------------------------- | -------- |
| Events          | `src/content/events/`            | Markdown |
| Gallery entries | `src/content/gallery/`           | Markdown |
| Videos          | `src/content/videos/`            | JSON     |
| News            | `src/content/news/`              | JSON     |
| CMS pages       | `src/content/pages/`             | Markdown |
| Site settings   | `src/content/settings/site.json` | JSON     |
| Images          | `public/images/`                 | JPG/PNG  |

Changes made through the CMS are saved to these files through the Git-backed CMS workflow.

> **Image note:** `public/images/` is now the single source of truth for site images and CMS uploads.

> **Note:** If admin auth is not configured yet, maintainers can temporarily use local mode at `/keystatic` with `npm run dev`.
