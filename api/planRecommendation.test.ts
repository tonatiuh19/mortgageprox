import { describe, expect, it } from "vitest";
import { __test } from "./index";

describe("recommendPlan", () => {
  it("keeps a small core team on Starter", () => {
    const result = __test.recommendPlan({ modules: [], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("starter");
    expect(result.trialDays).toBe(30);
  });

  it("moves the task board off Starter and onto Growth", () => {
    const result = __test.recommendPlan({ modules: ["tasks"], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("growth");
    expect(__test.planIncludesModule("starter", "growth")).toBe(false);
    expect(__test.planIncludesModule("growth", "growth")).toBe(true);
    expect(__test.planIncludesModule("scale", "growth")).toBe(true);
  });

  it("moves pre-approval letters off Starter and onto Growth", () => {
    const result = __test.recommendPlan({ modules: ["letters"], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("growth");
  });

  it("moves referral tools to Growth", () => {
    const result = __test.recommendPlan({ modules: ["realtors", "scheduler"], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("growth");
    expect(result.reasons).toContain("recommend.reason.growth");
  });

  it("puts a custom domain on Scale and keeps the MortgageProx address as the home", () => {
    const result = __test.recommendPlan({ modules: [], seats: 3, customStyles: false, twilio: false, customDomain: true });
    expect(result.planCode).toBe("scale");
    expect(result.reasons[0]).toBe("recommend.reason.domain");
    expect(result.waivedAddons).toContain("custom_domain");
    expect(__test.tenantSlugFromHost("northwind.mortgageprox.com")).toBe("northwind");
    expect(__test.tenantSlugFromHost("www.mortgageprox.com")).toBeNull();
    expect(__test.tenantHost("northwind")).toBe("northwind.mortgageprox.com");
    expect(__test.normalizeHostname("https://portal.northwind.com/apply")).toBe("portal.northwind.com");
    expect(__test.normalizeHostname("northwind.mortgageprox.com")).toBeNull();
  });

  it("puts the MCP connector on Scale and prices each read", () => {
    const result = __test.recommendPlan({ modules: ["mcp"], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("scale");
    expect(result.reasons).toContain("recommend.reason.premium");
    expect(result.reasons).toContain("recommend.reason.mcp");
    expect(__test.MCP_CALL_CENTS).toBe(3);
  });

  it("puts campaigns on Scale and prices contacts, not sends", () => {
    const result = __test.recommendPlan({ modules: ["campaigns"], seats: 3, customStyles: false, twilio: false, customDomain: false });
    expect(result.planCode).toBe("scale");
    expect(result.reasons).toContain("recommend.reason.premium");
    expect(result.reasons).toContain("recommend.reason.campaigns");
    const room = __test.campaignRoom({
      used: 800,
      included: 800,
      packs: 0,
      adding: 20,
      platformUsed: 800,
      platformAdding: 20,
      ceiling: 1000,
      confirmPacks: null,
      priceCents: 900,
    });
    expect(room).toEqual({ error: "errors.campaigns.pack", packs: 1, priceCents: 900 });
  });

  it("puts call transcripts on Scale only when calls or texts are chosen", () => {
    const withPhone = __test.recommendPlan({ modules: ["phone", "transcripts"], seats: 3, customStyles: false, twilio: true, customDomain: false });
    expect(withPhone.planCode).toBe("scale");
    expect(withPhone.addons).toContain("twilio");
    const alone = __test.recommendPlan({ modules: ["transcripts"], seats: 3, customStyles: false, twilio: true, customDomain: false });
    expect(alone.planCode).toBe("starter");
    expect(alone.addons).not.toContain("twilio");
    const emailOnly = __test.withWizardRules({ modules: ["transcripts", "email"], seats: 3, customStyles: false, twilio: true, customDomain: false });
    expect(emailOnly.modules).toEqual(["email"]);
    expect(emailOnly.twilio).toBe(false);
  });

  it("keeps email on Scale without adding a number connection", () => {
    const result = __test.recommendPlan({ modules: ["email"], seats: 3, customStyles: false, twilio: true, customDomain: false });
    expect(result.planCode).toBe("scale");
    expect(result.addons).not.toContain("twilio");
  });

  it("puts Twilio and conversations on Scale and waives the connection fee", () => {
    const result = __test.recommendPlan({ modules: ["conversations", "phone"], seats: 8, customStyles: false, twilio: true, customDomain: false });
    expect(result.planCode).toBe("scale");
    expect(result.addons).toContain("twilio");
    expect(result.waivedAddons).toContain("twilio");
  });

  it("keeps the style studio on Starter because it is included", () => {
    const result = __test.recommendPlan({ modules: [], seats: 3, customStyles: true, twilio: false, customDomain: false });
    expect(result.planCode).toBe("starter");
    expect(result.addons).not.toContain("custom_styles");
  });

  it("lets a custom domain recommend Scale even when styles are chosen", () => {
    const result = __test.recommendPlan({ modules: [], seats: 3, customStyles: true, twilio: false, customDomain: true });
    expect(result.planCode).toBe("scale");
    expect(result.reasons[0]).toBe("recommend.reason.domain");
    expect(result.addons).toContain("custom_domain");
    expect(result.addons).not.toContain("custom_styles");
  });

  it("keeps a style direction only when color, corners and headline are all present", () => {
    expect(__test.parseBrand({ accent: "#d4653a", radius: "round", headline: "italic" })).toEqual({
      accent: "#D4653A",
      radius: "round",
      headline: "italic",
    });
    expect(__test.parseBrand({ accent: "#D4653A", radius: "soft" })).toBeNull();
    expect(__test.normalizeHex("#abc")).toBe("#AABBCC");
    expect(__test.normalizeHex("nope")).toBeNull();
    expect(__test.parseBrand({ accent: "#abc", radius: "round", headline: "sans" })?.accent).toBe("#AABBCC");
  });

  it("rejects a wizard payload without a team size", () => {
    expect(__test.parseWizard({ modules: ["pipeline"], seats: 0 })).toBeNull();
  });
});

describe("parseGridQuery", () => {
  it("whitelists sort, caps the page size and escapes nothing into the column name", () => {
    const grid = __test.parseGridQuery(
      { page: "2", limit: "500", sort: "name; drop", dir: "asc", search: "  North " },
      { name: "t.name", created: "t.created_at" },
      "created",
    );
    expect(grid.sort).toBe("created");
    expect(grid.orderBy).toBe("t.created_at");
    expect(grid.limit).toBe(100);
    expect(grid.page).toBe(2);
    expect(grid.offset).toBe(100);
    expect(grid.dir).toBe("ASC");
    expect(grid.search).toBe("North");
  });
});
