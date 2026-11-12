import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createBlankFlow, fetchFlowList, setFlowEnabled } from "@/store/slices/flowsSlice";

export default function Reminders() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, status, errorKey } = useAppSelector((state) => state.flows);
  const [name, setName] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    void dispatch(fetchFlowList());
  }, [dispatch]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createBlankFlow({ name, stageId: stageId ? Number(stageId) : null }));
    if (createBlankFlow.fulfilled.match(result)) navigate(`/app/reminders/${result.payload}`);
  }

  if (!list && status !== "ready") return <PageSkeleton cards={0} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl space-y-6">
      <div>
        <SectionHeader title={t("app.reminders")} />
        <p className="mt-2 text-sm text-muted-foreground">{t("flows.lead")}</p>
      </div>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {list?.canEdit ? (
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={onCreate}>
          <Input required aria-label={t("flows.name")} placeholder={t("flows.name")} value={name} onChange={(event) => setName(event.target.value)} />
          <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("flows.stage")} value={stageId} onChange={(event) => setStageId(event.target.value)}>
            <option value="">{t("flows.noStage")}</option>
            {(list.stages || []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          <Button type="submit">{t("flows.new")}</Button>
        </form>
      ) : null}
      {status === "ready" && list && !list.items.length ? <p className="text-sm text-muted-foreground">{t("flows.empty")}</p> : null}
      <div className="space-y-3">
        {(list?.items || []).map((flow) => (
          <article key={flow.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link className="font-medium text-primary" to={`/app/reminders/${flow.id}`}>{flow.name}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{flow.stageName || t("flows.noStage")} · {t("flows.stepCount", { count: flow.stepCount })}</p>
                {flow.description ? <p className="mt-2 text-sm">{flow.description}</p> : null}
              </div>
              {list?.canEdit ? (
                <Button type="button" variant={flow.enabled ? "default" : "outline"} onClick={() => void dispatch(setFlowEnabled({ id: flow.id, enabled: !flow.enabled }))}>
                  {flow.enabled ? t("flows.on") : t("flows.off")}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{flow.enabled ? t("flows.on") : t("flows.off")}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
