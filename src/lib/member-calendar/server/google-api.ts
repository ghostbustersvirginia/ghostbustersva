/**
 * Thin fetch wrappers for the Google Calendar and Cloud Identity APIs.
 * Google error bodies are logged server-side, never returned to clients (R8).
 */
import { getGoogleAccessToken, SCOPES } from "./google-auth";

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(`Google API error ${status}: ${reason}`);
    this.name = "GoogleApiError";
  }
}

async function googleFetch<T>(
  url: string,
  scopes: string[],
  init: RequestInit & { allow404?: boolean } = {},
): Promise<{ status: number; data: T | null; etag: string | null }> {
  const token = await getGoogleAccessToken(scopes);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 404 && init.allow404) return { status: 404, data: null, etag: null };
  if (res.status === 204) return { status: 204, data: null, etag: null };

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[member-calendar] Google API ${res.status} ${url.split("?")[0]}: ${text}`);
    throw new GoogleApiError(res.status, text.slice(0, 200));
  }
  const data = (await res.json()) as T;
  return { status: res.status, data, etag: res.headers.get("etag") };
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export interface GoogleAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  resource?: boolean;
  self?: boolean;
  optional?: boolean;
  comment?: string;
  additionalGuests?: number;
}

export interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleAttachment {
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  title?: string;
}

export interface GoogleEvent {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  recurringEventId?: string;
  organizer?: { email?: string; self?: boolean };
  attendees?: GoogleAttendee[];
  attendeesOmitted?: boolean;
  attachments?: GoogleAttachment[];
  guestsCanSeeOtherGuests?: boolean;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

interface EventsListResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

function eventsUrl(calendarId: string, path = ""): string {
  return `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events${path}`;
}

/** All single (expanded) events in [timeMin, timeMax), following pages. */
export async function listCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "2500",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const { data } = await googleFetch<EventsListResponse>(`${eventsUrl(calendarId)}?${params}`, [
      SCOPES.calendar,
    ]);
    events.push(...(data?.items ?? []).filter((e) => e.status !== "cancelled"));
    pageToken = data?.nextPageToken;
  } while (pageToken);
  return events;
}

export async function getCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<GoogleEvent | null> {
  const { data } = await googleFetch<GoogleEvent>(
    eventsUrl(calendarId, `/${encodeURIComponent(eventId)}`),
    [SCOPES.calendar],
    { allow404: true },
  );
  if (!data || data.status === "cancelled") return null;
  return data;
}

/** Instances of a recurring series in [timeMin, timeMax). */
export async function listEventInstances(
  calendarId: string,
  recurringEventId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ timeMin, timeMax, maxResults: "2500" });
    if (pageToken) params.set("pageToken", pageToken);
    const { data } = await googleFetch<EventsListResponse>(
      `${eventsUrl(calendarId, `/${encodeURIComponent(recurringEventId)}/instances`)}?${params}`,
      [SCOPES.calendar],
    );
    events.push(...(data?.items ?? []).filter((e) => e.status !== "cancelled"));
    pageToken = data?.nextPageToken;
  } while (pageToken);
  return events;
}

/**
 * PATCH an event's attendees with If-Match, never notifying guests (R5.4, R5.5).
 * Throws GoogleApiError(412) on an ETag conflict.
 */
export async function patchEventAttendees(
  calendarId: string,
  eventId: string,
  etag: string,
  attendees: GoogleAttendee[],
): Promise<GoogleEvent> {
  const { data } = await googleFetch<GoogleEvent>(
    `${eventsUrl(calendarId, `/${encodeURIComponent(eventId)}`)}?sendUpdates=none`,
    [SCOPES.calendar],
    {
      method: "PATCH",
      headers: { "If-Match": etag },
      body: JSON.stringify({ attendees }),
    },
  );
  if (!data) throw new GoogleApiError(500, "Empty patch response");
  return data;
}

/**
 * PATCH only `extendedProperties.private`, with If-Match and no guest
 * notifications (PRD 010, R3.1). `properties` must already include any
 * existing private properties to keep. Never touches other fields.
 * Throws GoogleApiError(412) on an ETag conflict.
 */
export async function patchEventPrivateProperties(
  calendarId: string,
  eventId: string,
  etag: string,
  properties: Record<string, string>,
): Promise<GoogleEvent> {
  const { data } = await googleFetch<GoogleEvent>(
    `${eventsUrl(calendarId, `/${encodeURIComponent(eventId)}`)}?sendUpdates=none`,
    [SCOPES.calendar],
    {
      method: "PATCH",
      headers: { "If-Match": etag },
      body: JSON.stringify({ extendedProperties: { private: properties } }),
    },
  );
  if (!data) throw new GoogleApiError(500, "Empty patch response");
  return data;
}

export interface WatchChannel {
  id: string;
  resourceId: string;
  expiration?: string;
}

export async function watchCalendarEvents(
  calendarId: string,
  channel: { id: string; address: string; token: string; ttlSeconds: number },
): Promise<WatchChannel> {
  const { data } = await googleFetch<WatchChannel>(
    `${eventsUrl(calendarId, "/watch")}`,
    [SCOPES.calendar],
    {
      method: "POST",
      body: JSON.stringify({
        id: channel.id,
        type: "web_hook",
        address: channel.address,
        token: channel.token,
        params: { ttl: String(channel.ttlSeconds) },
      }),
    },
  );
  if (!data) throw new GoogleApiError(500, "Empty watch response");
  return data;
}

export async function stopChannel(channel: { id: string; resourceId: string }): Promise<void> {
  await googleFetch<unknown>(`${CALENDAR_BASE}/channels/stop`, [SCOPES.calendar], {
    method: "POST",
    body: JSON.stringify(channel),
    allow404: true,
  });
}

/* ------------------------------------------------------------------ */
/* Cloud Identity groups                                               */
/* ------------------------------------------------------------------ */

const IDENTITY_BASE = "https://cloudidentity.googleapis.com/v1";
const groupNameCache = new Map<string, string>();

async function lookupGroupName(groupEmail: string): Promise<string> {
  const cached = groupNameCache.get(groupEmail);
  if (cached) return cached;
  const params = new URLSearchParams({ "groupKey.id": groupEmail });
  const { data } = await googleFetch<{ name: string }>(`${IDENTITY_BASE}/groups:lookup?${params}`, [
    SCOPES.groups,
  ]);
  if (!data?.name) throw new GoogleApiError(500, `Group ${groupEmail} not found`);
  groupNameCache.set(groupEmail, data.name);
  return data.name;
}

/**
 * Is `memberEmail` in `groupEmail`, directly or through nested groups?
 * Tries the transitive check first, then falls back to a direct membership
 * lookup if the transitive API is unavailable for the Workspace edition.
 */
export async function isGroupMember(groupEmail: string, memberEmail: string): Promise<boolean> {
  const group = await lookupGroupName(groupEmail);
  const email = memberEmail.toLowerCase().replace(/'/g, "");

  try {
    const params = new URLSearchParams({ query: `member_key_id == '${email}'` });
    const { data } = await googleFetch<{ hasMembership?: boolean }>(
      `${IDENTITY_BASE}/${group}/memberships:checkTransitiveMembership?${params}`,
      [SCOPES.groups],
    );
    return data?.hasMembership === true;
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.status === 401) throw error;
    const params = new URLSearchParams({ "memberKey.id": email });
    const { status } = await googleFetch<{ name: string }>(
      `${IDENTITY_BASE}/${group}/memberships:lookup?${params}`,
      [SCOPES.groups],
      { allow404: true },
    );
    return status !== 404;
  }
}

/* ------------------------------------------------------------------ */
/* Drive (event images, PRD 009)                                       */
/* ------------------------------------------------------------------ */

const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";

export interface DriveFileMeta {
  id: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

/** File metadata, read as the service account itself (no delegation). */
export async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    fields: "id,mimeType,size,modifiedTime",
    supportsAllDrives: "true",
  });
  const { data } = await googleFetch<DriveFileMeta>(
    `${DRIVE_BASE}/${encodeURIComponent(fileId)}?${params}`,
    [SCOPES.drive],
    { allow404: true },
  );
  return data;
}

/** Downloads a Drive file's bytes. */
export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const token = await getGoogleAccessToken([SCOPES.drive]);
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const res = await fetch(`${DRIVE_BASE}/${encodeURIComponent(fileId)}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[member-calendar] Drive download ${res.status}: ${text.slice(0, 200)}`);
    throw new GoogleApiError(res.status, text.slice(0, 200));
  }
  return res.arrayBuffer();
}
