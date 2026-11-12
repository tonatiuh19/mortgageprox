import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EmailDraft, TemplateItem } from "@shared/api";
import EmailEditor from "@/components/email/EmailEditor";
import type { EmailBrandView } from "@/components/email/EmailPreview";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/store/hooks";
import { fetchCommandTemplates, saveCommandTemplate } from "@/store/slices/emailSlice";

function asDraft(item: TemplateItem): EmailDraft {
  return {
    subject: item.subject || "",
    greeting: item.greeting || "",
    headline: item.headline || item.name,
    body: item.body,
    buttonLabel: item.buttonLabel || "",
    buttonUrl: item.buttonUrl || "",
    details: item.details || [],
    footer: item.footer || "",
  };
}

export default function TenantEmailEditors({ tenantId, brand }: { tenantId: number; brand: EmailBrandView }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const emails = items.filter((item) => item.channel === "email");
  const current = emails.find((item) => item.id === selected) || emails[0];

  useEffect(() => {
    void dispatch(fetchCommandTemplates(tenantId)).then((result) => {
      if (fetchCommandTemplates.fulfilled.match(result)) setItems(result.payload);
    });
  }, [dispatch, tenantId]);

  useEffect(() => {
    if (current) setDraft(asDraft(current));
  }, [current?.id]);

  async function save() {
    if (!current || !draft) return;
    setBusy(true);
    const item = { ...current, ...draft, subject: draft.subject, body: draft.body };
    const result = await dispatch(saveCommandTemplate({ tenantId, item }));
    setBusy(false);
    if (saveCommandTemplate.fulfilled.match(result)) {
      setItems((list) => list.map((row) => (row.id === item.id ? item : row)));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    }
  }

  if (!emails.length || !draft) return null;
  return (
    <section className="min-w-0 pt-6">
      <h2 className="font-display text-2xl">{t("email.tenantTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("email.tenantNote")}</p>
      {saved ? <p className="mt-2 text-sm text-primary">{t("email.saved")}</p> : null}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {emails.map((item) => (
          <Button key={item.id} type="button" variant={item.id === current.id ? "default" : "outline"} className="shrink-0" onClick={() => setSelected(item.id)}>{item.name}</Button>
        ))}
      </div>
      <div className="mt-4">
        <EmailEditor brand={brand} sampleName={brand.name} value={draft} onChange={setDraft} onSave={() => void save()} busy={busy} />
      </div>
    </section>
  );
}
