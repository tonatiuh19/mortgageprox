import { describe, expect, it } from "vitest";
import { foregroundFor, hexToHsl, normalizeHex, parseBrandDirection } from "./brand";

describe("brand direction", () => {
  it("turns a hex accent into the HSL the theme expects", () => {
    expect(hexToHsl("#2F4FD8")).toBe("229 68.4% 51.6%");
    expect(hexToHsl("#fff")).toBe("0 0% 100%");
    expect(normalizeHex("2f4fd8")).toBe("#2F4FD8");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(hexToHsl("blue")).toBeNull();
  });

  it("keeps light accents readable", () => {
    expect(foregroundFor("#2F4FD8")).toBe("0 0% 100%");
    expect(foregroundFor("#F4E7C5")).toBe("223 38.9% 7.1%");
  });

  it("accepts a complete direction and refuses a partial one", () => {
    expect(parseBrandDirection({ accent: "#1f6f62", radius: "round", headline: "italic" })).toEqual({
      accent: "#1F6F62",
      radius: "round",
      headline: "italic",
    });
    expect(parseBrandDirection({ accent: "#1F6F62", radius: "soft" })).toBeNull();
  });
});
