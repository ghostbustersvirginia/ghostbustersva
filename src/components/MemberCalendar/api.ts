/** Browser-side calls to the member calendar API (PRD 008). */
import type {
  ApiError,
  CalendarEvent,
  EventsResponse,
  RequestAccessResponse,
  RsvpChoice,
  RsvpResponse,
  RsvpScope,
  SessionState,
  UpdateCalendarResponse,
} from "../../lib/member-calendar/types";
import { splitRange } from "../../lib/member-calendar/filters";
import type { GeoResult } from "../../lib/member-calendar/geo";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  unauthorized: "Your sign-in expired. Please sign in again.",
  not_member: "Your account is no longer on the member list.",
  rate_limited: "Too many requests. Wait a minute and try again.",
  server_error: "Something went wrong talking to Google. Please try again.",
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiRequestError(0, "network", "You appear to be offline. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as (T & { ok?: boolean }) | ApiError | null;
  if (!res.ok || !data || (data as ApiError).ok === false) {
    const err = data as ApiError | null;
    const code = err?.error ?? "server_error";
    throw new ApiRequestError(
      res.status,
      code,
      err?.message ?? FRIENDLY[code] ?? FRIENDLY.server_error,
    );
  }
  return data as T;
}

export const getSession = () => request<SessionState>("/api/auth/session");

export const signIn = (credential: string) =>
  request<SessionState>("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

/** Asks the officers to add the signed-in non-member (PRD 013, R3). */
export const requestAccess = () =>
  request<RequestAccessResponse>("/api/auth/request-access", { method: "POST" });

export const signOut = () => request<{ ok: true }>("/api/auth/logout", { method: "POST" });

/** Full-page navigation target that starts "Link Discord" (PRD 010, R1.2). */
export const DISCORD_LINK_START = "/api/auth/discord/start";

export const unlinkDiscord = () =>
  request<{ ok: true }>("/api/auth/discord/unlink", { method: "POST" });

export async function fetchEvents(
  start: Date,
  end: Date,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  const data = await request<EventsResponse>(`/api/calendar/events?${params}`, { signal });
  return data.events;
}

/** Fetches a long range in parallel chunks, merged by event ID in start order. */
export async function fetchEventsRange(
  start: Date,
  end: Date,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const chunks = await Promise.all(
    splitRange(start, end).map((w) => fetchEvents(w.start, w.end, signal)),
  );
  const byId = new Map<string, CalendarEvent>();
  for (const event of chunks.flat()) byId.set(event.id, event);
  return [...byId.values()].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export async function fetchEvent(id: string): Promise<CalendarEvent | null> {
  try {
    const data = await request<EventsResponse>(
      `/api/calendar/events?${new URLSearchParams({ id })}`,
    );
    return data.events[0] ?? null;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export const sendRsvp = (eventId: string, choice: RsvpChoice, scope: RsvpScope) =>
  request<RsvpResponse>("/api/calendar/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, choice, scope }),
  });

/** Re-sends invitations for upcoming Yes/Maybe RSVPs (PRD 012, R4). */
export const updateMyCalendar = () =>
  request<UpdateCalendarResponse>("/api/calendar/update-my-calendar", { method: "POST" });

/** Venue coordinates for map queries (PRD 009, R5.3). Missing keys = not looked up yet. */
export async function geocodeVenueQueries(
  queries: string[],
): Promise<Record<string, GeoResult | null>> {
  const data = await request<{ ok: true; results: Record<string, GeoResult | null> }>(
    "/api/calendar/geocode",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries }),
    },
  );
  return data.results;
}

/** Looks up a home location; the server stores nothing (PRD 009, R7). */
export const lookupHomeLocation = (query: string) =>
  request<{ ok: true; label: string; lat: number; lng: number }>("/api/member/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
