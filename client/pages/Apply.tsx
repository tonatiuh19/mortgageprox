import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LegalModal from "@/components/content/LegalModal";
import ApplyFrame from "@/components/portal/ApplyFrame";
import ApplySummary from "@/components/portal/ApplySummary";
import ApplySuccess from "@/components/portal/ApplySuccess";
import { OfficeMeta } from "@/components/PageMeta";
import PageMeta from "@/components/PageMeta";
import PageSkeleton from "@/components/portal/PageSkeleton";
import PersonWelcome from "@/components/portal/PersonWelcome";
import DevFill from "@/components/dev/DevFill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { fetchApplyDraft, fetchPublicOffice, saveApplyDraft, submitPublicApply, type PublicOffice } from "@/store/slices/workspaceSlice";

const STEPS = ["welcome", "identity", "property", "finances", "employment", "review"] as const;

export default function Apply() {
  const { t, i18n } = useTranslation();
  const { slug = "", officer: officerSlug = "" } = useParams();
  const dispatch = useAppDispatch();
  const [office, setOffice] = useState<PublicOffice | null>(null);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("purchase");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [value, setValue] = useState("");
  const [employer, setEmployer] = useState("");
  const [job, setJob] = useState("");
  const [income, setIncome] = useState("");
  const [incomeType, setIncomeType] = useState("w2");
  const [birthday, setBirthday] = useState("");
  const [saved, setSaved] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const draftKey = `mp-apply:${slug}:${officerSlug || "office"}`;
  const latest = useRef({ token: "", step: 0, firstName: "", lastName: "", email: "", phone: "", purpose: "purchase", amount: "", address: "", city: "", region: "", postal: "", value: "", employer: "", job: "", income: "", incomeType: "w2", birthday: "" });

  function fields() {
    return { firstName, lastName, email, phone, purpose, amount, address, city, region, postal, value, employer, job, income, incomeType, birthday };
  }

  function restore(nextStep: number, savedFields: Record<string, string>) {
    setStep(nextStep || 0);
    setFirstName(savedFields.firstName || "");
    setLastName(savedFields.lastName || "");
    setEmail(savedFields.email || "");
    setPhone(savedFields.phone || "");
    setPurpose(savedFields.purpose || "purchase");
    setAmount(savedFields.amount || "");
    setAddress(savedFields.address || "");
    setCity(savedFields.city || "");
    setRegion(savedFields.region || "");
    setPostal(savedFields.postal || "");
    setValue(savedFields.value || "");
    setEmployer(savedFields.employer || "");
    setJob(savedFields.job || "");
    setIncome(savedFields.income || "");
    setIncomeType(savedFields.incomeType || "w2");
    setBirthday(savedFields.birthday || "");
  }

  function keep(nextToken: string, nextStep: number, body: Record<string, string>) {
    setToken(nextToken);
    window.localStorage.setItem(draftKey, JSON.stringify({ token: nextToken, step: nextStep, payload: body }));
    window.sessionStorage.setItem(`mp-apply-${slug}`, nextToken);
    const url = new URL(window.location.href);
    if (url.searchParams.get("draft") !== nextToken) {
      url.searchParams.set("draft", nextToken);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
    setSaved(true);
  }

  latest.current = { token, step, ...fields() };

  useEffect(() => {
    void dispatch(fetchPublicOffice(officerSlug ? { slug, officer: officerSlug } : slug)).then((result) => {
      if (fetchPublicOffice.fulfilled.match(result)) setOffice(result.payload);
      else setMissing(true);
    });
    let local: { token?: string; step?: number; payload?: Record<string, string> } | null = null;
    try { local = JSON.parse(window.localStorage.getItem(draftKey) || "null"); } catch { local = null; }
    const stored = new URLSearchParams(window.location.search).get("draft") || local?.token || window.sessionStorage.getItem(`mp-apply-${slug}`) || "";
    if (!stored) {
      if (local?.payload) restore(local.step || 0, local.payload);
      return;
    }
    void dispatch(fetchApplyDraft({ slug, token: stored })).then((result) => {
      if (fetchApplyDraft.fulfilled.match(result) && result.payload) {
        setToken(result.payload.token);
        restore(result.payload.step || 0, result.payload.payload || {});
        setSaved(true);
        return;
      }
      if (local?.payload) restore(local.step || 0, local.payload);
    });
  }, [dispatch, slug, officerSlug, draftKey]);

  useEffect(() => {
    function onHide() {
      const current = latest.current;
      if (!current.email.includes("@")) return;
      const { token: nextToken, step: nextStep, ...body } = current;
      window.localStorage.setItem(draftKey, JSON.stringify({ token: nextToken, step: nextStep, payload: body }));
      void dispatch(saveApplyDraft({ slug, token: nextToken, officer: officerSlug, step: nextStep, payload: body }));
    }
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [dispatch, slug, officerSlug, draftKey]);

  function fillSample() {
    setEmail("felix@disruptinglabs.com");
    setFirstName("Felix");
    setLastName("Gomez");
    setPhone("4155550142");
    setBirthday("1986-03-14");
    setPurpose("purchase");
    setAmount("640000");
    setAddress("1 Market St");
    setCity("San Francisco");
    setRegion("CA");
    setPostal("94105");
    setValue("850000");
    setIncomeType("w2");
    setEmployer("Disrupting Labs");
    setJob("Founder");
    setIncome("180000");
    setError("");
  }

  async function remember(next: number) {
    const body = fields();
    window.localStorage.setItem(draftKey, JSON.stringify({ token, step: next, payload: body }));
    const result = await dispatch(saveApplyDraft({ slug, token, officer: officerSlug, step: next, payload: body }));
    if (saveApplyDraft.fulfilled.match(result) && result.payload) keep(result.payload, next, body);
    setStep(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 0) {
      if (!email.includes("@")) {
        setError("validation.email");
        return;
      }
      setError("");
      await remember(1);
      return;
    }
    if (step < STEPS.length - 1) {
      await remember(step + 1);
      return;
    }
    if (sending) return;
    setSending(true);
    setError("");
    const result = await dispatch(submitPublicApply({
      slug,
      officer: officerSlug,
      draftToken: token,
      firstName,
      lastName,
      email,
      phone,
      purpose,
      amountCents: Math.round((Number(amount) || 0) * 100),
      addressLine: address,
      city,
      region,
      postalCode: postal,
      propertyValueCents: Math.round((Number(value) || 0) * 100),
      employer,
      jobTitle: job,
      annualIncomeCents: Math.round((Number(income) || 0) * 100),
      incomeType,
      birthday,
      language: i18n.language.startsWith("es") ? "es" : "en",
    }));
    if (submitPublicApply.fulfilled.match(result)) {
      setWelcomed(result.payload === true);
      window.sessionStorage.removeItem(`mp-apply-${slug}`);
      window.localStorage.removeItem(draftKey);
      const url = new URL(window.location.href);
      url.searchParams.delete("draft");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      setSaved(false);
      setToken("");
      setSent(true);
    } else {
      setError(String(result.payload || "errors.server"));
      setSending(false);
    }
  }

  function startOver() {
    window.sessionStorage.removeItem(`mp-apply-${slug}`);
    window.localStorage.removeItem(draftKey);
    const url = new URL(window.location.href);
    url.searchParams.delete("draft");
    window.history.replaceState(window.history.state, "", url.pathname);
    setToken("");
    setSaved(false);
    setSending(false);
    setSent(false);
    setWelcomed(false);
    setError("");
    setStep(0);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPurpose("purchase");
    setAmount("");
    setAddress("");
    setCity("");
    setRegion("");
    setPostal("");
    setValue("");
    setEmployer("");
    setJob("");
    setIncome("");
    setIncomeType("w2");
    setBirthday("");
  }

  if (missing) return <><PageMeta title={t("meta.missingTitle")} description={t("meta.missingDescription")} noIndex /><p className="p-8 text-sm text-muted-foreground">{t("errors.notFound")}</p></>;
  if (!office) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  return (
    <div style={office.primaryColor ? { ["--primary" as string]: office.primaryColor } : undefined}>
    <OfficeMeta slug={slug} kind="apply" name={office.name} person={office.officer?.name} image={office.officer?.photoUrl || office.logoUrl} themeColor={office.primaryColor} />
    <ApplyFrame office={office} step={sent ? STEPS.length : step} saved={saved && !sent} onLegal={setLegal}>
    <form onSubmit={onSubmit}>
      {step === 0 ? (
        <div key={step} className="apply-step">
        <PersonWelcome office={office}>
          <h2 className="text-balance font-display text-[1.65rem] leading-none">{t("apply.ready")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("apply.readyLead")}</p>
          <div className="mt-5 space-y-3">
          <DevFill onFill={fillSample} />
          <label className="block text-sm font-medium" htmlFor="guest-email">{t("apply.yourEmail")}</label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="guest-email" required type="email" className="h-11 rounded-xl pl-10" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{t(error.includes(".") ? error : `errors.${error}`)}</p> : null}
          <Button className="mt-3 h-11 w-full" type="submit">{t("pipeline.next")}<ArrowRight /></Button>
          </div>
          <p className="mt-3 text-balance text-center text-xs leading-relaxed text-muted-foreground">{t("apply.welcome")}</p>
        </PersonWelcome>
        </div>
      ) : sent ? (
        <ApplySuccess name={office.officer?.name || office.name} email={welcomed ? email : ""} onAgain={startOver} />
      ) : (
        <div key={step} className={`apply-step space-y-4 ${sending ? "pointer-events-none" : ""}`}>
          <h1 className="font-display text-4xl">{t("apply.title")}</h1>
          <p className="text-muted-foreground">{t(`apply.${STEPS[step]}`)}</p>
          <DevFill onFill={fillSample} />
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
              <Input required type="email" className="sm:col-span-2" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input className="sm:col-span-2" aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input className="sm:col-span-2" type="date" aria-label={t("loan.birthday")} value={birthday} onChange={(event) => setBirthday(event.target.value)} />
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid gap-3">
              <Input aria-label={t("loan.address")} placeholder={t("loan.address")} value={address} onChange={(event) => setAddress(event.target.value)} />
              <Input aria-label={t("loan.city")} placeholder={t("loan.city")} value={city} onChange={(event) => setCity(event.target.value)} />
              <Input aria-label={t("loan.region")} placeholder={t("loan.region")} value={region} onChange={(event) => setRegion(event.target.value)} />
              <Input aria-label={t("loan.postal")} placeholder={t("loan.postal")} value={postal} onChange={(event) => setPostal(event.target.value)} />
              <Input aria-label={t("loan.value")} placeholder={t("loan.value")} value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
          ) : null}
          {step === 3 ? (
            <div className="grid gap-3">
              <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("app.purpose")} value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                <option value="purchase">{t("app.purchase")}</option>
                <option value="refinance">{t("app.refinance")}</option>
              </select>
              <Input aria-label={t("loan.amount")} placeholder={t("loan.amount")} value={amount} onChange={(event) => setAmount(event.target.value)} />
              <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.incomeType")} value={incomeType} onChange={(event) => setIncomeType(event.target.value)}>
                <option value="w2">{t("loan.w2")}</option>
                <option value="self_employed">{t("loan.selfEmployed")}</option>
                <option value="retired">{t("loan.retired")}</option>
                <option value="other">{t("source.other")}</option>
              </select>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="grid gap-3">
              <Input aria-label={t("loan.employer")} placeholder={t("loan.employer")} value={employer} onChange={(event) => setEmployer(event.target.value)} />
              <Input aria-label={t("loan.job")} placeholder={t("loan.job")} value={job} onChange={(event) => setJob(event.target.value)} />
              <Input aria-label={t("loan.income")} placeholder={t("loan.income")} value={income} onChange={(event) => setIncome(event.target.value)} />
            </div>
          ) : null}
          {step === 5 ? (
            <ApplySummary
              answers={{ firstName, lastName, email, phone, birthday, address, city, region, postal, value, purpose, amount, incomeType, employer, job, income }}
              disabled={sending}
              onEdit={(next) => void remember(next)}
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{t(error.includes(".") ? error : `errors.${error}`)}</p> : null}
          <div className={`flex gap-2 ${sending ? "pointer-events-auto" : ""}`}>
            {step > 0 ? <Button type="button" variant="outline" disabled={sending} onClick={() => void remember(step - 1)}>{t("pipeline.back")}</Button> : null}
            <Button className="flex-1 disabled:opacity-100" type="submit" disabled={sending} aria-busy={sending || undefined}>
              {sending ? <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : null}
              {sending ? t("apply.sending") : step < STEPS.length - 1 ? t("pipeline.next") : t("apply.send")}
            </Button>
          </div>
        </div>
      )}
    </form>
    </ApplyFrame>
    <LegalModal code={legal} office={slug} onClose={() => setLegal(null)} />
    </div>
  );
}
