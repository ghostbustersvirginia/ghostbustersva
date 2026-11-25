import { Resend } from "resend";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SendEmailOptions {
  /** Recipients; defaults to CONTACT_TO_EMAIL. */
  to?: string[];
  replyTo: string;
  subject: string;
  html: string;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ ok: boolean; error?: string }> {
  const resend = new Resend(import.meta.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: import.meta.env.CONTACT_FROM_EMAIL,
    to: options.to?.length ? options.to : [import.meta.env.CONTACT_TO_EMAIL],
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    console.error(JSON.stringify({ event: "resend_error", error }));
    return { ok: false, error: "send_failed" };
  }

  return { ok: true };
}
