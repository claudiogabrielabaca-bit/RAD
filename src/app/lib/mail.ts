import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const from = process.env.MAIL_FROM;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!from) {
    throw new Error("Missing MAIL_FROM");
  }

  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    console.error("Resend sendMail error:", result.error);
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Failed to send email"
    );
  }

  return result.data;
}