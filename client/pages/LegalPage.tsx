import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Markdown from "@/components/content/Markdown";
import PageMeta from "@/components/PageMeta";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLegalPage } from "@/store/slices/legalSlice";

export default function LegalPage({ code }: { code: "terms" | "privacy" }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const scope = params.get("scope") === "platform" ? "platform" : undefined;
  const office = params.get("office") || undefined;
  const dispatch = useAppDispatch();
  const { body, status, errorKey } = useAppSelector((state) => state.legal);

  useEffect(() => {
    void dispatch(fetchLegalPage({ code, scope, office }));
  }, [code, scope, office, dispatch]);

  const title = code === "privacy" ? t("legal.privacy") : t("legal.terms");
  const host = useAppSelector((state) => state.legal.host);
  const platform = scope === "platform" || !host;
  const hostname = window.location.hostname.replace(/^www\./, "");
  const domain = (host?.customDomain || "").replace(/^www\./, "");
  const officeCopy = !platform && Boolean(host);
  const indexable = platform || Boolean(domain && hostname === domain);
  return (
    <div className="mx-auto min-w-0 max-w-3xl px-5 py-12 sm:px-8">
      <PageMeta
        title={title}
        description={t("meta.legalDescription")}
        siteName={officeCopy ? host?.name : undefined}
        noIndex={!indexable}
      />
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {status === "loading" ? <p className="text-sm text-muted-foreground">{t("wizard.loading")}</p> : null}
      {status === "ready" && !errorKey ? <Markdown source={body} /> : null}
    </div>
  );
}
