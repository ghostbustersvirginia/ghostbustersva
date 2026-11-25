/**
 * Member calendar access requests (PRD 013, R3, R5): add the applicant to the
 * membership sheet and email the officers. Logs outcomes and row IDs only,
 * never names or emails (R6.2).
 */
import { escapeHtml, sendEmail } from "../../email";
import { memberEnv } from "./env";
import { addRequest, membershipSheetUrl } from "./membership-sheet";

export type AccessRequestStatus = "added" | "pending";

export function officerEmail(input: { email: string; name: string; id: string; sheetUrl: string }) {
  // No line breaks in a subject line.
  const name = (input.name.trim() || input.email).replace(/[\r\n]+/g, " ");
  return {
    subject: `Member calendar access request: ${name}`,
    html: [
      `<p>${escapeHtml(name)} asked for access to the member calendar.</p>`,
      "<ul>",
      `<li><strong>Name:</strong> ${escapeHtml(input.name || "(not given)")}</li>`,
      `<li><strong>Email:</strong> ${escapeHtml(input.email)}</li>`,
      `<li><strong>ID:</strong> ${escapeHtml(input.id)}</li>`,
      "</ul>",
      `<p>They're on the <a href="${escapeHtml(input.sheetUrl)}">membership spreadsheet</a>. ` +
        "Approve them there or in AppSheet to add them to all-members@.</p>",
      "<p>Reply to this email to write to them directly.</p>",
    ].join("\n"),
  };
}

export async function requestAccess(applicant: {
  email: string;
  name: string;
}): Promise<AccessRequestStatus> {
  const result = await addRequest(applicant);
  if (result.status === "pending") {
    console.info("[member-calendar] access request: already pending");
    return "pending";
  }
  console.info(`[member-calendar] access request: added id=${result.id} row=${result.row}`);

  // A failed email never fails the request: the row is what officers act on (R3.6).
  try {
    const { subject, html } = officerEmail({
      ...applicant,
      id: result.id,
      sheetUrl: membershipSheetUrl(),
    });
    const sent = await sendEmail({
      to: [memberEnv.officersEmail()],
      replyTo: applicant.email,
      subject,
      html,
    });
    if (!sent.ok) console.error(`[member-calendar] access request email failed id=${result.id}`);
  } catch (error) {
    console.error(
      `[member-calendar] access request email failed id=${result.id}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
  return "added";
}
