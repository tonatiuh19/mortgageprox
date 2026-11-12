import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calculators from "@/pages/app/Calculators";
import { setupStore } from "@/store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  apiErrorKey: () => "errors.server",
}));

describe("Calculators", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true, id: 4 } });
  });

  it("shows an FHA payment and saves the scenario on a client file", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={setupStore()}>
        <MemoryRouter>
          <Calculators />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText("$3,226.06")).toBeTruthy();
    await user.type(screen.getByLabelText("Client"), "12");
    await user.click(screen.getByRole("button", { name: "Save on the client file" }));
    expect(api.post).toHaveBeenCalledWith("/api/app/calculators", expect.objectContaining({
      kind: "fha",
      clientId: 12,
    }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
  });

  it("uses hourly pay, commission, bonus, and deductions on the worksheet", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={setupStore()}>
        <MemoryRouter>
          <Calculators />
        </MemoryRouter>
      </Provider>,
    );
    await user.click(screen.getByRole("button", { name: "Qualifying income" }));
    expect(screen.getByLabelText("Base pay")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Base pay"), "hourly");
    expect(screen.getByLabelText("Hourly rate")).toBeTruthy();
    expect(screen.getByLabelText("Commission this year")).toBeTruthy();
    expect(screen.getByLabelText("Bonus this year")).toBeTruthy();
    expect(screen.getByLabelText("Monthly deductions")).toBeTruthy();
    await user.type(screen.getByLabelText("Hourly rate"), "25");
    expect(screen.getByText("$4,333.33")).toBeTruthy();
  });
});
