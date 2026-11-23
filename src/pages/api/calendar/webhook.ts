/**
 * Google Calendar push notifications (events.watch) → detect RSVP changes
 * made in Google Calendar (PRD 008, R7.5).
 */
import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { memberEnv } from "../../../lib/member-calendar/server/env";
import { getStoredChannel } from "../../../lib/member-calendar/server/store";
import { syncRecentEvents } from "../../../lib/member-calendar/server/sync-service";

export const prerender = false;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const POST: APIRoute = async ({ request }) => {
  const expectedToken = memberEnv.webhookToken();
  const token = request.headers.get("x-goog-channel-token") ?? "";
  if (!expectedToken || !safeEqual(token, expectedToken)) {
    return new Response(null, { status: 403 });
  }

  const channelId = request.headers.get("x-goog-channel-id");
  const stored = await getStoredChannel();
  if (stored && channelId !== stored.id) {
    // A superseded channel; acknowledge so Google stops retrying.
    return new Response(null, { status: 204 });
  }

  // "sync" is the handshake sent when a channel is created.
  if (request.headers.get("x-goog-resource-state") === "sync") {
    return new Response(null, { status: 204 });
  }

  try {
    await syncRecentEvents();
  } catch (error) {
    console.error("[member-calendar] webhook sync failed:", error);
  }
  return new Response(null, { status: 204 });
};
