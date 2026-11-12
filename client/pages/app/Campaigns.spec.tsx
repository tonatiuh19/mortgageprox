import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Campaigns from "@/pages/app/Campaigns";
import { setupStore } from "@/store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const desk = {
  allowance: { included: 800, packs: 0, packSize: 100, priceCents: 900, used: 800, ceiling: 1000, ceilingUsed: 800 },
  topics: [{ id: 4, name: "Rate notes", subscribers: 1 }],
  contacts: [],
  campaigns: [],
};

afterEach(() => cleanup());

describe("Campaigns", () => {
  it("shows the pack price before saving people past the included 800", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes("people")) {
        return { data: { people: [{ id: 9, name: "Ada Lovelace", email: "ada@example.com", onList: false }] } };
      }
      return { data: desk };
    });
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "errors.campaigns.pack", packs: 1, priceCents: 900 } },
    });
    const store = setupStore({
      auth: {
        user: {
          id: 2,
          email: "maya@example.com",
          firstName: "Maya",
          lastName: "Chen",
          role: "brokerage_owner",
          actor: "brokerage",
          tenantId: 1,
          tenantName: "Northwind Mortgage",
          tenantSlug: "northwind-mortgage",
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
          modules: ["campaigns"],
        },
        bootstrapped: true,
        loading: false,
        errorKey: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Campaigns />
        </MemoryRouter>
      </Provider>,
    );
    expect(await screen.findByText(/800 of 800 contacts/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Ada Lovelace" }));
    await user.click(screen.getByRole("button", { name: "Add selected" }));
    expect(await screen.findByText("1 × 100 contacts, $9 a month. Save these people.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save with this pack" })).toBeInTheDocument();
  });
});
