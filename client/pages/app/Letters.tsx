import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import ModuleLock from "@/components/portal/ModuleLock";
import { fetchLetterHold } from "@/store/slices/workspaceSlice";

export default function Letters() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modules = useAppSelector((state) => state.auth.user?.modules);
  const [hold, setHold] = useState<boolean | null>(null);

  useEffect(() => {
    void dispatch(fetchLetterHold()).then((result) => setHold(fetchLetterHold.fulfilled.match(result) ? result.payload : false));
  }, [dispatch]);

  if (modules && !modules.includes("letters")) return <ModuleLock title={t("letters.title")} code="letters" />;
  if (hold == null) return <PageSkeleton cards={1} lines={2} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("letters.title")} />
      <p className="mt-4 text-muted-foreground">{hold ? t("letters.holdOn") : t("letters.holdOff")}</p>
      <p className="mt-3 text-sm"><Link className="text-primary" to="/app/settings">{t("letters.change")}</Link></p>
    </div>
  );
}
