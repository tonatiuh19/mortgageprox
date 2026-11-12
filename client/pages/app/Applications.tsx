import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch } from "@/store/hooks";
import { createClient, createLoan } from "@/store/slices/workspaceSlice";

const SOURCES = ["current_client_referral", "past_client", "past_client_referral", "personal_friend", "realtor", "advertisement", "business_partner", "builder", "other"];

export default function Applications() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("realtor");
  const [purpose, setPurpose] = useState("purchase");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const client = await dispatch(createClient({ firstName, lastName, email, phone, source }));
    if (!createClient.fulfilled.match(client)) {
      setError(String(client.payload || "errors.server"));
      return;
    }
    const loan = await dispatch(createLoan({ clientId: client.payload, purpose, amountCents: Math.round((Number(amount) || 0) * 100) }));
    if (!createLoan.fulfilled.match(loan)) {
      setError(String(loan.payload || "errors.server"));
      return;
    }
    navigate(`/app/loans/${loan.payload}`);
  }

  return (
    <form className="portal-rise mx-auto max-w-3xl space-y-3" onSubmit={onSubmit}>
      <SectionHeader title={t("modules.application.name")} meta={t("loan.applicationLead")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </div>
      <Input required type="email" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
      <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.source")} value={source} onChange={(event) => setSource(event.target.value)}>
          {SOURCES.map((item) => <option key={item} value={item}>{t(`source.${item}`)}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("app.purpose")} value={purpose} onChange={(event) => setPurpose(event.target.value)}>
          <option value="purchase">{t("app.purchase")}</option>
          <option value="refinance">{t("app.refinance")}</option>
        </select>
        <Input required aria-label={t("loan.amount")} placeholder={t("loan.amount")} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
      <Button type="submit">{t("loan.openFile")}</Button>
    </form>
  );
}
