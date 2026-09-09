import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { cleanNumber, excelSerialToDate, isBlankRow, normalizeRow } from "@/lib/import/parse";
import type { ValidateRowResult } from "@/lib/import/types";

const rowSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.coerce.number().positive(),
  currency: z.enum(CURRENCY_CODES),
  currentAmount: z.coerce.number().nonnegative().default(0),
  targetDate: z.coerce.date().nullable().optional(),
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
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "", blankrows: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that file. Make sure it's a valid .xlsx file." },
      { status: 400 }
    );
  }

  const results: ValidateRowResult[] = [];
  sheetRows.forEach((raw, i) => {
    const row = i + 2; // header is row 1
    const cell = normalizeRow(raw);

    if (isBlankRow(Object.values(cell))) {
      return; // fully blank row — skip silently
    }

    const nameRaw = String(cell["name"] ?? "").trim();
    const currencyRaw = String(cell["currency"] ?? "")
      .trim()
      .toUpperCase();
    const targetAmountRaw = cell["target amount"];
    const targetAmountBlank =
      targetAmountRaw === "" || targetAmountRaw === null || targetAmountRaw === undefined;
    const currentAmountRaw = cell["current amount"];
    const targetDateRaw = cell["target date"];

    if (!nameRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Name' is required.` });
      return;
    }
    if (targetAmountBlank) {
      results.push({ row, status: "error", error: `Row ${row}: 'Target Amount' is required.` });
      return;
    }
    if (!currencyRaw) {
      results.push({ row, status: "error", error: `Row ${row}: 'Currency' is required.` });
      return;
    }

    let targetDateValue: Date | string | null = null;
    if (targetDateRaw instanceof Date) {
      targetDateValue = targetDateRaw;
    } else if (typeof targetDateRaw === "string" && targetDateRaw.trim() !== "") {
      targetDateValue = targetDateRaw.trim();
    } else if (typeof targetDateRaw === "number") {
      // A date-looking cell that isn't Excel-date-formatted comes back as a
      // raw serial (days since 1899-12-30) instead of a Date — convert it
      // rather than silently dropping the value.
      targetDateValue = excelSerialToDate(targetDateRaw);
    }

    const parsed = rowSchema.safeParse({
      name: nameRaw,
      targetAmount: cleanNumber(targetAmountRaw),
      currency: currencyRaw,
      currentAmount:
        currentAmountRaw === "" || currentAmountRaw === null || currentAmountRaw === undefined
          ? 0
          : cleanNumber(currentAmountRaw),
      targetDate: targetDateValue,
    });

    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === "currency") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'currency' must be one of the supported codes, got '${currencyRaw}'.`,
        });
      } else if (field === "targetAmount") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'Target Amount' must be a positive number, got '${targetAmountRaw}'.`,
        });
      } else if (field === "currentAmount") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'Current Amount' must be a non-negative number, got '${currentAmountRaw}'.`,
        });
      } else if (field === "targetDate") {
        results.push({
          row,
          status: "error",
          error: `Row ${row}: 'Target Date' isn't a valid date, got '${targetDateRaw}'.`,
        });
      } else {
        results.push({ row, status: "error", error: `Row ${row}: ${parsed.error.issues[0]?.message}` });
      }
      return;
    }

    const dateLabel = parsed.data.targetDate
      ? `, due ${parsed.data.targetDate.toISOString().slice(0, 10)}`
      : "";
    results.push({
      row,
      status: "ok",
      data: parsed.data,
      summary: `${parsed.data.name} — ${parsed.data.currency} ${parsed.data.targetAmount.toLocaleString()} target${dateLabel}`,
    });
  });

  const validCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.length - validCount;

  return NextResponse.json({ rows: results, validCount, errorCount });
}
