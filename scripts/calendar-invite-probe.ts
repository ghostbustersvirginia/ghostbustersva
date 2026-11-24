/**
 * PRD 012, phase 0: checks how Google Calendar handles attendee invitations
 * before the site changes how it writes RSVPs. Runs only against a TEST
 * calendar, never the production GBVA Events calendar.
 *
 * Run:  npm run probe:invites
 * Setup and the full checklist: docs/CALENDAR_INVITE_TESTING.md
 *
 * Config (in .env.local or the environment):
 *   INVITE_PROBE_CALENDAR_ID  test calendar ID; its name must contain "test"
 *   INVITE_PROBE_ACCOUNTS     comma-separated test Gmail addresses (ideally 3,
 *                             one per "Add invitations to my calendar" setting)
 *   INVITE_PROBE_BYSTANDER    another test address, on every event from the
 *                             start, to see whether other guests get emailed
 *
 * Uses the site's own Google auth (delegated as GOOGLE_DELEGATED_USER).
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { memberEnv } from "../src/lib/member-calendar/server/env";
import { getGoogleAccessToken, SCOPES } from "../src/lib/member-calendar/server/google-auth";

type SendUpdates = "all" | "none";
type ResponseStatus = "accepted" | "tentative" | "declined" | "needsAction";

interface Attendee {
  email: string;
  responseStatus?: ResponseStatus;
}

interface Event {
  id: string;
  summary?: string;
  attendees?: Attendee[];
  start?: { dateTime?: string };
}

const API = "https://www.googleapis.com/calendar/v3";
const TITLE_PREFIX = "[PRD 012 test]";
const TIME_ZONE = "America/New_York";

/* --- Config and safety checks ------------------------------------------- */

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function listEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const calendarId = process.env.INVITE_PROBE_CALENDAR_ID?.trim() ?? "";
const accounts = listEnv("INVITE_PROBE_ACCOUNTS");
const [bystander] = listEnv("INVITE_PROBE_BYSTANDER");

if (!calendarId) fail("Set INVITE_PROBE_CALENDAR_ID to the test calendar's ID.");
if (accounts.length === 0) fail("Set INVITE_PROBE_ACCOUNTS to one or more test Gmail addresses.");
if (!bystander) fail("Set INVITE_PROBE_BYSTANDER to another test address.");

const production = (process.env.GBVA_EVENTS_CALENDAR_ID ?? "").trim().toLowerCase();
if (production && calendarId.toLowerCase() === production) {
  fail("INVITE_PROBE_CALENDAR_ID is the production GBVA Events calendar. Use a test calendar.");
}
if (memberEnv.accessMode() !== "delegated") {
  fail("Adding attendees needs GOOGLE_ACCESS_MODE=delegated (set it for this run).");
}
const forbidden = new Set(
  [memberEnv.delegatedUser(), ...memberEnv.groupAddresses()].map((e) => e.toLowerCase()),
);
for (const email of [...accounts, bystander]) {
  if (forbidden.has(email))
    fail(`${email} is the automation account or a group, not a test account.`);
}
if (accounts.includes(bystander)) fail("The bystander must not also be in INVITE_PROBE_ACCOUNTS.");

/* --- Calendar API ------------------------------------------------------- */

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getGoogleAccessToken([SCOPES.calendar]);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok)
    fail(`Google API ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const events = (path = "") => `/calendars/${encodeURIComponent(calendarId)}/events${path}`;

async function assertTestCalendar(): Promise<string> {
  const { summary } = await api<{ summary?: string }>(`${events()}?maxResults=1`);
  if (!summary || !/test/i.test(summary)) {
    fail(
      `The calendar's name is "${summary ?? ""}". It must contain "test" so production can't be hit by mistake.`,
    );
  }
  return summary;
}

/** A start two weeks out at 7pm Eastern, as a local date-time string. */
function localDateTime(daysAhead: number, hour: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  return `${ymd}T${String(hour).padStart(2, "0")}:00:00`;
}

async function createEvent(title: string, recurrence?: string[]): Promise<Event> {
  return api<Event>(`${events()}?sendUpdates=none`, {
    method: "POST",
    body: JSON.stringify({
      summary: `${TITLE_PREFIX} ${title}`,
      description:
        "Created by scripts/calendar-invite-probe.ts (PRD 012, phase 0). Safe to delete.",
      start: { dateTime: localDateTime(14, 19), timeZone: TIME_ZONE },
      end: { dateTime: localDateTime(14, 20), timeZone: TIME_ZONE },
      guestsCanSeeOtherGuests: true,
      attendees: [{ email: bystander, responseStatus: "accepted" }],
      ...(recurrence ? { recurrence } : {}),
    }),
  });
}

async function getEvent(id: string): Promise<Event> {
  return api<Event>(events(`/${encodeURIComponent(id)}`));
}

async function setAttendees(id: string, attendees: Attendee[], sendUpdates: SendUpdates) {
  await api<Event>(events(`/${encodeURIComponent(id)}?sendUpdates=${sendUpdates}`), {
    method: "PATCH",
    body: JSON.stringify({ attendees }),
  });
}

async function addAttendee(id: string, email: string, status: ResponseStatus, send: SendUpdates) {
  const current = (await getEvent(id)).attendees ?? [];
  const rest = current.filter((a) => a.email.toLowerCase() !== email);
  await setAttendees(id, [...rest, { email, responseStatus: status }], send);
}

async function removeAttendee(id: string, email: string, send: SendUpdates) {
  const current = (await getEvent(id)).attendees ?? [];
  await setAttendees(
    id,
    current.filter((a) => a.email.toLowerCase() !== email),
    send,
  );
}

async function instancesOf(id: string): Promise<Event[]> {
  const { items } = await api<{ items?: Event[] }>(
    events(`/${encodeURIComponent(id)}/instances?maxResults=20`),
  );
  return items ?? [];
}

async function deleteEvent(id: string) {
  // "all" so the test accounts' calendars are cleaned up too.
  await api<void>(events(`/${encodeURIComponent(id)}?sendUpdates=all`), { method: "DELETE" });
}

/* --- Interactive steps -------------------------------------------------- */

const rl = createInterface({ input: process.stdin, output: process.stdout });
const results: { check: string; question: string; notes: string }[] = [];
const created: string[] = [];

async function observe(check: string, question: string) {
  console.log(`\n  Check ${check}: ${question}`);
  const notes = await rl.question("  What did you see? (Enter to skip) › ");
  results.push({ check, question, notes: notes.trim() || "—" });
}

async function pause(message: string) {
  await rl.question(`\n${message}\nPress Enter when ready › `);
}

// The first account is removed (check 4) and used for the series (check 6); the
// second is re-invited (check 5). Every account is added in check 1.
const [first, second = first] = accounts;
/** The second account answers Maybe so check 2 sees both statuses; the rest answer Yes. */
const statusFor = (index: number): ResponseStatus => (index === 1 ? "tentative" : "accepted");

async function run() {
  const name = await assertTestCalendar();
  console.log(`\nTest calendar: "${name}"`);
  console.log(`Acting as: ${memberEnv.delegatedUser()}`);
  console.log(`Test accounts: ${accounts.join(", ")}`);
  console.log(`Bystander: ${bystander}`);
  await pause(
    'Before starting, check each test account\'s "Add invitations to my calendar" setting\n' +
      "(Google Calendar → Settings → Event settings) and clear their inboxes.",
  );

  // Checks 1, 2, 3, 7: adding with invitations.
  const single = await createEvent("single event");
  created.push(single.id);
  console.log(
    `\n→ Created a one-off event (${single.start?.dateTime}) with only the bystander, silently.`,
  );
  for (const [i, email] of accounts.entries()) {
    const status = statusFor(i);
    await addAttendee(single.id, email, status, "all");
    console.log(
      `→ Added ${email} as ${status === "accepted" ? "Yes" : "Maybe"} (${status}), sendUpdates=all.`,
    );
  }
  await pause("Wait a minute, then check each account's inbox and Google Calendar.");
  await observe(
    "1",
    "Did each added account get an invitation, and does the event appear on its calendar? Note which setting each account has.",
  );
  await observe(
    "2",
    "Does the event show as Yes/Maybe as the site set it, or as awaiting a response?",
  );
  await observe(
    "3",
    "Did the bystander, or any account added earlier, get an email when another account was added?",
  );
  await observe(
    "7",
    "Who does the invitation say it's from (calendar name, or calendar-automation@)?",
  );

  // Check 4: removing with a cancellation.
  await removeAttendee(single.id, first, "all");
  console.log(`\n→ Removed ${first}, sendUpdates=all.`);
  await pause(`Check ${first}'s inbox and calendar, and the bystander's inbox.`);
  await observe(
    "4",
    `Did ${first} get a cancellation, and is the event gone from its calendar? Did anyone else get email?`,
  );

  // Check 5: re-inviting someone already on the event (Update My Calendar).
  await removeAttendee(single.id, second, "none");
  await addAttendee(single.id, second, "tentative", "all");
  console.log(
    `\n→ Re-invited ${second}: removed silently, then added back as Maybe with sendUpdates=all.`,
  );
  await pause(`Check ${second}'s inbox and calendar, and everyone else's inbox.`);
  await observe(
    "5",
    `Did ${second} get exactly one new invitation, and nobody else any email? Is the event still on its calendar as Maybe?`,
  );

  // Check 6: recurring events, invitation on the first instance only.
  const series = await createEvent("weekly series", ["RRULE:FREQ=WEEKLY;COUNT=6"]);
  created.push(series.id);
  const instances = await instancesOf(series.id);
  console.log(
    `\n→ Created a weekly series with ${instances.length} instances, bystander only, silently.`,
  );
  for (const [i, instance] of instances.entries()) {
    await addAttendee(instance.id, first, "accepted", i === 0 ? "all" : "none");
  }
  console.log(
    `→ Added ${first} as Yes to every instance: sendUpdates=all on the first, none on the rest.`,
  );
  await pause(
    `Wait a minute, then check ${first}'s inbox and calendar for all ${instances.length} weeks.`,
  );
  await observe(
    "6",
    `How many emails did ${first} get? Which of the ${instances.length} weeks appear on its calendar? Did the bystander get any email?`,
  );

  // Results and cleanup.
  const lines = [
    `# PRD 012 phase 0 results (${new Date().toISOString().slice(0, 10)})`,
    "",
    `Test calendar: ${name}. Accounts: ${accounts.length}, plus a bystander.`,
    "",
    "| Check | Question | What we saw |",
    "| --- | --- | --- |",
    ...results.map((r) => `| ${r.check} | ${r.question} | ${r.notes.replace(/\|/g, "\\|")} |`),
  ];
  const file = join(tmpdir(), `prd-012-phase0-${Date.now()}.md`);
  writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`\n${lines.join("\n")}\n\nSaved to ${file}`);

  const answer = await rl.question(
    "\nDelete the test events now? This sends cancellations to the test accounts. (y/N) › ",
  );
  if (answer.trim().toLowerCase() === "y") {
    for (const id of created) await deleteEvent(id);
    console.log("→ Deleted the test events.");
  } else {
    console.log(`→ Kept them. Their titles start with "${TITLE_PREFIX}".`);
  }
}

run()
  .catch((error) => fail(error instanceof Error ? error.message : String(error)))
  .finally(() => rl.close());
