import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@shared/api";
import Tasks from "@/pages/app/Tasks";
import { api } from "@/lib/api";
import { setupStore } from "@/store";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  apiErrorKey: () => "errors.server",
}));

const items = [
  { id: 1, loanId: null, loanName: null, title: "Order appraisal", status: "open", column: "todo", priority: "high", dueOn: "2026-11-06", dueAt: "2026-11-06T21:00:00.000Z", assigneeId: 4, assigneeName: "Ana Lopez", position: 0 },
  { id: 2, loanId: null, loanName: null, title: "Collect pay stubs", status: "open", column: "doing", priority: "normal", dueOn: null, dueAt: null, assigneeId: null, assigneeName: null, position: 0 },
  { id: 3, loanId: 9, loanName: "Sam Rivera", title: "Wait on title", status: "open", column: "waiting", priority: "low", dueOn: null, dueAt: null, assigneeId: 4, assigneeName: "Ana Lopez", position: 0 },
  { id: 4, loanId: null, loanName: null, title: "Send closing gift", status: "done", column: "done", priority: "normal", dueOn: null, dueAt: null, assigneeId: 4, assigneeName: "Ana Lopez", position: 0 },
];

function mockBoard(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  vi.mocked(api.get).mockResolvedValue({
    data: {
      items,
      staff: [{ id: 4, name: "Ana Lopez" }],
      loans: [{ id: 9, name: "Sam Rivera" }],
      pagination: { page: 1, limit: 80, total: 4, totalPages: 1 },
    },
  });
}

afterEach(() => cleanup());

describe("Tasks", () => {
  beforeEach(() => {
    mockBoard(true);
  });

  it("shows the four columns and edits a card", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={setupStore()}>
        <Tasks />
      </Provider>,
    );
    expect(await screen.findByText("Order appraisal")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "In progress" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Waiting" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Done" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("button", { name: "Save task" })).toBeTruthy();
    expect(screen.getByText("Emails the assignee at 9:00 Central on the due day.")).toBeTruthy();
  });

  it("uses a move menu on a phone", async () => {
    mockBoard(false);
    render(
      <Provider store={setupStore()}>
        <Tasks />
      </Provider>,
    );
    expect(await screen.findByLabelText("Move to")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "In progress" })).toBeNull();
  });

  it("shows the upgrade link when the board is not on the plan", () => {
    vi.mocked(api.get).mockClear();
    const user = {
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
      planCode: "starter",
      trialEndsAt: null,
      startFeeStatus: "paid",
      modules: ["pipeline", "documents"],
    } as AuthUser;
    render(
      <Provider store={setupStore({ auth: { user, bootstrapped: true, loading: false, errorKey: null } })}>
        <MemoryRouter>
          <Tasks />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText("This module is not on your package yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the modules" }).getAttribute("href")).toBe("/app/modules?code=tasks");
    expect(api.get).not.toHaveBeenCalled();
  });
});
