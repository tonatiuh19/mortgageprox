import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewLoanDialog from "@/components/portal/NewLoanDialog";
import { api } from "@/lib/api";
import { setupStore } from "@/store";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

afterEach(() => cleanup());

describe("New loan share link", () => {
  it("shows the person's application link, not the office link", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes("share-link")) {
        return { data: { ok: true, slug: "maya-chen", link: "http://localhost:8080/apply/northwind-mortgage/maya-chen" } };
      }
      return { data: { draft: null } };
    });
    render(
      <Provider store={setupStore()}>
        <MemoryRouter>
          <NewLoanDialog open onOpenChange={() => undefined} />
        </MemoryRouter>
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Share application link/ }));
    expect(await screen.findByDisplayValue("http://localhost:8080/apply/northwind-mortgage/maya-chen")).toBeInTheDocument();
    expect(screen.getByText("This link is yours. The application is assigned to you, and your name shows first.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("http://localhost:8080/apply/northwind-mortgage")).toBeNull();
  });
});
