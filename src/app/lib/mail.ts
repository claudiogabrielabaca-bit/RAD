import { Resend } from "resend";
import { shouldBypassMailInLocal } from "@/app/lib/dev-flags";

type SendMailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({
  to,
  subject,
  html,
  text,
}: SendMailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (shouldBypassMailInLocal()) {
    if (!apiKey || !from) {
      console.warn(
        "sendMail local bypass active: missing RESEND_API_KEY or MAIL_FROM"
      );

      return {
        id: "local-dev-mail-bypass",
      };
    }
  }

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!from) {
    throw new Error("Missing MAIL_FROM");
  }

  const resend = new Resend(apiKey);

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