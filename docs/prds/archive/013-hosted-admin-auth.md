# PRD 013: Hosted Admin Login for Content Editing

**Status:** complete
**Author:** GitHub Copilot
**Date:** 2026-03-04

## Goal

Enable non-technical Ghostbusters team members to edit content in a browser with a login flow (WordPress-style), without using VS Code or running `npm run dev` locally.

## Scope

### Included

- Move Keystatic from local filesystem mode to hosted Git-backed mode with authentication.
- Expose admin entry at `/admin` (or `/keystatic` with `/admin` redirect).
- Keep Astro frontend static and deployed as-is.
- Support browser editing for existing CMS-managed content:
  - Events
  - Media / Gallery
  - Site Settings
- Define owner setup checklist for auth and repository permissions.
- Define publish workflow expectations (save → commit → deploy).

### Excluded

- Full CMS platform migration away from Keystatic.
- Drag-and-drop page builder or arbitrary layout editing.
- Multi-role editorial workflow beyond repository access controls.
- Frontend redesign.

## Requirements

1. Keystatic storage must be configured for hosted Git-backed editing (not `kind: "local"`).
2. Admin users must authenticate before editing content.
3. Admin UI must be reachable via `/admin` for non-technical staff.
4. Existing content schemas and file paths must remain compatible with current Astro content collections.
5. Saving content in admin must create Git commits/PR changes traceable to authenticated users.
6. Production deploy must automatically publish content changes after merge/push.
7. Documentation for editors must be reduced to a single short “How to Edit Content” guide.

## Design Notes

- This keeps Astro + Keystatic architecture and avoids new backend/database complexity.
- “Live editing” in this architecture means near-live static deploys after content commit/build.
- Permissions should be managed through Git provider organization/team access.
- Preferred route behavior:
  - `/admin` → editor entry URL
  - `/keystatic` remains available for compatibility (optional)

## Acceptance Criteria

- [ ] Admin can open production `/admin` in browser and see sign-in.
- [ ] Authenticated admin can edit an existing event and upload an image without local tools.
- [ ] A content save results in repository changes attributable to the editor identity.
- [ ] Production site reflects the content update after deploy.
- [ ] Local-only CMS instructions are removed from primary docs.
- [ ] Team handoff includes a one-page admin quickstart.

## Owner Setup Required (Non-code)

1. Choose and confirm Git provider/org ownership for content edits.
2. Create and configure Keystatic auth integration (provider app + OAuth credentials).
3. Store required secrets in hosting environment variables.
4. Grant edit permissions to Ghostbusters admin users in the Git org/repo.
5. Confirm hosting/build hooks auto-deploy after content merges.

## Implementation Notes

- Implemented in repo: hosted-ready Keystatic config toggle, `/admin` redirect route, and simplified editor/technical docs.
- Remaining to go live: complete external auth/app setup and hosting secrets from the owner checklist.
- This PRD is implementation-focused and should be executed before broad content-model expansion.
- If hosted Keystatic auth cannot satisfy team constraints during setup, evaluate fallback CMS options in a follow-up decision PRD.
