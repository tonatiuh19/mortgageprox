import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Modules from "@/pages/app/Modules";
import { setupStore } from "@/store";

const catalog = {
  planCode: "starter",
  owner: true,
  plans: [
    { code: "starter", priceCents: 14900 },
    { code: "growth", priceCents: 34900 },
    { code: "scale", priceCents: 69900 },
  ],
  items: [
    { code: "pipeline", category: "core", enabled: true, included: true, minimumPlan: "starter" },
    { code: "letters", category: "growth", enabled: false, included: true, minimumPlan: "growth" },
    { code: "phone", category: "communications", enabled: false, included: false, minimumPlan: "scale" },
  ],
};

function renderCatalog(owner: boolean) {
  const store = setupStore({
    modules: { catalog: { ...catalog, owner }, status: "ready", errorKey: null },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <Modules />
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(() => cleanup());

describe("Modules", () => {
  it("lets the owner turn on an included module and upgrade for a higher one", () => {
    renderCatalog(true);
    expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Upgrade to Scale/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull();
  });

  it("shows the lock to someone who cannot pay", () => {
    renderCatalog(false);
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Upgrade to Scale/ })).toBeNull();
    expect(screen.getByText("An owner can turn this on or move the office up.")).toBeTruthy();
  });
});
