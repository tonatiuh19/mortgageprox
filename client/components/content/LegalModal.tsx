import { useEffect } from "react";

function withoutLeadHeading(source: string, title: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first < 0) return source;
  const heading = /^(#{1,3})\s+(.+)$/.exec(lines[first].trim());
  if (!heading || heading[2].trim().toLowerCase() !== title.trim().toLowerCase()) return source;
  return lines.slice(first + 1).join("\n").replace(/^\n+/, "");
}
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Markdown from "@/components/content/Markdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLegalPreview } from "@/store/slices/legalSlice";

export default function LegalModal({
  code,
  platform = false,
  office = "",
  onClose,
}: {
  code: "terms" | "privacy" | null;
  platform?: boolean;
  office?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preview = useAppSelector((state) => state.legal);
  const scope = office ? `office:${office}` : platform ? "platform" : "";
  const title = code === "privacy" ? t("legal.privacy") : t("legal.terms");
  const page = code === "privacy" ? "privacy" : "terms";
  const href = office ? `/${page}?office=${encodeURIComponent(office)}` : `/${page}${platform ? "?scope=platform" : ""}`;
  const current = code !== null && preview.previewCode === code && preview.previewScope === scope;

  useEffect(() => {
    if (code) void dispatch(fetchLegalPreview({ code, ...(platform ? { scope: "platform" as const } : {}), ...(office ? { office } : {}) }));
  }, [code, platform, office, dispatch]);

  return (
    <Dialog open={code !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[min(85dvh,40rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">{title}</DialogTitle>
          <DialogDescription>{t("legal.stay")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {current && preview.previewStatus === "loading" ? <p className="text-sm text-muted-foreground">{t("wizard.loading")}</p> : null}
          {current && preview.previewError ? <p className="text-sm text-destructive">{t(preview.previewError.startsWith("errors.") ? preview.previewError : `errors.${preview.previewError}`)}</p> : null}
          {current && preview.previewStatus === "ready" && !preview.previewError ? <Markdown source={withoutLeadHeading(preview.previewBody, title)} /> : null}
        </div>
        <div className="border-t border-border px-5 py-3">
          <Link to={href} target="_blank" rel="noopener noreferrer" className="text-sm underline">{t("legal.openPage")}</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
