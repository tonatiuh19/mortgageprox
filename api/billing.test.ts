import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

describe("allowances", () => {
  it("keeps a quote and an open cap from blocking work", () => {
    expect(__test.allowanceDecision(10, null, 1, false)).toBeNull();
    expect(__test.allowanceDecision(10, 0, 1, true)).toBeNull();
  });

  it("blocks a channel the plan does not include", () => {
    expect(__test.allowanceDecision(0, 0, 1, false)).toBe("errors.billing.notIncluded");
  });

  it("blocks the next send once the included amount is used", () => {
    expect(__test.allowanceDecision(40, 40, 1, false)).toBe("errors.billing.allowance");
    expect(__test.allowanceDecision(39, 40, 1, false)).toBeNull();
  });

  it("names the meter state from how full the cap is", () => {
    expect(__test.meterState(0, 0, false)).toBe("off");
    expect(__test.meterState(0, null, false)).toBe("open");
    expect(__test.meterState(0, 10, true)).toBe("quote");
    expect(__test.meterState(8, 10, false)).toBe("watch");
    expect(__test.meterState(10, 10, false)).toBe("full");
    expect(__test.meterState(3, 10, false)).toBe("ok");
  });

  it("counts text segments and call minutes the way the cap does", () => {
    expect(__test.smsSegments("a".repeat(160))).toBe(1);
    expect(__test.smsSegments("a".repeat(161))).toBe(2);
    expect(__test.smsSegments("á")).toBe(1);
    expect(__test.smsSegments("á".repeat(71))).toBe(2);
    expect(__test.voiceMinutes(null)).toBe(1);
    expect(__test.voiceMinutes(61)).toBe(2);
  });

  it("refuses billing without a session", async () => {
    const res = await request(createServer()).get("/api/app/billing");
    expect(res.status).toBe(401);
  });

  it("sells an extra seat only when one can be added or an empty one removed", () => {
    expect(__test.seatChange({ used: 3, included: 3, extra: 0, action: "add", quoted: false })).toEqual({ extra: 1 });
    expect(__test.seatChange({ used: 4, included: 3, extra: 1, action: "remove", quoted: false })).toEqual({ error: "errors.billing.seatInUse" });
    expect(__test.seatChange({ used: 3, included: 3, extra: 1, action: "remove", quoted: false })).toEqual({ extra: 0 });
    expect(__test.seatChange({ used: 1, included: 3, extra: 0, action: "remove", quoted: false })).toEqual({ error: "errors.billing.noExtraSeat" });
    expect(__test.seatChange({ used: 1, included: 0, extra: 0, action: "add", quoted: true })).toEqual({ error: "errors.billing.notIncluded" });
  });

  it("offers packs for included emails, letters and loans only", () => {
    expect(__test.packApplies("emails", 500, false)).toBe(true);
    expect(__test.packApplies("letters", 0, false)).toBe(false);
    expect(__test.packApplies("loans", null, false)).toBe(false);
    expect(__test.packApplies("sms", 2000, false)).toBe(false);
    expect(__test.packApplies("voice", 1000, false)).toBe(false);
    expect(__test.packApplies("emails", 500, true)).toBe(false);
  });

  it("refuses a seat purchase without a session", async () => {
    const res = await request(createServer()).post("/api/app/billing/seats").send({ action: "add" });
    expect(res.status).toBe(401);
  });
});
