import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

describe("module catalog", () => {
  it("turns on an included module and sends a higher one to its plan", () => {
    expect(__test.moduleChange({ role: "brokerage_owner", planCode: "starter", category: "core", turningOn: false })).toEqual({ error: "errors.billing.core" });
    expect(__test.moduleChange({ role: "loan_officer", planCode: "scale", category: "growth", turningOn: true })).toEqual({ error: "errors.forbidden" });
    expect(__test.moduleChange({ role: "leadership", planCode: "growth", category: "growth", turningOn: true })).toEqual({ error: "errors.forbidden" });
    expect(__test.moduleChange({ role: "brokerage_owner", planCode: "starter", category: "growth", turningOn: true })).toEqual({ error: "errors.billing.upgrade", plan: "growth" });
    expect(__test.moduleChange({ role: "brokerage_owner", planCode: "growth", category: "growth", turningOn: true })).toEqual({ ok: true });
    expect(__test.moduleChange({ role: "brokerage_owner", planCode: "growth", category: "premium", turningOn: true })).toEqual({ error: "errors.billing.upgrade", plan: "scale" });
    expect(__test.moduleChange({ role: "brokerage_owner", planCode: "growth", category: "growth", turningOn: false })).toEqual({ ok: true });
    expect(__test.planIncludesModule("custom", "premium")).toBe(true);
    expect(__test.planIncludesModule("scale", "communications")).toBe(true);
    expect(__test.moduleMinimumPlan("core")).toBe("starter");
  });

  it("upgrades only upward, and only the owner can pay", () => {
    expect(__test.upgradeChange({ role: "brokerage_owner", from: "starter", to: "scale" })).toEqual({ ok: true });
    expect(__test.upgradeChange({ role: "brokerage_owner", from: "growth", to: "growth" })).toEqual({ error: "errors.billing.downgrade" });
    expect(__test.upgradeChange({ role: "brokerage_owner", from: "scale", to: "starter" })).toEqual({ error: "errors.billing.downgrade" });
    expect(__test.upgradeChange({ role: "leadership", from: "starter", to: "growth" })).toEqual({ error: "errors.forbidden" });
    expect(__test.upgradeChange({ role: "loan_officer", from: "starter", to: "growth" })).toEqual({ error: "errors.forbidden" });
    expect(__test.upgradeChange({ role: "brokerage_owner", from: "starter", to: "custom" })).toEqual({ error: "errors.billing.quote" });
    expect(__test.upgradeChange({ role: "brokerage_owner", from: "custom", to: "scale" })).toEqual({ error: "errors.billing.quote" });
  });

  it("keeps the catalog behind a session", async () => {
    const response = await request(createServer()).get("/api/app/modules");
    expect(response.status).toBe(401);
    const upgrade = await request(createServer()).post("/api/app/billing/upgrade").send({ planCode: "growth" });
    expect(upgrade.status).toBe(401);
  });
});
