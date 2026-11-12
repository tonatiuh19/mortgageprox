import { describe, expect, it } from "vitest";
import {
  DEFAULT_INPUTS,
  computeLoanCalc,
  fmtMoney,
  fmtPct,
  monthlyPi,
} from "./loan-calc-engine";

describe("loanCalcEngine", () => {
  it("computes standard P&I", () => {
    const pi = monthlyPi(320_000, 6.5, 30);
    expect(pi).toBeGreaterThan(2000);
    expect(pi).toBeLessThan(2100);
  });

  it("zero-rate amortizes evenly", () => {
    expect(monthlyPi(120_000, 0, 10)).toBeCloseTo(1000, 5);
  });

  it("negative rate is treated as zero", () => {
    expect(monthlyPi(120_000, -5, 10)).toBeCloseTo(1000, 5);
  });

  it("FHA finances upfront MIP and adds annual MI", () => {
    const r = computeLoanCalc("fha", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 3.5,
      interestRate: 6.5,
      upfrontMipPct: 1.75,
      miFactorPct: 0.55,
      homeownersInsuranceMonthly: 150,
      annualTaxRatePct: 1.25,
      income: [{ id: "1", label: "Salary", amount: 10_000 }],
      debts: [{ id: "1", label: "Car", amount: 400 }],
    });
    expect(r.downPayment).toBeCloseTo(14_000, 0);
    expect(r.baseLoan).toBeCloseTo(386_000, 0);
    expect(r.financedFee).toBeCloseTo(386_000 * 0.0175, 0);
    expect(r.totalLoan).toBeCloseTo(r.baseLoan + r.financedFee, 0);
    expect(r.monthlyMi).toBeGreaterThan(0);
    expect(r.totalMonthlyPayment).toBeGreaterThan(r.principalAndInterest);
    expect(r.ratiosAvailable).toBe(true);
    expect(r.frontEndRatio).toBeGreaterThan(0);
    expect(r.backEndRatio).toBeGreaterThan(r.frontEndRatio);
  });

  it("VA has funding fee and no monthly MI", () => {
    const r = computeLoanCalc("va", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 0,
      vaFundingFeePct: 2.15,
      homeownersInsuranceMonthly: 150,
    });
    expect(r.financedFee).toBeCloseTo(400_000 * 0.0215, 0);
    expect(r.monthlyMi).toBe(0);
  });

  it("conventional PMI only above 80% LTV", () => {
    const highLtv = computeLoanCalc("conventional", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 5,
      pmiAnnualPct: 0.5,
    });
    const at80 = computeLoanCalc("conventional", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 20,
      pmiAnnualPct: 0.5,
    });
    const lowLtv = computeLoanCalc("conventional", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 25,
      pmiAnnualPct: 0.5,
    });
    expect(highLtv.monthlyMi).toBeGreaterThan(0);
    expect(at80.monthlyMi).toBe(0);
    expect(lowLtv.monthlyMi).toBe(0);
  });

  it("empty income marks ratios unavailable (not 0% DTI)", () => {
    const r = computeLoanCalc("fha", {
      ...DEFAULT_INPUTS,
      salesPrice: 300_000,
      income: [
        { id: "1", label: "", amount: 0 },
        { id: "2", label: "", amount: 0 },
      ],
      debts: [{ id: "1", label: "Car", amount: 400 }],
    });
    expect(r.ratiosAvailable).toBe(false);
    expect(r.frontEndRatio).toBe(0);
    expect(r.backEndRatio).toBe(0);
    expect(r.totalMonthlyPayment).toBeGreaterThan(0);
  });

  it("investment credits 75% of rent toward housing ratio", () => {
    const base = computeLoanCalc("investment", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 20,
      rentalIncomeMonthly: 0,
      income: [{ id: "1", label: "Salary", amount: 8_000 }],
      debts: [],
    });
    const withRent = computeLoanCalc("investment", {
      ...DEFAULT_INPUTS,
      salesPrice: 400_000,
      downPaymentPct: 20,
      rentalIncomeMonthly: 2_000,
      income: [{ id: "1", label: "Salary", amount: 8_000 }],
      debts: [],
    });
    expect(withRent.housingPaymentForRatio).toBeCloseTo(
      Math.max(0, withRent.totalMonthlyPayment - 1500),
      2,
    );
    expect(withRent.frontEndRatio).toBeLessThan(base.frontEndRatio);
  });

  it("down payment above 100% clamps loan to zero", () => {
    const r = computeLoanCalc("conventional", {
      ...DEFAULT_INPUTS,
      salesPrice: 200_000,
      downPaymentPct: 150,
    });
    expect(r.baseLoan).toBe(0);
    expect(r.totalLoan).toBe(0);
    expect(r.principalAndInterest).toBe(0);
    expect(r.downPayment).toBe(200_000);
  });

  it("fmtMoney / fmtPct handle non-finite", () => {
    expect(fmtMoney(Number.NaN)).toBe("$0.00");
    expect(fmtPct(Number.NaN)).toBe("—");
  });
});
