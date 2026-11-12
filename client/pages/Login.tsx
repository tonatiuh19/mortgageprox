import { FormEvent, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthError, requestOtp, verifyOtp } from "@/store/slices/authSlice";
import DevFill from "@/components/dev/DevFill";
import { cn } from "@/lib/utils";

function loginEmail(value: string | null): string {
  const email = (value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

const CODE_LENGTH = 6;
const RESEND_SEC = 5 * 60;

const POINTS = ["login.pointCode", "login.pointSeparate", "login.pointBorrower"] as const;

export default function Login() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, errorKey } = useAppSelector((state) => state.auth);
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => loginEmail(params.get("email")));
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [intent, setIntent] = useState<"send" | "verify">("send");
  const submitted = useRef("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    setIntent("send");
    const ok = await dispatch(requestOtp(email.trim()));
    if (!requestOtp.fulfilled.match(ok)) return;
    setSent(true);
    setDelivered(ok.payload);
    setCode("");
    submitted.current = "";
    setResendIn(RESEND_SEC);
  }

  async function signIn(nextCode: string) {
    if (loading || submitted.current === nextCode) return;
    submitted.current = nextCode;
    setIntent("verify");
    const ok = await dispatch(verifyOtp({ email: email.trim(), code: nextCode }));
    if (!verifyOtp.fulfilled.match(ok)) return;
    const actor = ok.payload.actor;
    navigate(actor === "platform" ? "/command" : actor === "borrower" ? "/portal" : "/app", { replace: true });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sent) {
      void sendCode();
      return;
    }
    if (code.length === CODE_LENGTH) void signIn(code);
  }

  function changeEmail() {
    setSent(false);
    setDelivered(false);
    setCode("");
    submitted.current = "";
    setResendIn(0);
    dispatch(clearAuthError());
  }

  const error = errorKey ? t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`) : "";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
      <PageMeta title={t("login.title")} description={t("login.description")} noIndex />
      <div className="flex min-w-0 flex-col bg-background">
        <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-10">
          <Link to="/" aria-label={t("login.home")} className="min-w-0"><Logo /></Link>
          <Link to="/" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {t("login.back")}
          </Link>
        </header>
        <main className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex items-start justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                <KeyRound className="size-5" />
              </span>
              <DevFill onFill={() => setEmail("alex@disruptinglabs.com")} />
            </div>
            <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{sent ? t("login.codeTitle") : t("login.title")}</h1>
            <p className="mt-3 text-muted-foreground">{sent ? t("login.sent") : t("login.description")}</p>
            {sent ? <p className="mt-2 break-all text-sm font-medium">{email}</p> : null}
            {delivered ? <p className="mt-2 text-sm text-muted-foreground">{t("login.spam")}</p> : null}
            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              {sent ? (
                <CodeBoxes
                  value={code}
                  label={t("login.code")}
                  disabled={loading}
                  onChange={(next) => {
                    setCode(next);
                    if (next.length < CODE_LENGTH) submitted.current = "";
                    if (next.length === CODE_LENGTH) void signIn(next);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    placeholder={t("login.emailPlaceholder")}
                    className="h-12 rounded-xl"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              )}
              {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" aria-busy={loading} disabled={loading || (sent && code.length < CODE_LENGTH)}>
                {loading ? (intent === "verify" ? t("login.verifying") : t("login.sending")) : sent ? t("login.verify") : t("login.send")}
              </Button>
              {sent ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    className="text-primary disabled:text-muted-foreground"
                    disabled={loading || resendIn > 0}
                    onClick={() => void sendCode()}
                  >
                    {loading && intent === "send" ? t("login.resending") : resendIn > 0 ? t("login.resendIn", { time: clock(resendIn) }) : t("login.resend")}
                  </button>
                  <button type="button" className="text-muted-foreground hover:text-foreground" disabled={loading} onClick={changeEmail}>
                    {t("login.changeEmail")}
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </main>
        <footer className="px-5 pb-8 text-sm text-muted-foreground sm:px-10">
          <p className="mx-auto w-full max-w-sm">
            {t("login.newOffice")}{" "}
            <Link to="/start" className="font-medium text-primary">{t("login.startTrial")}</Link>
          </p>
        </footer>
      </div>
      <aside className="login-stage relative hidden min-h-0 min-w-0 flex-col justify-between gap-10 overflow-y-auto p-12 xl:p-16 lg:flex">
        <p className="text-sm font-medium opacity-80">{t("login.panelEyebrow")}</p>
        <div className="max-w-xl">
          <h2 className="font-display text-5xl leading-[1.05] tracking-tight xl:text-6xl">{t("login.panelTitle")}</h2>
          <p className="mt-5 max-w-md text-base leading-relaxed opacity-75">{t("login.panelLead")}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {POINTS.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground" />
                <span className="opacity-90">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <OfficePreview />
      </aside>
    </div>
  );
}

function clock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function OfficePreview() {
  const { t } = useTranslation();
  const rows = [
    [t("login.previewNew"), t("login.previewPerson")],
    [t("login.previewProcessing"), t("login.previewFile")],
    [t("login.previewClear"), t("login.previewClose")],
  ];
  return (
    <div className="login-sheet mt-10 w-full max-w-md rounded-2xl p-5 shadow-float" aria-hidden="true">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">NW</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{t("login.previewName")}</span>
          <span className="block truncate text-xs opacity-60">{t("login.previewHost")}</span>
        </span>
      </div>
      <ul className="mt-5 space-y-2">
        {rows.map(([stage, name]) => (
          <li key={stage} className="login-row flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm">
            <span className="opacity-60">{stage}</span>
            <span className="truncate font-medium">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodeBoxes({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled: boolean;
  label: string;
}) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? "");

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled]);

  function write(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(clean);
    const target = clean.length >= CODE_LENGTH ? CODE_LENGTH - 1 : Math.min(focusIndex, clean.length);
    window.requestAnimationFrame(() => refs.current[target]?.focus());
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    event.preventDefault();
    write(text, Math.min(text.replace(/\D/g, "").length, CODE_LENGTH) - 1);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = digits.slice();
      next[index - 1] = "";
      write(next.join(""), index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => { refs.current[index] = node; }}
            aria-label={t("login.digit", { n: index + 1 })}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={index === 0 ? CODE_LENGTH : 1}
            disabled={disabled}
            value={digit}
            className={cn(
              "h-12 min-w-0 rounded-xl border border-input bg-background text-center font-display text-xl tabular-nums",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            )}
            onPaste={onPaste}
            onKeyDown={(event) => onKeyDown(index, event)}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              if (raw.length > 1) {
                write(raw, raw.length - 1);
                return;
              }
              const next = digits.slice();
              next[index] = raw;
              write(next.join(""), raw ? index + 1 : index);
            }}
          />
        ))}
      </div>
    </div>
  );
}
