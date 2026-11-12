import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplySuccess from "@/components/portal/ApplySuccess";

afterEach(() => cleanup());

describe("Apply success", () => {
  it("names the officer and can start another application", async () => {
    const onAgain = vi.fn();
    render(<ApplySuccess name="Maya Chen" email="felix@disruptinglabs.com" onAgain={onAgain} />);
    expect(screen.getByRole("heading", { name: "You are all set" })).toBeInTheDocument();
    expect(screen.getByText("Maya Chen has your file.")).toBeInTheDocument();
    expect(screen.getByText("Check felix@disruptinglabs.com for what to send and a button to your portal.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start another application" }));
    expect(onAgain).toHaveBeenCalledOnce();
  });
});
