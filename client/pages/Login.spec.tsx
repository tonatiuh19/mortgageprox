import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";
import { setupStore } from "@/store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  apiErrorKey: () => "errors.server",
}));

function renderLogin(entry = "/login") {
  const store = setupStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<p>Office</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (String(url).includes("verify")) {
        return { data: { user: { actor: "brokerage" } } };
      }
      return { data: { ok: true, sent: true } };
    });
  });

  it("emails a code and signs in from six digits", async () => {
    const user = userEvent.setup();
    renderLogin();
    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    expect(screen.getByText("Your name on the door.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "maya@northwind.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Check your email." })).toBeInTheDocument();
    expect(screen.getByText("It isn't in your inbox? Check spam.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New code in 5:00" })).toBeDisabled();
    expect(screen.getByText("maya@northwind.example")).toBeInTheDocument();
    const first = screen.getByLabelText("Digit 1");
    await user.click(first);
    await user.paste("123456");
    expect(await screen.findByText("Office")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/api/auth/otp/verify", { email: "maya@northwind.example", code: "123456" });
  });

  it("fills the email from the welcome link and ignores a bad one", () => {
    renderLogin("/login?email=felix@disruptinglabs.com");
    expect(screen.getByLabelText("Email")).toHaveValue("felix@disruptinglabs.com");
  });
});
