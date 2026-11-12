import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => {
  __test.setDb(null);
});

const token = "mp_mcp_testtokenvalue";

function connectorDb(options?: { module?: boolean; status?: string; loans?: boolean }) {
  const moduleOn = options?.module !== false;
  const status = options?.status || "active";
  let billed = 0;
  __test.setDb({
    async execute(sql: string, params?: unknown[]) {
      if (sql.includes("mcp_token_hash")) {
        if (params?.[0] !== __test.sha256(token)) return [[], []];
        return [[{ id: 7, status, trial_ends_at: status === "trial" ? "2020-01-01 00:00:00" : null }], []];
      }
      if (sql.includes("FROM tenant_modules")) return moduleOn ? [[{ ok: 1 }], []] : [[], []];
      if (sql.includes("FROM loans")) {
        if (options?.loans === false) return [[], []];
        return [[{
          id: 3,
          purpose: "purchase",
          amount_cents: 25000000,
          status: "open",
          stage: "Application",
          first_name: "Ada",
          last_name: "Lovelace",
        }], []];
      }
      if (sql.includes("INSERT INTO mcp_calls")) {
        billed += 1;
        return [{ insertId: billed }, []];
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
    async getConnection() {
      throw new Error("mcp invoice sync should not run in vitest");
    },
  });
  return {
    billed: () => billed,
  };
}

describe("mcp connector", () => {
  it("keeps discovery and unknown tools off the bill", () => {
    expect(__test.MCP_CALL_CENTS).toBe(3);
    expect(__test.mcpDecision("initialize", {}).kind).toBe("result");
    expect(__test.mcpDecision("tools/list", {}).kind).toBe("result");
    expect(__test.mcpDecision("notifications/initialized", {}).kind).toBe("notify");
    expect(__test.mcpDecision("tools/call", { name: "list_loans", arguments: {} }).kind).toBe("call");
    const unknown = __test.mcpDecision("tools/call", { name: "drop_loans" });
    expect(unknown.kind).toBe("error");
  });

  it("refuses a missing token before it reads the brokerage", async () => {
    const res = await request(createServer()).post("/api/mcp").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
  });

  it("lists tools without recording a call", async () => {
    const db = connectorDb();
    const res = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token}`)
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(200);
    expect(res.body.result.tools.map((tool: { name: string }) => tool.name)).toContain("list_loans");
    expect(db.billed()).toBe(0);
  });

  it("bills one successful read and returns only that brokerage's loan", async () => {
    const db = connectorDb();
    const res = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token}`)
      .send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_loans", arguments: { status: "open" } } });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBe(false);
    expect(res.body.result.content[0].text).toContain("Ada Lovelace");
    expect(db.billed()).toBe(1);
  });

  it("does not bill a bad token, a missing module, or an unknown tool", async () => {
    const missing = connectorDb();
    const bad = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", "Bearer wrong-token")
      .send({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect(bad.status).toBe(401);
    expect(missing.billed()).toBe(0);

    const off = connectorDb({ module: false });
    const blocked = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token}`)
      .send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_loans" } });
    expect(blocked.status).toBe(403);
    expect(off.billed()).toBe(0);

    const db = connectorDb();
    const unknown = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token}`)
      .send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "delete_loan", arguments: { id: 3 } } });
    expect(unknown.status).toBe(200);
    expect(unknown.body.error.code).toBe(-32602);
    expect(db.billed()).toBe(0);
  });

  it("does not bill a rejected argument", async () => {
    const db = connectorDb();
    const res = await request(createServer())
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token}`)
      .send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "list_loans", arguments: { status: "deleted" } } });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBe(true);
    expect(db.billed()).toBe(0);
  });

  it("replaces the connector key for an owner and returns it once", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM sessions")) return [[{ actor: "brokerage", user_id: 2 }], []];
        if (sql.includes("FROM tenant_users")) {
          return [[{
            id: 2,
            email: "ada@harbor.example",
            first_name: "Ada",
            last_name: "Lovelace",
            role: "brokerage_owner",
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
            plan_code: "scale",
          }], []];
        }
        if (sql.includes("SELECT module_code FROM tenant_modules")) return [[{ module_code: "mcp" }], []];
        if (sql.includes("start_fee_status")) return [[{ start_fee_status: "paid" }], []];
        if (sql.includes("SELECT 1 AS ok FROM tenant_modules")) return [[{ ok: 1 }], []];
        if (sql.includes("mcp_token_hash")) return [{ affectedRows: 1 }, []];
        if (sql.includes("INSERT INTO activity_log")) return [{ insertId: 9 }, []];
        throw new Error(`unexpected sql: ${sql}`);
      },
      async getConnection() {
        throw new Error("no");
      },
    });
    const res = await request(createServer()).post("/api/app/billing/mcp-key").set("Cookie", "mp_session=owner-session");
    expect(res.status).toBe(200);
    expect(res.body.token.startsWith("mp_mcp_")).toBe(true);
    expect(res.body.token.startsWith(res.body.prefix)).toBe(true);
    expect(String(res.body.prefix)).toHaveLength(12);
  });
});
