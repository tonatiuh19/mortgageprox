import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScreenTitle } from "@/components/portal/PortalShell";
import PageSkeleton from "@/components/portal/PageSkeleton";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import { fetchBrand, fetchLoanFile } from "@/store/slices/workspaceSlice";
import type { BrandProfile } from "@shared/api";

type LetterLoan = {
  client: { firstName: string; lastName: string };
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
  letter: { amountCents: number; maxCents: number; expiresOn: string; active: boolean; held: boolean };
};

export default function Letter() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const dispatch = useAppDispatch();
  const [loan, setLoan] = useState<LetterLoan | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [error, setError] = useState("");

  useScreenTitle(loan ? `${loan.client.firstName} ${loan.client.lastName}`.trim() : "");

  useEffect(() => {
    void dispatch(fetchLoanFile(Number(id))).then((result) => {
      if (fetchLoanFile.fulfilled.match(result)) setLoan(result.payload.loan as unknown as LetterLoan);
      else setError(String(result.payload || "errors.server"));
    });
    void dispatch(fetchBrand()).then((result) => {
      if (fetchBrand.fulfilled.match(result)) setBrand(result.payload);
    });
  }, [dispatch, id]);

  if (!loan && !error) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;
  if (!loan) return <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p>;

  const place = [loan.addressLine, loan.city, loan.region, loan.postalCode].filter(Boolean).join(", ");

  return (
    <div className="portal-rise mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button type="button" variant="outline" asChild><Link to={`/app/loans/${id}`}>{t("loan.back")}</Link></Button>
        <Button type="button" onClick={() => window.print()}>{t("loan.print")}</Button>
      </div>
      <article className="rounded-2xl border border-border bg-card p-8">
        {brand?.logoUrl ? <img src={brand.logoUrl} alt="" className="mb-4 max-h-12 max-w-[180px] object-contain" /> : null}
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{brand?.name || ""}{brand?.nmls ? ` · NMLS ${brand.nmls}` : ""}</p>
        <p className="mt-2 text-sm text-muted-foreground">{loan.letter.active ? t("loan.letterOn") : t("loan.letterOff")}</p>
        <h1 className="mt-3 font-display text-4xl">{loan.client.firstName} {loan.client.lastName}</h1>
        {place ? <p className="mt-2 text-muted-foreground">{place}</p> : null}
        <p className="mt-6 text-lg">{t("loan.letterBody", { amount: formatMoney(loan.letter.amountCents), max: formatMoney(loan.letter.maxCents) })}</p>
        <p className="mt-4 text-sm text-muted-foreground">{loan.letter.expiresOn ? t("loan.letterUntil", { date: loan.letter.expiresOn }) : t("loan.noDate")}</p>
        {loan.letter.held ? <p className="mt-4 text-sm">{t("errors.letters.hold")}</p> : null}
      </article>
    </div>
  );
}
