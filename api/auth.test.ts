import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => {
  __test.setDb(null);
  __test.clearOutbox();
});

function mockAccount() {
  __test.setDb({
    async execute(sql: string) {
      if (sql.includes("FROM platform_emails")) return [[], []];
      if (sql.includes("FROM platform_users")) {
        return [[{ id: 1, status: "active", email: "alex@disruptinglabs.com", first_name: "Alex", last_name: "Gomez", role: "platform_owner" }], []];
      }
      if (sql.includes("FROM tenant_users") || sql.includes("FROM borrowers")) return [[], []];
      if (sql.includes("INSERT INTO otp_codes")) return [{ insertId: 4 }, []];
      if (sql.includes("FROM otp_codes")) {
        const last = __test.outbox[__test.outbox.length - 1];
        const code = last?.text.match(/\d{6}/)?.[0] || "";
        return [[{ id: 9, code_hash: __test.sha256(code), attempts: 0 }], []];
      }
      if (sql.includes("UPDATE otp_codes") || sql.includes("UPDATE `platform_users`") || sql.includes("INSERT INTO sessions")) {
        return [{ affectedRows: 1, insertId: 3 }, []];
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
    async getConnection() {
      throw new Error("transactions are not used in this test");
    },
  });
}

describe("passwordless auth", () => {
  it("emails a code without putting it in the response", async () => {
    mockAccount();
    const res = await request(createServer()).post("/api/auth/otp/request").send({ email: "alex@disruptinglabs.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, sent: true });
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
    expect(__test.outbox[0]?.to).toBe("alex@disruptinglabs.com");
    expect(__test.outbox[0]?.text).toMatch(/\d{6}/);
  });

  it("returns the same response when the email is unknown", async () => {
    __test.setDb({
      async execute(sql: string) {
        if (sql.includes("FROM platform_users") || sql.includes("FROM tenant_users") || sql.includes("FROM borrowers")) return [[], []];
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no");
      },
    });
    const res = await request(createServer()).post("/api/auth/otp/request").send({ email: "missing@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, sent: false });
    expect(__test.outbox).toHaveLength(0);
  });

  it("signs the owner in with the emailed code", async () => {
    mockAccount();
    await request(createServer()).post("/api/auth/otp/request").send({ email: "Alex@DisruptingLabs.com" });
    const code = __test.outbox[0].text.match(/\d{6}/)?.[0];
    const res = await request(createServer()).post("/api/auth/otp/verify").send({ email: "alex@disruptinglabs.com", code });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("platform_owner");
    const cookie = res.headers["set-cookie"];
    const joined = Array.isArray(cookie) ? cookie.join(";") : String(cookie || "");
    expect(joined).toContain("mp_session=");
  });

  it("recommends a plan without touching the database", async () => {
    const res = await request(createServer()).post("/api/public/wizard/recommend").send({
      modules: ["realtors"],
      seats: 4,
      customStyles: false,
      twilio: false,
      customDomain: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.recommendation.planCode).toBe("growth");
  });
});
