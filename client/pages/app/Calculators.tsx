import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_INPUTS,
  DEFAULTS_BY_KIND,
  computeLoanCalc,
  fmtMoney,
  fmtPct,
  monthlyPi,
  type LoanCalcKind,
} from "@shared/loan-calc-engine";
import { blankWorksheet, computeHousehold } from "@shared/income-qualify-engine";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCalculatorSaves, saveCalculator } from "@/store/slices/recordsSlice";

const KINDS: LoanCalcKind[] = ["fha", "va", "conventional", "investment", "mobile_home", "quick_payment"];

export default function Calculators() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [kind, setKind] = useState<LoanCalcKind | "income">("fha");
  const [salesPrice, setSalesPrice] = useState("400000");
  const [downPaymentPct, setDown] = useState("3.5");
  const [rate, setRate] = useState("6.5");
  const [term, setTerm] = useState("30");
  const [income, setIncome] = useState("8000");
  const [debts, setDebts] = useState("400");
  const [salary, setSalary] = useState("96000");
  const [payMethod, setPayMethod] = useState<"annual_salary" | "hourly">("annual_salary");
  const [hourly, setHourly] = useState("");
  const [hours, setHours] = useState("40");
  const [salary2, setSalary2] = useState("");
  const [name2, setName2] = useState("");
  const [overtime, setOvertime] = useState("");
  const [otYear, setOtYear] = useState("");
  const [otPrior, setOtPrior] = useState("");
  const [commission, setCommission] = useState("");
  const [commYear, setCommYear] = useState("");
  const [commPrior, setCommPrior] = useState("");
  const [bonus, setBonus] = useState("");
  const [bonusYear, setBonusYear] = useState("");
  const [bonusPrior, setBonusPrior] = useState("");
  const [deductions, setDeductions] = useState("");
  const [fee, setFee] = useState("");
  const [clientId, setClientId] = useState("");
  const [saved, setSaved] = useState(false);
  const [params] = useSearchParams();
  const loanId = Number(params.get("loanId") || 0);
  const [saves, setSaves] = useState<{ id: number; kind: string; title: string; createdAt: string }[]>([]);

  useEffect(() => {
    void dispatch(fetchCalculatorSaves(loanId)).then((result) => {
      if (fetchCalculatorSaves.fulfilled.match(result)) setSaves(result.payload);
    });
  }, [dispatch, loanId, saved]);

  const result = useMemo(() => {
    if (kind === "income") {
      const sheet = blankWorksheet();
      const first = sheet.borrowers[0];
      first.baseMethod = payMethod;
      first.annualSalary = payMethod === "annual_salary" ? Number(salary) || 0 : 0;
      first.hourlyRate = Number(hourly) || 0;
      first.hoursPerWeek = Number(hours) || 0;
      first.overtime = { ytd: Number(overtime) || 0, year1: Number(otYear) || 0, year2: Number(otPrior) || 0 };
      first.commission = { ytd: Number(commission) || 0, year1: Number(commYear) || 0, year2: Number(commPrior) || 0 };
      first.bonus = { ytd: Number(bonus) || 0, year1: Number(bonusYear) || 0, year2: Number(bonusPrior) || 0 };
      first.deductionsMonthly = Number(deductions) || 0;
      const second = sheet.borrowers[1];
      second.name = name2;
      second.baseMethod = "annual_salary";
      second.annualSalary = Number(salary2) || 0;
      const household = computeHousehold(sheet);
      const worksheet = Boolean(payMethod === "hourly" || overtime || otYear || otPrior || commission || commYear || commPrior || bonus || bonusYear || bonusPrior || deductions || salary2);
      return {
        qualify: household.householdTotal,
        first: household.borrowers[0]?.incomeUsedToQualify || 0,
        second: household.borrowers[1]?.incomeUsedToQualify || 0,
        worksheet,
      };
    }
    if (kind === "quick_payment") {
      const principal = Number(salesPrice) || 0;
      const payment = monthlyPi(principal, Number(rate) || 0, Number(term) || 30);
      return { quick: payment, principal };
    }
    const defaults = DEFAULTS_BY_KIND[kind];
    return computeLoanCalc(kind, {
      ...DEFAULT_INPUTS,
      ...defaults,
      salesPrice: Number(salesPrice) || 0,
      downPaymentPct: Number(downPaymentPct) || 0,
      interestRate: Number(rate) || 0,
      termYears: Number(term) || 30,
      income: [{ id: "i1", label: "Income", amount: Number(income) || 0 }, { id: "i2", label: "Other", amount: Number(overtime) || 0 }],
      ...(kind === "fha" && fee ? { upfrontMipPct: Number(fee), miFactorPct: Number(fee) } : {}),
      ...(kind === "va" && fee ? { vaFundingFeePct: Number(fee) } : {}),
      ...(kind !== "fha" && kind !== "va" && fee ? { pmiAnnualPct: Number(fee) } : {}),
      debts: [{ id: "d1", label: "Debts", amount: Number(debts) || 0 }],
    });
  }, [kind, salesPrice, downPaymentPct, rate, term, income, debts, salary, payMethod, hourly, hours, salary2, name2, overtime, otYear, otPrior, commission, commYear, commPrior, bonus, bonusYear, bonusPrior, deductions, fee]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const response = await dispatch(saveCalculator({
      kind,
      title: t(`calcKind.${kind}`),
      clientId: clientId ? Number(clientId) : null,
      loanId: loanId || null,
      inputs: { salesPrice, downPaymentPct, rate, term, income, debts, salary },
      result,
    }));
    if (saveCalculator.fulfilled.match(response)) setSaved(true);
  }

  return (
    <form className="portal-rise mx-auto max-w-3xl" onSubmit={onSave}>
      <SectionHeader title={t("app.calculators")} />
      <p className="mt-2 text-sm text-muted-foreground">{t("app.estimateNote")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...KINDS, "income" as const].map((item) => (
          <Button key={item} type="button" variant={kind === item ? "default" : "outline"} onClick={() => { setKind(item); setSaved(false); }}>
            {t(`calcKind.${item}`)}
          </Button>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {kind === "income" ? (
          <>
            <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("loan.payMethod")} value={payMethod} onChange={(event) => setPayMethod(event.target.value as "annual_salary" | "hourly")}>
              <option value="annual_salary">{t("loan.salaryPay")}</option>
              <option value="hourly">{t("loan.hourlyPay")}</option>
            </select>
            {payMethod === "hourly" ? <Input aria-label={t("loan.hourlyRate")} placeholder={t("loan.hourlyRate")} value={hourly} onChange={(event) => setHourly(event.target.value)} /> : <Input aria-label={t("loan.borrower")} value={salary} onChange={(event) => setSalary(event.target.value)} />}
            {payMethod === "hourly" ? <Input aria-label={t("loan.hoursWeek")} placeholder={t("loan.hoursWeek")} value={hours} onChange={(event) => setHours(event.target.value)} /> : null}
            <Input aria-label={t("loan.overtime")} placeholder={t("loan.overtime")} value={overtime} onChange={(event) => setOvertime(event.target.value)} />
            <Input aria-label={t("loan.priorYear")} placeholder={t("loan.priorYear")} value={otYear} onChange={(event) => setOtYear(event.target.value)} />
            <Input aria-label={t("loan.yearBefore")} placeholder={t("loan.yearBefore")} value={otPrior} onChange={(event) => setOtPrior(event.target.value)} />
            <Input aria-label={t("loan.commission")} placeholder={t("loan.commission")} value={commission} onChange={(event) => setCommission(event.target.value)} />
            <Input aria-label={t("loan.commissionPrior")} placeholder={t("loan.commissionPrior")} value={commYear} onChange={(event) => setCommYear(event.target.value)} />
            <Input aria-label={t("loan.commissionBefore")} placeholder={t("loan.commissionBefore")} value={commPrior} onChange={(event) => setCommPrior(event.target.value)} />
            <Input aria-label={t("loan.bonus")} placeholder={t("loan.bonus")} value={bonus} onChange={(event) => setBonus(event.target.value)} />
            <Input aria-label={t("loan.bonusPrior")} placeholder={t("loan.bonusPrior")} value={bonusYear} onChange={(event) => setBonusYear(event.target.value)} />
            <Input aria-label={t("loan.bonusBefore")} placeholder={t("loan.bonusBefore")} value={bonusPrior} onChange={(event) => setBonusPrior(event.target.value)} />
            <Input aria-label={t("loan.deductions")} placeholder={t("loan.deductions")} value={deductions} onChange={(event) => setDeductions(event.target.value)} />
            <Input aria-label={t("loan.borrowerName")} placeholder={t("loan.borrowerName")} value={name2} onChange={(event) => setName2(event.target.value)} />
            <Input aria-label={t("loan.household")} placeholder={t("loan.household")} value={salary2} onChange={(event) => setSalary2(event.target.value)} />
          </>
        ) : (
          <>
            <Input aria-label={kind === "quick_payment" ? t("app.principal") : t("app.salesPrice")} value={salesPrice} onChange={(event) => setSalesPrice(event.target.value)} />
            {kind !== "quick_payment" ? <Input aria-label={t("app.downPayment")} value={downPaymentPct} onChange={(event) => setDown(event.target.value)} /> : null}
            <Input aria-label={t("app.rate")} value={rate} onChange={(event) => setRate(event.target.value)} />
            <Input aria-label={t("app.term")} value={term} onChange={(event) => setTerm(event.target.value)} />
            {kind !== "quick_payment" ? <Input aria-label={t("app.income")} value={income} onChange={(event) => setIncome(event.target.value)} /> : null}
            {kind !== "quick_payment" ? <Input aria-label={t("app.debts")} value={debts} onChange={(event) => setDebts(event.target.value)} /> : null}
            {kind !== "quick_payment" ? <Input aria-label={t("loan.fee")} placeholder={t("loan.fee")} value={fee} onChange={(event) => setFee(event.target.value)} /> : null}
            {kind !== "quick_payment" ? <Input aria-label={t("loan.overtime")} placeholder={t("loan.overtime")} value={overtime} onChange={(event) => setOvertime(event.target.value)} /> : null}
          </>
        )}
      </div>
      <article className="mt-6 rounded-2xl border border-border bg-card p-5">
        {"qualify" in result ? (
          <div>
            <p className="text-sm text-muted-foreground">{t("loan.household")}</p>
            <p className="font-display text-4xl">{fmtMoney(result.qualify)}</p>
          </div>
        ) : null}
        {"quick" in result ? <p className="font-display text-4xl">{fmtMoney(result.quick)}</p> : null}
        {"totalMonthlyPayment" in result ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">{t("app.payment")}</dt><dd className="font-display text-3xl">{fmtMoney(result.totalMonthlyPayment)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">{t("app.frontEnd")}</dt><dd>{result.ratiosAvailable ? fmtPct(result.frontEndRatio) : t("grid.empty")}</dd></div>
            <div><dt className="text-sm text-muted-foreground">{t("app.backEnd")}</dt><dd>{result.ratiosAvailable ? fmtPct(result.backEndRatio) : t("grid.empty")}</dd></div>
            <div><dt className="text-sm text-muted-foreground">{t("app.funds")}</dt><dd>{fmtMoney(result.totalFundsNeeded)}</dd></div>
          </dl>
        ) : <p className="text-sm text-muted-foreground">{kind === "income" ? t("app.qualify") : t("app.payment")}</p>}
      </article>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input aria-label={t("app.client")} placeholder={t("app.client")} value={clientId} onChange={(event) => setClientId(event.target.value)} />
        <Button type="submit">{t("app.saveScenario")}</Button>
      </div>
      {saved ? <p className="mt-3 text-sm text-muted-foreground">{t("command.saved")}</p> : null}
      {kind === "income" && !("worksheet" in result && result.worksheet) ? <p className="mt-3 text-sm text-muted-foreground">{t("loan.incomeNote")}</p> : null}
      {saves.length ? (
        <ul className="mt-6 space-y-2">
          {saves.map((item) => (
            <li key={item.id} className="rounded-2xl border border-border p-3 text-sm">
              <strong>{item.title}</strong>
              <span className="ml-2 text-muted-foreground">{item.createdAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
    </form>
  );
}
