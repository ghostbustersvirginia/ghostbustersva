/**
 * Late RSVP-change export for officers (PRD 008, R7.6).
 *  GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional; filters on change time)
 */
import type { APIRoute } from "astro";
import { apiError, requireMember, serverError } from "../../../lib/member-calendar/server/http";
import { lateChangesToCsv } from "../../../lib/member-calendar/server/logic";
import { readLateChanges } from "../../../lib/member-calendar/server/store";

export const prerender = false;

function parseDay(value: string | null, endOfDay: boolean): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET: APIRoute = async ({ request, url }) => {
  let check;
  try {
    check = await requireMember(request, { organizer: true });
  } catch (error) {
    return serverError("session check", error);
  }
  if (!check.ok) return check.response;

  try {
    const now = new Date();
    const from =
      parseDay(url.searchParams.get("from"), false) ?? new Date(now.getTime() - 730 * 864e5);
    const to = parseDay(url.searchParams.get("to"), true) ?? now;
    if (to < from) return apiError("invalid_range", 400);

    const records = (await readLateChanges(from.getUTCFullYear(), to.getUTCFullYear())).filter(
      (r) => {
        const t = new Date(r.changedAt).getTime();
        return t >= from.getTime() && t <= to.getTime();
      },
    );

    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gbva-late-rsvp-changes-${now.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    });
    if (check.setCookie) headers.append("Set-Cookie", check.setCookie);
    return new Response(lateChangesToCsv(records), { status: 200, headers });
  } catch (error) {
    return serverError("late-changes csv", error);
  }
};
