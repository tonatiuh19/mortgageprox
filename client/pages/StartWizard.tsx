import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMe } from "@/store/slices/authSlice";
import { completeWizard, fetchCatalog, prepareWizardCheckout, previewWizardHost, recommendPackage, startTrial } from "@/store/slices/catalogSlice";
import StartFeeForm from "@/components/billing/StartFeeForm";
import Confetti from "@/components/motion/Confetti";
import DevFill from "@/components/dev/DevFill";
import StyleStudio from "@/components/brand/StyleStudio";
import { DEFAULT_BRAND, type BrandDirection } from "@/lib/brand";
import { sampleEmail } from "@/lib/devFill";
import { wizardModules, wizardNeedsNumbers } from "@/lib/wizard";

const SEATS = [
  { value: 3, key: "wizard.seats3" },
  { value: 10, key: "wizard.seats10" },
  { value: 25, key: "wizard.seats25" },
  { value: 40, key: "wizard.seats40" },
] as const;

const STEPS = ["wizard.stepIdentity", "wizard.stepTeam", "wizard.stepModules", "wizard.stepLook", "wizard.stepServices", "wizard.stepPlan"] as const;
const STEP_LOOK = 3;
const STEP_SERVICES = 4;
const STEP_PLAN = 5;

export default function StartWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const catalog = useAppSelector((state) => state.catalog);
  const [searchParams] = useSearchParams();
  const completedIntent = useRef(0);
  const [step, setStep] = useState(0);
  const [brokerageName, setBrokerageName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(3);
  const [modules, setModules] = useState<string[]>([]);
  const [brand, setBrand] = useState<BrandDirection>(DEFAULT_BRAND);
  const [brandLater, setBrandLater] = useState(false);
  const [twilio, setTwilio] = useState(false);
  const [customDomain, setCustomDomain] = useState(false);
  const [domain, setDomain] = useState("");
  const [pay, setPay] = useState<{ clientSecret: string; publishableKey: string; intentId: number } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const actionsRef = useRef<HTMLDivElement>(null);
  const catalogLoading = catalog.status === "idle" || catalog.status === "loading";
  const actionPlace = useActionPlace(actionsRef, step);

  useEffect(() => {
    if (catalog.status === "idle") void dispatch(fetchCatalog());
  }, [catalog.status, dispatch]);

  useEffect(() => {
    if (!catalog.startedEmail) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    void dispatch(fetchMe());
    setStep(0);
    setBrokerageName("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSeats(3);
    setModules([]);
    setBrand(DEFAULT_BRAND);
    setBrandLater(false);
    setTwilio(false);
    setCustomDomain(false);
    setDomain("");
    setPay(null);
    setPayLoading(false);
    setPayError("");
  }, [catalog.startedEmail, dispatch]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [step]);

  const selection = useMemo(
    () => ({ modules, seats, customStyles: false, twilio, customDomain }),
    [modules, seats, twilio, customDomain],
  );

  const plan = catalog.plans.find((item) => item.code === catalog.recommendation?.planCode);
  const feeDue = Boolean(plan && !plan.isQuote && plan.trialFeeCents > 0);
  const chosen = catalog.modules.filter((item) => modules.includes(item.code));

  useEffect(() => {
    if (catalog.startedEmail || step !== STEP_PLAN) return;
    void dispatch(recommendPackage(selection));
  }, [catalog.startedEmail, step, selection, dispatch]);

  const hostAsked = useRef("");
  useEffect(() => {
    const name = brokerageName.trim();
    if (catalog.startedEmail || step !== STEP_PLAN || name.length < 2 || hostAsked.current === name) return;
    hostAsked.current = name;
    void dispatch(previewWizardHost(name));
  }, [catalog.startedEmail, step, brokerageName, dispatch]);

  useEffect(() => {
    const intentId = Number(searchParams.get("intent") || 0);
    if (!intentId || completedIntent.current === intentId) return;
    completedIntent.current = intentId;
    void dispatch(completeWizard(intentId));
  }, [searchParams, dispatch]);

  useEffect(() => {
    if (catalog.startedEmail || step !== STEP_PLAN || !feeDue) return;
    let cancel = false;
    setPayLoading(true);
    setPay(null);
    setPayError("");
    void dispatch(prepareWizardCheckout({
      ...selection,
      brokerageName,
      firstName,
      lastName,
      email,
      phone,
      domain,
      ...(brandLater ? {} : { brand }),
    })).then((result) => {
      if (cancel) return;
      setPayLoading(false);
      if (prepareWizardCheckout.fulfilled.match(result)) setPay(result.payload);
      else setPayError(String(result.payload || "errors.server"));
    });
    return () => {
      cancel = true;
    };
  }, [catalog.startedEmail, step, feeDue, selection, brokerageName, firstName, lastName, email, phone, domain, brand, brandLater, dispatch]);

  const numbers = wizardNeedsNumbers(modules);
  const core = catalog.modules.filter((item) => item.category === "core");
  const optional = catalog.modules.filter((item) => item.category !== "core" && (item.code !== "transcripts" || numbers));

  useEffect(() => {
    if (numbers) return;
    setModules((current) => (current.includes("transcripts") ? wizardModules(current) : current));
    setTwilio(false);
  }, [numbers]);
  const identityReady = brokerageName.trim().length > 1 && firstName.trim() && lastName.trim() && email.includes("@");

  function toggle(code: string) {
    setModules((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  function goNext() {
    if (step === STEP_LOOK) setBrandLater(false);
    setStep((value) => value + 1);
  }

  function fillLookLater() {
    setBrandLater(true);
    setStep(STEP_SERVICES);
  }

  async function finish() {
    await dispatch(startTrial({ ...selection, brokerageName, firstName, lastName, email, phone, domain, ...(brandLater ? {} : { brand }) }));
  }

  if (catalog.startedEmail) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl min-w-0 items-center px-5 py-16 sm:px-8">
        <PageMeta title={t("wizard.readyTitle")} description={t("wizard.readyNext")} noIndex />
        <div className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-glow sm:p-12">
          <Confetti />
          <p className="relative z-10 text-sm font-medium text-primary">{t("wizard.readyKicker")}</p>
          <h1 className="relative z-10 mt-3 font-display text-5xl tracking-tight">{t("wizard.readyTitle")}</h1>
          <p className="relative z-10 mt-4 text-lg">{catalog.startedName ? t("wizard.readyOffice", { name: catalog.startedName }) : t("wizard.readyOfficePlain")}</p>
          {catalog.startedHost ? <p className="relative z-10 mt-2 break-all text-sm font-medium">{catalog.startedHost}</p> : null}
          <p className="relative z-10 mt-4 text-muted-foreground">{catalog.emailSent ? t("wizard.readyEmail", { email: catalog.startedEmail }) : t("wizard.readyEmailFailed")}</p>
          <p className="relative z-10 mt-2 text-sm text-muted-foreground">{t("wizard.readyNext")}</p>
          <Button asChild size="lg" className="relative z-10 mt-8"><Link to="/app">{t("wizard.enter")}</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <PageMeta title={t("wizard.title")} description={t("wizard.description")} />
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-primary">{t("wizard.eyebrow")}</p>
        <DevFill onFill={() => {
          setBrokerageName("Northwind Mortgage");
          setFirstName("Maya");
          setLastName("Chen");
          setEmail(sampleEmail("maya.chen"));
          setPhone("4155550148");
          setSeats(10);
          setModules((current) => (current.includes("conversations") ? current : [...current, "conversations"]));
          setTwilio(true);
        }} />
      </div>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">{t("wizard.title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("wizard.description")}</p>
      <ol className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((key, index) => (
          <li key={key} className={cn("shrink-0 rounded-full px-3 py-1 text-xs", index === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {index + 1}. {t(key)}
          </li>
        ))}
      </ol>

          {step === 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label={t("wizard.brokerageName")} value={brokerageName} onChange={setBrokerageName} />
              <Field label={t("wizard.firstName")} value={firstName} onChange={setFirstName} />
              <Field label={t("wizard.lastName")} value={lastName} onChange={setLastName} />
              <Field label={t("wizard.email")} value={email} onChange={setEmail} type="email" />
              <Field label={t("wizard.phone")} value={phone} onChange={setPhone} />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {SEATS.map((option) => (
                <button key={option.value} type="button" onClick={() => setSeats(option.value)} className={cn("rounded-2xl border p-5 text-left", seats === option.value ? "border-primary bg-accent shadow-glow" : "border-border bg-card")}>
                  <span className="font-display text-3xl tabular-nums">{option.value === 40 ? "25+" : option.value}</span>
                  <span className="mt-2 block text-sm text-muted-foreground">{t(option.key)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-8 space-y-8">
              <section>
                <h2 className="text-sm font-medium text-muted-foreground">{t("wizard.included")}</h2>
                {catalogLoading ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="wizard-skeletons" aria-busy="true" aria-label={t("wizard.loading")}>
                    {Array.from({ length: 8 }, (_, index) => <ModuleSkeleton key={index} />)}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {core.map((item) => (
                      <div key={item.code} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4">
                        <Check className="mt-0.5 size-4 text-primary" />
                        <span>
                          <strong className="block text-sm">{t(item.nameKey)}</strong>
                          <span className="text-sm text-muted-foreground">{t(item.summaryKey)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h2 className="text-sm font-medium text-muted-foreground">{t("wizard.optional")}</h2>
                {numbers || catalogLoading ? null : <p className="mt-2 text-sm text-muted-foreground">{t("wizard.numbersNote")}</p>}
                {catalogLoading ? (
                  <div className="mt-3 grid gap-2" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => <ModuleSkeleton key={index} wide />)}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {optional.map((item) => {
                      const on = modules.includes(item.code);
                      return (
                        <button key={item.code} type="button" onClick={() => toggle(item.code)} className={cn("rounded-2xl border p-4 text-left", on ? "border-primary bg-accent" : "border-border bg-card")}>
                          <strong className="block">{t(item.nameKey)}</strong>
                          <span className="mt-1 block text-sm text-muted-foreground">{t(item.summaryKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {step === STEP_LOOK ? (
            <div className="mt-8 space-y-3">
              <button type="button" onClick={fillLookLater} className={cn("w-full rounded-2xl border p-4 text-left", brandLater ? "border-primary bg-accent" : "border-border bg-card")}>
                <strong>{t("wizard.lookLater")}</strong>
                <span className="mt-1 block text-sm text-muted-foreground">{t("wizard.lookLaterNote")}</span>
              </button>
              <StyleStudio value={brand} onChange={setBrand} brokerageName={brokerageName} firstName={firstName} note={t("brand.included")} insideNote={t("brand.inside")} />
            </div>
          ) : null}

          {step === STEP_SERVICES ? (
            <div className="mt-8 space-y-3">
              <h2 className="font-display text-3xl">{t("wizard.servicesTitle")}</h2>
              {numbers ? <Service on={twilio} setOn={setTwilio} title={t("addons.twilio.name")} text={t("addons.twilio.summary")} /> : null}
              <Service on={customDomain} setOn={setCustomDomain} title={t("addons.customDomain.name")} text={t("addons.customDomain.summary")} />
              {customDomain ? <Input aria-label={t("wizard.domain")} placeholder={t("wizard.domain")} value={domain} onChange={(event) => setDomain(event.target.value)} /> : null}
            </div>
          ) : null}

          {step === STEP_PLAN && catalog.recommending ? <PlanSkeleton label={t("wizard.loading")} /> : null}

          {step === STEP_PLAN && !catalog.recommending && catalog.recommendation && plan ? (
            <article className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-glow" data-testid="wizard-plan">
              <div className="bg-foreground px-6 py-7 text-background">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-background/70">{t("wizard.recommendTitle")}</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-display text-5xl tracking-tight">{t(plan.nameKey)}</h2>
                  <p className="text-right">
                    <span className="block font-display text-4xl tabular-nums">{plan.isQuote ? t("pricing.quote") : formatMoney(plan.priceCents)}</span>
                    {!plan.isQuote ? <span className="mt-1 block text-sm text-background/70">{t("wizard.afterTrial")}</span> : null}
                  </p>
                </div>
                <p className="mt-3 max-w-xl text-sm text-background/80">{t(plan.taglineKey)}</p>
              </div>
              <div className="space-y-5 p-6">
                <ul className="space-y-2 text-sm">
                  {catalog.recommendation.reasons.map((key) => (
                    <li key={key} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{t(key)}</span></li>
                  ))}
                  {chosen.map((item) => (
                    <li key={item.code} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{t(item.nameKey)}</span></li>
                  ))}
                  {catalog.recommendation.waivedAddons.filter((code) => catalog.recommendation?.addons.includes(code)).map((code) => (
                    <li key={code} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{t("wizard.waived")}: {t(code === "custom_domain" ? "addons.customDomain.name" : "addons.twilio.name")}</span></li>
                  ))}
                  {brandLater ? <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{t("wizard.lookLaterKept")}</span></li> : null}
                </ul>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-muted/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("wizard.dueToday")}</p>
                    <p className="mt-2 font-display text-4xl tabular-nums">{plan.isQuote || plan.trialFeeCents <= 0 ? t("pricing.quote") : formatMoney(plan.trialFeeCents)}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.isQuote ? t("wizard.trialQuote") : t("wizard.creditedShort", { days: catalog.recommendation.trialDays })}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-border p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("wizard.addressLabel")}</p>
                    <div className="mt-2 break-all text-sm font-medium">{catalog.hostName === brokerageName.trim() && catalog.host ? catalog.host : <Skeleton className="h-5 w-full max-w-xs" />}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{t("wizard.addressStays")}</p>
                  </div>
                </div>
                {feeDue ? (
                  <div className="rounded-2xl border border-border p-4">
                    {payError === "errors.accountExists" && !payLoading ? (
                      <div data-testid="wizard-account-exists">
                        <h3 className="font-display text-2xl">{t("wizard.accountTitle")}</h3>
                        <p className="mt-3 text-sm text-muted-foreground">{t("wizard.accountBody")}</p>
                        <Button asChild className="mt-4">
                          <Link to="/login">{t("site.signIn")}</Link>
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-display text-2xl">{t("wizard.payTitle")}</h3>
                        {pay ? (
                          <div className="mt-4 min-h-40">
                            <StartFeeForm
                              key={pay.clientSecret}
                              publishableKey={pay.publishableKey}
                              clientSecret={pay.clientSecret}
                              accent={brandLater ? null : brand.accent}
                              radius={brandLater ? null : brand.radius}
                              label={t("wizard.payOpen", { fee: formatMoney(plan.trialFeeCents) })}
                              onPaid={async () => {
                                const result = await dispatch(completeWizard(pay.intentId));
                                if (completeWizard.rejected.match(result)) throw new Error("complete");
                              }}
                            />
                          </div>
                        ) : null}
                        {payLoading ? (
                          <div className="mt-4 space-y-3" data-testid="wizard-card-skeleton" aria-busy="true" aria-label={t("wizard.loading")}>
                            <Skeleton className="h-11 w-full rounded-xl" />
                            <Skeleton className="h-11 w-full rounded-xl" />
                            <Skeleton className="h-11 w-40 rounded-xl" />
                          </div>
                        ) : null}
                        {payError && !payLoading ? <p className="mt-4 text-sm text-destructive">{t(payError.startsWith("errors.") ? payError : `errors.${payError}`)}</p> : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          {catalog.errorKey ? <p className="mt-4 text-sm text-destructive">{t(catalog.errorKey.startsWith("errors.") ? catalog.errorKey : `errors.${catalog.errorKey}`)}</p> : null}

          {actionPlace === "visible" ? null : (
            <button type="button" className="scroll-cue" data-direction={actionPlace} onClick={() => scrollToNode(actionsRef.current)}>
              {t("wizard.scrollContinue")}
              <span className="scroll-cue-arrow" aria-hidden="true">{actionPlace === "above" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
            </button>
          )}

          <div ref={actionsRef} className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>{t("wizard.back")}</Button>
            {step < STEP_PLAN ? (
              <Button type="button" disabled={step === 0 && !identityReady} onClick={goNext}>{t("wizard.next")}</Button>
            ) : feeDue ? null : (
              <Button type="button" disabled={catalog.starting || !catalog.recommendation} onClick={() => void finish()}>{plan?.isQuote ? t("wizard.startQuote") : t("wizard.startFee")}</Button>
            )}
          </div>
    </div>
  );
}

function ModuleSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-border bg-card p-4", wide && "w-full")}>
      <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5" />
      </span>
    </div>
  );
}

function PlanSkeleton({ label }: { label: string }) {
  return (
    <article className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="wizard-plan-skeleton" aria-busy="true" aria-label={label}>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-10 w-36" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-6 h-6 w-3/5" />
    </article>
  );
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function scrollToNode(node: HTMLElement | null) {
  if (!node) return;
  node.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" });
}

function useActionPlace(ref: RefObject<HTMLElement | null>, watch: number) {
  const [place, setPlace] = useState<"visible" | "above" | "below">("visible");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setPlace("visible");
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPlace("visible");
        return;
      }
      setPlace(entry.boundingClientRect.top < 0 ? "above" : "below");
    }, { threshold: 0.85 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, watch]);
  return place;
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Service({ on, setOn, title, text }: { on: boolean; setOn: (value: boolean) => void; title: string; text: string }) {
  return (
    <button type="button" onClick={() => setOn(!on)} className={cn("w-full rounded-2xl border p-4 text-left", on ? "border-primary bg-accent" : "border-border bg-card")}>
      <strong>{title}</strong>
      <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
    </button>
  );
}
