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
- **CMS page copy** is managed through a browser CMS login at `/admin` (fixed page model for home/about/join/events/media/contact/donate/code-of-conduct).
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

| What                              | How                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Add/edit an event                 | Use the CMS at `/admin` (Events section)                                        |
| Add gallery photos                | Use the CMS at `/admin` (Gallery section)                                       |
| Change site-wide settings         | Use the CMS at `/admin` → Site Settings                                         |
| Change page copy (text/content)   | Use the CMS at `/admin` → Pages section; files are in `src/content/page-copy/*` |
| Change page layout/UX (template)  | Edit the `.astro` file in `src/pages/`                                          |
| Create or edit existing page copy | Use `/admin` → Pages; content is stored under `src/content/page-copy/*`         |
| Deploy                            | Push to `main` — deploy is automatic via Vercel                                 |

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
3. Save changes and wait for deploy (usually a few minutes, not instant).
4. Check the live site.

For day-to-day team use, this is all you need.

---

## Technical Docs (Developers)

- [.env.example](.env.example) — required CMS auth variable template
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

## CMS (Content Management System) Usage

The site includes **Keystatic CMS** — a browser-based content editor that lets you create and edit events, gallery entries, and site settings without touching code.

### How to Access

1. Open `/admin` on the deployed site.
2. Click **Sign in with GitHub**.
3. You need **write access** to the `ghostbustersva` repo — ask the project lead if you don't have it.
4. Use sections in the sidebar for:
   - Content: Events, Gallery, Videos, News
   - Pages: home/about/join/events/media/contact/donate/code-of-conduct (stored in `src/content/page-copy/*`)
   - Settings: Site Settings

### Before You Save (Important)

- In Git-backed mode, Keystatic saves against a specific Git commit snapshot.
- If there are unresolved or stale pending edits from another session, save can fail with commit/path mismatch errors.
- For maintainers using local dev mode, keep a clean working tree before CMS edits: commit, stash, or discard unrelated file changes first.
- If a save fails, refresh `/admin`, discard pending edits in the editor UI, and retry from a fresh session.

### What You Can Edit

| Section       | What it controls                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Events        | Event listings — title, date, location, summary, images, status                                                             |
| Gallery       | Photo gallery entries — image, title, alt text, date                                                                        |
| Videos        | YouTube videos shown on the Media page                                                                                      |
| News          | Press coverage / news links shown on the Media page                                                                         |
| Pages         | Per-page copy fields for home/about/join/events/media/contact/donate/code-of-conduct (stored in `src/content/page-copy/*`)  |
| Site Settings | Global values: site name/description, donate URL, contact email/phone, LED scrollbar text, nav/footer content, social links |

### CMS Pages and Page Copy

The current configuration exposes a fixed set of editor-managed page copy entries via `/admin` → Pages. Editors can update the existing home/about/join/events/media/contact/donate/code-of-conduct pages; creating new route pages is not supported in this version.

### Branch Workflow

- **New branch in `/admin`** creates/targets a real Git branch in GitHub for your CMS edits.
- **After save on that branch**, Vercel will build a preview for that branch.
- **To merge to `main`**, open GitHub in the browser, create a Pull Request from that branch to `main`, review, and click **Merge**.

### Production vs Branch Saves

- Saving in CMS while targeting **`main`** commits to production source and triggers a production deploy on Vercel.
- Saving in CMS while targeting a **non-main branch** does **not** change production unless that branch is merged into `main`.
- Branch work is safe for testing and review, as long as changes stay off `main`.
- Preview links are typically found in the GitHub Pull Request checks and/or the Vercel dashboard.
- Keystatic itself is the content editor; preview deployment links are provided by Vercel/GitHub integration.

### Editor SOP (Branch to Main)

1. In `/admin`, choose **New branch** and name it for the change (example: `content-home-hero-copy`).
2. Make edits and click **Save** in Keystatic.
3. Open GitHub in your browser and open a Pull Request from that branch to `main`.
4. Review the Vercel Preview deployment linked on the Pull Request and confirm content/layout looks correct.
5. Click **Merge** in GitHub; Vercel then deploys `main` to production.

### Where Content is Stored

All content is stored as files in this repository:

| Content         | Location                         | Format   |
| --------------- | -------------------------------- | -------- |
| Events          | `src/content/events/`            | Markdown |
| Gallery entries | `src/content/gallery/`           | Markdown |
| Videos          | `src/content/videos/`            | JSON     |
| News            | `src/content/news/`              | JSON     |
| Page copy       | `src/content/page-copy/`         | JSON     |
| Site settings   | `src/content/settings/site.json` | JSON     |
| Images          | `public/images/`                 | JPG/PNG  |

Changes made through the CMS are saved to these files through the Git-backed CMS workflow.

> **Image note:** `public/images/` is now the single source of truth for site images and CMS uploads.

> **Note:** If admin auth is not configured yet, maintainers can temporarily use local mode at `/keystatic` with `npm run dev`.
