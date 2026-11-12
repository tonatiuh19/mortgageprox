/**
 * Wage-earner qualifying income worksheet.
 * Estimates only. Confirm with the investor guidelines in force.
 *
 * YTD months: derived from pay-period ending month/day (calendar year to date).
 * Variable income: lesser of YTD-annualized vs 2-year average (when history present).
 */

export type BasePayMethod =
  | "annual_salary"
  | "periodic_salary"
  | "hourly"
  | "w2_average";

export type PayFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export interface VariableStream {
  /** YTD dollars from most recent paystub */
  ytd: number;
  /** Prior calendar year total */
  year1: number;
  /** Calendar year before that */
  year2: number;
}

export interface WageEarnerBorrower {
  name: string;
  loanNumber: string;
  employer: string;
  /** Pay period ending month 1–12 */
  payPeriodMonth: number;
  /** Pay period ending day 1–31 */
  payPeriodDay: number;
  /**
   * Paystub year-to-date gross (or base) — used for year-end pace tracking.
   * Advisory unless a future base method uses it for qualifying.
   */
  baseYtdAmount: number;
  baseMethod: BasePayMethod;
  annualSalary: number;
  periodicAmount: number;
  payFrequency: PayFrequency;
  hourlyRate: number;
  hoursPerWeek: number;
  w2Year1: number;
  w2Year2: number;
  overtime: VariableStream;
  commission: VariableStream;
  bonus: VariableStream;
  /** Gross monthly non-taxable (before gross-up) */
  nonTaxableMonthly: number;
  /** Gross-up rate e.g. 0.25 = 25% */
  nonTaxableGrossUpPct: number;
  /** Monthly deductions from qualifying income */
  deductionsMonthly: number;
  /** Optional CRM client link for this borrower slot (1–4) */
  linkedClientId?: number | null;
  /** Display-only when linked (not used in qualify math) */
  linkedPhone?: string;
  linkedEmail?: string;
}

export interface WageEarnerWorksheet {
  borrowers: [WageEarnerBorrower, WageEarnerBorrower, WageEarnerBorrower, WageEarnerBorrower];
}

export interface BorrowerQualifyResult {
  ytdMonths: number;
  monthlyBase: number;
  monthlyVariable: number;
  monthlyNonTaxable: number;
  monthlyDeductions: number;
  incomeUsedToQualify: number;
  /** YTD → year-end pace (null when YTD $ or months insufficient) */
  ytdPace: YtdYearEndPace | null;
  variableDetail: {
    overtime: number;
    commission: number;
    bonus: number;
  };
}

/** Projected finish-the-year pace from paystub YTD + pay-period months. */
export interface YtdYearEndPace {
  avgMonthly: number;
  projectedAnnual: number;
  /** Stated / method-implied annual for comparison (0 if unknown) */
  targetAnnual: number;
  /** projected vs target when target &gt; 0 */
  tracking: "ahead" | "on_pace" | "behind" | "n/a";
  /** (projected − target) / target when comparable */
  deltaPct: number | null;
}

export interface HouseholdQualifyResult {
  borrowers: BorrowerQualifyResult[];
  householdTotal: number;
}

export const emptyVariableStream = (): VariableStream => ({
  ytd: 0,
  year1: 0,
  year2: 0,
});

/** Calendar pay-period ending defaults to today (avoids year-round Jan 1 → 0.0 mo trap). */
export function defaultPayPeriodEnding(now = new Date()): {
  payPeriodMonth: number;
  payPeriodDay: number;
} {
  return {
    payPeriodMonth: now.getMonth() + 1,
    payPeriodDay: now.getDate(),
  };
}

export function blankBorrower(now = new Date()): WageEarnerBorrower {
  const period = defaultPayPeriodEnding(now);
  return {
    name: "",
    loanNumber: "",
    employer: "",
    payPeriodMonth: period.payPeriodMonth,
    payPeriodDay: period.payPeriodDay,
    baseYtdAmount: 0,
    baseMethod: "annual_salary",
    annualSalary: 0,
    periodicAmount: 0,
    payFrequency: "biweekly",
    hourlyRate: 0,
    hoursPerWeek: 40,
    w2Year1: 0,
    w2Year2: 0,
    overtime: emptyVariableStream(),
    commission: emptyVariableStream(),
    bonus: emptyVariableStream(),
    nonTaxableMonthly: 0,
    nonTaxableGrossUpPct: 0.25,
    deductionsMonthly: 0,
    linkedClientId: null,
    linkedPhone: "",
    linkedEmail: "",
  };
}

export function blankWorksheet(): WageEarnerWorksheet {
  return {
    borrowers: [
      blankBorrower(),
      blankBorrower(),
      blankBorrower(),
      blankBorrower(),
    ],
  };
}

/** Days from Jan 1 through month/day (inclusive). */
export function dayOfYear(month: number, day: number, year?: number): number {
  const y = year ?? new Date().getFullYear();
  const m = Math.min(12, Math.max(1, Math.floor(Number(month) || 1)));
  const maxDay = new Date(y, m, 0).getDate();
  const d = Math.min(maxDay, Math.max(1, Math.floor(Number(day) || 1)));
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y, m - 1, d);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * YTD months from pay-period ending date.
 * Jan 1 → ~0.0; mid-year scales by average month length (365/12).
 */
export function ytdMonthsFromPayPeriod(
  month: number,
  day: number,
  year?: number,
): number {
  const days = dayOfYear(month, day, year);
  const months = days / (365 / 12);
  return Math.round(months * 10) / 10;
}

export function periodsPerYear(freq: PayFrequency): number {
  switch (freq) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "semimonthly":
      return 24;
    case "monthly":
      return 12;
  }
}

export function monthlyFromPeriodic(
  amount: number,
  freq: PayFrequency,
): number {
  const a = Math.max(0, Number(amount) || 0);
  return (a * periodsPerYear(freq)) / 12;
}

export function monthlyBasePay(b: WageEarnerBorrower): number {
  switch (b.baseMethod) {
    case "annual_salary":
      return Math.max(0, Number(b.annualSalary) || 0) / 12;
    case "periodic_salary":
      return monthlyFromPeriodic(b.periodicAmount, b.payFrequency);
    case "hourly": {
      const rate = Math.max(0, Number(b.hourlyRate) || 0);
      const hours = Math.max(0, Number(b.hoursPerWeek) || 0);
      return (rate * hours * 52) / 12;
    }
    case "w2_average": {
      const y1 = Math.max(0, Number(b.w2Year1) || 0);
      const y2 = Math.max(0, Number(b.w2Year2) || 0);
      if (y1 <= 0 && y2 <= 0) return 0;
      if (y1 > 0 && y2 > 0) return (y1 + y2) / 2 / 12;
      return (y1 || y2) / 12;
    }
  }
}

/**
 * Monthly qualifying amount for one variable stream.
 * Prefer lesser of YTD-annualized vs 2-year average when both exist.
 */
export function monthlyVariableStream(
  stream: VariableStream,
  ytdMonths: number,
): number {
  const ytd = Math.max(0, Number(stream.ytd) || 0);
  const y1 = Math.max(0, Number(stream.year1) || 0);
  const y2 = Math.max(0, Number(stream.year2) || 0);
  const hasHistory = y1 > 0 || y2 > 0;
  const avg2Annual =
    y1 > 0 && y2 > 0 ? (y1 + y2) / 2 : y1 > 0 || y2 > 0 ? y1 || y2 : 0;

  let annual = 0;
  if (ytd > 0 && ytdMonths > 0.05) {
    const ytdAnnualized = (ytd / ytdMonths) * 12;
    annual =
      hasHistory && avg2Annual > 0
        ? Math.min(ytdAnnualized, avg2Annual)
        : ytdAnnualized;
  } else if (hasHistory) {
    annual = avg2Annual;
  }

  return annual / 12;
}

/** Annualized target implied by the selected base-pay method (for YTD tracking). */
export function statedAnnualTarget(b: WageEarnerBorrower): number {
  return Math.max(0, monthlyBasePay(b) * 12);
}

/**
 * If YTD earnings continue at the same monthly pace, where do they finish the year?
 * Returns null when YTD $ is empty or YTD months are ~0 (e.g. Jan 1).
 */
export function computeYtdYearEndPace(
  baseYtdAmount: number,
  ytdMonths: number,
  targetAnnual = 0,
): YtdYearEndPace | null {
  const ytd = Math.max(0, Number(baseYtdAmount) || 0);
  const months = Math.max(0, Number(ytdMonths) || 0);
  if (ytd <= 0 || months <= 0.05) return null;

  const avgMonthly = ytd / months;
  const projectedAnnual = avgMonthly * 12;
  const target = Math.max(0, Number(targetAnnual) || 0);

  let tracking: YtdYearEndPace["tracking"] = "n/a";
  let deltaPct: number | null = null;
  if (target > 0) {
    deltaPct = (projectedAnnual - target) / target;
    if (deltaPct > 0.03) tracking = "ahead";
    else if (deltaPct < -0.03) tracking = "behind";
    else tracking = "on_pace";
  }

  return {
    avgMonthly,
    projectedAnnual,
    targetAnnual: target,
    tracking,
    deltaPct,
  };
}

/**
 * Map household qualifying income → loan-calc monthly income line drafts.
 * One line per borrower with incomeUsedToQualify &gt; 0.
 */
export function householdToIncomeLineDrafts(
  worksheet: WageEarnerWorksheet,
): { label: string; amount: number }[] {
  const household = computeHousehold(worksheet);
  const lines: { label: string; amount: number }[] = [];
  worksheet.borrowers.forEach((b, i) => {
    const amount = household.borrowers[i]?.incomeUsedToQualify ?? 0;
    if (amount <= 0.005) return;
    const name = b.name.trim();
    lines.push({
      label: name
        ? `Borrower ${i + 1} · ${name}`
        : `Borrower ${i + 1} qualifying`,
      amount: Math.round(amount * 100) / 100,
    });
  });
  return lines;
}

export function computeBorrowerQualify(
  b: WageEarnerBorrower,
): BorrowerQualifyResult {
  const ytdMonths = ytdMonthsFromPayPeriod(b.payPeriodMonth, b.payPeriodDay);
  const monthlyBase = monthlyBasePay(b);
  const overtime = monthlyVariableStream(b.overtime, ytdMonths);
  const commission = monthlyVariableStream(b.commission, ytdMonths);
  const bonus = monthlyVariableStream(b.bonus, ytdMonths);
  const monthlyVariable = overtime + commission + bonus;

  const grossUp = Math.max(0, Number(b.nonTaxableGrossUpPct) || 0);
  const nonTaxBase = Math.max(0, Number(b.nonTaxableMonthly) || 0);
  const monthlyNonTaxable = nonTaxBase * (1 + grossUp);
  const monthlyDeductions = Math.max(0, Number(b.deductionsMonthly) || 0);

  const incomeUsedToQualify = Math.max(
    0,
    monthlyBase + monthlyVariable + monthlyNonTaxable - monthlyDeductions,
  );

  const ytdPace = computeYtdYearEndPace(
    b.baseYtdAmount,
    ytdMonths,
    statedAnnualTarget(b),
  );

  return {
    ytdMonths,
    monthlyBase,
    monthlyVariable,
    monthlyNonTaxable,
    monthlyDeductions,
    incomeUsedToQualify,
    ytdPace,
    variableDetail: { overtime, commission, bonus },
  };
}

export function computeHousehold(
  worksheet: WageEarnerWorksheet,
): HouseholdQualifyResult {
  const borrowers = worksheet.borrowers.map(computeBorrowerQualify);
  const householdTotal = borrowers.reduce(
    (s, r) => s + r.incomeUsedToQualify,
    0,
  );
  return { borrowers, householdTotal };
}

export const fmtMoney = (n: number, decimals = 2) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
};
