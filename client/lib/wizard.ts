// Keep in step with withWizardRules in api/index.ts. Transcripts and Twilio require conversations or phone.
const NUMBER_MODULES = new Set(["conversations", "phone"]);

export function wizardNeedsNumbers(modules: readonly string[]): boolean {
  return modules.some((code) => NUMBER_MODULES.has(code));
}

export function wizardModules(modules: readonly string[]): string[] {
  if (wizardNeedsNumbers(modules)) return [...modules];
  return modules.filter((code) => code !== "transcripts");
}
