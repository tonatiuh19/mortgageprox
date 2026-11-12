import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartWizard from "@/pages/StartWizard";

vi.mock("@/components/billing/StartFeeForm", () => ({
  default: () => <div data-testid="wizard-card" />,
}));
import { setupStore } from "@/store";
import { api, apiErrorKey } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  apiErrorKey: vi.fn(() => "errors.server"),
}));

describe("StartWizard", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } });
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (String(url).includes("checkout")) {
        return { data: { clientSecret: "cs_test_secret", publishableKey: "pk_test_123", intentId: 4 } };
      }
      if (String(url).includes("recommend")) {
        return {
          data: {
            recommendation: {
              planCode: "scale",
              reasons: ["recommend.reason.communications"],
              addons: ["twilio"],
              waivedAddons: ["twilio"],
              trialDays: 30,
            },
          },
        };
      }
      return { data: { email: "ada@example.com", emailSent: true } };
    });
  });

  it("walks the package choices and shows the recommended plan", async () => {
    const user = userEvent.setup();
    const store = setupStore({
      catalog: {
        modules: [
          { code: "pipeline", nameKey: "modules.pipeline.name", summaryKey: "modules.pipeline.summary", category: "core", kind: "product", sortOrder: 1 },
          { code: "conversations", nameKey: "modules.conversations.name", summaryKey: "modules.conversations.summary", category: "communications", kind: "product", sortOrder: 2 },
        ],
        plans: [{ code: "scale", nameKey: "plans.scale.name", taglineKey: "plans.scale.tagline", priceCents: 69900, seatLimit: 25, isQuote: false, trialFeeCents: 29900, includedLoans: null, includedEmails: 10000, includedLetters: 120, includedSms: 2000, includedVoiceMinutes: 1000, sortOrder: 1, modules: [] }],
        addons: [],
        trialDays: 30,
        status: "ready",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: null,
        startedName: null,
        startedHost: null,
        emailSent: false,
        host: null,
        hostName: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    await user.type(screen.getByLabelText("Brokerage name"), "Harbor Home Loans");
    await user.type(screen.getByLabelText("Your first name"), "Ada");
    await user.type(screen.getByLabelText("Your last name"), "Lovelace");
    await user.type(screen.getByLabelText("Work email"), "ada@harbor.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Conversations/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("wizard-plan")).toHaveTextContent("Scale");
    expect(screen.getByTestId("wizard-plan")).toHaveTextContent("$699");
    expect(screen.getByTestId("wizard-plan")).toHaveTextContent("Texts, calls, email or Twilio");
    expect(await screen.findByTestId("wizard-card")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open the trial" })).not.toBeInTheDocument();
  });

  it("offers sign in when the email already has an office", async () => {
    const user = userEvent.setup();
    vi.mocked(apiErrorKey).mockReturnValue("errors.accountExists");
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (String(url).includes("checkout")) throw new Error("conflict");
      if (String(url).includes("recommend")) {
        return {
          data: {
            recommendation: {
              planCode: "scale",
              reasons: ["recommend.reason.communications"],
              addons: [],
              waivedAddons: [],
              trialDays: 30,
            },
          },
        };
      }
      return { data: { host: "harbor.mortgageprox.com" } };
    });
    const store = setupStore({
      catalog: {
        modules: [
          { code: "pipeline", nameKey: "modules.pipeline.name", summaryKey: "modules.pipeline.summary", category: "core", kind: "product", sortOrder: 1 },
        ],
        plans: [{ code: "scale", nameKey: "plans.scale.name", taglineKey: "plans.scale.tagline", priceCents: 69900, seatLimit: 25, isQuote: false, trialFeeCents: 29900, includedLoans: null, includedEmails: 10000, includedLetters: 120, includedSms: 2000, includedVoiceMinutes: 1000, sortOrder: 1, modules: [] }],
        addons: [],
        trialDays: 30,
        status: "ready",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: null,
        startedName: null,
        startedHost: null,
        emailSent: false,
        host: "harbor.mortgageprox.com",
        hostName: "Harbor Home Loans",
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    await user.type(screen.getByLabelText("Brokerage name"), "Harbor Home Loans");
    await user.type(screen.getByLabelText("Your first name"), "Ada");
    await user.type(screen.getByLabelText("Your last name"), "Lovelace");
    await user.type(screen.getByLabelText("Work email"), "ada@harbor.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("wizard-account-exists")).toHaveTextContent("This email already has an office");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Pay the start fee")).not.toBeInTheDocument();
  });

  it("hides transcripts and Twilio until conversations or phone is chosen", async () => {
    const user = userEvent.setup();
    const store = setupStore({
      catalog: {
        modules: [
          { code: "pipeline", nameKey: "modules.pipeline.name", summaryKey: "modules.pipeline.summary", category: "core", kind: "product", sortOrder: 1 },
          { code: "email", nameKey: "modules.email.name", summaryKey: "modules.email.summary", category: "communications", kind: "product", sortOrder: 2 },
          { code: "phone", nameKey: "modules.phone.name", summaryKey: "modules.phone.summary", category: "communications", kind: "product", sortOrder: 3 },
          { code: "transcripts", nameKey: "modules.transcripts.name", summaryKey: "modules.transcripts.summary", category: "communications", kind: "product", sortOrder: 4 },
        ],
        plans: [],
        addons: [],
        trialDays: 30,
        status: "ready",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: null,
        startedName: null,
        startedHost: null,
        emailSent: false,
        host: null,
        hostName: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    await user.type(screen.getByLabelText("Brokerage name"), "Harbor Home Loans");
    await user.type(screen.getByLabelText("Your first name"), "Ada");
    await user.type(screen.getByLabelText("Your last name"), "Lovelace");
    await user.type(screen.getByLabelText("Work email"), "ada@harbor.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: /Email/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Call transcripts/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: /Fill this later/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Twilio connection/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Fill this later/ }));
    expect(screen.queryByRole("button", { name: /Twilio connection/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom domain/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: /Phone/ }));
    expect(screen.getByRole("button", { name: /Call transcripts/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: /Twilio connection/ })).toBeInTheDocument();
  });

  it("shows card skeletons while the catalog is still loading", async () => {
    const user = userEvent.setup();
    const store = setupStore({
      catalog: {
        modules: [],
        plans: [],
        addons: [],
        trialDays: 30,
        status: "loading",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: null,
        startedName: null,
        startedHost: null,
        emailSent: false,
        host: null,
        hostName: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    await user.type(screen.getByLabelText("Brokerage name"), "Harbor Home Loans");
    await user.type(screen.getByLabelText("Your first name"), "Ada");
    await user.type(screen.getByLabelText("Your last name"), "Lovelace");
    await user.type(screen.getByLabelText("Work email"), "ada@harbor.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByTestId("wizard-skeletons")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conversations/ })).not.toBeInTheDocument();
  });

  it("points toward Continue while that button is off screen", () => {
    let notify: IntersectionObserverCallback = () => {};
    class MockObserver {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", MockObserver);
    const store = setupStore({
      catalog: {
        modules: [],
        plans: [],
        addons: [],
        trialDays: 30,
        status: "ready",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: null,
        startedName: null,
        startedHost: null,
        emailSent: false,
        host: null,
        hostName: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    const entry = (top: number, intersecting: boolean) => ({ isIntersecting: intersecting, boundingClientRect: { top } }) as IntersectionObserverEntry;
    act(() => notify([entry(900, false)], {} as IntersectionObserver));
    expect(screen.getByRole("button", { name: "Scroll to continue" })).toHaveAttribute("data-direction", "below");
    act(() => notify([entry(-20, false)], {} as IntersectionObserver));
    expect(screen.getByRole("button", { name: "Scroll to continue" })).toHaveAttribute("data-direction", "above");
    act(() => notify([entry(12, true)], {} as IntersectionObserver));
    expect(screen.queryByRole("button", { name: "Scroll to continue" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("celebrates when the workspace opens", () => {
    const store = setupStore({
      catalog: {
        modules: [],
        plans: [],
        addons: [],
        trialDays: 30,
        status: "ready",
        recommendation: null,
        recommending: false,
        starting: false,
        errorKey: null,
        startedEmail: "maya@example.com",
        startedName: "Northwind Mortgage",
        startedHost: "northwind.mortgageprox.com",
        emailSent: true,
        host: null,
        hostName: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <StartWizard />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "You're in." })).toBeInTheDocument();
    expect(screen.getByText("Northwind Mortgage is open.")).toBeInTheDocument();
    expect(screen.getByText("northwind.mortgageprox.com")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tell us how your brokerage works." })).not.toBeInTheDocument();
    expect(screen.queryByText("1. Your brokerage")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Brokerage name")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter your office" })).toHaveAttribute("href", "/app");
    expect(document.querySelector("canvas")).toBeTruthy();
  });
});
