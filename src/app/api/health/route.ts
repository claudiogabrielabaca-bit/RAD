import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const DATABASE_CHECK_TIMEOUT_MS = 1500;

type DatabaseHealth = "ok" | "timeout" | "error";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("health_check_timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.message === "health_check_timeout";
}

async function checkDatabase(): Promise<DatabaseHealth> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_CHECK_TIMEOUT_MS);
    return "ok";
  } catch (error) {
    console.error(
      "health database check error:",
      error instanceof Error ? error.message : error
    );

    return isTimeoutError(error) ? "timeout" : "error";
  }
}

export async function GET() {
  const database = await checkDatabase();
  const ok = database === "ok";

  return NextResponse.json(
    {
      ok,
      service: "rad",
      database,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: NO_STORE_HEADERS,
    }
  );
}
