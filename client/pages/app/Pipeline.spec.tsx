import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@shared/api";
import Pipeline from "@/pages/app/Pipeline";
import { api } from "@/lib/api";
import { setupStore } from "@/store";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  apiErrorKey: () => "errors.server",
}));

const columns = [
  {
    id: 1,
    name: "New lead",
    isFunded: false,
    reminderOn: true,
    total: 1,
    hasMore: true,
    items: [{
      id: 7,
      clientId: 1,
      clientName: "Maya Chen",
      purpose: "purchase",
      amountCents: 42500000,
      status: "open",
      assigneeId: 2,
      assigneeName: "Ana Lopez",
      createdAt: "",
    }],
  },
  { id: 2, name: "Funded", isFunded: true, reminderOn: false, total: 0, hasMore: false, items: [] },
];

const owner = {
  id: 1,
  email: "owner@example.com",
  firstName: "Maya",
  lastName: "Chen",
  role: "brokerage_owner",
  actor: "brokerage",
  tenantId: 1,
  tenantName: "Northwind",
  tenantSlug: "northwind",
  customDomain: null,
  primaryColor: null,
  brandRadius: null,
  brandHeadline: null,
  logoUrl: null,
  faviconUrl: null,
  tenantStatus: "trial",
  planCode: "growth",
  trialEndsAt: null,
  startFeeStatus: "paid",
  modules: ["pipeline"],
} as AuthUser;

function mockBoard(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === "/api/app/loans") return { data: { columns, officers: [{ id: 2, name: "Ana Lopez" }] } };
    if (url === "/api/app/stages") return { data: { items: [{ id: 1, name: "New lead", sort: 10, isFunded: false }, { id: 2, name: "Funded", sort: 60, isFunded: true }] } };
    return { data: { items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } } };
  });
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.patch).mockResolvedValue({ data: { ok: true, status: "funded" } });
}

function renderBoard(role: AuthUser["role"] = "brokerage_owner") {
  return render(
    <Provider store={setupStore({ auth: { user: { ...owner, role }, bootstrapped: true, loading: false, errorKey: null } })}>
      <Pipeline />
    </Provider>,
  );
}

afterEach(() => cleanup());

describe("Pipeline", () => {
  beforeEach(() => {
    mockBoard(true);
  });

  it("keeps the card in place until the move is confirmed", async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(await screen.findByText("Maya Chen")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "New lead" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Funded" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
    const funded = screen.getByRole("heading", { name: "Funded" }).closest("section");
    fireEvent.drop(funded as HTMLElement, { dataTransfer: { getData: () => "7", setData: () => undefined } });
    expect(await screen.findByText("Maya Chen moves from New lead to Funded.")).toBeTruthy();
    expect(screen.getByText("This file becomes funded.")).toBeTruthy();
    expect(screen.getByText("The reminder for New lead stops.")).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.drop(funded as HTMLElement, { dataTransfer: { getData: () => "7", setData: () => undefined } });
    await user.click(await screen.findByRole("button", { name: "Move loan" }));
    expect(api.patch).toHaveBeenCalledWith("/api/app/loans/7", { stageId: 2 });
  });

  it("uses a move menu on a phone and still confirms", async () => {
    mockBoard(false);
    const user = userEvent.setup();
    renderBoard();
    expect(await screen.findByLabelText("Move")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Funded" })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Move"), "2");
    expect(await screen.findByText("This file becomes funded.")).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("lets a partner look without moving a loan", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/api/app/loans") return { data: { columns, officers: [] } };
      if (url === "/api/app/stages") return { data: { items: [] } };
      return { data: { items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } } };
    });
    renderBoard("partner");
    expect(await screen.findByText("Maya Chen")).toBeTruthy();
    expect(screen.queryByLabelText("Move")).toBeNull();
    expect(screen.queryByLabelText("Loan officer")).toBeNull();
  });
});
