import type { EmailDetail, EmailDraft } from "@shared/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EmailPreview, { type EmailBrandView } from "@/components/email/EmailPreview";

export default function EmailEditor({
  brand,
  sampleName,
  value,
  onChange,
  onSave,
  busy,
  hideSave,
}: {
  brand: EmailBrandView;
  sampleName?: string;
  value: EmailDraft;
  onChange: (next: EmailDraft) => void;
  onSave: () => void;
  busy?: boolean;
  hideSave?: boolean;
}) {
  const { t } = useTranslation();
  function patch(partial: Partial<EmailDraft>) {
    onChange({ ...value, ...partial });
  }
  function setDetail(index: number, partial: Partial<EmailDetail>) {
    patch({ details: value.details.map((detail, item) => (item === index ? { ...detail, ...partial } : detail)) });
  }
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-muted-foreground">{t("email.tokens")}</p>
        <Input aria-label={t("email.subject")} placeholder={t("email.subject")} value={value.subject} onChange={(event) => patch({ subject: event.target.value })} />
        <Input aria-label={t("email.greeting")} placeholder={t("email.greeting")} value={value.greeting} onChange={(event) => patch({ greeting: event.target.value })} />
        <Input aria-label={t("email.headline")} placeholder={t("email.headline")} value={value.headline} onChange={(event) => patch({ headline: event.target.value })} />
        <Textarea aria-label={t("email.body")} placeholder={t("email.body")} value={value.body} onChange={(event) => patch({ body: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label={t("email.button")} placeholder={t("email.button")} value={value.buttonLabel} onChange={(event) => patch({ buttonLabel: event.target.value })} />
          <Input aria-label={t("email.buttonUrl")} placeholder={t("email.buttonUrl")} value={value.buttonUrl} onChange={(event) => patch({ buttonUrl: event.target.value })} />
        </div>
        <div className="space-y-2">
          <p className="text-sm">{t("email.details")}</p>
          {value.details.map((detail, index) => (
            <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label={t("email.detailLabel")} value={detail.label} onChange={(event) => setDetail(index, { label: event.target.value })} />
              <Input aria-label={t("email.detailValue")} value={detail.value} onChange={(event) => setDetail(index, { value: event.target.value })} />
              <Button type="button" variant="outline" onClick={() => patch({ details: value.details.filter((_, item) => item !== index) })}>{t("email.removeDetail")}</Button>
            </div>
          ))}
          {value.details.length < 6 ? (
            <Button type="button" variant="outline" onClick={() => patch({ details: [...value.details, { label: "", value: "" }] })}>{t("email.addDetail")}</Button>
          ) : null}
        </div>
        <Textarea aria-label={t("email.footer")} placeholder={t("email.footer")} value={value.footer} onChange={(event) => patch({ footer: event.target.value })} />
        {hideSave ? null : <Button type="button" disabled={busy || value.subject.trim().length < 1 || value.headline.trim().length < 1 || value.body.trim().length < 1} onClick={onSave}>{t("email.save")}</Button>}
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-sm text-muted-foreground">{t("email.preview")}</p>
        <EmailPreview brand={brand} draft={value} sampleName={sampleName} />
      </div>
    </div>
  );
}
