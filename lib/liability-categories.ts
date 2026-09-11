// Groups liability types into the 4 accordion sections on /liabilities.
// Same shape/spirit as lib/asset-categories.ts's ASSET_CATEGORIES — icon +
// subtitle metadata the full Liabilities page needs, distinct from the flat
// LIABILITY_TYPES list used by the API/schema enum.

export type LiabilityTypeValue = "HOME_LOAN" | "CAR_LOAN" | "PERSONAL_LOAN" | "CREDIT_CARD" | "DEVICE_EMI" | "OTHER";

export const LIABILITY_TYPES: { value: LiabilityTypeValue; label: string }[] = [
  { value: "HOME_LOAN", label: "Home Loan" },
  { value: "CAR_LOAN", label: "Car Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEVICE_EMI", label: "Device EMI" },
  { value: "OTHER", label: "Other" },
];

export function liabilityTypeLabel(value: string): string {
  return LIABILITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export const LIABILITY_CATEGORIES: {
  id: string;
  label: string;
  subtitle: string;
  icon: string; // lucide-react component name
  types: LiabilityTypeValue[];
}[] = [
  {
    id: "mortgages",
    label: "Secured Mortgages & Property Loans",
    subtitle: "Long-term real estate financing",
    icon: "Home",
    types: ["HOME_LOAN"],
  },
  {
    id: "consumer",
    label: "Personal & Consumer Financing",
    subtitle: "Vehicle, education, personal, and device loans",
    icon: "Smartphone",
    types: ["CAR_LOAN", "PERSONAL_LOAN", "DEVICE_EMI"],
  },
  {
    id: "credit-cards",
    label: "Revolving Credit Cards & Lines",
    subtitle: "Monthly billing cycles and running balances",
    icon: "CreditCard",
    types: ["CREDIT_CARD"],
  },
  {
    id: "other",
    label: "Other Liabilities",
    subtitle: "Anything that doesn't fit the above",
    icon: "Layers",
    types: ["OTHER"],
  },
];

export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];

export function categoryForLiabilityType(liabilityType: string): LiabilityCategory | undefined {
  return LIABILITY_CATEGORIES.find((c) => (c.types as string[]).includes(liabilityType));
}
