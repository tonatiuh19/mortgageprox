import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, roleCan } from "@shared/api";
import { __test } from "./index";

describe("roles", () => {
  it("matches the client permission map", () => {
    expect(__test.ROLE_PERMISSIONS).toEqual(ROLE_PERMISSIONS);
  });

  it("gives Alex's owner role the command center and keeps a loan officer in their book", () => {
    expect(roleCan("platform_owner", "tenants.billing")).toBe(true);
    expect(__test.roleCan("platform_owner", "tenants.billing")).toBe(true);
    expect(roleCan("platform_support", "tenants.billing")).toBe(false);
    expect(roleCan("loan_officer", "team.manage")).toBe(false);
    expect(roleCan("loan_officer", "clients.write")).toBe(true);
    expect(roleCan("brokerage_owner", "settings.write")).toBe(true);
    expect(roleCan("processor", "inbox.read")).toBe(false);
    expect(roleCan("borrower", "portal.read")).toBe(true);
    expect(roleCan("borrower", "clients.read")).toBe(false);
  });
});
