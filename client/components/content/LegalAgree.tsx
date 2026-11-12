import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import LegalModal from "@/components/content/LegalModal";

export default function LegalAgree({
  checked,
  onChange,
  platform = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  platform?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [page, setPage] = useState<"terms" | "privacy" | null>(null);

  return (
    <div className="flex items-start gap-2 text-sm">
      <input id={id} type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <p>
        <label htmlFor={id}>{t("billing.agree")}</label>{" "}
        <button type="button" className="underline" onClick={() => setPage("terms")}>{t("legal.terms")}</button>
        {" "}{t("billing.agreeAnd")}{" "}
        <button type="button" className="underline" onClick={() => setPage("privacy")}>{t("legal.privacy")}</button>.
      </p>
      <LegalModal code={page} platform={platform} onClose={() => setPage(null)} />
    </div>
  );
}
