import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/app/Dashboard";
import { setupStore } from "@/store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  apiErrorKey: () => "errors.server",
}));

const user = {
  id: 1,
  email: "maya@example.com",
  firstName: "Maya",
  lastName: "Chen",
  role: "brokerage_owner" as const,
  actor: "brokerage" as const,
  tenantId: 1,
  tenantName: "Northwind Mortgage",
  tenantSlug: "northwind-mortgage",
  customDomain: null,
  primaryColor: null,
  brandRadius: null,
  brandHeadline: null,
  logoUrl: null,
  faviconUrl: null,
  tenantStatus: "trial",
  planCode: "scale",
  trialEndsAt: null,
  startFeeStatus: "paid",
  modules: ["conversations", "tasks", "pipeline", "clients"],
};

afterEach(() => cleanup());

describe("Dashboard", () => {
  it("shows the office, the next actions, and loans by stage", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        scope: "all",
        clients: 4,
        openLoans: 2,
        openTasks: 1,
        daysLeft: 31,
        startFeeStatus: "paid",
        unread: 3,
        seatsUsed: 1,
        seatLimit: 25,
        stages: [{ id: 1, name: "New lead", count: 2 }],
        dueTasks: [],
        recentLoans: [{ id: 9, name: "Ada Lovelace", stage: "New lead", amountCents: 45000000, purpose: "purchase" }],
      },
    });
    render(
      <Provider store={setupStore({ auth: { user, bootstrapped: true, loading: false, errorKey: null } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </Provider>,
    );
    expect(await screen.findByRole("heading", { name: "Hello, Maya" })).toBeInTheDocument();
    expect(screen.getByText("The office")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open a loan" })).toHaveAttribute("href", "/app/pipeline");
    expect(screen.getByRole("link", { name: "Add a client" })).toHaveAttribute("href", "/app/clients");
    expect(screen.getByRole("link", { name: "Open the inbox" })).toHaveAttribute("href", "/app/conversations");
    expect(screen.getByText("1 of 25 seats")).toBeInTheDocument();
    expect(screen.getAllByText("New lead").length).toBeGreaterThan(0);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Nothing is due in the next two days.")).toBeInTheDocument();
  });
});
