import { Briefcase, Home, Landmark, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";

export type ApplyAnswers = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday: string;
  address: string;
  city: string;
  region: string;
  postal: string;
  value: string;
  purpose: string;
  amount: string;
  incomeType: string;
  employer: string;
  job: string;
  income: string;
};

function prettyPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function prettyDate(value: string, language: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(language, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dollars(value: string) {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) return "";
  return formatMoney(Math.round(amount * 100));
}

function place(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(", ");
}

function Row({ label, value, empty }: { label: string; value: string; empty: string }) {
  const shown = value.trim();
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`break-words text-sm ${shown ? "" : "text-muted-foreground"}`}>{shown || empty}</dd>
    </div>
  );
}

function Group({ icon, title, onEdit, edit, disabled, children }: { icon: ReactNode; title: string; onEdit: () => void; edit: string; disabled: boolean; children: ReactNode }) {
  return (
    <section className="px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
        <h2 className="min-w-0 flex-1 font-medium">{title}</h2>
        <button type="button" className="shrink-0 text-sm font-medium text-primary disabled:opacity-40" onClick={onEdit} disabled={disabled}>{edit}</button>
      </div>
      <dl className="mt-3 space-y-2.5 pl-12">{children}</dl>
    </section>
  );
}

export default function ApplySummary({ answers, onEdit, disabled = false }: { answers: ApplyAnswers; onEdit: (step: number) => void; disabled?: boolean }) {
  const { t, i18n } = useTranslation();
  const empty = t("apply.notAdded");
  const name = `${answers.firstName} ${answers.lastName}`.trim();
  const cityLine = [answers.city, [answers.region, answers.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const home = place([answers.address, cityLine]);
  const amount = dollars(answers.amount);
  const incomeName = answers.incomeType === "self_employed"
    ? t("loan.selfEmployed")
    : answers.incomeType === "retired"
      ? t("loan.retired")
      : answers.incomeType === "other"
        ? t("source.other")
        : t("loan.w2");

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="bg-primary/10 px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{answers.purpose === "refinance" ? t("app.refinance") : t("app.purchase")}</p>
        <p className={`mt-1 font-display text-4xl tabular-nums ${amount ? "" : "text-2xl text-muted-foreground"}`}>{amount || empty}</p>
        <p className={`mt-1 break-words text-sm ${home ? "text-foreground/80" : "text-muted-foreground"}`}>{home || empty}</p>
      </div>
      <div className="divide-y divide-border">
        <Group icon={<User size={16} />} title={t("apply.step.identity")} edit={t("apply.edit")} disabled={disabled} onEdit={() => onEdit(1)}>
          <Row label={t("apply.name")} value={name} empty={empty} />
          <Row label={t("app.email")} value={answers.email} empty={empty} />
          <Row label={t("app.phone")} value={answers.phone ? prettyPhone(answers.phone) : ""} empty={empty} />
          <Row label={t("loan.birthday")} value={answers.birthday ? prettyDate(answers.birthday, i18n.language) : ""} empty={empty} />
        </Group>
        <Group icon={<Home size={16} />} title={t("apply.step.property")} edit={t("apply.edit")} disabled={disabled} onEdit={() => onEdit(2)}>
          <Row label={t("loan.address")} value={answers.address} empty={empty} />
          <Row label={t("loan.city")} value={answers.city} empty={empty} />
          <Row label={t("loan.region")} value={answers.region} empty={empty} />
          <Row label={t("loan.postal")} value={answers.postal} empty={empty} />
          <Row label={t("loan.value")} value={dollars(answers.value)} empty={empty} />
        </Group>
        <Group icon={<Landmark size={16} />} title={t("apply.step.finances")} edit={t("apply.edit")} disabled={disabled} onEdit={() => onEdit(3)}>
          <Row label={t("app.purpose")} value={answers.purpose === "refinance" ? t("app.refinance") : t("app.purchase")} empty={empty} />
          <Row label={t("loan.amount")} value={amount} empty={empty} />
          <Row label={t("loan.incomeType")} value={incomeName} empty={empty} />
        </Group>
        <Group icon={<Briefcase size={16} />} title={t("apply.step.employment")} edit={t("apply.edit")} disabled={disabled} onEdit={() => onEdit(4)}>
          <Row label={t("loan.employer")} value={answers.employer} empty={empty} />
          <Row label={t("loan.job")} value={answers.job} empty={empty} />
          <Row label={t("loan.income")} value={dollars(answers.income)} empty={empty} />
        </Group>
      </div>
    </article>
  );
}
