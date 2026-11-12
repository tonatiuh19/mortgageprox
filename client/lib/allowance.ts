import type { CatalogPlan } from "@shared/api";

export type AllowanceLine = {
  key: "loans" | "emails" | "letters" | "sms" | "voice";
  kind: "count" | "open" | "off" | "quote";
  count: number;
};

/** What a public plan card should say is included. Quotes collapse to one line. */
export function allowanceLines(plan: Pick<CatalogPlan, "isQuote" | "includedLoans" | "includedEmails" | "includedLetters" | "includedSms" | "includedVoiceMinutes">): AllowanceLine[] {
  if (plan.isQuote) return [{ key: "loans", kind: "quote", count: 0 }];
  const specs: Array<[AllowanceLine["key"], number | null]> = [
    ["loans", plan.includedLoans],
    ["emails", plan.includedEmails],
    ["letters", plan.includedLetters],
    ["sms", plan.includedSms],
    ["voice", plan.includedVoiceMinutes],
  ];
  return specs.map(([key, included]) => {
    if (included == null) return { key, kind: "open", count: 0 };
    if (included <= 0) return { key, kind: "off", count: 0 };
    return { key, kind: "count", count: included };
  });
}
