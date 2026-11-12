import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EmailDraft, TemplateItem } from "@shared/api";
import EmailEditor from "@/components/email/EmailEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BRAND, type BrandHeadline, type BrandRadius } from "@/lib/brand";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createTemplate, fetchTemplates, saveTemplate } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";

const EMPTY: EmailDraft = {
  subject: "",
  greeting: "Hello {{firstName}},",
  headline: "",
  body: "",
  buttonLabel: "",
  buttonUrl: "",
  details: [],
  footer: "{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.",
};

function draftOf(item: TemplateItem): EmailDraft {
  return {
    subject: item.subject || "",
    greeting: item.greeting || "",
    headline: item.headline || "",
    body: item.body,
    buttonLabel: item.buttonLabel || "",
    buttonUrl: item.buttonUrl || "",
    details: item.details || [],
    footer: item.footer || "",
  };
}

export default function Templates() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const templates = useAppSelector((state) => state.records.templates);
  const loading = useAppSelector((state) => state.records.loading);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const user = useAppSelector((state) => state.auth.user);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [draft, setDraft] = useState<EmailDraft>(EMPTY);
  const [plain, setPlain] = useState("");
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const brand = {
    name: user?.tenantName || "MortgageProx",
    logoUrl: user?.logoUrl,
    accent: user?.primaryColor || DEFAULT_BRAND.accent,
    radius: (user?.brandRadius === "sharp" || user?.brandRadius === "round" ? user.brandRadius : "soft") as BrandRadius,
    headline: (user?.brandHeadline === "sans" || user?.brandHeadline === "italic" ? user.brandHeadline : "serif") as BrandHeadline,
  };

  useEffect(() => {
    void dispatch(fetchTemplates({ search }));
  }, [dispatch, search]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const body = channel === "email" ? { name, channel, ...draft, subject: draft.subject || name, headline: draft.headline || name } : { name, channel, subject: "", body: plain };
    const result = await dispatch(createTemplate(body));
    if (createTemplate.fulfilled.match(result)) {
      setName("");
      setDraft(EMPTY);
      setPlain("");
      void dispatch(fetchTemplates({ search }));
    }
  }

  async function onSave() {
    if (!editing) return;
    setBusy(true);
    const result = await dispatch(saveTemplate({ ...editing, ...draft, subject: draft.subject, body: editing.channel === "email" ? draft.body : plain }));
    setBusy(false);
    if (saveTemplate.fulfilled.match(result)) {
      setEditing(null);
      void dispatch(fetchTemplates({ search }));
    }
  }

  if (loading && templates.length === 0) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-5xl">
      <SectionHeader title={t("modules.templates.name")} tools={<Input className="section-search" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />} />
      <GridTools screen="templates" path="/api/app/templates" filename="templates.csv" query={{ search }} onApply={(next) => setSearch(next.search || "")} />
      <p className="mt-2 text-sm text-muted-foreground">{t("email.appNote")}</p>
      {editing ? (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">{editing.name}</h2>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("email.back")}</Button>
          </div>
          {editing.channel === "email" ? (
            <EmailEditor brand={brand} sampleName={brand.name} value={draft} onChange={setDraft} onSave={() => void onSave()} busy={busy} />
          ) : (
            <form className="grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); void onSave(); }}>
              <Textarea required aria-label={t("app.templateBody")} value={plain} onChange={(event) => setPlain(event.target.value)} />
              <Button type="submit">{t("email.save")}</Button>
            </form>
          )}
        </div>
      ) : (
        <form className="mt-6 grid max-w-3xl gap-3" onSubmit={onCreate}>
          <DevFill className="justify-self-start" onFill={() => {
            setName("Status note");
            setChannel("note");
            setPlain("Left a voicemail about the two documents still needed.");
          }} />
          <Input required aria-label={t("app.templateName")} placeholder={t("app.templateName")} value={name} onChange={(event) => setName(event.target.value)} />
          <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("app.channel")} value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="email">{t("email.channelEmail")}</option>
            <option value="sms">{t("email.channelSms")}</option>
            <option value="note">{t("email.channelNote")}</option>
          </select>
          {channel === "email" ? (
            <EmailEditor brand={brand} sampleName={brand.name} value={{ ...draft, headline: draft.headline || name }} onChange={setDraft} onSave={() => undefined} hideSave />
          ) : (
            <Textarea required aria-label={t("app.templateBody")} placeholder={t("app.templateBody")} value={plain} onChange={(event) => setPlain(event.target.value)} />
          )}
          {channel === "email" ? null : <Button type="submit">{t("app.addTemplate")}</Button>}
          {channel === "email" ? <Button type="submit">{t("app.addTemplate")}</Button> : null}
        </form>
      )}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {editing ? null : (
        <ul className="mt-6 space-y-2">
          {templates.map((template) => (
            <li key={template.id}>
              <button type="button" className="w-full rounded-2xl border border-border bg-card p-4 text-left" onClick={() => { setEditing(template); setDraft(draftOf(template)); setPlain(template.body); }}>
                <strong>{template.name}</strong>
                <p className="text-xs text-muted-foreground">{template.channel}</p>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm">{template.headline || template.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
