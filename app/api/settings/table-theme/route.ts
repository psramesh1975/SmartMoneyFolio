import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TABLE_THEME_KEYS } from "@/lib/table-themes";

const schema = z.object({
  tableTheme: z.enum(TABLE_THEME_KEYS as [string, ...string[]]),
});

// Persists the household's Monthly Base/Tracker table color theme choice —
// same pattern as app/api/account/profile/route.ts (Zod validation, session
// check, prisma.household.update). DB-backed, not localStorage, so the
// choice is the same on every device/browser the household signs into.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Not a valid theme." }, { status: 400 });
  }

  await prisma.household.update({
    where: { id: session.householdId },
    data: { tableTheme: parsed.data.tableTheme },
  });

  return NextResponse.json({ ok: true });
}
