import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PersonWelcome from "@/components/portal/PersonWelcome";
import type { PublicOffice } from "@/store/slices/workspaceSlice";

afterEach(() => cleanup());

const office: PublicOffice = {
  name: "Northwind Mortgage",
  slug: "northwind-mortgage",
  phone: "4155550100",
  email: "office@northwind.example",
  address: "1 Market St, San Francisco, CA, 94105",
  nmls: "100",
  primaryColor: null,
  logoUrl: null,
  officer: {
    name: "Maya Chen",
    photoUrl: null,
    nmls: "224411",
    bio: "Purchase and refinance.",
    email: "maya@northwind.example",
    phone: "4155550148",
    role: "brokerage_owner",
    specializations: ["purchase"],
    links: { website: "https://northwind.example", linkedin: "", facebook: "", instagram: "", youtube: "" },
  },
};

describe("Person welcome", () => {
  it("shows the person's phone, email, and only the links they saved", () => {
    render(<PersonWelcome office={office} />);
    expect(screen.getByRole("heading", { name: "Maya Chen" })).toBeInTheDocument();
    expect(screen.getByText("(415) 555-0148")).toBeInTheDocument();
    expect(screen.getByText("maya@northwind.example")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://northwind.example");
    expect(screen.queryByRole("link", { name: "LinkedIn" })).toBeNull();
  });
});
