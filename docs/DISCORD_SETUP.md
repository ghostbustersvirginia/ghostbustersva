# Calendar Discord Integration — Setup Checklist

Setup for [PRD 010](prds/010-calendar-discord-integration.md), done in Discord and
Vercel. None of it is code. It produces the five `DISCORD_*` environment variables, and
it has to be done before phases 2–4 can be tested end to end.

The integration stays off until **all five** variables are set (`memberEnv.discordEnabled()`),
so you can do these steps in any order without affecting the live site.

**Who does what:**

| Step | Needs                                                                          |
| ---- | ------------------------------------------------------------------------------ |
| 1–3  | Anyone with a Discord account. They become the application owner               |
| 4    | A member of the GBVA Discord server with **Manage Server** (to invite the bot) |
| 5    | A server admin who can edit the events channel's permissions                   |
| 6–7  | A Vercel project admin                                                         |

Write down each value marked **📝** as you go. Step 6 lists all of them.

---

## 1. Create the Discord application

- [x] Go to <https://discord.com/developers/applications> and choose **New Application**.
  - Name: `Ghostbusters Virginia` (members see this name on the "Link Discord" consent
    screen and on the bot's messages).
  - Optional: upload the GBVA logo as the app icon.
- [x] Consider creating a **Team** (Developer Portal → Teams) first and creating the app
      under it, so the app isn't tied to one person's account.
- [x] On **General Information**, copy the **Application ID**.
  - 📝 `DISCORD_CLIENT_ID` = Application ID

## 2. OAuth2 settings (for "Link Discord")

- [x] Open **OAuth2**.
- [x] Under **Client Secret**, choose **Reset Secret** and copy the value. Discord shows
      it only once.
  - 📝 `DISCORD_CLIENT_SECRET` (secret)
- [x] Under **Redirects**, add one URI per environment that will run the link flow:

  ```
  https://ghostbustersva.com/api/auth/discord/callback
  http://localhost:4321/api/auth/discord/callback
  ```

  - Discord requires an **exact** match and doesn't allow wildcards. Per-deployment
    Vercel preview URLs won't work. If you want to test on Preview, use a stable preview
    domain (for example a branch alias) and add its callback URL too.
  - If production is still served from `gbva-site.vercel.app`, add
    `https://gbva-site.vercel.app/api/auth/discord/callback` as well.

- [x] You don't need to pick scopes here. The app requests only `identify` at runtime.

## 3. Bot user

- [x] Open **Bot**.
- [x] Choose **Reset Token** and copy the token. Discord shows it only once. Anyone with
      this token can act as the bot, so treat it like a password.
  - 📝 `DISCORD_BOT_TOKEN` (secret)
- [x] Turn **Public Bot** off, so only the application owner can add it to servers.
- [x] Leave **Requires OAuth2 Code Grant** off.
- [x] Leave all three **Privileged Gateway Intents** off. The integration uses REST only
      and never reads messages.

## 4. Invite the bot to the GBVA server

The bot needs these permissions in the events channel:

| Permission               | Why                                     |
| ------------------------ | --------------------------------------- |
| View Channel             | See the events channel                  |
| Send Messages            | Required alongside thread permissions   |
| Create Public Threads    | Create one thread per event series (R2) |
| Send Messages in Threads | Post the starter message, add members   |
| Manage Threads           | Unarchive threads before adding members |

That's permission integer **`326417517568`**.

- [x] Open this URL (replace `<CLIENT_ID>`) while signed in as someone with **Manage
      Server** on the GBVA server:

  ```
  https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&scope=bot&permissions=326417517568&guild_id=998292963127988284&disable_guild_select=true
  ```

- [x] Approve. The bot appears in the member list (offline, which is expected: it never
      connects to the gateway).
- [x] Record the server and channel IDs. They come from the channel link
      `https://discord.com/channels/998292963127988284/1233635927490826340`:
  - 📝 `DISCORD_GUILD_ID` = `998292963127988284`
  - 📝 `DISCORD_EVENTS_CHANNEL_ID` = `1233635927490826340`

  To look up IDs for a different channel later: turn on **User Settings → Advanced →
  Developer Mode**, then right-click the server or channel and choose **Copy Server ID**
  or **Copy Channel ID**.

## 5. Check the events channel permissions

Channel overrides can block what the server-level role allows.

- [x] Open the events channel → **Edit Channel → Permissions**.
- [x] Check that neither `@everyone` nor any role the bot has denies the five permissions
      from step 4. If one does, add an override for the bot's role (it has the same name
      as the app) that allows them.
- [x] Check that members who should be in event threads can **View Channel**. Discord
      can't add someone to a thread in a channel they can't see.
- [x] Members must already be **in the GBVA server**. The site doesn't add people to the
      server (PRD 010 excludes `guilds.join`), so a linked member who isn't in it is
      skipped.

## 6. Add environment variables in Vercel

Project Settings → Environment Variables. Redeploy after saving.

| Variable                    | Value                 | Secret? |
| --------------------------- | --------------------- | ------- |
| `DISCORD_CLIENT_ID`         | Step 1 Application ID | no      |
| `DISCORD_CLIENT_SECRET`     | Step 2                | yes     |
| `DISCORD_BOT_TOKEN`         | Step 3                | yes     |
| `DISCORD_GUILD_ID`          | `998292963127988284`  | no      |
| `DISCORD_EVENTS_CHANNEL_ID` | `1233635927490826340` | no      |

Or with the CLI (each command prompts for the value, so it stays out of shell history):

```sh
vercel env add DISCORD_CLIENT_ID production
vercel env add DISCORD_CLIENT_SECRET production
vercel env add DISCORD_BOT_TOKEN production
vercel env add DISCORD_GUILD_ID production
vercel env add DISCORD_EVENTS_CHANNEL_ID production
```

> **Preview and development:** with the same values, testing on a preview creates real
> threads in the real events channel and adds real members to them.
>
> - Create a private test channel (for example `#calendar-bot-test`) that only admins
>   and the bot can see, and set its ID as `DISCORD_EVENTS_CHANNEL_ID` for Preview and
>   Development only.
> - Or leave the Discord variables unset for Preview, which keeps the integration off
>   there.
> - Use a separate Preview Redis too (see
>   [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) step 10). Otherwise preview
>   threads get written into the production thread records.

- [x] For local development, add the same five values to `.env.local`, pointing at the
      test channel. `vercel env pull .env.local` works if you set them for Development.
- [x] The variable names are already in `.env.example`, `astro.config.mjs`, and
      `memberEnv` (phase 1).

## 7. Sanity checks

These prove the bot setup works before any thread code runs. Read the token without
echoing it:

```sh
read -rs DISCORD_BOT_TOKEN && export DISCORD_BOT_TOKEN
UA='DiscordBot (https://ghostbustersva.com, 1.0)'
```

- [x] **Token is valid.** This should return the bot's user, with `"bot": true`:

  ```sh
  curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "User-Agent: $UA" \
    https://discord.com/api/v10/users/@me
  ```

- [x] **Bot can see the channel.** This should return the channel with `"type": 0` (a
      text channel). A `50001 Missing Access` means the step 5 overrides are blocking it:

  ```sh
  curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "User-Agent: $UA" \
    https://discord.com/api/v10/channels/1233635927490826340
  ```

- [x] **Bot can create threads.** Try this against the **test** channel, not the real
      events channel. It should return a thread with `"type": 11`. Delete the thread
      afterwards in the Discord app:

  ```sh
  curl -s -X POST -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "User-Agent: $UA" \
    -H "Content-Type: application/json" \
    -d '{"name":"Setup check","type":11,"auto_archive_duration":60}' \
    https://discord.com/api/v10/channels/<TEST_CHANNEL_ID>/threads
  ```

- [x] Run `unset DISCORD_BOT_TOKEN` when you're done.

---

## If a secret leaks

- **Bot token:** Developer Portal → Bot → **Reset Token**, then update
  `DISCORD_BOT_TOKEN` in Vercel and redeploy. The old token stops working immediately.
  Discord also resets tokens it finds in public GitHub repos.
- **Client secret:** Developer Portal → OAuth2 → **Reset Secret**, then update
  `DISCORD_CLIENT_SECRET` and redeploy. Existing links aren't affected, because the site
  stores only Discord user IDs, not OAuth tokens.

## Done when

- [x] Every 📝 value is recorded, and the step 6 variables are set in Vercel.
- [x] The bot is in the GBVA server, and the step 7 checks pass.
- [x] The redirect URIs in step 2 match every environment that will run "Link Discord".
- [x] Preview/Development either point at a test channel or have the integration off.
    