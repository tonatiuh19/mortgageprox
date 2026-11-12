import { describe, expect, it } from "vitest";
import { isLocalDev } from "./devFill";

describe("local dev fill", () => {
  it("stays off for production hosts even if the build flag is on", () => {
    expect(isLocalDev(true, "mortgageprox.vercel.app")).toBe(false);
    expect(isLocalDev(true, "www.example.com")).toBe(false);
    expect(isLocalDev(false, "localhost")).toBe(false);
  });

  it("is on for localhost and a private LAN address during dev", () => {
    expect(isLocalDev(true, "localhost")).toBe(true);
    expect(isLocalDev(true, "127.0.0.1")).toBe(true);
    expect(isLocalDev(true, "192.168.68.112")).toBe(true);
  });
});
