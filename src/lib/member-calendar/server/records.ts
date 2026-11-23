/** Record shapes shared by the store and the pure logic (PRD 008, R7). */
import type { GoogleResponseStatus } from "../types";

/** Status value stored for someone no longer on the attendee list. */
export const REMOVED = "removed";
export type SnapshotStatus = GoogleResponseStatus | typeof REMOVED;

export interface LateChangeRecord {
  eventId: string;
  eventTitle: string;
  rawTitle: string;
  chapter: string | null;
  eventStart: string;
  memberEmail: string;
  memberName: string;
  previousStatus: SnapshotStatus;
  newStatus: SnapshotStatus;
  changedAt: string;
  minutesBeforeStart: number;
  source: "site" | "google";
}
