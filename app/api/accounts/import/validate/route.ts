import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
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
  familyMemberId: z.string().min(1),
  assetClass: z.enum(ASSET_CLASS_VALUES),
  holdingName: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  currentValue: z.coerce.number().nonnegative(),
});

const MAX_FILE_BYTES = 5 * 1024 * 1024;

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

  const members = await prisma.familyMember.findMany({
    where: { householdId: session.householdId },
    select: { id: true, name: true },
  });
  const memberByName = new Map(members.map((m) => [m.name.trim().toLowerCase(), m.id]));

  const results: ValidateRowResult[] = [];
  sheetRows.forEach((raw, i) => {
    const row = i + 2; // header is row 1
    const cell = normalizeRow(raw);

    const memberNameRaw = String(cell["family member"] ?? "").trim();
    const assetClassRaw = String(cell["asset class"] ?? "").trim();
    const holdingNameRaw = String(cell["holding name"] ?? "").trim();
    const currencyRaw = String(cell["currency"] ?? "").trim();
    const valueRaw = cell["current value"];
    const valueBlank = valueRaw === "" || valueRaw === null || valueRaw === undefined;

    if (!memberNameRaw && !assetClassRaw && !holdingNameRaw && !currencyRaw && valueBlank) {
      return; // fully blank row — skip silently
    }

    if (!memberNameRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Family Member' is required.` });
      return;
    }
    const familyMemberId = memberByName.get(memberNameRaw.toLowerCase());
    if (!familyMemberId) {
      results.push({
        row,
        status: "error",
        error: `Row ${row}: no family member named '${memberNameRaw}' — check spelling or add them on the Accounts page first.`,
      });
      return;
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

    if (!holdingNameRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Holding Name' is required.` });
      return;
    }

    if (!currencyRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Currency' is required.` });
      return;
    }

    if (valueBlank) {
      results.push({ row, status: "error", error: `Row ${row}: 'Current Value' is required.` });
      return;
    }

    const parsed = rowSchema.safeParse({
      familyMemberId,
      assetClass,
      holdingName: holdingNameRaw,
      currency: currencyRaw,
      currentValue: cleanNumber(valueRaw),
    });

    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === "currency") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'currency' must be one of the supported codes, got '${currencyRaw}'.`,
        });
      } else if (field === "currentValue") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'Current Value' must be a non-negative number, got '${valueRaw}'.`,
        });
      } else {
        results.push({ row, status: "error", error: `Row ${row}: ${parsed.error.issues[0]?.message}` });
      }
      return;
    }

    results.push({
      row,
      status: "ok",
      data: parsed.data,
      summary: `${parsed.data.holdingName} — ${parsed.data.currency} ${parsed.data.currentValue.toLocaleString()} (${memberNameRaw}, ${assetClassLabel(assetClass)})`,
    });
  });

  const validCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.length - validCount;

  return NextResponse.json({ rows: results, validCount, errorCount });
}
