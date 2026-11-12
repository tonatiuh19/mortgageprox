import { describe, expect, it } from "vitest";
import { __test } from "./index";

describe("MISMO 3.4", () => {
  it("writes the stored loan as a 3.4 file and leaves out fields the office does not have", () => {
    const xml = __test.mismoDocument({
      id: 12,
      purpose: "purchase",
      amount_cents: 40000000,
      property_value_cents: 50000000,
      down_payment_cents: 2000000,
      property_type: "condo",
      address_line: "10 Market St",
      city: "San Francisco",
      region: "California",
      postal_code: "94105",
      application_on: "2026-11-01",
      est_close_on: "2026-12-15",
      first_name: "Ada",
      last_name: "Lovelace",
      client_email: "ada@example.com",
      client_phone: "4155550100",
      birthday: "1990-04-02",
      employer: "Northwind",
      job_title: "Analyst",
      annual_income_cents: 9600000,
      income_type: "w2",
      brokerage_name: "Northwind Mortgage",
      nmls: "123456",
    });
    expect(xml).toContain('MISMOReferenceModelIdentifier="3.4.032420160128"');
    expect(xml).toContain("<AboutVersionIdentifier>3.4</AboutVersionIdentifier>");
    expect(xml).toContain("<LoanPurposeType>Purchase</LoanPurposeType>");
    expect(xml).toContain("<NoteAmount>400000.00</NoteAmount>");
    expect(xml).toContain("<DownPaymentAmount>20000.00</DownPaymentAmount>");
    expect(xml).toContain("<StateCode>CA</StateCode>");
    expect(xml).toContain("<ProjectLegalStructureType>Condominium</ProjectLegalStructureType>");
    expect(xml).toContain("<FirstName>Ada</FirstName>");
    expect(xml).toContain("<BorrowerBirthDate>1990-04-02</BorrowerBirthDate>");
    expect(xml).toContain("<IncomeType>Base</IncomeType>");
    expect(xml).toContain("<CurrentIncomeMonthlyTotalAmount>8000.00</CurrentIncomeMonthlyTotalAmount>");
    expect(xml).toContain("<PartyRoleType>LoanOriginationCompany</PartyRoleType>");
    expect(xml).toContain("<LicenseIdentifier>123456</LicenseIdentifier>");
    expect(xml).not.toContain("<MortgageType>");
    expect(xml).not.toContain("CreditScore");
  });
});
