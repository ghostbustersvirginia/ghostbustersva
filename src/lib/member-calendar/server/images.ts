/**
 * Event hero images (PRD 009, R1).
 *
 * The browser asks for /api/calendar/image/<eventId>?w=<width>. The server finds
 * the event's first PNG/JPEG attachment, reads it from Drive as the service
 * account, and serves a resized WebP stored in a private Vercel Blob store
 * (keyed by file ID, modified time and width). Without a Blob store (local dev)
 * the original image is served as-is.
 */
import { get, putImage } from "@vercel/blob";
import { memberEnv, readEnv } from "./env";
import {
  downloadDriveFile,
  getCalendarEvent,
  getDriveFileMeta,
  GoogleApiError,
} from "./google-api";
import { heroAttachment } from "./logic";

export const IMAGE_WIDTHS = [320, 640, 1200] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const SOURCE_TYPES = new Set(["image/png", "image/jpeg"]);

export function parseImageWidth(value: string | null): ImageWidth | null {
  const n = Number(value);
  return (IMAGE_WIDTHS as readonly number[]).includes(n) ? (n as ImageWidth) : null;
}

/** Logged once per file per instance, so a bad share doesn't flood the logs. */
const reportedFiles = new Set<string>();
function reportOnce(fileId: string, message: string) {
  if (reportedFiles.has(fileId)) return;
  reportedFiles.add(fileId);
  console.error(`[member-calendar] image ${fileId.slice(0, 6)}…: ${message}`);
}

function blobConfigured(): boolean {
  return Boolean(readEnv("BLOB_STORE_ID") || readEnv("BLOB_READ_WRITE_TOKEN"));
}

export function blobPathname(fileId: string, modifiedTime: string | undefined, width: number) {
  const version = (modifiedTime ?? "0").replace(/[^0-9]/g, "");
  return `calendar-images/${fileId}-${version}-w${width}.webp`;
}

export interface ServedImage {
  body: ReadableStream<Uint8Array> | ArrayBuffer;
  contentType: string;
}

async function readCached(pathname: string): Promise<ServedImage | null> {
  try {
    const result = await get(pathname, { access: "private" });
    if (result?.statusCode === 200 && result.stream) {
      return { body: result.stream, contentType: result.blob.contentType || "image/webp" };
    }
  } catch (error) {
    if (!(error instanceof Error && /not.?found/i.test(error.name + error.message))) {
      console.error("[member-calendar] blob read failed:", error);
    }
  }
  return null;
}

/**
 * The resized hero image for an event, or null when it has none, it isn't a
 * PNG/JPEG, it's too large, or the service account can't read it.
 */
export async function getEventImage(
  eventId: string,
  width: ImageWidth,
): Promise<ServedImage | null> {
  const event = await getCalendarEvent(memberEnv.calendarId(), eventId);
  const hero = event ? heroAttachment(event) : null;
  if (!hero) return null;

  let meta;
  try {
    meta = await getDriveFileMeta(hero.fileId);
  } catch (error) {
    if (error instanceof GoogleApiError && (error.status === 403 || error.status === 404)) {
      reportOnce(hero.fileId, `not readable by the service account (${error.status})`);
      return null;
    }
    throw error;
  }
  if (!meta) {
    reportOnce(hero.fileId, "not found");
    return null;
  }
  if (!SOURCE_TYPES.has(meta.mimeType) || Number(meta.size ?? 0) > MAX_SOURCE_BYTES) {
    reportOnce(hero.fileId, `skipped (${meta.mimeType}, ${meta.size ?? "?"} bytes)`);
    return null;
  }

  if (!blobConfigured()) {
    // Local dev without a Blob store: serve the original.
    return { body: await downloadDriveFile(hero.fileId), contentType: meta.mimeType };
  }

  const pathname = blobPathname(hero.fileId, meta.modifiedTime, width);
  const cached = await readCached(pathname);
  if (cached) return cached;

  const source = await downloadDriveFile(hero.fileId);
  await putImage(pathname, Buffer.from(source), {
    access: "private",
    optimizeImage: { width, quality: 78, format: "webp" },
    allowOverwrite: true,
  });
  return (await readCached(pathname)) ?? { body: source, contentType: meta.mimeType };
}
