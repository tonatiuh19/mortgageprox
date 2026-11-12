import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MarkdownEditor from "@/components/content/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLegalDrafts, saveLegalPage } from "@/store/slices/legalSlice";

function Editor({ code, value, onChange }: { code: "terms" | "privacy"; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const title = t(code === "terms" ? "legal.terms" : "legal.privacy");

  async function save() {
    setBusy(true);
    await dispatch(saveLegalPage({ code, body: value }));
    setBusy(false);
  }

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4">
        <MarkdownEditor label={title} value={value} onChange={onChange} />
      </div>
      <div className="mt-4">
        <Button type="button" disabled={busy || value.trim().length < 1} onClick={() => void save()}>{t("command.saveLegal")}</Button>
      </div>
    </section>
  );
}

export default function LegalPages() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { terms, privacy, drafts, saved, errorKey } = useAppSelector((state) => state.legal);
  const [termsBody, setTermsBody] = useState("");
  const [privacyBody, setPrivacyBody] = useState("");

  useEffect(() => {
    if (drafts === "idle") void dispatch(fetchLegalDrafts());
  }, [drafts, dispatch]);

  useEffect(() => {
    if (drafts === "ready") {
      setTermsBody(terms);
      setPrivacyBody(privacy);
    }
  }, [drafts, terms, privacy]);

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-tight">{t("command.legal")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("command.legalNote")}</p>
        {saved ? <p className="mt-2 text-sm text-primary">{t("command.saved")}</p> : null}
        {errorKey ? <p className="mt-2 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      </div>
      <Editor code="terms" value={termsBody} onChange={setTermsBody} />
      <Editor code="privacy" value={privacyBody} onChange={setPrivacyBody} />
    </div>
  );
}
