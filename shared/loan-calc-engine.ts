/**
 * Loan calculator formulas ported for MortgageProx.
 * Estimates only. Confirm with the investor guidelines in force.
 */

export type LoanCalcKind =
  | "fha"
  | "va"
  | "conventional"
  | "investment"
  | "mobile_home"
  | "quick_payment";

export type LineItem = { id: string; label: string; amount: number };

export interface LoanCalcInputs {
  salesPrice: number;
  downPaymentPct: number;
  interestRate: number;
  /** FHA upfront MIP % (e.g. 1.75) */
  upfrontMipPct: number;
  /** FHA annual MI factor % (e.g. 0.55) */
  miFactorPct: number;
  /** VA funding fee % (e.g. 2.15) */
  vaFundingFeePct: number;
  /** Conventional PMI annual % when LTV > 80 */
  pmiAnnualPct: number;
  annualTaxRatePct: number;
  homeownersInsuranceMonthly: number;
  hoaMonthly: number;
  /** Investment: expected rental income / mo */
  rentalIncomeMonthly: number;
  termYears: number;
  income: LineItem[];
  debts: LineItem[];
  bankBalance: number;
  closingCostPct: number;
  accountLast4: string;
}

export interface LoanCalcResult {
  downPayment: number;
  baseLoan: number;
  financedFee: number;
  totalLoan: number;
  principalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyMi: number;
  monthlyHoa: number;
  totalMonthlyPayment: number;
  /** Housing payment used for front-end (may exclude rental offset) */
  housingPaymentForRatio: number;
  totalMonthlyIncome: number;
  totalMonthlyDebt: number;
  /**
   * False when income is zero — ratios are not meaningful (do not treat as 0% DTI).
   */
  ratiosAvailable: boolean;
  frontEndRatio: number;
  backEndRatio: number;
  estClosingCosts: number;
  totalFundsNeeded: number;
  surplus: number;
  ltv: number;
  feeLabel: string;
  miLabel: string;
}

export const DEFAULT_INPUTS: LoanCalcInputs = {
  salesPrice: 0,
  downPaymentPct: 3.5,
  interestRate: 6.5,
  upfrontMipPct: 1.75,
  miFactorPct: 0.55,
  vaFundingFeePct: 2.15,
  pmiAnnualPct: 0.5,
  annualTaxRatePct: 1.25,
  homeownersInsuranceMonthly: 150,
  hoaMonthly: 0,
  rentalIncomeMonthly: 0,
  termYears: 30,
  income: [
    { id: "i1", label: "", amount: 0 },
    { id: "i2", label: "", amount: 0 },
    { id: "i3", label: "", amount: 0 },
  ],
  debts: [
    { id: "d1", label: "", amount: 0 },
    { id: "d2", label: "", amount: 0 },
    { id: "d3", label: "", amount: 0 },
  ],
  bankBalance: 0,
  closingCostPct: 4,
  accountLast4: "",
};

export const DEFAULTS_BY_KIND: Record<
  Exclude<LoanCalcKind, "quick_payment">,
  Partial<LoanCalcInputs>
> = {
  fha: { downPaymentPct: 3.5, upfrontMipPct: 1.75, miFactorPct: 0.55 },
  va: { downPaymentPct: 0, vaFundingFeePct: 2.15 },
  conventional: { downPaymentPct: 5, pmiAnnualPct: 0.5 },
  investment: {
    downPaymentPct: 20,
    interestRate: 7.0,
    pmiAnnualPct: 0.75,
    rentalIncomeMonthly: 0,
  },
  mobile_home: { downPaymentPct: 5, interestRate: 7.25, pmiAnnualPct: 0.6 },
};

export function newLineId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function sumLines(items: LineItem[]): number {
  return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

export function monthlyPi(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const rate = Number.isFinite(annualRatePct) ? Math.max(0, annualRatePct) : 0;
  if (rate === 0) return principal / n;
  const r = rate / 100 / 12;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export function computeLoanCalc(
  kind: Exclude<LoanCalcKind, "quick_payment">,
  inputs: LoanCalcInputs,
): LoanCalcResult {
  const price = Math.max(0, Number(inputs.salesPrice) || 0);
  const dpPct = Math.min(100, Math.max(0, Number(inputs.downPaymentPct) || 0));
  const downPayment = (price * dpPct) / 100;
  const baseLoan = Math.max(0, price - downPayment);
  const ltv = price > 0 ? (baseLoan / price) * 100 : 0;

  let financedFee = 0;
  let monthlyMi = 0;
  let feeLabel = "Financed fee";
  let miLabel = "Mortgage Insurance";

  if (kind === "fha") {
    feeLabel = "Upfront MIP Financed";
    miLabel = "Mortgage Insurance";
    financedFee = (baseLoan * (Number(inputs.upfrontMipPct) || 0)) / 100;
    // Annual MIP on base loan (common FHA estimate)
    monthlyMi = (baseLoan * (Number(inputs.miFactorPct) || 0)) / 100 / 12;
  } else if (kind === "va") {
    feeLabel = "VA Funding Fee Financed";
    miLabel = "Mortgage Insurance";
    financedFee = (baseLoan * (Number(inputs.vaFundingFeePct) || 0)) / 100;
    monthlyMi = 0;
  } else {
    // conventional / investment / mobile_home — PMI if LTV > 80
    feeLabel = "Financed fees";
    miLabel = "PMI";
    financedFee = 0;
    if (ltv > 80) {
      monthlyMi = (baseLoan * (Number(inputs.pmiAnnualPct) || 0)) / 100 / 12;
    }
  }

  const totalLoan = baseLoan + financedFee;
  const principalAndInterest = monthlyPi(
    totalLoan,
    Number(inputs.interestRate) || 0,
    Number(inputs.termYears) || 30,
  );
  const monthlyTax =
    (price * (Number(inputs.annualTaxRatePct) || 0)) / 100 / 12;
  const monthlyInsurance = Math.max(
    0,
    Number(inputs.homeownersInsuranceMonthly) || 0,
  );
  const monthlyHoa = Math.max(0, Number(inputs.hoaMonthly) || 0);

  const totalMonthlyPayment =
    principalAndInterest +
    monthlyTax +
    monthlyInsurance +
    monthlyMi +
    monthlyHoa;

  const totalMonthlyIncome = sumLines(inputs.income || []);
  const totalMonthlyDebt = sumLines(inputs.debts || []);

  // Investment: net housing for ratios can credit a portion of rent (conservative 75%)
  const rentCredit =
    kind === "investment"
      ? Math.max(0, Number(inputs.rentalIncomeMonthly) || 0) * 0.75
      : 0;
  const housingPaymentForRatio = Math.max(
    0,
    totalMonthlyPayment - rentCredit,
  );

  const ratiosAvailable = totalMonthlyIncome > 0;
  const frontEndRatio = ratiosAvailable
    ? (housingPaymentForRatio / totalMonthlyIncome) * 100
    : 0;
  const backEndRatio = ratiosAvailable
    ? ((housingPaymentForRatio + totalMonthlyDebt) / totalMonthlyIncome) * 100
    : 0;

  const estClosingCosts = (price * (Number(inputs.closingCostPct) || 0)) / 100;
  const totalFundsNeeded = estClosingCosts + downPayment;
  const surplus = (Number(inputs.bankBalance) || 0) - totalFundsNeeded;

  return {
    downPayment,
    baseLoan,
    financedFee,
    totalLoan,
    principalAndInterest,
    monthlyTax,
    monthlyInsurance,
    monthlyMi,
    monthlyHoa,
    totalMonthlyPayment,
    housingPaymentForRatio,
    totalMonthlyIncome,
    totalMonthlyDebt,
    ratiosAvailable,
    frontEndRatio,
    backEndRatio,
    estClosingCosts,
    totalFundsNeeded,
    surplus,
    ltv,
    feeLabel,
    miLabel,
  };
}

export function kindTitle(kind: LoanCalcKind): string {
  switch (kind) {
    case "fha":
      return "FHA — 30 Year Fixed";
    case "va":
      return "VA — 30 Year Fixed";
    case "conventional":
      return "Conventional — 30 Year Fixed";
    case "investment":
      return "Investment Property";
    case "mobile_home":
      return "Mobile Home";
    case "quick_payment":
      return "Quick Payment & Amortization";
  }
}

export function kindBlurb(kind: LoanCalcKind): string {
  switch (kind) {
    case "fha":
      return "Enter the sales price, income, and debts to see the payment, qualifying ratios, and funds needed to close.";
    case "va":
      return "VA purchase worksheet with funding fee, payment breakdown, and DTI ratios.";
    case "conventional":
      return "Conventional purchase with PMI when LTV is above 80%.";
    case "investment":
      return "Investment purchase with optional rental income credit (75%) toward ratios.";
    case "mobile_home":
      return "Mobile / manufactured home purchase estimate — confirm program guidelines with your AE.";
    case "quick_payment":
      return "Fast payment and amortization schedule (same engine as the public calculator).";
  }
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

export const fmtPct = (n: number, decimals = 2) => {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
};