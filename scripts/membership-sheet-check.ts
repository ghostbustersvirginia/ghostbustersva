/**
 * PRD 013, phase 0: checks that the site can reach the membership spreadsheet
 * and find the columns it will write. Prints structure and counts only, never
 * names or emails.
 *
 * Run:  npm run check:membership-sheet
 *       npm run check:membership-sheet -- --write-test
 *
 * --write-test also writes one test row (ID, Name, Email only) and clears it
 * again. It refuses unless the spreadsheet's title contains "test".
 *
 * Config (in .env.local or the environment):
 *   MEMBERSHIP_SHEET_ID     the spreadsheet ID
 *   MEMBERSHIP_WORKSHEET    the worksheet (tab) name, default "Membership"
 *
 * Setup: docs/MEMBERSHIP_REQUESTS_SETUP.md
 */
import { memberEnv } from "../src/lib/member-calendar/server/env";
import { getGoogleAccessToken, SCOPES } from "../src/lib/member-calendar/server/google-auth";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const COLUMNS = ["ID", "Name", "Email"] as const;
const ID_PATTERN = /^[A-Za-z0-9]+$/;

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const sheetId = memberEnv.membershipSheetId() ?? fail("MEMBERSHIP_SHEET_ID is not set.");
const worksheet = memberEnv.membershipWorksheet();
const writeTest = process.argv.includes("--write-test");

async function sheets<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getGoogleAccessToken([SCOPES.sheets]);
  const res = await fetch(`${API}/${encodeURIComponent(sheetId)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint =
      res.status === 403
        ? " Is the sheet shared with the Google account the site uses, and is the Sheets scope allowed?"
        : res.status === 404
          ? " Check MEMBERSHIP_SHEET_ID."
          : "";
    fail(`Sheets API ${res.status}.${hint}\n${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const quoted = `'${worksheet.replace(/'/g, "''")}'`;

async function main() {
  console.log(`\nAccess mode: ${memberEnv.accessMode()}`);

  // 1. The spreadsheet and the worksheet.
  const meta = await sheets<{
    properties: { title: string };
    sheets: { properties: { title: string } }[];
  }>("?fields=properties.title,sheets.properties.title");
  const title = meta.properties.title;
  const tabs = meta.sheets.map((s) => s.properties.title);
  console.log(`Spreadsheet: "${title}"`);
  if (!tabs.includes(worksheet)) {
    fail(`No worksheet named "${worksheet}". Worksheets: ${tabs.map((t) => `"${t}"`).join(", ")}`);
  }
  console.log(`✔ Worksheet "${worksheet}" found`);

  // 2. Header row: find ID, Name, Email by name.
  const header = await sheets<{ values?: string[][] }>(
    `/values/${encodeURIComponent(`${quoted}!1:1`)}`,
  );
  const headers = (header.values?.[0] ?? []).map((h) => String(h).trim());
  const positions = new Map<string, number>();
  for (const name of COLUMNS) {
    const index = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (index < 0) fail(`No "${name}" column in row 1. Headers: ${headers.join(" | ")}`);
    positions.set(name, index);
  }
  console.log(
    `✔ Columns: ${COLUMNS.map((c) => `${c} = ${columnLetter(positions.get(c)!)}`).join(", ")}`,
  );
  const others = headers.filter((h, i) => h && ![...positions.values()].includes(i));
  console.log(`  Other columns (never touched): ${others.join(" | ") || "none"}`);

  // 3. The three columns' contents: counts and ID format only.
  const ranges = COLUMNS.map((c) => {
    const letter = columnLetter(positions.get(c)!);
    return `${quoted}!${letter}2:${letter}`;
  });
  const params = new URLSearchParams();
  for (const r of ranges) params.append("ranges", r);
  params.set("majorDimension", "COLUMNS");
  const data = await sheets<{ valueRanges: { values?: string[][] }[] }>(
    `/values:batchGet?${params}`,
  );
  const [ids, names, emails] = data.valueRanges.map((r) =>
    (r.values?.[0] ?? []).map((v) => String(v).trim()),
  );
  const rows = Math.max(ids.length, names.length, emails.length);
  let lastFilled = 0;
  for (let i = 0; i < rows; i++) {
    if (ids[i] || names[i] || emails[i]) lastFilled = i + 2;
  }
  const filledIds = ids.filter(Boolean);
  const lengths = [...new Set(filledIds.map((id) => id.length))].sort((a, b) => a - b);
  const nonAlnum = filledIds.filter((id) => !ID_PATTERN.test(id)).length;
  const duplicateIds = filledIds.length - new Set(filledIds).size;
  const emailList = emails.filter(Boolean).map((e) => e.toLowerCase());
  const duplicateEmails = emailList.length - new Set(emailList).size;

  console.log(`✔ Rows with an ID, Name or Email: ${lastFilled ? lastFilled - 1 : 0}`);
  console.log(`  Next row the site would write: ${lastFilled ? lastFilled + 1 : 2}`);
  console.log(`  ID lengths seen: ${lengths.join(", ") || "none"}`);
  console.log(`  IDs that aren't letters and digits only: ${nonAlnum}`);
  console.log(`  Duplicate IDs: ${duplicateIds}; duplicate emails: ${duplicateEmails}`);

  if (!writeTest) {
    console.log("\nRead-only check passed. Add --write-test (test sheet only) to check writing.\n");
    return;
  }

  // 4. Optional: write and clear one row on a test sheet.
  if (!/test/i.test(title)) {
    fail(`--write-test refuses: the spreadsheet title "${title}" doesn't contain "test".`);
  }
  const row = lastFilled ? lastFilled + 1 : 2;
  const cell = (c: (typeof COLUMNS)[number]) =>
    `${quoted}!${columnLetter(positions.get(c)!)}${row}`;
  const values: Record<(typeof COLUMNS)[number], string> = {
    ID: `test${Math.random().toString(36).slice(2, 6)}`,
    Name: "=[PRD 013 test] stored as text",
    Email: "prd-013-test@example.invalid",
  };
  await sheets("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: COLUMNS.map((c) => ({ range: cell(c), values: [[values[c]]] })),
    }),
  });
  const check = await sheets<{ valueRanges: { values?: string[][] }[] }>(
    `/values:batchGet?${new URLSearchParams(COLUMNS.map((c) => ["ranges", cell(c)]))}&valueRenderOption=UNFORMATTED_VALUE`,
  );
  const readBack = check.valueRanges.map((r) => r.values?.[0]?.[0] ?? "");
  const ok = COLUMNS.every((c, i) => readBack[i] === values[c]);
  console.log(
    `${ok ? "✔" : "✖"} Wrote row ${row}; read back ${ok ? "as written" : readBack.join(" | ")}`,
  );
  // A formula would read back as its result or an error, not the text written.
  if (ok) console.log('  The Name starts with "=" and was stored as text, not run as a formula.');

  await sheets("/values:batchClear", {
    method: "POST",
    body: JSON.stringify({ ranges: COLUMNS.map(cell) }),
  });
  console.log(`✔ Cleared row ${row}'s ID, Name and Email\n`);
  if (!ok) process.exit(1);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
