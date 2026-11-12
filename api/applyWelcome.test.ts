import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => {
  __test.setDb(null);
  __test.clearOutbox();
});

function officeDb(options: { emails: number | null }) {
  const writes: string[] = [];
  __test.setDb({
    async execute(sql: string, params?: unknown[]) {
      if (sql.includes("WHERE slug = ?")) {
        return [[{ id: 9, name: "Northwind Mortgage", slug: "northwind-mortgage", status: "active", support_email: "hello@northwind.example", primary_color: "#1F6F62", brand_radius: "soft", brand_headline: "serif", logo_url: null }], []];
      }
      if (sql.includes("FROM tenants")) {
        return [[{ id: 9, name: "Northwind Mortgage", support_email: "hello@northwind.example", primary_color: "#1F6F62", brand_radius: "soft", brand_headline: "serif", logo_url: null }], []];
      }
      if (sql.includes("tenant_subscriptions")) {
        if (options.emails == null) return [[], []];
        return [[{
          plan_id: 1,
          plan_code: "scale",
          price_cents: 69900,
          is_quote: 0,
          seat_limit: 10,
          included_loans: 100,
          included_emails: options.emails,
          included_letters: 10,
          included_sms: 100,
          included_voice_minutes: 100,
          stripe_price_id: null,
          extra_seats: 0,
          trial_ends_at: null,
          start_fee_cents: 0,
          start_fee_status: "paid",
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_checkout_session_id: null,
        }], []];
      }
      if (sql.includes("tenant_usage_grants")) return [[], []];
      if (sql.includes("AS broadcast_emails")) return [[{ seats: 1, loans: 0, emails: 0, sms: 0, voice: 0, broadcast_emails: 0, broadcast_sms: 0 }], []];
      if (sql.includes("public_slug")) return [[{ id: 4, first_name: "Maya", last_name: "Chen", email: "maya@northwind.example" }], []];
      if (sql.includes("notify_email")) return [[{ email: "maya@northwind.example", notify_also: null, notify_events: "application" }], []];
      if (sql.includes("message_templates")) return [[], []];
      if (sql.includes("pipeline_stages")) return [[{ id: 3 }], []];
      if (sql.includes("tenant_modules")) return [[], []];
      if (sql.includes("conversation_threads") && sql.includes("SELECT")) return [[], []];
      if (sql.includes("INSERT INTO clients")) return [{ insertId: 21 }, []];
      if (sql.includes("INSERT INTO loans")) return [{ insertId: 44 }, []];
      if (sql.includes("INSERT INTO compliance_items")) return [{ insertId: 1 }, []];
      if (sql.includes("INSERT INTO borrowers")) {
        writes.push(String(params?.[2] || ""));
        return [{ insertId: 8 }, []];
      }
      if (sql.includes("INSERT INTO conversation_threads")) return [{ insertId: 5 }, []];
      if (sql.includes("INSERT INTO conversation_messages")) {
        writes.push("message");
        return [{ insertId: 6 }, []];
      }
      if (sql.includes("UPDATE conversation_threads")) return [{ affectedRows: 1 }, []];
      throw new Error(sql);
    },
    async getConnection() {
      throw new Error("no transaction");
    },
  });
  return writes;
}

const application = {
  officer: "maya-chen",
  firstName: "Felix",
  lastName: "Gomez",
  email: "felix@disruptinglabs.com",
  phone: "4155550142",
  purpose: "purchase",
  amountCents: 64000000,
  addressLine: "1 Market St",
  city: "San Francisco",
  region: "CA",
  postalCode: "94105",
};

describe("applicant welcome", () => {
  it("lists the documents and points at sign-in, in both languages", () => {
    const purchase = __test.fillEmail(__test.applicantWelcome("en", "purchase"), {
      firstName: "Felix",
      brokerage: "Northwind Mortgage",
      officer: "Maya Chen",
      loginUrl: "http://localhost:8080/login?email=felix%40disruptinglabs.com",
    });
    expect(purchase.subject).toBe("We have your purchase application");
    expect(purchase.body).toContain("photo ID");
    expect(purchase.body).toContain("Maya Chen");
    expect(purchase.buttonLabel).toBe("Open your portal");
    expect(purchase.buttonUrl).toContain("/login?email=");
    expect(purchase.body).not.toContain("—");
    const refinance = __test.applicantWelcome("es", "refinance");
    expect(refinance.subject).toContain("refinanciamiento");
    expect(refinance.body).toContain("hipoteca");
    expect(refinance.buttonUrl).toBe("{{loginUrl}}");
    expect(`${refinance.headline} ${refinance.footer}`).not.toContain("—");
  });

  it("creates the portal account and emails the applicant", async () => {
    const writes = officeDb({ emails: null });
    const res = await request(createServer())
      .post("/api/public/apply/northwind-mortgage")
      .set("Origin", "http://localhost:8080")
      .send(application);
    expect(res.status).toBe(201);
    expect(res.body.welcomed).toBe(true);
    expect(writes).toContain("felix@disruptinglabs.com");
    expect(writes).toContain("message");
    const letter = __test.outbox.find((item) => item.to === "felix@disruptinglabs.com");
    expect(letter?.subject).toBe("We have your purchase application");
    expect(letter?.html).toContain("Open your portal");
    expect(letter?.html).toContain("http://localhost:8080/login?email=felix%40disruptinglabs.com");
    expect(letter?.html).toContain("Maya Chen");
    expect(letter?.text).not.toMatch(/\d{6}/);
  });

  it("still opens the portal account when the office is out of emails", async () => {
    const writes = officeDb({ emails: 0 });
    const res = await request(createServer())
      .post("/api/public/apply/northwind-mortgage")
      .set("Origin", "http://localhost:8080")
      .send({ ...application, purpose: "refinance", language: "es" });
    expect(res.status).toBe(201);
    expect(res.body.welcomed).toBe(false);
    expect(writes).toContain("felix@disruptinglabs.com");
    expect(writes).not.toContain("message");
    expect(__test.outbox.some((item) => item.to === "felix@disruptinglabs.com")).toBe(false);
  });
});
