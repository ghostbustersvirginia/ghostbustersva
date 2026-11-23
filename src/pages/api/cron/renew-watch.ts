/**
 * Daily Vercel cron: renew the Google Calendar push channel and run a sync
 * as a safety net for missed notifications (PRD 008, R7.5).
 */
import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { memberEnv } from "../../../lib/member-calendar/server/env";
import { json } from "../../../lib/member-calendar/server/http";
import {
  renewWatchChannel,
  syncRecentEvents,
} from "../../../lib/member-calendar/server/sync-service";

export const prerender = false;

function authorized(request: Request): boolean {
  const secret = memberEnv.cronSecret();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return new Response(null, { status: 401 });

  const result: Record<string, unknown> = {};
  try {
    result.sync = await syncRecentEvents();
  } catch (error) {
    console.error("[member-calendar] cron sync failed:", error);
    result.sync = "failed";
  }
  try {
    result.channel = await renewWatchChannel();
  } catch (error) {
    console.error("[member-calendar] channel renewal failed:", error);
    result.channel = "failed";
  }
  return json({ ok: result.sync !== "failed" && result.channel !== "failed", ...result });
};
