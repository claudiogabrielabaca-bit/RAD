import { prisma } from "@/app/lib/prisma";
import { getSessionToken } from "@/app/lib/auth";

export async function getCurrentUser() {
  const token = await getSessionToken();

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: { token },
    }).catch(() => {});
    return null;
  }

  return session.user;
}