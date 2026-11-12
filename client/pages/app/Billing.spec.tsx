import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Billing from "@/pages/app/Billing";
import { setupStore } from "@/store";
import type { BillingSnapshot } from "@shared/api";

const snapshot: BillingSnapshot = {
  planCode: "starter",
  priceCents: 14900,
  isQuote: false,
  trialEndsAt: null,
  startFeeCents: 29900,
  startFeeStatus: "paid",
  publishableKey: null,
  allowances: [
    { key: "seats", included: 3, used: 1, state: "ok" },
    { key: "loans", included: 40, used: 40, state: "full" },
    { key: "emails", included: 500, used: 12, state: "ok" },
    { key: "letters", included: 0, used: 0, state: "off" },
    { key: "sms", included: 0, used: 0, state: "off" },
    { key: "voice", included: 0, used: 0, state: "off" },
  ],
  seatOffer: { priceCents: 2900, included: 3, extra: 0, used: 1 },
  packs: [{ code: "loans_20", meter: "loans", units: 20, priceCents: 4900 }],
  campaignOffer: null,
  mcp: { enabled: false, calls: 0, cents: 0, priceCents: 3, tokenPrefix: null },
};

describe("Billing", () => {
  it("shows the included amounts and a used cap", () => {
    const store = setupStore({
      auth: {
        user: {
          id: 2,
          email: "ada@harbor.example",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "brokerage_owner",
          actor: "brokerage",
          tenantId: 4,
          tenantName: "Harbor",
          tenantSlug: "harbor",
          customDomain: null,
          primaryColor: "#D4653A",
          brandRadius: "soft",
          brandHeadline: "serif",
          logoUrl: null,
          faviconUrl: null,
          tenantStatus: "trial",
          planCode: "starter",
          trialEndsAt: null,
          startFeeStatus: "paid",
          modules: ["brand"],
        },
        bootstrapped: true,
        loading: false,
        errorKey: null,
      },
      billing: { snapshot, clientSecret: null, status: "ready", errorKey: null },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("40 / 40")).toBeInTheDocument();
    expect(screen.getByText("Included amount used")).toBeInTheDocument();
    expect(screen.getAllByText("Not included").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Twilio credits" })).toBeInTheDocument();
    expect(screen.getByText("then $29 each")).toBeInTheDocument();
    expect(screen.getByText("then 20 for $49")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a seat, $29 per month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 20 open loans, $49" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "MCP connector" })).not.toBeInTheDocument();
  });

  it("shows MCP reads as usage when the connector is on", () => {
    const store = setupStore({
      auth: {
        user: {
          id: 2,
          email: "ada@harbor.example",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "brokerage_owner",
          actor: "brokerage",
          tenantId: 4,
          tenantName: "Harbor",
          tenantSlug: "harbor",
          customDomain: null,
          primaryColor: null,
          brandRadius: null,
          brandHeadline: null,
          logoUrl: null,
          faviconUrl: null,
          tenantStatus: "active",
          planCode: "scale",
          trialEndsAt: null,
          startFeeStatus: "paid",
          modules: ["brand", "mcp"],
        },
        bootstrapped: true,
        loading: false,
        errorKey: null,
      },
      billing: {
        snapshot: {
          ...snapshot,
          planCode: "scale",
          mcp: { enabled: true, calls: 2, cents: 6, priceCents: 3, tokenPrefix: "mp_mcp_ab12" },
        },
        clientSecret: null,
        status: "ready",
        errorKey: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "MCP connector" })).toBeInTheDocument();
    expect(screen.getByText(/2 reads this month/)).toBeInTheDocument();
    expect(screen.getByText(/Current key starts with mp_mcp_ab12/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace the key" })).toBeInTheDocument();
  });
});
