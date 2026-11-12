import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplySummary, { type ApplyAnswers } from "@/components/portal/ApplySummary";

afterEach(() => cleanup());

const answers: ApplyAnswers = {
  firstName: "Felix",
  lastName: "Gomez",
  email: "felix@disruptinglabs.com",
  phone: "4155550142",
  birthday: "1986-03-14",
  address: "1 Market St",
  city: "San Francisco",
  region: "CA",
  postal: "94105",
  value: "850000",
  purpose: "purchase",
  amount: "640000",
  incomeType: "w2",
  employer: "Disrupting Labs",
  job: "Founder",
  income: "180000",
};

describe("Apply summary", () => {
  it("lists every answer and jumps back to a step", async () => {
    const onEdit = vi.fn();
    render(<ApplySummary answers={answers} onEdit={onEdit} />);
    expect(screen.getAllByText("Purchase").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$640,000").length).toBeGreaterThan(0);
    expect(screen.getByText("1 Market St, San Francisco, CA 94105")).toBeInTheDocument();
    expect(screen.getByText("Felix Gomez")).toBeInTheDocument();
    expect(screen.getByText("felix@disruptinglabs.com")).toBeInTheDocument();
    expect(screen.getByText("(415) 555-0142")).toBeInTheDocument();
    expect(screen.getByText("Mar 14, 1986")).toBeInTheDocument();
    expect(screen.getByText("$850,000")).toBeInTheDocument();
    expect(screen.getByText("W-2")).toBeInTheDocument();
    expect(screen.getByText("Disrupting Labs")).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("$180,000")).toBeInTheDocument();
    const edits = screen.getAllByRole("button", { name: "Edit" });
    expect(edits).toHaveLength(4);
    await userEvent.click(edits[1]);
    expect(onEdit).toHaveBeenCalledWith(2);
  });

  it("marks a missing answer instead of leaving a hole", () => {
    render(<ApplySummary answers={{ ...answers, phone: "", amount: "", purpose: "refinance" }} onEdit={() => undefined} />);
    expect(screen.getAllByText("Refinance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not added").length).toBeGreaterThan(0);
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});
