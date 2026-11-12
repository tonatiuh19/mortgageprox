import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => __test.setDb(null));

describe("wizard checkout", () => {
  it("rejects an incomplete signup before opening a card form", async () => {
    const res = await request(createServer()).post("/api/public/wizard/checkout").send({ email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation.wizard");
  });

  it("does not open a card session when Stripe is unavailable", async () => {
    const res = await request(createServer()).post("/api/public/wizard/checkout").send({
      brokerageName: "Harbor Home Loans",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@harbor.example",
      selection: { modules: [], seats: 3, customStyles: false, twilio: false, customDomain: false },
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("errors.stripe");
  });

  it("offers the next free address when the plain slug is taken", async () => {
    __test.setDb({
      async execute(sql: string, params?: unknown[]) {
        if (sql.includes("FROM tenants WHERE slug")) {
          return params?.[0] === "harbor-home-loans" ? [[{ id: 4 }], []] : [[], []];
        }
        throw new Error(sql);
      },
      async getConnection() {
        throw new Error("no transaction");
      },
    });
    const taken = await request(createServer()).get("/api/public/wizard/host").query({ name: "Harbor Home Loans" });
    expect(taken.status).toBe(200);
    expect(taken.body.host).toBe("harbor-home-loans-2.mortgageprox.com");
    const free = await request(createServer()).get("/api/public/wizard/host").query({ name: "Northwind Mortgage" });
    expect(free.status).toBe(200);
    expect(free.body.host).toBe("northwind-mortgage.mortgageprox.com");
  });
});
