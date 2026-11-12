import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppSelector } from "@/store/hooks";

export default function ModulePage() {
  const { code = "" } = useParams();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const enabled = !!user?.modules.includes(code);
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title={t(`modules.${code}.name`, { defaultValue: code })} />
      <p className="mt-4 text-muted-foreground">{enabled ? t("app.moduleReady") : t("app.moduleLocked")}</p>
      {!enabled ? <Link className="mt-6 inline-flex text-sm font-medium text-primary" to={`/app/modules?code=${encodeURIComponent(code)}`}>{t("market.open")}</Link> : null}
      <p className="mt-3">{t(`modules.${code}.summary`, { defaultValue: "" })}</p>
    </div>
  );
}
