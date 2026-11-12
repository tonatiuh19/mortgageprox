import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => __test.setDb(null));

function brokerageSession(role: string) {
  const writes: string[] = [];
  __test.setDb({
    async execute(sql: string, params?: unknown[]) {
      if (sql.includes("FROM sessions")) return [[{ actor: "brokerage", user_id: 2 }], []];
      if (sql.includes("FROM tenant_users")) {
        return [[{
          id: 2,
          email: "ada@harbor.example",
          first_name: "Ada",
          last_name: "Lovelace",
          role,
          status: "active",
          tenant_id: 7,
          tenant_name: "Harbor",
          tenant_slug: "harbor",
          custom_domain: null,
          primary_color: null,
          brand_radius: "soft",
          brand_headline: "serif",
          tenant_status: "active",
          trial_ends_at: null,
          plan_code: "growth",
        }], []];
      }
      if (sql.includes("SELECT module_code FROM tenant_modules")) return [[{ module_code: "brand" }], []];
      if (sql.includes("start_fee_status")) return [[{ start_fee_status: "paid" }], []];
      if (sql.includes("FROM tenant_legal_pages")) return [[{ code: "terms", body_md: "Harbor terms" }, { code: "privacy", body_md: "Harbor privacy" }], []];
      if (sql.includes("INSERT INTO tenant_legal_pages")) {
        writes.push(String(params?.[2] || ""));
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("INSERT INTO activity_log")) return [{ insertId: 1 }, []];
      throw new Error(sql);
    },
    async getConnection() {
      throw new Error("no transaction");
    },
  });
  return writes;
}

describe("legal pages", () => {
  it("names the brokerage in the starter and leaves MortgageProx out", () => {
    const pages = __test.tenantLegalStarter("Harbor Lending");
    expect(pages.terms).toContain("Harbor Lending");
    expect(pages.privacy).toContain("Harbor Lending");
    expect(pages.terms).not.toContain("MortgageProx");
    expect(pages.privacy).not.toContain("MortgageProx");
    expect(pages.terms).not.toContain("\u2014");
    expect(pages.privacy).not.toContain("\u2014");
  });

  it("rejects an unknown page before reading the database", async () => {
    const res = await request(createServer()).get("/api/public/legal/billing");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("errors.notFound");
  });

  it("returns the stored markdown", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM legal_pages")) return [[{ code: "terms", body_md: "# Terms\n\nHello.", updated_at: "2026-11-05 00:00:00" }], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const res = await request(createServer()).get("/api/public/legal/terms");
    expect(res.status).toBe(200);
    expect(res.body.page.body).toContain("# Terms");
    expect(res.body.page.owner).toBe("platform");
  });

  it("returns the brokerage page on its host and not the platform page", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM tenants")) return [[{ id: 7, name: "Harbor", slug: "harbor", status: "active", custom_domain: null, logo_url: null, primary_color: "#1F6F62" }], []];
        if (sql.includes("FROM tenant_legal_pages")) return [[{ body_md: "Harbor terms", updated_at: "2026-11-05 00:00:00" }], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const res = await request(createServer()).get("/api/public/legal/terms").set("x-mp-host", "harbor.mortgageprox.com");
    expect(res.status).toBe(200);
    expect(res.body.page.owner).toBe("tenant");
    expect(res.body.page.body).toBe("Harbor terms");
    expect(res.body.tenant.name).toBe("Harbor");
  });

  it("keeps MortgageProx terms when the agreement asks for the platform copy", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM legal_pages")) return [[{ code: "terms", body_md: "Platform terms", updated_at: "2026-11-05 00:00:00" }], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const res = await request(createServer()).get("/api/public/legal/terms?scope=platform").set("x-mp-host", "harbor.mortgageprox.com");
    expect(res.status).toBe(200);
    expect(res.body.page.owner).toBe("platform");
    expect(res.body.page.body).toBe("Platform terms");
  });

  it("does not publish a suspended brokerage or an empty page", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM tenants")) return [[{ id: 7, name: "Harbor", slug: "harbor", status: "suspended", custom_domain: null, logo_url: null, primary_color: null }], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const hidden = await request(createServer()).get("/api/public/legal/terms").set("x-mp-host", "harbor.mortgageprox.com");
    expect(hidden.status).toBe(404);

    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM tenants")) return [[{ id: 7, name: "Harbor", slug: "harbor", status: "active", custom_domain: "portal.harbor.com", logo_url: null, primary_color: null }], []];
        if (sql.includes("FROM tenant_legal_pages")) return [[], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const missing = await request(createServer()).get("/api/public/legal/privacy").set("x-mp-host", "portal.harbor.com");
    expect(missing.status).toBe(404);
  });

  it("refuses a command edit without a session", async () => {
    const res = await request(createServer()).put("/api/command/legal/terms").send({ body: "Hello" });
    expect(res.status).toBe(401);
  });

  it("lets the owner save and refuses a loan officer", async () => {
    const writes = brokerageSession("brokerage_owner");
    const saved = await request(createServer()).put("/api/app/legal/terms").set("Cookie", "mp_session=owner").send({ body: "Harbor terms, revised" });
    expect(saved.status).toBe(200);
    expect(writes).toEqual(["Harbor terms, revised"]);

    brokerageSession("loan_officer");
    const refused = await request(createServer()).put("/api/app/legal/privacy").set("Cookie", "mp_session=officer").send({ body: "Nope" });
    expect(refused.status).toBe(403);
  });

  it("refuses a brokerage edit without a session", async () => {
    const res = await request(createServer()).get("/api/app/legal");
    expect(res.status).toBe(401);
  });
});
