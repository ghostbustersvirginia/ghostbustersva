import { beforeEach, describe, expect, it, vi } from "vitest";

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  getDriveFileMeta: vi.fn(),
  downloadDriveFile: vi.fn(),
}));
const blob = vi.hoisted(() => ({ get: vi.fn(), putImage: vi.fn() }));
const env = vi.hoisted(() => ({ blob: true }));

vi.mock("../src/lib/member-calendar/server/google-api", async () => {
  class GoogleApiError extends Error {
    constructor(
      public status: number,
      public reason: string,
    ) {
      super(reason);
    }
  }
  return { ...google, GoogleApiError };
});
vi.mock("@vercel/blob", () => blob);
vi.mock("../src/lib/member-calendar/server/env", () => ({
  memberEnv: { calendarId: () => "cal" },
  readEnv: (name: string) => (env.blob && name === "BLOB_STORE_ID" ? "store_1" : undefined),
}));

import { GoogleApiError } from "../src/lib/member-calendar/server/google-api";
import {
  blobPathname,
  getEventImage,
  parseImageWidth,
} from "../src/lib/member-calendar/server/images";
import { heroAttachment, heroImageVersion } from "../src/lib/member-calendar/server/logic";

const png = { fileId: "file1", mimeType: "image/png", title: "flyer.png" };
const stream = () => new ReadableStream<Uint8Array>();

describe("heroAttachment (PRD 009, R1.1)", () => {
  it("picks the first PNG or JPEG with a Drive file", () => {
    expect(
      heroAttachment({
        attachments: [
          { fileId: "pdf", mimeType: "application/pdf" },
          { mimeType: "image/png" },
          { fileId: "gif", mimeType: "image/gif" },
          { fileId: "jpg", mimeType: "image/JPEG" },
          png,
        ],
      })?.fileId,
    ).toBe("jpg");
    expect(heroAttachment({ attachments: [] })).toBeNull();
    expect(heroAttachment({})).toBeNull();
  });

  it("gives an opaque version that changes with the attachment", () => {
    const v = heroImageVersion(png);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(v).not.toContain("file1");
    expect(heroImageVersion({ ...png, fileId: "file2" })).not.toBe(v);
  });
});

describe("getEventImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.blob = true;
    google.getCalendarEvent.mockResolvedValue({ id: "e1", attachments: [png] });
    google.getDriveFileMeta.mockResolvedValue({
      id: "file1",
      mimeType: "image/png",
      size: "1000",
      modifiedTime: "2026-11-23T10:00:00.000Z",
    });
    google.downloadDriveFile.mockResolvedValue(new ArrayBuffer(8));
  });

  it("only accepts the supported widths", () => {
    expect(parseImageWidth("640")).toBe(640);
    expect(parseImageWidth("500")).toBeNull();
    expect(parseImageWidth(null)).toBeNull();
  });

  it("serves a cached resized copy without downloading from Drive", async () => {
    blob.get.mockResolvedValue({
      statusCode: 200,
      stream: stream(),
      blob: { contentType: "image/webp" },
    });
    const image = await getEventImage("e1", 640);
    expect(image?.contentType).toBe("image/webp");
    expect(blob.get).toHaveBeenCalledWith(blobPathname("file1", "2026-11-23T10:00:00.000Z", 640), {
      access: "private",
    });
    expect(google.downloadDriveFile).not.toHaveBeenCalled();
  });

  it("on a miss, resizes into the private Blob store, then serves it", async () => {
    blob.get
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { name: "BlobNotFoundError" }))
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: stream(),
        blob: { contentType: "image/webp" },
      });
    const image = await getEventImage("e1", 320);
    expect(blob.putImage).toHaveBeenCalledWith(
      "calendar-images/file1-20261123100000000-w320.webp",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        optimizeImage: { width: 320, quality: 78, format: "webp" },
      }),
    );
    expect(image?.contentType).toBe("image/webp");
  });

  it("serves the original when no Blob store is configured (local dev)", async () => {
    env.blob = false;
    const image = await getEventImage("e1", 1200);
    expect(image).toEqual({ body: expect.any(ArrayBuffer), contentType: "image/png" });
    expect(blob.get).not.toHaveBeenCalled();
  });

  it("returns nothing for events without an image, unreadable files, or oversized files", async () => {
    google.getCalendarEvent.mockResolvedValueOnce({ id: "e1", attachments: [] });
    await expect(getEventImage("e1", 640)).resolves.toBeNull();

    google.getDriveFileMeta.mockRejectedValueOnce(new GoogleApiError(403, "forbidden"));
    await expect(getEventImage("e1", 640)).resolves.toBeNull();

    google.getDriveFileMeta.mockResolvedValueOnce({
      id: "file1",
      mimeType: "image/png",
      size: String(20 * 1024 * 1024),
    });
    await expect(getEventImage("e1", 640)).resolves.toBeNull();
    expect(google.downloadDriveFile).not.toHaveBeenCalled();
  });
});
