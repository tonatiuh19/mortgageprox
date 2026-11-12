import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, ClipboardPen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DevFill from "@/components/dev/DevFill";
import { sampleEmail } from "@/lib/devFill";
import { useAppDispatch } from "@/store/hooks";
import { createClient, createLoan, emailShareLink, fetchLoanDraft, fetchShareLink, rotateShareLink, saveLoanDraft } from "@/store/slices/workspaceSlice";

const SOURCES = ["current_client_referral", "past_client", "past_client_referral", "personal_friend", "realtor", "advertisement", "business_partner", "builder", "other"];

export default function NewLoanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "share" | "manual">("choose");
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("realtor");
  const [purpose, setPurpose] = useState("purchase");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [propertyType, setPropertyType] = useState("single_family");
  const [value, setValue] = useState("");
  const [employer, setEmployer] = useState("");
  const [job, setJob] = useState("");
  const [income, setIncome] = useState("");
  const [incomeType, setIncomeType] = useState("w2");
  const [shareEmail, setShareEmail] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [link, setLink] = useState("");

  const draft = { firstName, lastName, email, phone, source, purpose, amount, address, city, region, postal, propertyType, value, employer, job, income, incomeType };

  useEffect(() => {
    if (!open) return;
    void dispatch(fetchLoanDraft()).then((result) => {
      if (!fetchLoanDraft.fulfilled.match(result) || !result.payload) return;
      const saved = result.payload.payload;
      setStep(result.payload.step || 1);
      setMode("manual");
      setFirstName(saved.firstName || "");
      setLastName(saved.lastName || "");
      setEmail(saved.email || "");
      setPhone(saved.phone || "");
      setSource(saved.source || "realtor");
      setPurpose(saved.purpose || "purchase");
      setAmount(saved.amount || "");
      setAddress(saved.address || "");
      setCity(saved.city || "");
      setRegion(saved.region || "");
      setPostal(saved.postal || "");
      setPropertyType(saved.propertyType || "single_family");
      setValue(saved.value || "");
      setEmployer(saved.employer || "");
      setJob(saved.job || "");
      setIncome(saved.income || "");
      setIncomeType(saved.incomeType || "w2");
    });
  }, [open, dispatch]);

  useEffect(() => {
    if (mode !== "share") return;
    let live = true;
    void dispatch(fetchShareLink()).then((result) => {
      if (!live) return;
      if (fetchShareLink.fulfilled.match(result)) {
        setLink(result.payload.link);
        setError("");
      } else setError(String(result.payload || "errors.server"));
    });
    return () => {
      live = false;
    };
  }, [mode, dispatch]);

  function close(next: boolean) {
    if (!next) {
      setMode("choose");
      setStep(1);
      setError("");
      setCopied(false);
      setLink("");
    }
    onOpenChange(next);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function onManual(event: FormEvent) {
    event.preventDefault();
    if (step < 5) {
      const next = step + 1;
      setStep(next);
      void dispatch(saveLoanDraft({ step: next, payload: draft }));
      return;
    }
    setError("");
    const client = await dispatch(createClient({ firstName, lastName, email, phone, source }));
    if (!createClient.fulfilled.match(client)) {
      setError(String(client.payload || "errors.server"));
      return;
    }
    const loan = await dispatch(createLoan({
      clientId: client.payload,
      purpose,
      amountCents: Math.round((Number(amount) || 0) * 100),
      addressLine: address,
      city,
      region,
      postalCode: postal,
      propertyType,
      propertyValueCents: Math.round((Number(value) || 0) * 100),
      employer,
      jobTitle: job,
      annualIncomeCents: Math.round((Number(income) || 0) * 100),
      incomeType,
    }));
    if (!createLoan.fulfilled.match(loan)) {
      setError(String(loan.payload || "errors.server"));
      return;
    }
    close(false);
    navigate(`/app/loans/${loan.payload}`);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
        {mode === "choose" ? (
          <div>
            <DialogTitle className="text-center font-display text-2xl">{t("pipeline.newTitle")}</DialogTitle>
            <DialogDescription className="mt-1 text-center">{t("pipeline.newLead")}</DialogDescription>
            <button type="button" className="relative mt-5 w-full rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 text-left" onClick={() => setMode("share")}>
              <span className="absolute right-4 top-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">{t("pipeline.recommended")}</span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Share2 size={22} /></span>
              <span className="mt-3 block pr-16 text-lg font-semibold">{t("pipeline.shareTitle")}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t("pipeline.shareBody")}</span>
              <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">{t("pipeline.getLink")} <ChevronRight size={16} /></span>
            </button>
            <button type="button" className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left" onClick={() => setMode("manual")}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><ClipboardPen size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t("pipeline.manualTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("pipeline.manualBody")}</span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        ) : null}
        {mode === "share" ? (
          <div>
            <DialogTitle className="font-display text-2xl">{t("pipeline.shareTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{t("pipeline.shareReady")}</DialogDescription>
            <div className="mt-4 flex min-w-0 gap-2">
              <Input className="min-w-0" readOnly aria-label={t("pipeline.getLink")} value={link} />
              <Button type="button" variant="outline" onClick={() => void copy()}>{copied ? <Check size={16} /> : t("pipeline.copy")}</Button>
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
            <div className="mt-4 grid gap-2">
              <Input type="email" aria-label={t("app.email")} placeholder={t("app.email")} value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} />
              <Input aria-label={t("book.note")} placeholder={t("book.note")} value={shareNote} onChange={(event) => setShareNote(event.target.value)} />
              <Button type="button" variant="outline" disabled={!link} onClick={() => void dispatch(emailShareLink({ email: shareEmail, note: shareNote }))}>{t("loan.emailLink")}</Button>
              <Button type="button" variant="outline" disabled={!link} onClick={() => void dispatch(rotateShareLink()).then((result) => {
                if (rotateShareLink.fulfilled.match(result)) setLink(result.payload.link);
                else setError(String(result.payload || "errors.server"));
              })}>{t("loan.replaceLink")}</Button>
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setMode("choose")}>{t("pipeline.back")}</Button>
              {link ? <Button type="button" variant="outline" asChild><a href={link} target="_blank" rel="noreferrer">{t("pipeline.openLink")}</a></Button> : null}
            </div>
          </div>
        ) : null}
        {mode === "manual" ? (
          <form onSubmit={onManual}>
            <DialogTitle className="font-display text-2xl">{t("pipeline.manualTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{t(`loan.step${step}`)}</DialogDescription>
            <DevFill className="mt-3" onFill={() => {
              setFirstName("James");
              setLastName("Okafor");
              setEmail(sampleEmail("james.okafor"));
              setPhone("5125550199");
              setAmount("425000");
            }} />
            {step === 1 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
                <Input required type="email" className="sm:col-span-2" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
                <Input className="sm:col-span-2" aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            ) : null}
            {step === 2 ? (
              <div className="mt-4 grid gap-3">
                <Input aria-label={t("loan.address")} placeholder={t("loan.address")} value={address} onChange={(event) => setAddress(event.target.value)} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input aria-label={t("loan.city")} placeholder={t("loan.city")} value={city} onChange={(event) => setCity(event.target.value)} />
                  <Input aria-label={t("loan.region")} placeholder={t("loan.region")} value={region} onChange={(event) => setRegion(event.target.value)} />
                  <Input aria-label={t("loan.postal")} placeholder={t("loan.postal")} value={postal} onChange={(event) => setPostal(event.target.value)} />
                </div>
                <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.propertyType")} value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
                  {["single_family", "condo", "townhouse", "multi", "manufactured", "other"].map((item) => <option key={item} value={item}>{t(`property.${item}`)}</option>)}
                </select>
              </div>
            ) : null}
            {step === 3 ? (
              <div className="mt-4 grid gap-3">
                <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.source")} value={source} onChange={(event) => setSource(event.target.value)}>
                  {SOURCES.map((item) => <option key={item} value={item}>{t(`source.${item}`)}</option>)}
                </select>
                <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("app.purpose")} value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                  <option value="purchase">{t("app.purchase")}</option>
                  <option value="refinance">{t("app.refinance")}</option>
                </select>
                <Input required aria-label={t("loan.amount")} placeholder={t("loan.amount")} value={amount} onChange={(event) => setAmount(event.target.value)} />
                <Input aria-label={t("loan.value")} placeholder={t("loan.value")} value={value} onChange={(event) => setValue(event.target.value)} />
                <p className="text-sm text-muted-foreground">{t("loan.tasksApply")}</p>
              </div>
            ) : null}
            {step === 4 ? (
              <div className="mt-4 grid gap-3">
                <Input aria-label={t("loan.employer")} placeholder={t("loan.employer")} value={employer} onChange={(event) => setEmployer(event.target.value)} />
                <Input aria-label={t("loan.job")} placeholder={t("loan.job")} value={job} onChange={(event) => setJob(event.target.value)} />
                <Input aria-label={t("loan.income")} placeholder={t("loan.income")} value={income} onChange={(event) => setIncome(event.target.value)} />
                <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.incomeType")} value={incomeType} onChange={(event) => setIncomeType(event.target.value)}>
                  <option value="w2">{t("loan.w2")}</option>
                  <option value="self_employed">{t("loan.selfEmployed")}</option>
                  <option value="retired">{t("loan.retired")}</option>
                  <option value="other">{t("source.other")}</option>
                </select>
              </div>
            ) : null}
            {step === 5 ? (
              <p className="mt-4 text-sm text-muted-foreground">{firstName} {lastName} · {address} {city} · {t(`app.${purpose}`)} · {amount}</p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
            <div className="mt-4 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => step === 1 ? setMode("choose") : setStep(step - 1)}>{t("pipeline.back")}</Button>
              <Button type="submit">{step < 5 ? t("pipeline.next") : t("loan.openFile")}</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
