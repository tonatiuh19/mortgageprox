import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageMeta, { PageMetaProvider } from "@/components/PageMeta";

describe("PageMeta", () => {
  it("replaces the previous page instead of leaving its tags behind", () => {
    const view = render(
      <PageMetaProvider>
        <PageMeta title="Pricing" description="Plans for a brokerage." />
      </PageMetaProvider>,
    );
    expect(document.title).toBe("Pricing · MortgageProx");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Plans for a brokerage.");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("index");

    view.rerender(
      <PageMetaProvider>
        <PageMeta title="Sign in" description="We'll email a code." noIndex />
      </PageMetaProvider>,
    );
    expect(document.title).toBe("Sign in · MortgageProx");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("We'll email a code.");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe("Sign in · MortgageProx");
  });

  it("uses the office name on a personal link and stays noindex off their domain", () => {
    render(
      <PageMetaProvider>
        <PageMeta title="Apply with Maya Chen" description="Maya Chen will walk the file with you." siteName="Northwind Mortgage" noIndex ogType="profile" image="https://cdn.example/maya.jpg" />
      </PageMetaProvider>,
    );
    expect(document.title).toBe("Apply with Maya Chen · Northwind Mortgage");
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")).toBe("Northwind Mortgage");
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content")).toBe("summary_large_image");
    expect(document.documentElement.lang).toBe("en");
  });
});
