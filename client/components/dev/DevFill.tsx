import { useTranslation } from "react-i18next";
import { isLocalDev } from "@/lib/devFill";
import { cn } from "@/lib/utils";

export default function DevFill({ onFill, className }: { onFill: () => void; className?: string }) {
  const { t } = useTranslation();
  if (!isLocalDev()) return null;
  return (
    <button
      type="button"
      onClick={onFill}
      className={cn(
        "rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      {t("dev.fill")}
    </button>
  );
}
