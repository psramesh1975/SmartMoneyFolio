import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { COUNTRY_CODES, isValidTimeZone } from "@/lib/countries";

const memberSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().default("Member"),
  operationalCurrency: z.enum(CURRENCY_CODES).default("USD"),
  residencyStatus: z.enum(["NRI", "RESIDENT_INDIAN", "OTHER"]).default("OTHER"),
  isMinor: z.boolean().default(false),
  dateOfBirth: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
});

const schema = z.object({
  householdName: z.string().min(1),
  country: z.enum(COUNTRY_CODES),
  timeZone: z.string().min(1).refine(isValidTimeZone, { message: "Not a valid timezone." }),
  baseCurrency: z.enum(CURRENCY_CODES),
  operationalCurrency: z.enum(CURRENCY_CODES),
  email: z.string().email(),
  password: z.string().min(8),
  members: z.array(memberSchema).default([]),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some details are missing or invalid. Please check the form and try again." },
      { status: 400 }
    );
  }

  const { householdName, country, timeZone, baseCurrency, operationalCurrency, email, password, members } =
    parsed.data;
  const normalizedEmail = email.toLowerCase();

  const selfDraft = members.find((m) => m.relationship.toLowerCase() === "self");
  if (!selfDraft?.dateOfBirth || !selfDraft?.city || !selfDraft?.address) {
    return NextResponse.json(
      { error: "Date of birth, place, and address are required for the primary account holder." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists. Try logging in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: householdName,
        country,
        timeZone,
        baseCurrency,
        operationalCurrency,
      },
    });

    const user = await tx.user.create({
      data: {
        householdId: household.id,
        email: normalizedEmail,
        passwordHash,
      },
    });

    const otherMembers = members.filter((m) => m !== selfDraft);

    await tx.familyMember.create({
      data: {
        householdId: household.id,
        linkedUserId: user.id,
        name: selfDraft.name,
        relationship: "Self",
        operationalCurrency: selfDraft.operationalCurrency,
        residencyStatus: selfDraft.residencyStatus,
        dateOfBirth: new Date(selfDraft.dateOfBirth!),
        city: selfDraft.city,
        address: selfDraft.address,
        isMinor: false,
      },
    });

    for (const m of otherMembers) {
      await tx.familyMember.create({
        data: {
          householdId: household.id,
          name: m.name,
          relationship: m.relationship,
          operationalCurrency: m.operationalCurrency,
          residencyStatus: m.residencyStatus,
          dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
          isMinor: m.isMinor,
        },
      });
    }

    return { household, user };
  });

  await createSession({
    userId: result.user.id,
    householdId: result.household.id,
    email: result.user.email,
    isPlatformOwner: false,
  });

  return NextResponse.json({ ok: true });
}