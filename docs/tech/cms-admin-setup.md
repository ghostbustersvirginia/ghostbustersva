# CMS Admin Setup & Handoff Runbook

Notes for handing the site off to the Ghostbusters team and spinning down the developer project.

## Handoff Checklist (For the Team)

1. **Vercel account** — walk the designated owner through creating a Vercel account (free hobby tier works). Connect it to their GitHub.
2. **GitHub repo transfer** — transfer `ghostbustersva` repo ownership to whoever the team picks as owner (Settings → Transfer ownership). They accept the transfer.
3. **Vercel project import** — new owner imports the repo as a Vercel project. Vercel auto-detects Astro. Confirm the production domain (`ghostbustersva.com`) is assigned.
4. **GitHub App** — on the new owner's GitHub: Settings → Developer settings → GitHub Apps → New GitHub App:
   - **App name:** `Ghostbusters VA CMS` (or similar — must be globally unique)
   - **Homepage URL:** `https://ghostbustersva.com`
   - **Callback URL:** `https://ghostbustersva.com/api/keystatic/github/oauth/callback`
   - **Webhook:** uncheck "Active" (not needed)
   - **Permissions → Repository:**
     - Contents: **Read & write**
     - Metadata: **Read-only**
   - **Where can this app be installed?** Only on this account
   - After creating, copy the **Client ID** (starts with `Iv…`) and generate a **Client Secret**.
   - **Install the app** on the `ghostbustersva` repo (Settings → Install App → select the repo).
5. **Vercel env vars** — in the new Vercel project, Settings → Environment Variables, add for Production:
   - `PUBLIC_KEYSTATIC_GITHUB_REPO` = `new-owner/ghostbustersva`
   - `KEYSTATIC_GITHUB_CLIENT_ID` = from step 4
   - `KEYSTATIC_GITHUB_CLIENT_SECRET` = from step 4
   - `KEYSTATIC_SECRET` = run `openssl rand -hex 32`
6. **Update domain references in code** — the codebase currently uses `ghostbustersva.vercel.app`. Find-and-replace to the production domain:
   - `astro.config.mjs` → `site` value and `security.allowedDomains`
   - `src/layouts/BaseLayout.astro` → fallback URLs for canonical and OG image
   - `public/robots.txt` → sitemap URL
   - `docs/cms-guide.md` → admin URL in editor instructions
7. **Deploy** — push any commit or trigger a manual deploy from Vercel.
8. **Verify** — open `/admin`, sign in with GitHub, edit a test event, save, confirm it deploys.
9. **Editor access** — add Ghostbusters team members as repo collaborators (write access). They sign in at `/admin` with their GitHub accounts.

## Spindown (Developer)

Once the team's Vercel project is live and verified:

1. Delete your Vercel project (Project Settings → Advanced → Delete Project).
2. Remove env vars from your local `.env` (or delete the file).
3. Delete the old GitHub App (github.com/settings/apps).
4. Remove yourself as collaborator on the transferred repo if no longer needed.
5. Confirm the production domain resolves to their Vercel project, not yours.

## Architecture Reference

- Keystatic uses `github` mode when `PUBLIC_KEYSTATIC_GITHUB_REPO` is set, `local` mode otherwise.
- `/admin` redirects to `/keystatic`.
- Auth uses a **GitHub App** (not an OAuth App). GitHub Apps provide expiring tokens with refresh support, which Keystatic requires.
- Editors save → Keystatic commits to GitHub → Vercel auto-deploys (~1-2 min).
- Editor access = GitHub repo write access. No separate CMS accounts.

## Troubleshooting

| Symptom                       | Fix                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/keystatic` shows local mode | `PUBLIC_KEYSTATIC_GITHUB_REPO` env var missing — check Vercel env vars, redeploy                                                   |
| OAuth redirect error          | Callback URL in the GitHub App must exactly match `https://domain.com/api/keystatic/github/oauth/callback`                         |
| 401 on login                  | Keystatic requires a **GitHub App** (not an OAuth App). Verify you created the correct type under Developer settings → GitHub Apps |
| Permission denied on save     | Editor needs write access to the GitHub repo                                                                                       |
| Site not updating after save  | Check Vercel Deployments tab — auto-deploy on push must be enabled                                                                 |
