import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PortalShell from "@/components/portal/PortalShell";
import { setupStore } from "@/store";
import { LayoutDashboard, Building2 } from "lucide-react";

describe("PortalShell", () => {
  it("renders grouped navigation and the phone More tab", () => {
    const store = setupStore({
      auth: {
        user: {
          id: 1,
          email: "alex@disruptinglabs.com",
          firstName: "Alex",
          lastName: "Gomez",
          role: "platform_owner",
          actor: "platform",
          tenantId: null,
          tenantName: null,
          tenantSlug: null,
          customDomain: null,
          primaryColor: null,
          brandRadius: null,
          brandHeadline: null,
          logoUrl: null,
          faviconUrl: null,
          tenantStatus: null,
          planCode: null,
          trialEndsAt: null,
          startFeeStatus: null,
          modules: [],
        },
        bootstrapped: true,
        loading: false,
        errorKey: null,
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/command"]}>
          <PortalShell
            loginPath="/login"
            titleKey="command.title"
            homePath="/command"
            tabs={["/command", "/command/tenants"]}
            nav={[
              { to: "/command", end: true, labelKey: "command.overview", icon: LayoutDashboard, section: "command.sectionHome" },
              { to: "/command/tenants", labelKey: "command.tenants", icon: Building2, perm: "tenants.read", section: "command.sectionNetwork" },
            ]}
          />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("Alex Gomez")).toBeTruthy();
  });
});
