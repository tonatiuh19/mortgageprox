import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

const edges = [
  { sourceKey: "trigger", targetKey: "check", edgeType: "next" },
  { sourceKey: "check", targetKey: "purchase", edgeType: "yes" },
  { sourceKey: "check", targetKey: "refi", edgeType: "no" },
  { sourceKey: "purchase", targetKey: "text", edgeType: "next" },
  { sourceKey: "text", targetKey: "end", edgeType: "next" },
];

const base = {
  edges,
  now: new Date("2026-11-04T18:00:00Z"),
  waitingSince: null as Date | null,
  quietStart: 9,
  quietEnd: 19,
  smsReady: true,
  emailAllowed: true,
  smsAllowed: true as boolean | "later",
};

describe("reminder flows", () => {
  it("sends the purchase email and holds a text until morning", () => {
    const plan = __test.planFlowStep;
    expect(plan).toBeTypeOf("function");
    if (!plan) return;
    const purchase = plan({
      ...base,
      step: { stepKey: "check", stepType: "condition", config: { check: "purpose_purchase" } },
      ctx: { purpose: "purchase", hasEmail: true, hasPhone: true, replied: false, stopOnReply: true },
    });
    expect(purchase).toMatchObject({ kind: "move", edge: "yes", then: "purchase" });
    const text = plan({
      ...base,
      now: new Date("2026-11-05T01:00:00Z"),
      step: { stepKey: "text", stepType: "send_sms", config: { body: "Hello" } },
      ctx: { purpose: "purchase", hasEmail: true, hasPhone: true, replied: false, stopOnReply: true },
    });
    expect(text.kind).toBe("hold");
    expect(text.reason).toBe("quiet");
    const stopped = plan({
      ...base,
      step: { stepKey: "purchase", stepType: "send_email", config: {} },
      ctx: { purpose: "purchase", hasEmail: true, hasPhone: true, replied: true, stopOnReply: true },
    });
    expect(stopped).toMatchObject({ kind: "stop", reason: "reply" });
  });

  it("skips a text when Twilio is off and keeps the six starters in the brokerage name", () => {
    const plan = __test.planFlowStep;
    if (!plan) throw new Error("missing planner");
    const skipped = plan({
      ...base,
      smsReady: false,
      step: { stepKey: "text", stepType: "send_sms", config: { body: "Hello" } },
      ctx: { purpose: "refinance", hasEmail: true, hasPhone: true, replied: false, stopOnReply: true },
    });
    expect(skipped).toMatchObject({ kind: "skip", reason: "twilio", then: "end" });
    const library = __test.reminderLibrary?.("Harbor Home");
    const text = JSON.stringify(library);
    expect(text).toContain("Harbor Home");
    expect(text).toContain("Draft");
    expect(text).toContain("Loan Funded");
    expect(text).not.toContain("Encore");
    expect(text).not.toContain("—");
    expect(Array.isArray(library) && library).toHaveLength(6);
  });

  it("keeps the builder behind a session", async () => {
    const response = await request(createServer()).get("/api/app/reminders");
    expect(response.status).toBe(401);
    const cron = await request(createServer()).get("/api/cron/flow-reminders");
    expect(cron.status).toBe(401);
  });
});
