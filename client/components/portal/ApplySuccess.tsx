import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function ApplySuccess({ name, email = "", onAgain }: { name: string; email?: string; onAgain: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="apply-step flex flex-col items-center px-2 py-8 text-center sm:py-14">
      <span className="apply-success-ring relative grid size-24 place-items-center rounded-full bg-primary/10">
        <span className="apply-success-mark grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow">
          <Check size={32} strokeWidth={2.5} />
        </span>
      </span>
      <h1 className="mt-8 font-display text-4xl">{t("apply.sentTitle")}</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">{t("apply.sent")}</p>
      <p className="mt-2 text-sm font-medium">{t("apply.sentWith", { name })}</p>
      {email ? <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("apply.sentMail", { email })}</p> : null}
      <Button className="mt-8 h-11" type="button" onClick={onAgain}>{t("apply.again")}</Button>
    </div>
  );
}
