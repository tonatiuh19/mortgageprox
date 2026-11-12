import type { FlowEdge, FlowEdgeType, FlowStep, FlowStepType } from "@shared/api";

export const ADDABLE_STEPS: FlowStepType[] = ["send_email", "send_letter", "send_sms", "wait", "notify_staff", "condition", "wait_for_reply", "end"];

export function stepBranches(type: string): FlowEdgeType[] {
  if (type === "condition") return ["yes", "no"];
  if (type === "wait_for_reply") return ["replied", "no_reply"];
  if (type === "end") return [];
  return ["next"];
}

export function defaultConfig(type: FlowStepType): Record<string, unknown> {
  if (type === "wait" || type === "wait_for_reply") return { amount: type === "wait_for_reply" ? 2 : 1, unit: "days" };
  if (type === "condition") return { check: "purpose_purchase" };
  if (type === "notify_staff") return { note: "" };
  if (type === "send_sms") return { body: "" };
  if (type === "send_email") {
    return { subject: "", greeting: "Hello {{firstName}},", headline: "", body: "", buttonLabel: "Open your portal", buttonUrl: "{{portalUrl}}", details: [], footer: "" };
  }
  return {};
}

function key() {
  return `s${Math.random().toString(36).slice(2, 8)}`;
}

export function insertAfter(steps: FlowStep[], edges: FlowEdge[], afterKey: string, type: FlowStepType, label: string, branch: FlowEdgeType) {
  const after = steps.find((step) => step.stepKey === afterKey);
  if (!after) return { steps, edges, key: "" };
  const stepKey = key();
  const shift = branch === "no" || branch === "no_reply" ? 260 : branch === "yes" || branch === "replied" ? -260 : 0;
  const step: FlowStep = {
    stepKey,
    stepType: type,
    label,
    templateId: null,
    config: defaultConfig(type),
    x: after.x + shift,
    y: after.y + 170,
  };
  const existing = edges.find((edge) => edge.sourceKey === afterKey && edge.edgeType === branch);
  const next = edges.filter((edge) => !(edge.sourceKey === afterKey && edge.edgeType === branch));
  next.push({ sourceKey: afterKey, targetKey: stepKey, edgeType: branch });
  if (existing && type !== "end") {
    const out = stepBranches(type)[0] || "next";
    next.push({ sourceKey: stepKey, targetKey: existing.targetKey, edgeType: out });
  }
  return { steps: [...steps, step], edges: next, key: stepKey };
}

export function removeStep(steps: FlowStep[], edges: FlowEdge[], stepKey: string) {
  const step = steps.find((item) => item.stepKey === stepKey);
  if (!step || step.stepType === "trigger") return { steps, edges };
  return {
    steps: steps.filter((item) => item.stepKey !== stepKey),
    edges: edges.filter((edge) => edge.sourceKey !== stepKey && edge.targetKey !== stepKey),
  };
}

export function stepSummary(step: FlowStep): string {
  if (step.stepType === "wait" || step.stepType === "wait_for_reply") {
    return `${Number(step.config.amount) || 0} ${String(step.config.unit || "hours")}`;
  }
  if (step.stepType === "condition") return String(step.config.check || "");
  if (step.stepType === "send_email") return String(step.config.subject || step.label);
  if (step.stepType === "send_sms") return String(step.config.body || "").slice(0, 80);
  if (step.stepType === "notify_staff") return String(step.config.note || step.label);
  return step.label;
}
