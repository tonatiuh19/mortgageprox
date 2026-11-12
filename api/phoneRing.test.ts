import { describe, expect, it } from "vitest";
import { __test } from "./index";

describe("phone desk", () => {
  it("rings the browser, then the cell, then voicemail", () => {
    expect(__test.ringPlan({
      blocked: false,
      browser: true,
      forwardingPhone: "+14155550190",
      voicemail: true,
    })).toEqual(["browser", "forward", "voicemail"]);
  });

  it("stops a blocked number before any ring", () => {
    expect(__test.ringPlan({
      blocked: true,
      browser: true,
      forwardingPhone: "+14155550190",
      voicemail: true,
    })).toEqual(["blocked"]);
  });

  it("ends the call when nothing is set to answer", () => {
    expect(__test.ringPlan({
      blocked: false,
      browser: false,
      forwardingPhone: null,
      voicemail: false,
    })).toEqual(["ended"]);
  });

  it("builds a Microsoft sign-in link that names the mailbox and can be verified", () => {
    const state = __test.signState({ mailboxId: 4, exp: 99 });
    expect(__test.readState(state)?.mailboxId).toBe(4);
    expect(__test.readState("nope.nope")).toBeNull();
    const url = new URL(__test.microsoftAuthUrl("app-id", "http://localhost:8081/api/public/microsoft/callback", state, "ada@northwind.example"));
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.searchParams.get("login_hint")).toBe("ada@northwind.example");
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("scope")).toContain("Mail.Read");
    expect(url.searchParams.get("scope")).not.toContain("Calendars");
  });

  it("accepts a 10-digit US number and refuses a short one", () => {
    expect(__test.toE164("(415) 555-0190")).toBe("+14155550190");
    expect(__test.toE164("555")).toBeNull();
  });
});
