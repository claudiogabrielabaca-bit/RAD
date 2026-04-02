import { getDayHighlights } from "../src/app/lib/wiki";

const START_YEAR = 1800;
const END_YEAR = new Date().getFullYear();
const REQUEST_DELAY_MS = 120;
const LOG_EVERY = 25;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffleArray(items: string[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function buildBalancedDates() {
  const dates: string[] = [];

  for (let month = 1; month <= 12; month += 1) {
    for (let year = START_YEAR; year <= END_YEAR; year += 1) {
      const maxDay = getDaysInMonth(year, month);

      for (let day = 1; day <= maxDay; day += 1) {
        dates.push(`${year}-${pad2(month)}-${pad2(day)}`);
      }
    }
  }

  return shuffleArray(dates);
}

async function main() {
  const dates = buildBalancedDates();
  let processed = 0;

  for (const date of dates) {
    try {
      await getDayHighlights(date);
      processed += 1;

      if (processed % LOG_EVERY === 0) {
        console.log(`Processed ${processed}/${dates.length} dates. Last: ${date}`);
      }
    } catch (error) {
      console.error(`Failed: ${date}`, error);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });
