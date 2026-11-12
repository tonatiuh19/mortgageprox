import { describe, expect, it } from "vitest";
import { wizardModules, wizardNeedsNumbers } from "./wizard";

describe("wizard dependencies", () => {
  it("hides call transcripts until conversations or phone is chosen", () => {
    expect(wizardNeedsNumbers([])).toBe(false);
    expect(wizardNeedsNumbers(["email", "broadcasts"])).toBe(false);
    expect(wizardModules(["transcripts", "email"])).toEqual(["email"]);
    expect(wizardNeedsNumbers(["phone"])).toBe(true);
    expect(wizardNeedsNumbers(["conversations"])).toBe(true);
    expect(wizardModules(["conversations", "transcripts"])).toEqual(["conversations", "transcripts"]);
  });
});
