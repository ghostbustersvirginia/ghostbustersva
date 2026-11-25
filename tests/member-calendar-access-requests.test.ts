import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret";
const SHEET = "sheet-123";
const ORIGIN = "https://ghostbustersva.com";

vi.mock("../src/lib/member-calendar/server/env", () => {
  class ConfigError extends Error {}
  return {
    ConfigError,
    readEnv: () => undefined,
    memberEnv: {
      sessionSecret: () => SECRET,
      membershipSheetId: () => SHEET,
      membershipWorksheet: () => "Membership",
      officersEmail: () => "officers@ghostbustersva.com",
      accessMode: () => "delegated",
    },
  };
});
vi.mock("../src/lib/member-calendar/server/google-auth", () => ({
  getGoogleAccessToken: async () => "token",
  SCOPES: { sheets: "sheets-scope" },
}));
vi.mock("../src/lib/member-calendar/server/store", () => ({
  withLock: (_key: string, fn: () => Promise<unknown>) => fn(),
}));
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("../src/lib/email", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sendEmail: email.sendEmail,
}));
const membership = vi.hoisted(() => ({ isMember: false }));
vi.mock("../src/lib/member-calendar/server/http", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAllowedOrigin: () => true,
  checkMembership: async () => ({ isMember: membership.isMember, isOrganizer: false }),
}));
vi.mock("../src/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ limited: false }),
  getIp: () => "1.2.3.4",
}));

import {
  APPLICANT_COOKIE,
  applicantCookieHeader,
  decodeApplicant,
  encodeApplicant,
} from "../src/lib/member-calendar/server/applicant";
import { encodeSession, newSession } from "../src/lib/member-calendar/server/session";
import {
  addRequest,
  columnLetter,
  findColumns,
  hasEmail,
  newMemberId,
  nextRow,
} from "../src/lib/member-calendar/server/membership-sheet";
import { officerEmail, requestAccess } from "../src/lib/member-calendar/server/access-requests";
import { POST as requestAccessRoute } from "../src/pages/api/auth/request-access";

/* --- A fake Membership worksheet behind fetch ---------------------------- */

const OTHER = "Approval";
let grid: string[][];
const writes: { range: string; value: string }[] = [];
let lastBody: { valueInputOption?: string } = {};

function colIndex(letters: string) {
  return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
  const url = new URL(input);
  expect(url.pathname.startsWith(`/v4/spreadsheets/${SHEET}`)).toBe(true);
  const path = decodeURIComponent(url.pathname.slice(`/v4/spreadsheets/${SHEET}`.length));
  const ok = (data: unknown) => new Response(JSON.stringify(data));

  if (path === "/values/'Membership'!1:1") return ok({ values: [grid[0]] });
  if (path === "/values:batchGet") {
    const ranges = url.searchParams.getAll("ranges");
    return ok({
      valueRanges: ranges.map((r) => {
        const letter = /!([A-Z]+)2:/.exec(r)![1];
        const col = colIndex(letter);
        return { values: [grid.slice(1).map((row) => row[col] ?? "")] };
      }),
    });
  }
  if (path === "/values:batchUpdate") {
    lastBody = JSON.parse(String(init?.body));
    for (const d of (lastBody as { data: { range: string; values: string[][] }[] }).data) {
      const [, letters, row] = /!([A-Z]+)(\d+)$/.exec(d.range)!;
      const r = Number(row) - 1;
      while (grid.length <= r) grid.push([]);
      grid[r][colIndex(letters)] = d.values[0][0];
      writes.push({ range: d.range, value: d.values[0][0] });
    }
    return ok({});
  }
  throw new Error(`unexpected ${path}`);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // Name and Email aren't next to ID, and other columns sit around them.
  grid = [
    ["ID", OTHER, "name", "Email", "Status"],
    ["a1b2c3d4", "TRUE", "Ann", "Ann@Example.com", "Added"],
    ["7", "FALSE", "Bob", "bob@example.com", ""],
    ["", "FALSE", "", "", ""], // a checkbox-only row
  ];
  writes.length = 0;
  membership.isMember = false;
  email.sendEmail.mockResolvedValue({ ok: true });
});

/* --- Applicant cookie (R2) ---------------------------------------------- */

describe("applicant cookie (PRD 013, R2)", () => {
  const applicant = { email: "new@gmail.com", name: "New", expiresAt: Date.now() + 60_000 };

  it("round-trips, and rejects tampering, expiry and the wrong secret", () => {
    const value = encodeApplicant(applicant, SECRET);
    expect(decodeApplicant(value, SECRET)).toEqual(applicant);
    const [payload, sig] = value.split(".");
    const forged = Buffer.from(
      JSON.stringify({ e: "someone@else.com", n: "X", x: applicant.expiresAt }),
    ).toString("base64url");
    expect(decodeApplicant(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(decodeApplicant(`${payload}.${sig}`, "other")).toBeNull();
    expect(decodeApplicant(value, SECRET, applicant.expiresAt + 1)).toBeNull();
  });

  it("can't be swapped with a member session cookie", () => {
    const session = encodeSession(
      newSession({ email: "new@gmail.com", name: "New", isOrganizer: false }),
      SECRET,
    );
    expect(decodeApplicant(session, SECRET)).toBeNull();
  });

  it("is HttpOnly, SameSite=Lax, 30 minutes, and Secure over https", () => {
    const header = applicantCookieHeader(
      { email: "new@gmail.com", name: "New" },
      SECRET,
      new Request(`${ORIGIN}/api/auth/session`),
    );
    expect(header).toMatch(new RegExp(`^${APPLICANT_COOKIE}=`));
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=1800");
    expect(header).toContain("Secure");
  });
});

/* --- Sheet helpers (R3) -------------------------------------------------- */

describe("membership sheet helpers (R3)", () => {
  it("finds columns by header, ignoring case and spaces", () => {
    expect(findColumns(["ID", "x", " name ", "EMAIL"])).toEqual({ ID: 0, Name: 2, Email: 3 });
    expect(() => findColumns(["ID", "Name"])).toThrow(/Email/);
  });

  it("converts column indexes to letters", () => {
    expect([0, 25, 26, 51, 52].map(columnLetter)).toEqual(["A", "Z", "AA", "AZ", "BA"]);
  });

  it("writes after the last row with an ID, Name or Email", () => {
    expect(nextRow({ ids: [], names: [], emails: [] })).toBe(2);
    expect(nextRow({ ids: ["a", "", ""], names: ["", "", ""], emails: ["", "x@y", ""] })).toBe(4);
    // A gap in the middle isn't reused.
    expect(nextRow({ ids: ["a", "", "c"], names: [], emails: [] })).toBe(5);
  });

  it("matches emails ignoring case and spaces", () => {
    expect(hasEmail(["", " Ann@Example.com "], "ann@example.com")).toBe(true);
    expect(hasEmail(["ann@example.com"], "bob@example.com")).toBe(false);
  });

  it("makes 8-character lowercase alphanumeric IDs, skipping taken ones", () => {
    expect(newMemberId([])).toMatch(/^[a-z0-9]{8}$/);
    // The first try collides with "aaaaaaaa" (any case); the second doesn't.
    const picks = [...Array(8).fill(0), ...Array(8).fill(1)];
    expect(newMemberId(["AAAAAAAA"], () => picks.shift()!)).toBe("bbbbbbbb");
  });
});

describe("addRequest (R3.3–R3.5)", () => {
  it("writes ID, Name and Email only, as RAW, in the next row", async () => {
    const result = await addRequest({ email: "new@gmail.com", name: '=HYPERLINK("x")' });

    expect(result).toMatchObject({ status: "added", row: 4 });
    expect(writes.map((w) => w.range)).toEqual([
      "'Membership'!A4",
      "'Membership'!C4",
      "'Membership'!D4",
    ]);
    expect(lastBody.valueInputOption).toBe("RAW");
    expect(grid[3]).toEqual([
      (result as { id: string }).id,
      "FALSE",
      '=HYPERLINK("x")',
      "new@gmail.com",
      "",
    ]);
  });

  it("adds nothing when the email is already on the sheet", async () => {
    expect(await addRequest({ email: "ann@example.com", name: "Ann" })).toEqual({
      status: "pending",
    });
    expect(writes).toEqual([]);
  });
});

/* --- Officer email (R5) -------------------------------------------------- */

describe("officer email (R5)", () => {
  it("escapes HTML and keeps line breaks out of the subject", () => {
    const { subject, html } = officerEmail({
      email: "new@gmail.com",
      name: "<b>Eve</b>\r\nBcc: x@y.com",
      id: "abcd1234",
      sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
    });
    expect(subject).toBe("Member calendar access request: <b>Eve</b> Bcc: x@y.com");
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(html).not.toContain("<b>Eve</b>");
    expect(html).toContain("abcd1234");
    expect(html).toContain("https://docs.google.com/spreadsheets/d/sheet-123/edit");
  });

  it("emails officers once for a new request, with Reply-To the applicant", async () => {
    expect(await requestAccess({ email: "new@gmail.com", name: "New" })).toBe("added");
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0][0]).toMatchObject({
      to: ["officers@ghostbustersva.com"],
      replyTo: "new@gmail.com",
    });

    expect(await requestAccess({ email: "NEW@gmail.com", name: "New" })).toBe("pending");
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when the email fails (R3.6), and logs no name or email (R6.2)", async () => {
    email.sendEmail.mockRejectedValue(new Error("resend down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await requestAccess({ email: "new@gmail.com", name: "New Person" })).toBe("added");

    const logged = [...error.mock.calls, ...info.mock.calls].flat().join(" ");
    expect(logged).not.toContain("new@gmail.com");
    expect(logged).not.toContain("New Person");
    error.mockRestore();
    info.mockRestore();
  });
});

/* --- Endpoint (R3) ------------------------------------------------------- */

describe("POST /api/auth/request-access", () => {
  const call = (cookie?: string, body?: unknown) =>
    (requestAccessRoute as (ctx: { request: Request }) => Promise<Response>)({
      request: new Request(`${ORIGIN}/api/auth/request-access`, {
        method: "POST",
        headers: cookie ? { cookie: `${APPLICANT_COOKIE}=${cookie}` } : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
    });
  const applicantCookie = (email = "new@gmail.com") =>
    encodeApplicant({ email, name: "New", expiresAt: Date.now() + 60_000 }, SECRET);

  it("refuses without a valid applicant cookie", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("garbage.sig")).status).toBe(401);
    expect(writes).toEqual([]);
  });

  it("uses the cookie's email and ignores one in the body (R2.3)", async () => {
    const res = await call(applicantCookie(), { email: "victim@example.com", name: "Victim" });
    expect(await res.json()).toEqual({ ok: true, status: "added" });
    expect(writes.map((w) => w.value)).toContain("new@gmail.com");
    expect(writes.map((w) => w.value)).not.toContain("victim@example.com");
  });

  it("reports pending for an email already on the sheet", async () => {
    const res = await call(applicantCookie("bob@example.com"));
    expect(await res.json()).toEqual({ ok: true, status: "pending" });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it("reports member, and writes nothing, once they're on the list", async () => {
    membership.isMember = true;
    const res = await call(applicantCookie());
    expect(await res.json()).toEqual({ ok: true, status: "member" });
    expect(writes).toEqual([]);
  });
});
