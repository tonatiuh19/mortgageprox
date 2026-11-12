import type { EmailDraft } from "@shared/api";

export const EMAIL_SAMPLE: Record<string, string> = {
  firstName: "Maya",
  brokerage: "Northwind Mortgage",
  code: "482913",
  minutes: "10",
  host: "northwind-mortgage.mortgageprox.com",
  loginUrl: "https://mortgageprox.com/login",
  appUrl: "https://mortgageprox.com/app",
  portalUrl: "https://mortgageprox.com/portal",
  transcript: "We walked through the rate and the two documents still needed.",
  officer: "Alex",
  inviter: "Alex",
  task: "Call about the last two pay stubs.",
  amount: "$299",
  date: "Nov 4, 2026",
  reference: "MP-1042",
};

export function fillEmailText(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key: string) => (key in vars ? vars[key] : token));
}

export function previewDraft(draft: EmailDraft, vars: Record<string, string>): EmailDraft {
  return {
    subject: fillEmailText(draft.subject, vars),
    greeting: fillEmailText(draft.greeting, vars),
    headline: fillEmailText(draft.headline, vars),
    body: fillEmailText(draft.body, vars),
    buttonLabel: fillEmailText(draft.buttonLabel, vars),
    buttonUrl: fillEmailText(draft.buttonUrl, vars),
    details: draft.details.map((detail) => ({
      label: fillEmailText(detail.label, vars),
      value: fillEmailText(detail.value, vars),
    })),
    footer: fillEmailText(draft.footer, vars),
  };
}
