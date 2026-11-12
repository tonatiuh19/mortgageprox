import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/portal/SectionHeader";

export default function ModuleLock({ title, code }: { title: string; code: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <SectionHeader title={title} />
      <p className="mt-4 text-muted-foreground">{t("app.moduleOff")}</p>
      <Link className="mt-6 inline-flex text-sm font-medium text-primary" to={`/app/modules?code=${code}`}>{t("market.open")}</Link>
    </div>
  );
}
