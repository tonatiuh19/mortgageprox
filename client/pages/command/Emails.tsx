import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EmailDraft, PlatformEmailItem } from "@shared/api";
import EmailEditor from "@/components/email/EmailEditor";
import { Button } from "@/components/ui/button";
import { DEFAULT_BRAND } from "@/lib/brand";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearEmailSaved, fetchPlatformEmails, savePlatformEmail } from "@/store/slices/emailSlice";

const PLATFORM_BRAND = { name: "MortgageProx", logoUrl: null, accent: DEFAULT_BRAND.accent, radius: DEFAULT_BRAND.radius, headline: DEFAULT_BRAND.headline };

export default function Emails() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { platform, status, saved, errorKey } = useAppSelector((state) => state.emails);
  const [code, setCode] = useState("sign_in");
  const [drafts, setDrafts] = useState<Record<string, EmailDraft>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "idle") void dispatch(fetchPlatformEmails());
  }, [status, dispatch]);

  useEffect(() => {
    if (status !== "ready") return;
    setDrafts(Object.fromEntries(platform.map((email) => [email.code, email])));
  }, [status, platform]);

  const current = drafts[code];

  async function save() {
    if (!current) return;
    setBusy(true);
    await dispatch(savePlatformEmail({ code, ...current } as PlatformEmailItem));
    setBusy(false);
    window.setTimeout(() => dispatch(clearEmailSaved()), 1500);
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
      <h1 className="font-display text-4xl tracking-tight">{t("email.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("email.note")}</p>
      {saved ? <p className="mt-2 text-sm text-primary">{t("email.saved")}</p> : null}
      {errorKey ? <p className="mt-2 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {["sign_in", "workspace_ready", "invite", "transcript"].map((item) => (
          <Button key={item} type="button" variant={item === code ? "default" : "outline"} className="shrink-0" onClick={() => setCode(item)}>{t(`email.${item}`)}</Button>
        ))}
      </div>
      {current ? (
        <div className="mt-6">
          <EmailEditor brand={PLATFORM_BRAND} value={current} onChange={(next) => setDrafts((items) => ({ ...items, [code]: next }))} onSave={() => void save()} busy={busy} />
        </div>
      ) : null}
    </div>
  );
}
