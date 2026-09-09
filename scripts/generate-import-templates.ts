// Generates the three static .xlsx templates served from the Import from
// Excel modals. Run once at build/edit time (npm run generate-templates) —
// these are committed files, not generated per-request.
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

function writeTemplate(filename: string, headers: string[], exampleRow: (string | number)[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

  const outDir = path.join(process.cwd(), "public", "templates");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  XLSX.writeFile(workbook, outPath);
  console.log(`Wrote ${outPath}`);
}

writeTemplate(
  "holdings-import-template.xlsx",
  ["Family Member", "Asset Class", "Holding Name", "Currency", "Current Value"],
  ["Self", "Fixed Deposit", "Example — delete this row", "USD", 1000]
);

writeTemplate(
  "goals-import-template.xlsx",
  ["Name", "Target Amount", "Currency", "Current Amount", "Target Date"],
  ["Example — delete this row", 1000000, "USD", 0, "2030-01-01"]
);

writeTemplate(
  "targets-import-template.xlsx",
  ["Asset Class", "Target %"],
  ["Example — delete this row", 0]
);
