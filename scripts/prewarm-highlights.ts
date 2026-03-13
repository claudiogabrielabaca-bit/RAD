import { getDayHighlights } from "../src/app/lib/wiki";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const startYear = 1900;
  const endYear = new Date().getFullYear();

  let processed = 0;

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const maxDay = getDaysInMonth(year, month);

      for (let day = 1; day <= maxDay; day++) {
        const date = `${year}-${pad2(month)}-${pad2(day)}`;

        try {
          await getDayHighlights(date);
          processed++;

          if (processed % 25 === 0) {
            console.log(`Processed ${processed} dates. Last: ${date}`);
          }

          await sleep(150);
        } catch (error) {
          console.error(`Failed: ${date}`, error);
        }
      }
    }
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });