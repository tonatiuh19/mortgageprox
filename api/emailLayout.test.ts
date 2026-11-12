import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

describe("email layout", () => {
  it("renders a branded shell and escapes the message", () => {
    const rendered = __test.renderEmail(__test.PLATFORM_BRAND, __test.fillEmail(__test.platformEmailDefaults("sign_in"), {
      code: "482913",
      minutes: "10",
      loginUrl: "https://mortgageprox.com/login",
    }));
    expect(rendered.html).toContain("Your sign-in code");
    expect(rendered.html).toContain("#2F4FD8");
    expect(rendered.html).toContain("https://mortgageprox.com/login");
    expect(rendered.html).toContain("482913");
    expect(rendered.text).toMatch(/482913/);
    const hostile = __test.renderEmail(__test.PLATFORM_BRAND, {
      ...__test.platformEmailDefaults("transcript"),
      body: "<script>alert(1)</script>",
      buttonLabel: "Open",
      buttonUrl: "javascript:alert(1)",
    });
    expect(hostile.html).toContain("&lt;script&gt;");
    expect(hostile.html).not.toContain("javascript:");
  });

  it("names the brokerage in the starters and skips an em dash", () => {
    const starters = __test.tenantEmailStarters("Harbor Home");
    expect(starters.map((item) => item.name)).toEqual(["Welcome", "Document request", "Task assigned", "Payment receipt"]);
    const joined = starters.map((item) => `${item.draft.headline} ${item.draft.footer}`).join(" ");
    expect(joined).toContain("Harbor Home");
    expect(joined).not.toContain("—");
    expect(joined).not.toContain("MortgageProx");
  });

  it("keeps platform emails behind the platform owner", async () => {
    const res = await request(createServer()).get("/api/command/emails");
    expect(res.status).toBe(401);
  });
});
