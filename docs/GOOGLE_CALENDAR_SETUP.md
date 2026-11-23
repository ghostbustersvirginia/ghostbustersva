# Member Calendar — Phase 0 Setup Checklist

Setup for [PRD 008](prds/008-user-calendar-integration.md), done in Google and Vercel. None
of it is code, and it all has to be done before Phase 1 can be tested end to end.

**Who does what:**

| Step | Needs                                                                                     |
| ---- | ----------------------------------------------------------------------------------------- |
| 1–4  | A Google Cloud project owner (anyone with a `@ghostbustersva.com` account can create one) |
| 5    | A Google Workspace **super admin** for ghostbustersva.com                                 |
| 6    | Whoever manages the `calendar-automation@` account                                        |
| 7    | A Google Groups owner for `all-members@` and `officers@`                                  |
| 8–10 | A Vercel project admin                                                                    |

Write down each value marked **📝** as you go. Step 10 lists all of them.

---

## 1. Create the Google Cloud project

- [x] Sign in to <https://console.cloud.google.com> with a `@ghostbustersva.com` account.
- [x] Create a project (suggested name: `gbva-site`) **under the ghostbustersva.com
      organization**, not "No organization".
  - 📝 Project ID: gbva-site
  - 📝 Project **number**, shown on the project dashboard
- [x] Enable these APIs (APIs & Services → Library):
  - Google Calendar API
  - Cloud Identity API
  - IAM Service Account Credentials API
  - Security Token Service API

  Or, with the gcloud CLI:

  ```sh
  gcloud config set project gbva-site
  gcloud services enable calendar-json.googleapis.com cloudidentity.googleapis.com \
    iamcredentials.googleapis.com sts.googleapis.com
  ```

## 2. Configure the OAuth consent screen ("Google Auth Platform")

- [ ] **Branding:**
  - App name `Ghostbusters Virginia`
  - Support email: a group or shared inbox, not a personal address
  - Logo: optional
  - App home page: `https://ghostbustersva.com`
  - Privacy policy: see the note below
  - Authorized domain: `ghostbustersva.com`
- [ ] **Audience:** user type **External**, because most members use personal Gmail.
      Then **Publish app** so the status is **In production**.
  - While the app is in "Testing", only listed test users can sign in.
- [ ] **Data access:** add only `openid`, `.../auth/userinfo.email`, and
      `.../auth/userinfo.profile`.
  - Do **not** add any Calendar scopes here. The server holds those (step 4), not the
    user.
  - With only these scopes, the app should not need Google's security review.

> ⚠️ **Privacy policy:** the site has no privacy policy page yet. Google asks for one
> before it will show the app's branding (verification). The feature also stores names
> and an RSVP change log. Add a simple `/privacy` page before launch, covering what's
> stored, who can see it, how long it's kept, and how to ask for removal. That's a small
> follow-up task.

## 3. Create the OAuth client ID

- [x] Google Auth Platform → Clients → **Create client** → type **Web application**,
      name `GBVAMembers`.
- [x] **Authorized JavaScript origins:**
  - `https://ghostbustersva.com`
  - `https://www.ghostbustersva.com`
  - `http://localhost`
  - `http://localhost:4321` (Astro dev). The Google sign-in button needs both
    localhost entries.
  - Your staging / preview origin: see the note below.
- [x] **Authorized redirect URIs:** leave empty. The sign-in flow returns a token directly
      to the page.
- 📝 **Client ID** (`…apps.googleusercontent.com`). It isn't secret, but keep it in env
  vars anyway.

> **Preview deployments:** Google doesn't allow wildcard origins, and every Vercel preview
> URL is different. Pick one:
>
> - **Recommended:** a fixed staging domain, e.g. `staging.ghostbustersva.com`, assigned
>   to a `staging` branch in Vercel.
> - A Vercel branch alias such as `gbva-site-git-<branch>-<team>.vercel.app`, added here
>   for each long-lived branch.
>
> Sign-in won't work on any other preview URL. That's acceptable.

## 4. Create the service account

- [x] IAM & Admin → Service Accounts → **Create**:
  - name `gbva-calendar-proxy`
  - **no** project roles
  - do not create a key yet
- 📝 Service account **email**, e.g.
  `gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com`
- 📝 Service account **Unique ID** (a long number), needed for domain-wide delegation (step 5, Part B).
  100949542158821650227

```sh
gcloud iam service-accounts create gbva-calendar-proxy --display-name="GBVA calendar proxy"
```

## 5. Give the service account access in Workspace (super admin)

Do **both** parts below. Part A gives the service account its own access to groups and the
calendar. Part B is still required: Google refuses to let a service account add attendees
to an event (`forbiddenForServiceAccounts`) unless it uses domain-wide delegation, so
real RSVPs can't be saved without it.

### Part A: direct access (groups, and reading the calendar)

- [x] **Groups access:**
  - In the Admin console (<https://admin.google.com>), go to Account → **Admin roles** →
    **Groups Reader**.
  - Under **Assign service accounts**, add the service account email.
  - Changes can take up to 24h to apply. The role lets the service account see group
    membership, including nested groups.
- [x] **Calendar access:** handled in step 6, by sharing the calendar with the service
      account.
- [x] Check whether the Workspace **external calendar-sharing policy** allows it. The
      service account's email is outside the ghostbustersva.com domain.
  - Admin console → Apps → Google Workspace → Calendar → Sharing settings →
    _External sharing options for primary calendars_ / _secondary calendars_.
  - It needs to allow at least **"Share all information, and outsiders can change
    calendars"** for secondary calendars, or step 6 will fail.
  - If you don't want to loosen this, skip the calendar sharing in step 6. Part B covers
    calendar access on its own.

### Part B: domain-wide delegation for the calendar (required for RSVPs)

Domain-wide delegation lets the service account act as **any user** in the domain, but
only within the granted scope. Grant only the calendar scope. The server uses it only to
act as `calendar-automation@` for Calendar calls; group checks keep using Part A.

- [ ] Admin console → Security → Access and data control → API controls → **Manage
      Domain Wide Delegation** → **Add new**:
  - Client ID: the service account **Unique ID** (step 4)
  - Scope:
    ```
    https://www.googleapis.com/auth/calendar.events
    ```
- [ ] Confirm `calendar-automation@` can **make changes to events** on GBVA Events. As
      the calendar's owner, it can.
- [ ] Let the service account sign on its own behalf. Keyless delegation signs its
      assertion through the IAM Credentials API, which needs this binding:
  ```sh
  gcloud iam service-accounts add-iam-policy-binding \
    gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com --project=gbva-site \
    --role=roles/iam.serviceAccountTokenCreator \
    --member="serviceAccount:gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com"
  ```
- [ ] In step 10, set `GOOGLE_ACCESS_MODE=delegated` and
      `GOOGLE_DELEGATED_USER=calendar-automation@ghostbustersva.com`.

## 6. Prepare the "GBVA Events" calendar

Sign in as `calendar-automation@ghostbustersva.com`.

- [x] **Part A:** open calendar settings → _Share with specific people_ → add the
      service account email with **"Make changes to events"**.
- [x] Settings → _Integrate calendar_ → copy the **Calendar ID**. It ends in
      `@group.calendar.google.com`.
  - 📝 Calendar ID
  - The ID in the PRD is base64-encoded. Use the decoded form shown here.

- [x] **Organizer check:** open 3–4 existing events and confirm the organizer is the
      GBVA Events calendar itself. That's the case when an event is created _on_ the
      calendar.
  - Events created on someone's personal calendar and then invited to this one belong to
    that person. RSVP will be disabled for those.
  - Tell event creators: **always create events directly on GBVA Events.**
- [x] **Guest list visibility:** for existing upcoming events, open each → Guest
      permissions → check **See guest list**. New events have this on by default; leave
      it that way.
- [x] **Organizer conventions** (share with whoever creates events):
  - Title format `<Chapter> - <Event title>`. Chapters: Blue Ridge/CVille,
    Central/Richmond/RVA, NoVA, Fredericksburg/FXBG, Southeast/757, Virtual.
  - One event per day for multi-day events.
  - Do not use "Notify guests" when editing events, or members will get email.

## 7. Check the Google Groups

- [x] Confirm `all-members@ghostbustersva.com` exists and includes members' **personal
      Gmail addresses**, with the exact spelling they sign in with.
  - Nested chapter groups are fine, because the check counts members of nested groups.
- [x] Confirm `officers@ghostbustersva.com` exists and lists the officers who can download
      the late-change CSV.
- [x] Group settings → **Allow members from outside the organization** must be on for
      `all-members@`.
- [x] Pick 2 test accounts: a member's personal Gmail, and a Gmail that is **not** in the
      group. They're used in step 11.

## 8. Connect Vercel to Google without a stored key (Workload Identity Federation)

This lets the Vercel functions sign in to Google as the service account, with no key
file anywhere.

- [x] Vercel → Project → Settings → **Security** → _Secure backend access with OIDC
      federation_ → **Enabled**, issuer mode **Team**.
  - 📝 Team slug
  - 📝 Project name
  - The issuer is `https://oidc.vercel.com/<team-slug>`, and the audience is
    `https://vercel.com/<team-slug>`.
- [x] Create the identity pool and provider in Google Cloud:

  ```sh
  TEAM=gbva; PROJECT=gbva-site; GCP_NUM=<gcp-project-number>

  gcloud iam workload-identity-pools create vercel \
    --location=global --display-name="Vercel"

  gcloud iam workload-identity-pools providers create-oidc vercel \
    --location=global --workload-identity-pool=vercel \
    --issuer-uri="https://oidc.vercel.com/${TEAM}" \
    --allowed-audiences="https://vercel.com/${TEAM}" \
    --attribute-mapping="google.subject=assertion.sub" \
    --attribute-condition="assertion.sub.startsWith('owner:${TEAM}:project:${PROJECT}:environment:')"
  ```

- [x] Let each Vercel environment act as the service account:

  ```sh
  for ENV in production preview development; do
    gcloud iam service-accounts add-iam-policy-binding \
      gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com \
      --role=roles/iam.workloadIdentityUser \
      --member="principal://iam.googleapis.com/projects/${GCP_NUM}/locations/global/workloadIdentityPools/vercel/subject/owner:${TEAM}:project:${PROJECT}:environment:${ENV}"
  done
  ```

  Drop `development` if you don't want local dev to reach real data. Local dev gets its
  token via `vercel env pull`, which expires after about 12h. Run it again when calls
  start failing.

- 📝 Pool ID `vercel`, provider ID `vercel`

> **Fallback, a JSON key:** only if Workload Identity Federation can't be made to work.
>
> - Newer Google Cloud organizations block key creation by default (the
>   `iam.disableServiceAccountKeyCreation` policy). An org admin would have to make an
>   exception for this project.
> - If you do create a key, store it base64-encoded in one secret env var. Never commit
>   it.
> - Plan to rotate it yearly.

## 9. Webhook and cron secrets

These support detecting RSVP changes made in Google Calendar (PRD R7.5).

- [x] Generate two random secrets:
      `openssl rand -base64 32` → `CALENDAR_WEBHOOK_TOKEN`, and
      `openssl rand -base64 32` → `CRON_SECRET`.
- [x] Generate the session signing secret: `openssl rand -base64 48` → `SESSION_SECRET`.
- [x] Vercel cron jobs only run on **Production**. The push channel will be registered for
      the production webhook URL only. Previews won't receive change notifications;
      that's expected.
- [ ] The Hobby plan only allows a daily Vercel cron, so a GitHub Actions workflow
      (`.github/workflows/calendar-sync.yml`) calls the same endpoint every 6 hours.
      Add the secret on GitHub: repo **Settings → Secrets and variables → Actions → New
      repository secret**, name `CRON_SECRET`, with the same value as Production's
      `CRON_SECRET` in Vercel. Then run the workflow once from the **Actions** tab
      ("Calendar sync" → **Run workflow**) to register the channel right away.

## 10. Add environment variables in Vercel

Project Settings → Environment Variables. Use the same values for Production and
Preview unless noted otherwise. Redeploy after saving.

| Variable                                 | Value                                                    | Secret? |
| ---------------------------------------- | -------------------------------------------------------- | ------- |
| `GOOGLE_OAUTH_CLIENT_ID`                 | Step 3 client ID                                         | no      |
| `GBVA_EVENTS_CALENDAR_ID`                | Step 6 calendar ID                                       | yes     |
| `GBVA_MEMBERS_GROUP`                     | `all-members@ghostbustersva.com`                         | no      |
| `GBVA_ORGANIZERS_GROUP`                  | `officers@ghostbustersva.com`                            | no      |
| `GOOGLE_ACCESS_MODE`                     | `delegated` (needed for RSVPs; `direct` is read-only)    | no      |
| `GOOGLE_DELEGATED_USER`                  | `calendar-automation@ghostbustersva.com`                 | no      |
| `GCP_PROJECT_NUMBER`                     | Step 1 project number                                    | no      |
| `GCP_SERVICE_ACCOUNT_EMAIL`              | Step 4 email                                             | no      |
| `GCP_WORKLOAD_IDENTITY_POOL_ID`          | `vercel`                                                 | no      |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | `vercel`                                                 | no      |
| `SESSION_SECRET`                         | Step 9 (**different** values for Production and Preview) | yes     |
| `CALENDAR_WEBHOOK_TOKEN`                 | Step 9 (Production only)                                 | yes     |
| `CRON_SECRET`                            | Step 9 (Production only)                                 | yes     |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`      | Already set for rate limiting; see the note below        | yes     |

> **Redis for Preview:** RSVP fingerprints, display names and the late-change log are
> stored in Redis.
>
> - If Preview shares the production Redis database, testing on a preview will write into
>   the real late-change log.
> - Create a second free Upstash database for Preview and development, and set its
>   URL/token for those environments only.
> - In Production, confirm both Upstash variables are set. RSVP change tracking needs them,
>   even though rate limiting can work without them.

- [x] Copy the non-secret names into `.env.example`, and add the schema entries to
      `astro.config.mjs`. That part is done in Phase 1 code.

## 11. Sanity checks before Phase 1

These checks prove the setup works before any site code exists.

- [x] **OAuth:** sign in at the OAuth Playground
      (<https://developers.google.com/oauthplayground>) with your own client ID and the
      `openid email` scopes. No "unverified app" screen should appear.
- [x] **Service account → calendar:** from a machine with gcloud, impersonate the service
      account and list a few events:

  ```sh
  gcloud auth print-access-token \
    --impersonate-service-account=gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/calendar.events > /tmp/tok
  curl -s -H "Authorization: Bearer $(cat /tmp/tok)" \
    "https://www.googleapis.com/calendar/v3/calendars/<CALENDAR_ID_URL_ENCODED>/events?maxResults=3&singleEvents=true" | head -40
  ```

  This needs you to hold Token Creator on the service account temporarily. It works for
  This checks Part A access only. Delegated calendar access is checked from the app.

- [x] **Service account → groups:** the same token with the
      `cloud-identity.groups.readonly` scope, calling
      `GET https://cloudidentity.googleapis.com/v1/groups:lookup?groupKey.id=all-members@ghostbustersva.com`.
      It should return `groups/<id>`.
- [x] Remove any temporary Token Creator grant you gave yourself.

---

## Done when

- [x] Every 📝 value is recorded, and the env vars from step 10 are set in Vercel.
- [x] Both sanity checks in step 11 return data.
- [x] Event creators have the conventions from step 6.
- [x] There's a `/privacy` page, or a follow-up task for one.
- [x] Update PRD 008 → Architecture with the access option used (A or B).
