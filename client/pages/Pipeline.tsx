import { useTranslation } from "react-i18next";
import PageMeta from "@/components/PageMeta";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "rose";

interface Loan {
  borrower: string;
  purpose: string;
  amount: number;
  rate: string;
  officer: string;
  progress: number;
  next: string;
  tone: Tone;
}

interface Stage {
  name: string;
  loans: Loan[];
}

const stages: Stage[] = [
  {
    name: "New application",
    loans: [
      {
        borrower: "Maya Chen",
        purpose: "Purchase · Austin, TX",
        amount: 612000,
        rate: "6.125%",
        officer: "AR",
        progress: 10,
        next: "Complete application",
        tone: "emerald",
      },
    ],
  },
  {
    name: "Documents",
    loans: [
      {
        borrower: "James Okafor",
        purpose: "Refinance · Denver, CO",
        amount: 389500,
        rate: "5.750%",
        officer: "DK",
        progress: 28,
        next: "Upload two pay stubs",
        tone: "amber",
      },
      {
        borrower: "Priya Raman",
        purpose: "Purchase · Seattle, WA",
        amount: 845000,
        rate: "6.000%",
        officer: "AR",
        progress: 35,
        next: "Sign disclosures",
        tone: "emerald",
      },
    ],
  },
  {
    name: "Processing",
    loans: [
      {
        borrower: "Leo & Ana Martín",
        purpose: "Purchase · Phoenix, AZ",
        amount: 730000,
        rate: "6.250%",
        officer: "DK",
        progress: 55,
        next: "Order appraisal",
        tone: "emerald",
      },
      {
        borrower: "Sam Whitfield",
        purpose: "Refinance · Portland, OR",
        amount: 294000,
        rate: "5.500%",
        officer: "AR",
        progress: 46,
        next: "Explain credit inquiry",
        tone: "rose",
      },
    ],
  },
  {
    name: "Underwriting",
    loans: [
      {
        borrower: "Grace Lin",
        purpose: "Purchase · San Diego, CA",
        amount: 958000,
        rate: "6.000%",
        officer: "DK",
        progress: 72,
        next: "Review conditions",
        tone: "emerald",
      },
    ],
  },
  {
    name: "Clear to close",
    loans: [
      {
        borrower: "Owen Brooks",
        purpose: "Purchase · Nashville, TN",
        amount: 415000,
        rate: "5.875%",
        officer: "AR",
        progress: 92,
        next: "Final walkthrough booked",
        tone: "emerald",
      },
    ],
  },
  {
    name: "Funded",
    loans: [
      {
        borrower: "Hannah Ruiz",
        purpose: "Refinance · Tampa, FL",
        amount: 520000,
        rate: "5.625%",
        officer: "DK",
        progress: 100,
        next: "Closing package sent",
        tone: "emerald",
      },
    ],
  },
];

const toneDot: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const kpis = [
  { label: "Pipeline volume", value: "$4.76M" },
  { label: "Active applications", value: "23" },
  { label: "Avg. days to close", value: "11" },
  { label: "Conversion", value: "38%" },
];

function LoanCard({ loan, index }: { loan: Loan; index: number }) {
  return (
    <article
      style={{ animationDelay: `${index * 70}ms` }}
      className="animate-slide-up rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{loan.borrower}</p>
          <p className="truncate text-xs text-muted-foreground">
            {loan.purpose}
          </p>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
          {loan.officer}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <p className="font-semibold tabular-nums">
          {currency.format(loan.amount)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {loan.rate}
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${loan.progress}%` }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <span className={cn("size-1.5 shrink-0 rounded-full", toneDot[loan.tone])} />
        <p className="truncate text-xs text-muted-foreground">{loan.next}</p>
      </div>
    </article>
  );
}

export default function Pipeline() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <PageMeta title={t("meta.previewTitle")} description={t("meta.previewDescription")} noIndex />
      <div className="animate-slide-up">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Workspace preview
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight sm:text-6xl">
          Pipeline
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every loan and where it stands, from application to funded. Each
          brokerage names and orders its own stages, and every move can send
          the right message automatically.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 font-display text-3xl tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="-mx-5 mt-10 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
        <div className="flex min-w-max gap-4">
          {stages.map((stage) => {
            const total = stage.loans.reduce((sum, loan) => sum + loan.amount, 0);
            return (
              <section
                key={stage.name}
                className="flex w-[290px] shrink-0 flex-col rounded-2xl bg-muted/60 p-3"
              >
                <header className="flex items-center justify-between gap-2 px-2 py-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{stage.name}</h2>
                    <span className="rounded-md bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {stage.loans.length}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {currency.format(total)}
                  </span>
                </header>
                <div className="mt-2 flex flex-col gap-3">
                  {stage.loans.map((loan, i) => (
                    <LoanCard key={loan.borrower} loan={loan} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
