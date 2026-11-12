import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { setupStore } from "@/store";
import LegalAgree from "./LegalAgree";
import MarkdownEditor from "./MarkdownEditor";

describe("Markdown editor", () => {
  it("previews the page and inserts markup from the toolbar", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor label="Terms" value={"# Terms\n\nHello"} onChange={onChange} />);
    expect(screen.getByRole("heading", { name: "Terms" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledWith("****# Terms\n\nHello");
  });

  it("opens the agreement in a dialog and keeps the full page for a new tab", () => {
    const onChange = vi.fn();
    render(
      <Provider store={setupStore()}>
        <MemoryRouter>
          <LegalAgree checked onChange={onChange} platform />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Terms" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute("href", "/terms?scope=platform");
    expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute("target", "_blank");
  });
});
