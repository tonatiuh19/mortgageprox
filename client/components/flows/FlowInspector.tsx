import type { EmailDraft, FlowEdgeType, FlowStep, FlowStepType, TemplateItem } from "@shared/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EmailEditor from "@/components/email/EmailEditor";
import type { EmailBrandView } from "@/components/email/EmailPreview";
import { ADDABLE_STEPS, stepBranches } from "@/components/flows/flowModel";

function emailDraft(step: FlowStep): EmailDraft {
  const config = step.config;
  const details = Array.isArray(config.details) ? config.details as EmailDraft["details"] : [];
  return {
    subject: String(config.subject || ""),
    greeting: String(config.greeting || ""),
    headline: String(config.headline || ""),
    body: String(config.body || ""),
    buttonLabel: String(config.buttonLabel || ""),
    buttonUrl: String(config.buttonUrl || ""),
    details,
    footer: String(config.footer || ""),
  };
}

export default function FlowInspector({
  step,
  templates,
  brand,
  readOnly,
  onChange,
  onDelete,
  onAdd,
  onSaveTemplate,
}: {
  step: FlowStep;
  templates: TemplateItem[];
  brand: EmailBrandView;
  readOnly: boolean;
  onChange: (step: FlowStep) => void;
  onDelete: () => void;
  onAdd: (type: FlowStepType, branch: FlowEdgeType) => void;
  onSaveTemplate: (step: FlowStep) => void;
}) {
  const { t } = useTranslation();
  const patch = (config: Record<string, unknown> | EmailDraft, extra?: Partial<FlowStep>) => onChange({ ...step, ...extra, config: { ...step.config, ...config } });
  const branches = stepBranches(step.stepType);
  const channel = step.stepType === "send_sms" ? "sms" : "email";
  const choices = templates.filter((item) => item.channel === channel);

  function useTemplate(id: number) {
    const template = templates.find((item) => item.id === id);
    if (!template) return onChange({ ...step, templateId: null });
    onChange({
      ...step,
      templateId: template.id,
      config: {
        ...step.config,
        subject: template.subject || "",
        greeting: template.greeting || "",
        headline: template.headline || "",
        body: template.body,
        buttonLabel: template.buttonLabel || "",
        buttonUrl: template.buttonUrl || "",
        details: template.details || [],
        footer: template.footer || "",
      },
    });
  }

  return (
    <aside className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-primary">{t(`flows.type.${step.stepType}`)}</p>
      <Input aria-label={t("flows.label")} value={step.label} disabled={readOnly} onChange={(event) => onChange({ ...step, label: event.target.value })} />
      {step.stepType === "wait" || step.stepType === "wait_for_reply" ? (
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label={t("flows.amount")} type="number" min={0} value={String(step.config.amount ?? 1)} disabled={readOnly} onChange={(event) => patch({ amount: Number(event.target.value) })} />
          <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("flows.unit")} value={String(step.config.unit || "days")} disabled={readOnly} onChange={(event) => patch({ unit: event.target.value })}>
            <option value="minutes">{t("flows.minutes")}</option>
            <option value="hours">{t("flows.hours")}</option>
            <option value="days">{t("flows.days")}</option>
          </select>
        </div>
      ) : null}
      {step.stepType === "condition" ? (
        <select className="h-11 w-full rounded-md border border-input bg-background px-3" aria-label={t("flows.check")} value={String(step.config.check || "purpose_purchase")} disabled={readOnly} onChange={(event) => patch({ check: event.target.value })}>
          <option value="purpose_purchase">{t("flows.checkPurchase")}</option>
          <option value="purpose_refinance">{t("flows.checkRefinance")}</option>
          <option value="has_email">{t("flows.checkEmail")}</option>
          <option value="has_phone">{t("flows.checkPhone")}</option>
        </select>
      ) : null}
      {step.stepType === "notify_staff" ? (
        <Textarea aria-label={t("flows.note")} value={String(step.config.note || "")} disabled={readOnly} onChange={(event) => patch({ note: event.target.value })} />
      ) : null}
      {step.stepType === "send_sms" ? (
        <div className="space-y-3">
          <select className="h-11 w-full rounded-md border border-input bg-background px-3" aria-label={t("flows.template")} value={step.templateId || ""} disabled={readOnly} onChange={(event) => useTemplate(Number(event.target.value))}>
            <option value="">{t("flows.oneOff")}</option>
            {choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Textarea aria-label={t("flows.message")} value={String(step.config.body || "")} disabled={readOnly} onChange={(event) => patch({ body: event.target.value })} />
          <p className="text-xs text-muted-foreground">{t("flows.segments", { count: Math.max(1, Math.ceil(String(step.config.body || "").length / 160)) })}</p>
        </div>
      ) : null}
      {step.stepType === "send_email" ? (
        <div className="space-y-3">
          <select className="h-11 w-full rounded-md border border-input bg-background px-3" aria-label={t("flows.template")} value={step.templateId || ""} disabled={readOnly} onChange={(event) => useTemplate(Number(event.target.value))}>
            <option value="">{t("flows.oneOff")}</option>
            {choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <EmailEditor
            brand={brand}
            sampleName={brand.name}
            hideSave
            value={emailDraft(step)}
            onChange={(draft) => patch(draft)}
            onSave={() => undefined}
          />
          {!readOnly ? (
            <Button type="button" variant="outline" onClick={() => onSaveTemplate(step)}>{step.templateId ? t("flows.updateTemplate") : t("flows.saveTemplate")}</Button>
          ) : null}
        </div>
      ) : null}
      {!readOnly && step.stepType !== "end" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("flows.addAfter")}</p>
          {branches.map((branch) => (
            <div key={branch} className="flex flex-wrap gap-2">
              {branches.length > 1 ? <span className="pt-2 text-xs text-muted-foreground">{t(`flows.branch.${branch}`)}</span> : null}
              {ADDABLE_STEPS.map((type) => (
                <Button key={`${branch}-${type}`} type="button" variant="outline" onClick={() => onAdd(type, branch)}>{t(`flows.type.${type}`)}</Button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {!readOnly && step.stepType !== "trigger" ? (
        <Button type="button" variant="outline" onClick={onDelete}>{t("flows.remove")}</Button>
      ) : null}
    </aside>
  );
}
