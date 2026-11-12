import { describe, expect, it } from "vitest";
import {
  blankBorrower,
  blankWorksheet,
  computeBorrowerQualify,
  computeHousehold,
  computeYtdYearEndPace,
  dayOfYear,
  householdToIncomeLineDrafts,
  monthlyBasePay,
  monthlyFromPeriodic,
  monthlyVariableStream,
  ytdMonthsFromPayPeriod,
} from "./income-qualify-engine";

describe("incomeQualifyEngine", () => {
  it("YTD months: Jan 1 ≈ 0.0", () => {
    expect(dayOfYear(1, 1)).toBe(1);
    expect(ytdMonthsFromPayPeriod(1, 1)).toBe(0.0);
  });

  it("YTD months: June 30 ≈ 6.0", () => {
    const m = ytdMonthsFromPayPeriod(6, 30);
    expect(m).toBeGreaterThan(5.8);
    expect(m).toBeLessThan(6.2);
  });

  it("blank borrower defaults pay period to today (not fixed Jan 1)", () => {
    const now = new Date(2026, 8, 29); // Sep 29
    const b = blankBorrower(now);
    expect(b.payPeriodMonth).toBe(9);
    expect(b.payPeriodDay).toBe(29);
    expect(b.baseYtdAmount).toBe(0);
    expect(
      ytdMonthsFromPayPeriod(b.payPeriodMonth, b.payPeriodDay, 2026),
    ).toBeGreaterThan(8);
  });

  it("YTD year-end pace: $36,350 over mid-year months", () => {
    const months = ytdMonthsFromPayPeriod(8, 15, 2026);
    const pace = computeYtdYearEndPace(36_350, months, 60_000);
    expect(pace).not.toBeNull();
    expect(pace!.avgMonthly).toBeCloseTo(36_350 / months, 2);
    expect(pace!.projectedAnnual).toBeCloseTo((36_350 / months) * 12, 0);
  });

  it("YTD pace tracking ahead/behind vs target", () => {
    const ahead = computeYtdYearEndPace(30_000, 6, 50_000);
    expect(ahead?.tracking).toBe("ahead"); // 60k projected vs 50k
    const behind = computeYtdYearEndPace(20_000, 6, 50_000);
    expect(behind?.tracking).toBe("behind"); // 40k projected
    const onPace = computeYtdYearEndPace(25_000, 6, 50_000);
    expect(onPace?.tracking).toBe("on_pace");
    expect(computeYtdYearEndPace(0, 6, 50_000)).toBeNull();
    expect(computeYtdYearEndPace(10_000, 0, 50_000)).toBeNull();
  });

  it("annual salary → monthly / 12", () => {
    const b = blankBorrower();
    b.baseMethod = "annual_salary";
    b.annualSalary = 120_000;
    expect(monthlyBasePay(b)).toBeCloseTo(10_000, 5);
  });

  it("biweekly periodic → ×26/12", () => {
    expect(monthlyFromPeriodic(2000, "biweekly")).toBeCloseTo(
      (2000 * 26) / 12,
      5,
    );
  });

  it("hourly 40h × rate × 52/12", () => {
    const b = blankBorrower();
    b.baseMethod = "hourly";
    b.hourlyRate = 25;
    b.hoursPerWeek = 40;
    expect(monthlyBasePay(b)).toBeCloseTo((25 * 40 * 52) / 12, 5);
  });

  it("W-2 average uses both years", () => {
    const b = blankBorrower();
    b.baseMethod = "w2_average";
    b.w2Year1 = 100_000;
    b.w2Year2 = 80_000;
    expect(monthlyBasePay(b)).toBeCloseTo(90_000 / 12, 5);
  });

  it("variable uses lesser of YTD annualized vs 2-yr avg", () => {
    const monthly = monthlyVariableStream(
      { ytd: 6_000, year1: 10_000, year2: 10_000 },
      6,
    );
    expect(monthly).toBeCloseTo(10_000 / 12, 5);
  });

  it("variable YTD-only when no history", () => {
    const monthly = monthlyVariableStream(
      { ytd: 3_000, year1: 0, year2: 0 },
      3,
    );
    expect(monthly).toBeCloseTo(12_000 / 12, 5);
  });

  it("qualify = base + variable + grossed-up non-tax − deductions", () => {
    const b = blankBorrower();
    b.baseMethod = "annual_salary";
    b.annualSalary = 60_000;
    b.payPeriodMonth = 6;
    b.payPeriodDay = 30;
    b.overtime = { ytd: 3_000, year1: 6_000, year2: 6_000 };
    b.nonTaxableMonthly = 400;
    b.nonTaxableGrossUpPct = 0.25;
    b.deductionsMonthly = 100;
    const r = computeBorrowerQualify(b);
    expect(r.monthlyBase).toBeCloseTo(5_000, 2);
    expect(r.monthlyVariable).toBeCloseTo(500, 2);
    expect(r.monthlyNonTaxable).toBeCloseTo(500, 2);
    expect(r.incomeUsedToQualify).toBeCloseTo(5_900, 2);
  });

  it("household sums four borrowers", () => {
    const w = blankWorksheet();
    w.borrowers[0].annualSalary = 120_000;
    w.borrowers[1].annualSalary = 60_000;
    const h = computeHousehold(w);
    expect(h.borrowers[0].incomeUsedToQualify).toBeCloseTo(10_000, 2);
    expect(h.borrowers[1].incomeUsedToQualify).toBeCloseTo(5_000, 2);
    expect(h.householdTotal).toBeCloseTo(15_000, 2);
  });

  it("householdToIncomeLineDrafts skips zero borrowers and labels names", () => {
    const w = blankWorksheet();
    w.borrowers[0].name = "Lester Garcia";
    w.borrowers[0].annualSalary = 0;
    w.borrowers[1].name = "Maribel Rodriguez";
    w.borrowers[1].annualSalary = 72_000;
    w.borrowers[2].name = "Marina Carmen Anaya";
    w.borrowers[2].annualSalary = 46_872;
    const lines = householdToIncomeLineDrafts(w);
    expect(lines).toHaveLength(2);
    expect(lines[0].label).toContain("Maribel");
    expect(lines[0].amount).toBeCloseTo(6_000, 2);
    expect(lines[1].label).toContain("Marina");
    expect(lines[1].amount).toBeCloseTo(3_906, 2);
  });
});
