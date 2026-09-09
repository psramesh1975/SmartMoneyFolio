// Small helpers shared by the three /api/*/import/validate routes for
// turning a loosely-typed spreadsheet row into something a Zod schema can
// judge cleanly.

import { ASSET_CLASSES } from "@/lib/asset-classes";

/** Case-insensitive, trimmed lookup keyed by lower-cased header name, so
 * "Family Member", "family member", and " Family Member " all resolve the
 * same cell. */
export function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.trim().toLowerCase()] = v;
  }
  return out;
}

/** True once every named cell on a row is blank — used to silently skip
 * trailing empty rows Excel often leaves in a sheet. */
export function isBlankRow(cells: unknown[]): boolean {
  return cells.every((v) => v === "" || v === null || v === undefined);
}

/** Strips commas/currency symbols from a number pasted out of a spreadsheet
 * (e.g. "$1,200.50" -> "1200.50") before it reaches z.coerce.number().
 * Recognizes accounting-style negatives ("(500)" -> "-500") and preserves
 * scientific notation ("1.5e6") instead of mangling it into "1.56". */
export function cleanNumber(raw: unknown): unknown {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (trimmed === "") return trimmed;

  const parenMatch = trimmed.match(/^\((.*)\)$/);
  const inner = parenMatch ? parenMatch[1] : trimmed;

  let cleaned = inner.replace(/[^0-9.\-eE+]/g, "");
  if (parenMatch && cleaned && !cleaned.startsWith("-")) {
    cleaned = `-${cleaned}`;
  }
  return cleaned === "" ? trimmed : cleaned;
}

/** Converts a raw Excel date serial number (from a cell that isn't
 * date-formatted, so SheetJS's `cellDates: true` didn't convert it) into a
 * real Date, using the same days-since-epoch math SheetJS itself documents
 * for manual serial conversion. */
export function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/** Matches a typed asset class against its enum value ("STOCKS"), its full
 * display label ("Fixed Deposit / Time Deposit"), or either half of a
 * compound label ("Fixed Deposit", "Time Deposit") — case-insensitively, so
 * the short form a user is likely to type in Excel still resolves. */
export function matchAssetClass(raw: string): string | undefined {
  const norm = raw.trim().toLowerCase();
  if (!norm) return undefined;
  const found = ASSET_CLASSES.find((c) => {
    if (c.value.toLowerCase() === norm) return true;
    if (c.label.toLowerCase() === norm) return true;
    return c.label.split("/").some((segment) => segment.trim().toLowerCase() === norm);
  });
  return found?.value;
}
