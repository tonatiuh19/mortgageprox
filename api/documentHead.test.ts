import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

afterEach(() => {
  __test.setDb(null);
});

function headDb() {
  __test.setDb({
    async execute(sql: string, params: unknown[] = []) {
      if (sql.includes("favicon_url")) {
        return [[{
          id: 9,
          name: "Northwind <script>",
          slug: "northwind-mortgage",
          custom_domain: "northwind.example",
          logo_url: "https://cdn.example/logo.png",
          favicon_url: "https://cdn.example/icon.png",
          primary_color: "#112233",
        }], []];
      }
      if (sql.includes("tenant_site_pages")) {
        return [[{ title: "About us", body_md: "A brokerage. Not a bank." }], []];
      }
      if (sql.includes("public_slug")) {
        if (params[1] === "gone") return [[], []];
        return [[{ first_name: "Maya", last_name: "Chen", photo_url: "https://cdn.example/maya.jpg" }], []];
      }
      if (sql.includes("custom_domain")) {
        return [[{
          id: 9,
          name: "Northwind <script>",
          slug: "northwind-mortgage",
          status: "active",
          custom_domain: "northwind.example",
          logo_url: "https://cdn.example/logo.png",
          primary_color: "#112233",
        }], []];
      }
      return [[], []];
    },
    async getConnection() {
      throw new Error("no transaction");
    },
  });
}

function titles(html: string): string[] {
  return [...html.matchAll(/<title>(.*?)<\/title>/g)].map((match) => match[1]);
}

describe("document head", () => {
  it("indexes the marketing home and keeps a single title", async () => {
    const res = await request(createServer()).get("/").set("Accept", "text/html");
    expect(res.status).toBe(200);
    expect(titles(res.text)).toEqual(["MortgageProx · The office around the loan"]);
    expect(res.text).toContain('content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"');
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('"@type":"WebSite"');
  });

  it("names a personal apply link and keeps it out of search on our host", async () => {
    headDb();
    const res = await request(createServer())
      .get("/apply/northwind-mortgage/maya-chen")
      .set("Accept", "text/html")
      .set("X-Forwarded-Host", "mortgageprox.vercel.app")
      .set("X-Forwarded-Proto", "https");
    expect(res.status).toBe(200);
    expect(titles(res.text)).toEqual(["Apply with Maya Chen · Northwind &lt;script&gt;"]);
    expect(res.text).toContain('content="noindex, nofollow"');
    expect(res.text).toContain('property="og:image" content="https://cdn.example/maya.jpg"');
    expect(res.text).not.toContain("<title>Apply with Maya Chen · Northwind <script>");
  });

  it("indexes that same link on the office domain", async () => {
    headDb();
    const res = await request(createServer())
      .get("/apply/northwind-mortgage/maya-chen")
      .set("Accept", "text/html")
      .set("X-Forwarded-Host", "www.northwind.example")
      .set("X-Forwarded-Proto", "https");
    expect(titles(res.text)[0]).toContain("Maya Chen");
    expect(res.text).toContain('content="index, follow');
    expect(res.text).toContain('"@type":"FinancialService"');
  });

  it("does not invent a person who is not on the link", async () => {
    headDb();
    const res = await request(createServer()).get("/apply/northwind-mortgage/gone").set("Accept", "text/html");
    expect(titles(res.text)[0]).toContain("Page not found");
    expect(res.text).not.toContain("Maya Chen");
    expect(res.text).toContain("noindex, nofollow");
  });

  it("uses the office page title", async () => {
    headDb();
    const res = await request(createServer()).get("/w/northwind-mortgage/about").set("Accept", "text/html");
    expect(titles(res.text)).toEqual(["About us · Northwind &lt;script&gt;"]);
  });

  it("keeps a private route anonymous", async () => {
    headDb();
    const res = await request(createServer()).get("/app/clients/21").set("Accept", "text/html");
    expect(titles(res.text)).toEqual(["MortgageProx"]);
    expect(res.text).toContain("noindex, nofollow");
    expect(res.text).not.toContain("Maya");
  });

  it("follows the request language", async () => {
    headDb();
    const res = await request(createServer())
      .get("/book/northwind-mortgage")
      .set("Accept", "text/html")
      .set("Accept-Language", "es-MX,es;q=0.9");
    expect(titles(res.text)[0]).toContain("Agenda con Northwind");
    expect(res.text).toContain('lang="es"');
  });
});
