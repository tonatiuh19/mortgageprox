import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { EmailDraft, FlowDetail as FlowDetailType, FlowEdge, FlowEdgeType, FlowStep, FlowStepType } from "@shared/api";
import { useScreenTitle } from "@/components/portal/PortalShell";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FlowInspector from "@/components/flows/FlowInspector";
import { insertAfter, removeStep, stepSummary } from "@/components/flows/flowModel";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchFlow, fetchFlowList, fetchFlowRuns, publishFlowTemplate, saveFlow, setFlowEnabled } from "@/store/slices/flowsSlice";

const FlowCanvas = lazy(() => import("@/components/flows/FlowCanvas"));

type Draft = {
  name: string;
  description: string;
  stageId: number | null;
  enabled: boolean;
  stopOnReply: boolean;
  quietStartHour: number;
  quietEndHour: number;
  steps: FlowStep[];
  edges: FlowEdge[];
};

function fromFlow(flow: FlowDetailType): Draft {
  return {
    name: flow.name,
    description: flow.description,
    stageId: flow.stageId,
    enabled: flow.enabled,
    stopOnReply: flow.stopOnReply,
    quietStartHour: flow.quietStartHour,
    quietEndHour: flow.quietEndHour,
    steps: flow.steps,
    edges: flow.edges,
  };
}

export default function FlowDetailPage() {
  const { id = "" } = useParams();
  const flowId = Number(id);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.flows.detail);
  const runs = useAppSelector((state) => state.flows.runs);
  const list = useAppSelector((state) => state.flows.list);
  const errorKey = useAppSelector((state) => state.flows.errorKey);
  const user = useAppSelector((state) => state.auth.user);
  const [tab, setTab] = useState<"builder" | "people" | "settings">("builder");
  const [wide, setWide] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    void dispatch(fetchFlow(flowId));
    if (!list) void dispatch(fetchFlowList());
  }, [dispatch, flowId, list]);

  useEffect(() => {
    if (!detail || detail.flow.id !== flowId || dirty) return;
    setDraft(fromFlow(detail.flow));
  }, [detail, flowId, dirty]);

  useEffect(() => {
    if (tab === "people") void dispatch(fetchFlowRuns(flowId));
  }, [dispatch, flowId, tab]);

  useScreenTitle(draft?.name || "");

  if (!draft || !detail || detail.flow.id !== flowId) {
    return <p className="text-sm text-muted-foreground">{errorKey ? t(errorKey) : t("flows.loading")}</p>;
  }

  const readOnly = !detail.canEdit;
  const selectedStep = draft.steps.find((step) => step.stepKey === selected) || null;
  const brand = {
    name: user?.tenantName || "Brokerage",
    logoUrl: user?.logoUrl || null,
    accent: user?.primaryColor || "#2F4FD8",
    radius: (user?.brandRadius === "sharp" || user?.brandRadius === "round" ? user.brandRadius : "soft") as "sharp" | "soft" | "round",
    headline: (user?.brandHeadline === "sans" || user?.brandHeadline === "italic" ? user.brandHeadline : "serif") as "sans" | "serif" | "italic",
  };

  function update(next: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setDirty(true);
  }

  function changeStep(step: FlowStep) {
    update({ steps: draft.steps.map((item) => (item.stepKey === step.stepKey ? step : item)) });
  }

  function add(type: FlowStepType, branch: FlowEdgeType) {
    if (!selected) return;
    const result = insertAfter(draft.steps, draft.edges, selected, type, t(`flows.type.${type}`), branch);
    update({ steps: result.steps, edges: result.edges });
    if (result.key) setSelected(result.key);
  }

  async function onSave() {
    setBusy(true);
    const result = await dispatch(saveFlow({ id: flowId, ...draft }));
    setBusy(false);
    if (saveFlow.fulfilled.match(result)) {
      setDirty(false);
      void dispatch(fetchFlow(flowId));
    }
  }

  async function onSaveTemplate(step: FlowStep) {
    const draft = step.config as unknown as EmailDraft;
    const result = await dispatch(publishFlowTemplate({
      id: step.templateId,
      name: step.label || t("flows.template"),
      channel: "email",
      subject: String(draft.subject || step.label),
      greeting: String(draft.greeting || ""),
      headline: String(draft.headline || step.label),
      body: String(draft.body || ""),
      buttonLabel: String(draft.buttonLabel || ""),
      buttonUrl: String(draft.buttonUrl || ""),
      details: Array.isArray(draft.details) ? draft.details : [],
      footer: String(draft.footer || ""),
    }));
    if (publishFlowTemplate.fulfilled.match(result)) changeStep({ ...step, templateId: result.payload });
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4">
      <Link className="text-sm text-primary" to="/app/reminders">{t("flows.back")}</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <SectionHeader title={draft.name} />
          <p className="mt-2 text-sm text-muted-foreground">{t("flows.builderLead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <Button type="button" variant={draft.enabled ? "default" : "outline"} onClick={() => void dispatch(setFlowEnabled({ id: flowId, enabled: !draft.enabled })).then((result) => {
              if (setFlowEnabled.fulfilled.match(result)) update({ enabled: result.payload });
            })}>
              {draft.enabled ? t("flows.on") : t("flows.off")}
            </Button>
          ) : null}
          {!readOnly ? <Button type="button" disabled={busy} onClick={() => void onSave()}>{t("flows.save")}</Button> : null}
        </div>
      </div>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        {(["builder", "people", "settings"] as const).map((item) => (
          <Button key={item} type="button" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{t(`flows.tab.${item}`)}</Button>
        ))}
      </div>
      {tab === "builder" ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {wide ? (
            <Suspense fallback={<p className="text-sm text-muted-foreground">{t("flows.loading")}</p>}>
              <FlowCanvas
                steps={draft.steps}
                edges={draft.edges}
                selectedKey={selected}
                readOnly={readOnly}
                onSelect={setSelected}
                onChange={(next) => update(next)}
              />
            </Suspense>
          ) : (
            <div className="space-y-2">
              {draft.steps.map((step) => (
                <button key={step.stepKey} type="button" className={selected === step.stepKey ? "w-full rounded-2xl border border-primary bg-card p-4 text-left" : "w-full rounded-2xl border border-border bg-card p-4 text-left"} onClick={() => setSelected(step.stepKey)}>
                  <p className="text-xs text-primary">{t(`flows.type.${step.stepType}`)}</p>
                  <strong>{step.label}</strong>
                  <p className="text-sm text-muted-foreground">{stepSummary(step)}</p>
                </button>
              ))}
            </div>
          )}
          {selectedStep ? (
            <FlowInspector
              step={selectedStep}
              templates={detail.templates}
              brand={brand}
              readOnly={readOnly}
              onChange={changeStep}
              onDelete={() => {
                const next = removeStep(draft.steps, draft.edges, selectedStep.stepKey);
                update(next);
                setSelected(null);
              }}
              onAdd={add}
              onSaveTemplate={(step) => void onSaveTemplate(step)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("flows.pick")}</p>
          )}
        </div>
      ) : null}
      {tab === "people" ? (
        <ul className="space-y-2">
          {runs.length ? runs.map((run) => (
            <li key={run.id} className="rounded-2xl border border-border bg-card p-4">
              <strong>{run.clientName}</strong>
              <p className="text-sm text-muted-foreground">{t(`flows.run.${run.status}`, { defaultValue: run.status })}{run.endReason ? ` · ${run.endReason}` : ""}</p>
            </li>
          )) : <li className="text-sm text-muted-foreground">{t("flows.noPeople")}</li>}
        </ul>
      ) : null}
      {tab === "settings" ? (
        <div className="max-w-xl space-y-3">
          <Input aria-label={t("flows.name")} value={draft.name} disabled={readOnly} onChange={(event) => update({ name: event.target.value })} />
          <Textarea aria-label={t("flows.description")} value={draft.description} disabled={readOnly} onChange={(event) => update({ description: event.target.value })} />
          <select className="h-11 w-full rounded-md border border-input bg-background px-3" aria-label={t("flows.stage")} value={draft.stageId || ""} disabled={readOnly} onChange={(event) => update({ stageId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">{t("flows.noStage")}</option>
            {(list?.stages || []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.stopOnReply} disabled={readOnly} onChange={(event) => update({ stopOnReply: event.target.checked })} />
            {t("flows.stopOnReply")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input aria-label={t("flows.quietStart")} type="number" min={0} max={23} value={draft.quietStartHour} disabled={readOnly} onChange={(event) => update({ quietStartHour: Number(event.target.value) })} />
            <Input aria-label={t("flows.quietEnd")} type="number" min={0} max={23} value={draft.quietEndHour} disabled={readOnly} onChange={(event) => update({ quietEndHour: Number(event.target.value) })} />
          </div>
          <p className="text-xs text-muted-foreground">{t("flows.quietHelp")}</p>
        </div>
      ) : null}
    </div>
  );
}
