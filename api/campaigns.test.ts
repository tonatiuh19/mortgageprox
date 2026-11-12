import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { __test } from "./index";

describe("campaign contacts", () => {
  it("includes 800 on Scale and Custom, and nothing on Growth", () => {
    expect(__test.campaignIncluded("scale", null)).toBe(800);
    expect(__test.campaignIncluded("custom", null)).toBe(800);
    expect(__test.campaignIncluded("custom", 2500)).toBe(2500);
    expect(__test.campaignIncluded("growth", null)).toBe(0);
  });

  it("asks for a $9 pack of 100 before the list passes 800", () => {
    expect(__test.campaignRoom({
      used: 790,
      included: 800,
      packs: 0,
      adding: 30,
      platformUsed: 790,
      platformAdding: 30,
      ceiling: 1000,
      confirmPacks: null,
      priceCents: 900,
    })).toEqual({ error: "errors.campaigns.pack", packs: 1, priceCents: 900 });
  });

  it("buys the packs only when the office confirms that exact number", () => {
    const input = {
      used: 800,
      included: 800,
      packs: 0,
      adding: 250,
      platformUsed: 100,
      platformAdding: 250,
      ceiling: 1000,
      priceCents: 900,
    };
    expect(__test.campaignRoom({ ...input, confirmPacks: 3 })).toEqual({ ok: true, packsToBuy: 3, allowance: 1100 });
    const short = __test.campaignRoom({ ...input, confirmPacks: 2 });
    expect("error" in short && short.error).toBe("errors.campaigns.pack");
  });

  it("stops the whole platform at the shared ceiling", () => {
    const full = __test.campaignRoom({
      used: 0,
      included: 800,
      packs: 0,
      adding: 10,
      platformUsed: 1000,
      platformAdding: 10,
      ceiling: 1000,
      confirmPacks: null,
      priceCents: 900,
    });
    expect("error" in full && full.error).toBe("errors.campaigns.capacity");
  });

  it("does not count a second office copy of the same email against the ceiling", () => {
    expect(__test.campaignRoom({
      used: 10,
      included: 800,
      packs: 0,
      adding: 1,
      platformUsed: 1000,
      platformAdding: 0,
      ceiling: 1000,
      confirmPacks: null,
      priceCents: 900,
    })).toEqual({ ok: true, packsToBuy: 0, allowance: 800 });
  });

  it("refuses to remove a pack that still holds people", () => {
    const busy = __test.campaignPackChange({ used: 850, included: 800, packs: 1, action: "remove" });
    expect("error" in busy && busy.error).toBe("errors.campaigns.packInUse");
    expect(__test.campaignPackChange({ used: 800, included: 800, packs: 1, action: "remove" })).toEqual({ packs: 0 });
  });

  it("keeps the unsubscribe placeholder in the marketing message", () => {
    const html = __test.campaignHtml("Rates <moved> & so did payments");
    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
    expect(html).not.toContain("<moved>");
    expect(html).toContain("&amp;");
  });

  it("checks the Resend webhook signature", () => {
    const secret = `whsec_${Buffer.from("campaign-secret").toString("base64")}`;
    const raw = JSON.stringify({ type: "email.opened" });
    const id = "msg_1";
    const timestamp = "1700000000";
    const signed = crypto.createHmac("sha256", Buffer.from("campaign-secret")).update(`${id}.${timestamp}.${raw}`).digest("base64");
    expect(__test.verifyResendWebhook(raw, { id, timestamp, signature: `v1,${signed}` }, secret, 1700000000)).toBe(true);
    expect(__test.verifyResendWebhook(raw, { id, timestamp, signature: "v1,nope" }, secret, 1700000000)).toBe(false);
    expect(__test.verifyResendWebhook(raw, { id, timestamp, signature: `v1,${signed}` }, secret, 1700000400)).toBe(false);
  });
});
