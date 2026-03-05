# CMS Quickstart (Editors)

Use this page if you manage content and do not work in code.

## Sign in

1. Open `https://ghostbustersva.vercel.app/admin` in your browser.
2. Click **Sign in with GitHub** and authenticate with your GitHub account.
3. You need **write access** to the `ghostbustersva` repo — ask the project lead if you don't have it.
4. You will be taken to the content dashboard.

If your team is still in setup mode, use the temporary URL shared by the project lead.

## What you can edit

- **Events:** titles, dates, summaries, links, and event images.
- **Media / Gallery:** add photos, captions, and alt text.
- **Page Copy:** editable text on About, Join, Contact, and Donate pages (titles, intro text, lists, links).
- **Site Settings:** site name, description, donate/store links, contact email, social links, footer text.

## Common tasks

### Add an event

1. Open **Events**.
2. Click **Create**.
3. Fill required fields and upload an image.
4. Click **Save**.

### Update event text, link, or image

1. Open **Events**.
2. Select the event.
3. Edit fields.
4. Click **Save**.

### Add a gallery photo

1. Open **Media / Gallery**.
2. Click **Create**.
3. Add image, title, and alt text.
4. Click **Save**.

### Update global links

1. Open **Site Settings**.
2. Edit donate/store/social links.
3. Click **Save**.

### Edit page text (About, Join, Contact, Donate)

1. Open the page copy singleton (e.g., **About Page Copy**).
2. Edit titles, intro text, list items, or links.
3. Click **Save**.

## Publishing behavior

- The CMS works through a **branch workflow**: when you save, Keystatic creates a branch and a pull request on GitHub.
- After you confirm the PR is merged (or if your branch is set to auto-merge), Vercel auto-deploys the change within ~1-2 minutes.
- You can choose an existing branch or create a new one from the dropdown at the top of the dashboard.
- If content is urgent, notify the project lead to confirm deploy status.

## Limits (by design)

- Layout and visual design are developer-managed.
- Navigation structure and component behavior are developer-managed.
- If you need a new section or layout change, request it from the project lead.

## Troubleshooting

**I cannot sign in**

- Confirm your GitHub account has **write access** to the `ghostbustersva` repo.
- Ask the project lead to add you as a collaborator.

**I saved, but site is unchanged**

- Wait for deploy to finish.
- Ask the project lead to verify the latest deployment.

**Image is missing**

- Re-open the entry and confirm the image field is set.
- Make sure alt text is present and save again.
