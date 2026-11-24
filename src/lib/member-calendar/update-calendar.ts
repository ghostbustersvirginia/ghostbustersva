/** What "Update My Calendar" tells the member (PRD 012, R4.5–R4.7). */
export interface Notice {
  tone: "ok" | "warn" | "error";
  text: string;
}

export const UPDATING_CALENDAR = "Sending calendar invitations for your upcoming RSVPs…";

export function updateCalendarNotice({ sent, total }: { sent: number; total: number }): Notice {
  if (total === 0) {
    return { tone: "ok", text: "You don't have any upcoming Yes or Maybe RSVPs." };
  }
  if (sent === 0) {
    return {
      tone: "error",
      text: "Couldn't send your calendar invitations. Try again later.",
    };
  }
  if (sent < total) {
    return { tone: "warn", text: `Sent ${sent} of ${total}. Try again later for the rest.` };
  }
  return {
    tone: "ok",
    text: `Sent ${sent} calendar ${sent === 1 ? "invitation" : "invitations"}. Check your email if ${sent === 1 ? "it doesn't" : "they don't"} appear.`,
  };
}
