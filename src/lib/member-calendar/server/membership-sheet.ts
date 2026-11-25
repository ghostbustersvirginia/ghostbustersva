/**
 * The GBVA membership spreadsheet (PRD 013, R3). Officers approve new members
 * from its Membership worksheet. The site only ever reads and writes the ID,
 * Name and Email columns, found by their headers in row 1.
 */
import { randomInt } from "node:crypto";
import { memberEnv } from "./env";
import { GoogleApiError } from "./google-api";
import { getGoogleAccessToken, SCOPES } from "./google-auth";
import { normalizeEmail } from "./logic";
import { withLock } from "./store";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
export const SHEET_COLUMNS = ["ID", "Name", "Email"] as const;
export type SheetColumn = (typeof SHEET_COLUMNS)[number];
const ID_LENGTH = 8;
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LOCK_KEY = "membership-sheet-lock";

export class MembershipSheetError extends Error {}

/* --- Pure helpers ------------------------------------------------------- */

/** Column indexes of ID, Name and Email in the header row, ignoring case. */
export function findColumns(headers: string[]): Record<SheetColumn, number> {
  const normalized = headers.map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase(),
  );
  const out = {} as Record<SheetColumn, number>;
  for (const name of SHEET_COLUMNS) {
    const index = normalized.indexOf(name.toLowerCase());
    if (index < 0) throw new MembershipSheetError(`No "${name}" column in the header row`);
    out[name] = index;
  }
  return out;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export interface SheetRows {
  ids: string[];
  names: string[];
  emails: string[];
}

/**
 * The sheet row to write next: the first after the last row with an ID, Name
 * or Email. Other columns (checkboxes, AppSheet's) don't count, so rows that
 * only have a checkbox are filled in rather than skipped.
 */
export function nextRow({ ids, names, emails }: SheetRows): number {
  const length = Math.max(ids.length, names.length, emails.length);
  let last = 1; // the header row
  for (let i = 0; i < length; i++) {
    if (ids[i]?.trim() || names[i]?.trim() || emails[i]?.trim()) last = i + 2;
  }
  return last + 1;
}

export function hasEmail(emails: string[], email: string): boolean {
  const target = normalizeEmail(email);
  return emails.some((e) => e && normalizeEmail(e) === target);
}

/** An 8-character lowercase alphanumeric ID not already used (case-insensitive). */
export function newMemberId(
  existing: string[],
  random: (max: number) => number = randomInt,
): string {
  const taken = new Set(existing.map((id) => id.trim().toLowerCase()));
  for (;;) {
    let id = "";
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[random(ID_ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
}

/* --- Sheets API --------------------------------------------------------- */

function sheetId(): string {
  const id = memberEnv.membershipSheetId();
  if (!id) throw new MembershipSheetError("MEMBERSHIP_SHEET_ID is not set");
  return id;
}

async function sheets<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getGoogleAccessToken([SCOPES.sheets]);
  const res = await fetch(`${API}/${encodeURIComponent(sheetId())}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[member-calendar] Sheets API ${res.status}: ${text.slice(0, 300)}`);
    throw new GoogleApiError(res.status, text.slice(0, 200));
  }
  return (await res.json()) as T;
}

function worksheetRange(range: string): string {
  return `'${memberEnv.membershipWorksheet().replace(/'/g, "''")}'!${range}`;
}

interface SheetSnapshot {
  columns: Record<SheetColumn, number>;
  rows: SheetRows;
}

async function readSheet(): Promise<SheetSnapshot> {
  const header = await sheets<{ values?: string[][] }>(
    `/values/${encodeURIComponent(worksheetRange("1:1"))}`,
  );
  const columns = findColumns(header.values?.[0] ?? []);
  const params = new URLSearchParams({ majorDimension: "COLUMNS" });
  for (const name of SHEET_COLUMNS) {
    const letter = columnLetter(columns[name]);
    params.append("ranges", worksheetRange(`${letter}2:${letter}`));
  }
  const data = await sheets<{ valueRanges: { values?: string[][] }[] }>(
    `/values:batchGet?${params}`,
  );
  const [ids, names, emails] = data.valueRanges.map((r) =>
    (r.values?.[0] ?? []).map((v) => String(v ?? "")),
  );
  return { columns, rows: { ids: ids ?? [], names: names ?? [], emails: emails ?? [] } };
}

/** Whether this email already has a row (PRD 013, R4.4). */
export async function hasRequest(email: string): Promise<boolean> {
  const { rows } = await readSheet();
  return hasEmail(rows.emails, email);
}

export type AddRequestResult = { status: "added"; id: string; row: number } | { status: "pending" };

/**
 * Adds a row for this person unless their email is already on the sheet.
 * Writes the ID, Name and Email cells only, as raw text, never `append`
 * (R3.3–R3.5). Runs under a lock so two requests can't take the same row.
 */
export function addRequest(input: { email: string; name: string }): Promise<AddRequestResult> {
  return withLock(LOCK_KEY, async () => {
    const { columns, rows } = await readSheet();
    if (hasEmail(rows.emails, input.email)) return { status: "pending" };

    const row = nextRow(rows);
    const id = newMemberId(rows.ids);
    const values: Record<SheetColumn, string> = { ID: id, Name: input.name, Email: input.email };
    await sheets("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: SHEET_COLUMNS.map((name) => ({
          range: worksheetRange(`${columnLetter(columns[name])}${row}`),
          values: [[values[name]]],
        })),
      }),
    });
    return { status: "added", id, row };
  });
}

/** A link to the sheet for officers' email, built at send time (R5.3). */
export function membershipSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId())}/edit`;
}
