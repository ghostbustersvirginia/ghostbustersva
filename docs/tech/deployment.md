# Deployment Guide (Technical)

This site is statically built. Event status (`upcoming` vs `past`) is calculated during each build, so if builds don't run regularly, event sections can look outdated.

For CMS admin login and authentication setup, see `docs/tech/cms-admin-setup.md`.

---

## How Often to Rebuild

A production rebuild should run **at least once every 24 hours**. Also trigger a rebuild:

- **On-demand before major event days** (same-day morning is recommended).
- **Immediately after content changes** in `src/content/events/`.

### Where the Schedule Lives

Scheduled rebuilds are managed **in the hosting dashboard, not in this repo**:

| Host               | How to Configure                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Vercel**         | Project Settings → Cron Jobs, or a Deploy Hook URL called by an external scheduler              |
| **Netlify**        | Site Settings → Scheduled Builds (daily cadence)                                                |
| **GitHub Actions** | Add a `schedule` cron workflow in `.github/workflows/` with `workflow_dispatch` for manual runs |

> If this later moves into the repo (for example, a GitHub Actions cron), update this file.

### Monthly Quick Check

1. Open the hosting platform's **Deployments** tab.
2. Confirm scheduled builds are appearing at least daily.
3. Open `/events` and confirm upcoming/past sections look correct.
4. If no recent scheduled deploy appears, check cron/hook settings.

**Owner:** Whoever has admin access to the hosting platform.

---

## Manual Deploy Steps

1. Pull latest `main`.
2. Run `npm ci`.
3. Run `npm run check`.
4. Run `npm run build`.
5. Deploy generated output.
6. Verify `/` and `/events` reflect expected upcoming/past partitions.

## On-Demand Rebuild

Run an immediate rebuild when:

- New or updated event content merged.
- Multi-day event boundary (start/end) is within 24 hours.
- Operator notices stale event categorization in production.

Steps:

1. Trigger platform build hook (or manual workflow dispatch).
2. Confirm latest commit hash is deployed.
3. Verify homepage upcoming cards and `/events` upcoming/past sections.
4. If stale data persists, clear deployment cache and redeploy.

## Why This Matters

Event partitions are computed with date logic in `src/lib/events.ts`. Without scheduled rebuilds, yesterday's classification can remain visible in production even though event dates have passed.
