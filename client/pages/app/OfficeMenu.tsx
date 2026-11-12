import { FormEvent, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BROKER_ROLES } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchOfficeMenu, fetchOfficeNav, saveOfficeMenu, setRoles, setSections } from "@/store/slices/recordsSlice";

export default function OfficeMenu({ tenantId = null }: { tenantId?: number | null }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { sections, roles, notice, errorKey } = useAppSelector((state) => state.records);

  useEffect(() => {
    void dispatch(fetchOfficeMenu(tenantId));
  }, [dispatch, tenantId]);

  function patchSection(id: string, patch: { customLabel?: string; hidden?: boolean }) {
    dispatch(setSections(sections.map((section) => (section.id === id ? { ...section, ...patch } : section))));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(saveOfficeMenu({ tenantId, sections, roles }));
    if (saveOfficeMenu.fulfilled.match(result) && tenantId == null) void dispatch(fetchOfficeNav());
  }

  function toggleRole(role: string, sectionId: string) {
    dispatch(setRoles(roles.map((row) => (row.role === role && row.sectionId === sectionId ? { ...row, visible: !row.visible } : row))));
  }

  return (
    <form className="mt-10 space-y-4" onSubmit={onSubmit}>
      <h2 className="font-display text-3xl">{t("app.menu")}</h2>
      <p className="text-sm text-muted-foreground">{t("app.menuHelp")}</p>
      {sections.map((section) => (
        <article key={section.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>{section.customLabel || t(section.labelKey)}</strong>
            {!section.entitled && tenantId == null ? <Link className="text-xs text-primary" to="/app/modules">{t("app.notInPlan")}</Link> : null}
            {!section.entitled && tenantId != null ? <span className="text-xs text-muted-foreground">{t("app.notInPlan")}</span> : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              aria-label={t("app.customName")}
              placeholder={t(section.labelKey)}
              value={section.customLabel || ""}
              onChange={(event) => patchSection(section.id, { customLabel: event.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={section.hidden}
                onChange={(event) => patchSection(section.id, { hidden: event.target.checked })}
              />
              {t("app.hideSection")}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {BROKER_ROLES.map((role) => {
              const row = roles.find((item) => item.role === role && item.sectionId === section.id);
              return (
                <label key={role} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(row?.visible)} onChange={() => toggleRole(role, section.id)} />
                  {t(`role.${role}`)}
                </label>
              );
            })}
          </div>
        </article>
      ))}
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{t(notice)}</p> : null}
      <Button type="submit">{t("app.saveMenu")}</Button>
    </form>
  );
}
