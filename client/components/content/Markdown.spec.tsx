import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown from "./Markdown";

describe("Markdown", () => {
  it("renders headings, lists and safe links", () => {
    const { container } = render(<Markdown source={"# Terms\n\nA **workspace**.\n\n- Seats\n\nSee [Stripe](https://stripe.com) and [home](/).\n\n<script>alert(1)</script>"} />);
    expect(screen.getByRole("heading", { name: "Terms" })).toBeInTheDocument();
    expect(screen.getByText("workspace").tagName).toBe("STRONG");
    expect(screen.getByText("Seats")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stripe" })).toHaveAttribute("href", "https://stripe.com");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("alert(1)");
  });
});
