import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import MarkdownEditor from "@/components/content/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTenantLegal, saveTenantLegal } from "@/store/slices/tenantLegalSlice";

function PageEditor({
  code,
  value,
  busy,
  onChange,
  onSave,
}: {
  code: "terms" | "privacy";
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const title = t(code === "terms" ? "legal.terms" : "legal.privacy");
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4">
        <MarkdownEditor label={title} value={value} onChange={onChange} />
      </div>
      <div className="mt-4">
        <Button type="button" disabled={busy || value.trim().length < 1} onClick={onSave}>{t("command.saveLegal")}</Button>
      </div>
    </section>
  );
}

export default function TenantLegalEditors({ tenantId }: { tenantId?: number }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { terms, privacy, drafts, saved, errorKey, tenantId: loadedId } = useAppSelector((state) => state.tenantLegal);
  const [termsBody, setTermsBody] = useState("");
  const [privacyBody, setPrivacyBody] = useState("");
  const [busy, setBusy] = useState<"terms" | "privacy" | null>(null);
  const wanted = tenantId ?? null;
  const hydrated = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (drafts === "idle" || loadedId !== wanted) void dispatch(fetchTenantLegal(tenantId ? { tenantId } : undefined));
  }, [drafts, dispatch, loadedId, tenantId, wanted]);

  useEffect(() => {
    if (drafts !== "ready" || loadedId !== wanted || hydrated.current === wanted) return;
    hydrated.current = wanted;
    setTermsBody(terms);
    setPrivacyBody(privacy);
  }, [drafts, loadedId, wanted, terms, privacy]);

  async function save(code: "terms" | "privacy", body: string) {
    setBusy(code);
    await dispatch(saveTenantLegal({ code, body, ...(tenantId ? { tenantId } : {}) }));
    setBusy(null);
  }

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h2 className="font-display text-3xl">{t(tenantId ? "command.tenantLegal" : "command.legal")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(tenantId ? "command.tenantLegalNote" : "legal.tenantNote")}</p>
        {saved ? <p className="mt-2 text-sm text-primary">{t("command.saved")}</p> : null}
        {errorKey ? <p className="mt-2 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      </div>
      <PageEditor code="terms" value={termsBody} busy={busy === "terms"} onChange={setTermsBody} onSave={() => void save("terms", termsBody)} />
      <PageEditor code="privacy" value={privacyBody} busy={busy === "privacy"} onChange={setPrivacyBody} onSave={() => void save("privacy", privacyBody)} />
    </div>
  );
}
