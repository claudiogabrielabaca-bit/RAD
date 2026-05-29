const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const MONTH_DAY = process.argv[3] ?? "05-29";
const ATTEMPTS = Number(process.argv[4] ?? 45);

function isValidDay(day: unknown): day is string {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

async function main() {
  const seen: string[] = [];

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const params = new URLSearchParams();

    params.set("bundle", "1");
    params.set("monthDay", MONTH_DAY);

    if (seen.length > 0) {
      params.set("excludeDays", seen.join(","));
    }

    const currentDay = seen.at(-1);

    if (currentDay) {
      params.set("currentDay", currentDay);
    }

    const url = `${BASE_URL.replace(/\/$/, "")}/api/today-valid-day?${params.toString()}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => null);

    if (!res.ok || !json || !isValidDay(json.day)) {
      console.log({
        attempt: i + 1,
        status: res.status,
        error: json,
      });
      break;
    }

    const duplicate = seen.includes(json.day);
    seen.push(json.day);

    console.log({
      attempt: i + 1,
      day: json.day,
      source: json.source,
      restartedRound: json.restartedRound,
      duplicate,
      title: json.highlightData?.highlight?.title ?? null,
    });

    if (duplicate) {
      break;
    }
  }

  console.log("");
  console.log(`Unique days: ${new Set(seen).size}`);
  console.log(`Total responses: ${seen.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
