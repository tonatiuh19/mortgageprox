import { useEffect, useMemo, useState } from "react";
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { Building2, KeyRound, Sparkles, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import LegalAgree from "@/components/content/LegalAgree";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stripeAppearance } from "@/lib/stripeAppearance";

const PAY_BEATS = [
  { icon: Wallet, key: "wizard.beatPay" },
  { icon: Building2, key: "wizard.beatOffice" },
  { icon: Sparkles, key: "wizard.beatName" },
  { icon: KeyRound, key: "wizard.beatIn" },
] as const;

const stripeCache = new Map<string, ReturnType<typeof loadStripe>>();

function stripePromise(publishableKey: string) {
  const existing = stripeCache.get(publishableKey);
  if (existing) return existing;
  const created = loadStripe(publishableKey);
  stripeCache.set(publishableKey, created);
  return created;
}

function PayFields({ label, onPaid }: { label: string; onPaid?: () => Promise<void> }) {
  const { t } = useTranslation();
  const checkout = useCheckoutElements();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [beat, setBeat] = useState(0);
  const BeatIcon = PAY_BEATS[beat].icon;

  useEffect(() => {
    if (!pending) {
      setBeat(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setBeat((current) => (current + 1) % PAY_BEATS.length), 900);
    return () => window.clearInterval(timer);
  }, [pending]);

  async function pay() {
    if (checkout.type !== "success" || !agreed) return;
    setPending(true);
    setMessage("");
    const result = await checkout.checkout.confirm({ redirect: onPaid ? "if_required" : "always" });
    if (result.type === "error") {
      setMessage(result.error.message || "");
      setPending(false);
      return;
    }
    if (onPaid) {
      try {
        await onPaid();
      } catch {
        setMessage(t("errors.server"));
        setPending(false);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className={cn(pending && "pointer-events-none opacity-60")}>
        <PaymentElement options={{ layout: "tabs", terms: { card: "never" } }} />
      </div>
      <LegalAgree platform checked={agreed} onChange={setAgreed} disabled={pending} />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="button" className={cn("max-w-full min-w-56", pending && "h-auto min-h-11 whitespace-normal")} aria-busy={pending} disabled={pending || !agreed || checkout.type !== "success"} onClick={() => void pay()}>
        {pending ? (<><BeatIcon className="animate-pulse" />{`${t(PAY_BEATS[beat].key)}...`}</>) : label}
      </Button>
    </div>
  );
}

export default function StartFeeForm({
  publishableKey,
  clientSecret,
  accent,
  radius,
  label,
  onPaid,
}: {
  publishableKey: string;
  clientSecret: string;
  accent: string | null;
  radius: string | null;
  label: string;
  onPaid?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const stripe = useMemo(() => stripePromise(publishableKey), [publishableKey]);
  const appearance = useMemo(() => stripeAppearance(accent, radius), [accent, radius]);
  return (
    <CheckoutElementsProvider
      stripe={stripe}
      options={{
        clientSecret,
        elementsOptions: {
          appearance,
          fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }],
        },
      }}
    >
      <p className="text-sm text-muted-foreground">{t("billing.cardNote")}</p>
      <PayFields label={label} onPaid={onPaid} />
    </CheckoutElementsProvider>
  );
}
