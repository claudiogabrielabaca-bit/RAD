import { PrismaClient as SqliteClient } from "../src/generated/prisma-sqlite/index.js";
import { PrismaClient as PostgresClient } from "../src/generated/prisma-postgres/index.js";

if (!process.env.SQLITE_DATABASE_URL) {
  throw new Error("Missing SQLITE_DATABASE_URL for SQLite source");
}

if (!process.env.POSTGRES_DATABASE_URL) {
  throw new Error("Missing POSTGRES_DATABASE_URL for Postgres target");
}

const source = new SqliteClient();
const target = new PostgresClient();

async function copyTable(label, fetchRows, insertRows) {
  const rows = await fetchRows();

  if (!rows.length) {
    console.log(`[skip] ${label}: 0 rows`);
    return;
  }

  const result = await insertRows(rows);
  const count =
    typeof result?.count === "number" ? result.count : rows.length;

  console.log(`[ok] ${label}: ${count} rows`);
}

async function resetTarget() {
  console.log("Clearing Postgres target tables...");

  await target.notification.deleteMany();
  await target.replyReport.deleteMany();
  await target.replyLike.deleteMany();
  await target.ratingReply.deleteMany();
  await target.reviewReport.deleteMany();
  await target.ratingLike.deleteMany();
  await target.favoriteDay.deleteMany();
  await target.rating.deleteMany();
  await target.surpriseDeck.deleteMany();
  await target.todayHistoryPool.deleteMany();
  await target.dayStats.deleteMany();
  await target.dayHighlightCache.deleteMany();
  await target.rateLimit.deleteMany();
  await target.adminSession.deleteMany();
  await target.session.deleteMany();
  await target.user.deleteMany();

  console.log("Target cleared.");
}

try {
  console.log("Starting SQLite -> Postgres migration...");
  console.log(`Source: ${process.env.SQLITE_DATABASE_URL}`);
  console.log(`Target: ${process.env.POSTGRES_DATABASE_URL}`);

  await resetTarget();

  await copyTable(
    "User",
    () => source.user.findMany(),
    (rows) => target.user.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "Session",
    () => source.session.findMany(),
    (rows) => target.session.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "AdminSession",
    () => source.adminSession.findMany(),
    (rows) => target.adminSession.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "RateLimit",
    () => source.rateLimit.findMany(),
    (rows) => target.rateLimit.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "DayHighlightCache",
    () => source.dayHighlightCache.findMany(),
    (rows) => target.dayHighlightCache.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "DayStats",
    () => source.dayStats.findMany(),
    (rows) => target.dayStats.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "SurpriseDeck",
    () => source.surpriseDeck.findMany(),
    (rows) => target.surpriseDeck.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "TodayHistoryPool",
    () => source.todayHistoryPool.findMany(),
    (rows) => target.todayHistoryPool.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "Rating",
    () => source.rating.findMany(),
    (rows) => target.rating.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "RatingLike",
    () => source.ratingLike.findMany(),
    (rows) => target.ratingLike.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "ReviewReport",
    () => source.reviewReport.findMany(),
    (rows) => target.reviewReport.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "RatingReply",
    () => source.ratingReply.findMany(),
    (rows) => target.ratingReply.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "ReplyLike",
    () => source.replyLike.findMany(),
    (rows) => target.replyLike.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "ReplyReport",
    () => source.replyReport.findMany(),
    (rows) => target.replyReport.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "FavoriteDay",
    () => source.favoriteDay.findMany(),
    (rows) => target.favoriteDay.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "Notification",
    () => source.notification.findMany(),
    (rows) => target.notification.createMany({ data: rows, skipDuplicates: true })
  );

  const [users, ratings, replies, notifications] = await Promise.all([
    target.user.count(),
    target.rating.count(),
    target.ratingReply.count(),
    target.notification.count(),
  ]);

  console.log("");
  console.log("Migration finished.");
  console.log(`Users: ${users}`);
  console.log(`Ratings: ${ratings}`);
  console.log(`Replies: ${replies}`);
  console.log(`Notifications: ${notifications}`);
} catch (error) {
  console.error("Migration failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await source.$disconnect();
  await target.$disconnect();
}