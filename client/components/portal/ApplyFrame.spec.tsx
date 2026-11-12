import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ApplyFrame from "@/components/portal/ApplyFrame";
import type { PublicOffice } from "@/store/slices/workspaceSlice";

afterEach(() => cleanup());

const office: PublicOffice = {
  name: "Northwind Mortgage",
  slug: "northwind-mortgage",
  phone: "",
  email: "",
  address: "",
  nmls: "",
  primaryColor: null,
  logoUrl: null,
  officer: {
    name: "Maya Chen",
    photoUrl: null,
    nmls: "",
    bio: "",
    email: "",
    phone: "",
    role: "brokerage_owner",
    specializations: [],
    links: { website: "", linkedin: "", facebook: "", instagram: "", youtube: "" },
  },
};

describe("Apply frame", () => {
  it("hides the rail on the email screen", () => {
    render(<ApplyFrame office={office} step={0} saved={false} onLegal={() => undefined}>Form</ApplyFrame>);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("starts the rail on the name step", () => {
    render(<ApplyFrame office={office} step={1} saved onLegal={() => undefined}>Form</ApplyFrame>);
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("You");
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.queryByText("Start")).toBeNull();
    expect(screen.getByText("Northwind Mortgage · Maya Chen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy policy" })).toBeInTheDocument();
  });
});
