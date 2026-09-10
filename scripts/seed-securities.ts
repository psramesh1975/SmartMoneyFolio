// Standalone seeder for the global SecuritiesMaster directory. Run manually
// (npx tsx scripts/seed-securities.ts) or on its own weekly trigger —
// deliberately NOT part of package.json's build command and NOT touched by
// `prisma db push && seed`, which runs on every deploy. This data is
// household-independent and much slower-moving than anything else the app
// deploys, so it gets its own lifecycle entirely.
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
}

async function seedMutualFunds() {
  console.log("Fetching mutual fund scheme list from mfapi.in...");
  const res = await fetch("https://api.mfapi.in/mf");
  if (!res.ok) throw new Error(`mfapi.in returned ${res.status}`);
  const schemes: { schemeCode: number; schemeName: string }[] = await res.json();
  console.log(`Got ${schemes.length} mutual fund schemes. Upserting...`);

  let done = 0;
  for (const batch of chunk(schemes, 500)) {
    await prisma.$transaction(
      batch.map((s) =>
        prisma.securitiesMaster.upsert({
          where: { tickerOrCode_securityType: { tickerOrCode: String(s.schemeCode), securityType: "MUTUAL_FUND" } },
          update: { name: s.schemeName },
          create: {
            securityType: "MUTUAL_FUND",
            country: "IN",
            tickerOrCode: String(s.schemeCode),
            name: s.schemeName,
            exchange: "AMFI",
          },
        })
      )
    );
    done += batch.length;
    console.log(`  ...${done}/${schemes.length} mutual funds upserted`);
  }
}

async function seedNseStocks() {
  console.log("Fetching NSE equity list...");
  const res = await fetch("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv");
  if (!res.ok) throw new Error(`NSE archive returned ${res.status}`);
  const csv = await res.text();

  // Reuse the xlsx dependency already in this repo for CSV parsing (handles
  // quoted commas in company names correctly) rather than adding a new one.
  const workbook = XLSX.read(csv, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  console.log(`Got ${rows.length} NSE-listed equities. Upserting...`);

  let done = 0;
  for (const batch of chunk(rows, 500)) {
    await prisma.$transaction(
      batch
        .filter((r) => r["SYMBOL"])
        .map((r) =>
          prisma.securitiesMaster.upsert({
            where: { tickerOrCode_securityType: { tickerOrCode: `${r["SYMBOL"]}.NS`, securityType: "STOCK" } },
            update: { name: r["NAME OF COMPANY"], isin: r["ISIN NUMBER"] || null },
            create: {
              securityType: "STOCK",
              country: "IN",
              tickerOrCode: `${r["SYMBOL"]}.NS`,
              name: r["NAME OF COMPANY"],
              isin: r["ISIN NUMBER"] || null,
              exchange: "NSE",
            },
          })
        )
    );
    done += batch.length;
    console.log(`  ...${done}/${rows.length} NSE stocks upserted`);
  }
}

// US stock seeding (SEC ticker JSON, country: "US", exchange: "NASDAQ"/"NYSE")
// follows the same upsert shape as seedNseStocks — not included in this pass,
// per the phase's scope note. Add it here the same way when needed.

async function main() {
  await seedMutualFunds();
  await seedNseStocks();
  console.log("Securities master seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
