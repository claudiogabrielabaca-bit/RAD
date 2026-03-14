import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode } from "@/app/lib/auth";
import { sendMail } from "@/app/lib/mail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    let devCode: string | undefined;
    let emailSent = false;

    if (user) {
      const resetCode = generateNumericCode(6);
      const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: resetCode,
          passwordResetExpiresAt: resetExpiresAt,
        },
      });

      devCode = process.env.NODE_ENV !== "production" ? resetCode : undefined;

      try {
        const mailResult = await sendMail({
          to: user.email,
          subject: "Your RAD password reset code",
          text: `Hello ${user.username},

Your password reset code is: ${resetCode}

This code expires in 15 minutes.`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
              <h2>RAD password reset</h2>
              <p>Hello <strong>${user.username}</strong>,</p>
              <p>Your reset code is:</p>
              <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
                ${resetCode}
              </div>
              <p>This code expires in <strong>15 minutes</strong>.</p>
            </div>
          `,
        });

        console.log("forgot-password email sent:", mailResult?.id);
        emailSent = true;
      } catch (mailError) {
        console.error("forgot-password mail send error:", mailError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        emailSent,
        message: "If that email exists, a recovery code was sent.",
        devCode,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("forgot-password POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}