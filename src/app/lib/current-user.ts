import { prisma } from "@/app/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/app/lib/auth";

export async function getCurrentUser() {
  const token = await getSessionToken();

  if (!token) return null;

  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          bio: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session
      .delete({
        where: { id: session.id },
      })
      .catch(() => {});

    return null;
  }

  return session.user;
}