import { describe, expect, it } from "vitest";
import { allowanceLines } from "./allowance";

const empty = {
  includedLoans: null,
  includedEmails: null,
  includedLetters: null,
  includedSms: null,
  includedVoiceMinutes: null,
};

describe("allowance lines", () => {
  it("collapses a quote to one line", () => {
    expect(allowanceLines({ ...empty, isQuote: true })).toEqual([{ key: "loans", kind: "quote", count: 0 }]);
  });

  it("marks a zero cap as not included and a null cap as open", () => {
    const lines = allowanceLines({
      isQuote: false,
      includedLoans: null,
      includedEmails: 500,
      includedLetters: 0,
      includedSms: 0,
      includedVoiceMinutes: 0,
    });
    expect(lines.find((line) => line.key === "loans")?.kind).toBe("open");
    expect(lines.find((line) => line.key === "emails")).toEqual({ key: "emails", kind: "count", count: 500 });
    expect(lines.find((line) => line.key === "letters")?.kind).toBe("off");
  });
});
