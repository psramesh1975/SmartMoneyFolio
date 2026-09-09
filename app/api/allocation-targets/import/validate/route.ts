import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { ASSET_CLASSES, assetClassLabel } from "@/lib/asset-classes";
import { cleanNumber, matchAssetClass, normalizeRow } from "@/lib/import/parse";
import type { ValidateRowResult } from "@/lib/import/types";

const ASSET_CLASS_VALUES = [
  "CASH",
  "FIXED_DEPOSIT",
  "STOCKS",
  "MUTUAL_FUNDS",
  "BONDS",
  "GOLD",
  "RETIREMENT_SAVINGS",
  "INSURANCE_LINKED",
  "REAL_ESTATE",
  "CRYPTOCURRENCY",
  "OTHER",
] as const;

const rowSchema = z.object({
  assetClass: z.enum(ASSET_CLASS_VALUES),
  targetPercent: z.coerce.number().min(0).max(1),
});

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SUM_EPSILON = 0.005;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 5MB)." }, { status: 400 });
  }

  let sheetRows: Record<string, unknown>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that file. Make sure it's a valid .xlsx file." },
      { status: 400 }
    );
  }

  const results: ValidateRowResult[] = [];
  const seenAssetClass = new Map<string, number>(); // assetClass -> first row it appeared on

  sheetRows.forEach((raw, i) => {
    const row = i + 2; // header is row 1
    const cell = normalizeRow(raw);

    const assetClassRaw = String(cell["asset class"] ?? "").trim();
    const percentRaw = cell["target %"];
    const percentBlank = percentRaw === "" || percentRaw === null || percentRaw === undefined;

    if (!assetClassRaw && percentBlank) {
      return; // fully blank row — skip silently
    }

    if (!assetClassRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Asset Class' is required.` });
      return;
    }
    const assetClass = matchAssetClass(assetClassRaw);
    if (!assetClass) {
      results.push({
        row,
        status: "error",
        error: `Row ${row}: '${assetClassRaw}' isn't a recognized asset class.`,
      });
      return;
    }

    const firstRow = seenAssetClass.get(assetClass);
    if (firstRow !== undefined) {
      results.push({
        row,
        status: "error",
        error: `Row ${row}: '${assetClassLabel(assetClass)}' already appears on row ${firstRow} — each asset class can only have one target.`,
      });
      return;
    }
    seenAssetClass.set(assetClass, row);

    if (percentBlank) {
      results.push({ row, status: "error", error: `Row ${row}: 'Target %' is required.` });
      return;
    }

    const cleaned = cleanNumber(percentRaw);
    let num = Number(cleaned);
    if (Number.isNaN(num)) {
      results.push({
        row,
        status: "error",
        error: `Row ${row}: 'Target %' must be a number, got '${percentRaw}'.`,
      });
      return;
    }
    if (num > 1) num = num / 100;

    const parsed = rowSchema.safeParse({ assetClass, targetPercent: num });
    if (!parsed.success) {
      results.push({
        row,
        status: "error",
        error: `Row ${row}: 'Target %' must be between 0% and 100%, got '${percentRaw}'.`,
      });
      return;
    }

    results.push({
      row,
      status: "ok",
      data: parsed.data,
      summary: `${assetClassLabel(assetClass)} — ${(parsed.data.targetPercent * 100).toFixed(1)}%`,
    });
  });

  const validCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.length - validCount;

  const sum = results
    .filter((r) => r.status === "ok")
    .reduce((acc, r) => acc + ((r.data?.targetPercent as number) ?? 0), 0);
  let warning: string | null = null;
  if (validCount > 0 && Math.abs(sum - 1) > SUM_EPSILON) {
    warning = `These targets sum to ${Math.round(sum * 100)}%, not 100%. You can still import — you'll be able to adjust the remaining allocation on the Targets page afterward.`;
  }

  return NextResponse.json({ rows: results, validCount, errorCount, warning });
}
