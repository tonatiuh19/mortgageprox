import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMe } from "@/store/slices/authSlice";
import { fetchBrand, saveBrand, uploadBrandAsset } from "@/store/slices/workspaceSlice";
import OfficeMenu from "@/pages/app/OfficeMenu";
import DevFill from "@/components/dev/DevFill";
import StyleStudio from "@/components/brand/StyleStudio";
import TenantLegalEditors from "@/components/content/TenantLegalEditors";
import { DEFAULT_BRAND, type BrandDirection, type BrandHeadline, type BrandRadius } from "@/lib/brand";

export default function Settings() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const errorKey = useAppSelector((state) => state.workspace.errorKey);
  const profile = useAppSelector((state) => state.workspace.brandProfile);
  const [name, setName] = useState(user?.tenantName || "");
  const [phone, setPhone] = useState("");
  const [nmls, setNmls] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [letterHold, setLetterHold] = useState(false);
  const [supportEmail, setSupportEmail] = useState(user?.email || "");
  const [hydrated, setHydrated] = useState(false);
  const [brand, setBrand] = useState<BrandDirection>({
    accent: user?.primaryColor || DEFAULT_BRAND.accent,
    radius: user?.brandRadius === "sharp" || user?.brandRadius === "round" ? user.brandRadius as BrandRadius : "soft",
    headline: user?.brandHeadline === "sans" || user?.brandHeadline === "italic" ? user.brandHeadline as BrandHeadline : "serif",
  });
  const [customDomain, setCustomDomain] = useState(user?.customDomain || "");
  const [logoUrl, setLogoUrl] = useState<string | null>(user?.logoUrl || null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(user?.faviconUrl || null);
  const [assetBusy, setAssetBusy] = useState<"logo" | "favicon" | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const ownDomain = user?.planCode === "scale" || user?.planCode === "custom";
  const host = user?.tenantSlug ? `${user.tenantSlug}.mortgageprox.com` : "";

  useEffect(() => {
    void dispatch(fetchBrand());
  }, [dispatch]);

  useEffect(() => {
    if (hydrated || !errorKey) return;
    setHydrated(true);
  }, [errorKey, hydrated]);

  useEffect(() => {
    if (!profile || hydrated) return;
    setName(profile.name || user?.tenantName || "");
    setPhone(profile.phone || "");
    setNmls(profile.nmls || "");
    setAddressLine(profile.addressLine || "");
    setCity(profile.city || "");
    setRegion(profile.region || "");
    setPostalCode(profile.postalCode || "");
    setLetterHold(Boolean(profile.letterHold));
    setSupportEmail(profile.supportEmail || user?.email || "");
    setBrand({
      accent: profile.primaryColor || user?.primaryColor || DEFAULT_BRAND.accent,
      radius: profile.brandRadius === "sharp" || profile.brandRadius === "round" ? profile.brandRadius : "soft",
      headline: profile.brandHeadline === "sans" || profile.brandHeadline === "italic" ? profile.brandHeadline : "serif",
    });
    setCustomDomain(profile.customDomain || "");
    setLogoUrl(profile.logoUrl);
    setFaviconUrl(profile.faviconUrl);
    setHydrated(true);
  }, [profile, hydrated, user]);

  async function onAsset(kind: "logo" | "favicon", file: File | null, clear = false) {
    const max = kind === "favicon" ? 512_000 : 1_000_000;
    if (file && file.size > max) {
      setAssetError("errors.brand.large");
      return;
    }
    setAssetError(null);
    setAssetBusy(kind);
    const dataUrl = file ? await readFile(file) : undefined;
    const result = await dispatch(uploadBrandAsset(clear || !dataUrl ? { kind, clear: true } : { kind, dataUrl }));
    setAssetBusy(null);
    if (uploadBrandAsset.fulfilled.match(result)) {
      if (kind === "logo") setLogoUrl(result.payload.url);
      else setFaviconUrl(result.payload.url);
      void dispatch(fetchMe());
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(saveBrand({ name, phone, nmls, addressLine, city, region, postalCode, letterHold, supportEmail, primaryColor: brand.accent, brandRadius: brand.radius, brandHeadline: brand.headline, ...(ownDomain ? { customDomain } : {}) }));
    if (saveBrand.fulfilled.match(result)) void dispatch(fetchMe());
  }

  if (!hydrated) return <PageSkeleton cards={1} lines={5} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl">
    <form className="space-y-4" onSubmit={onSubmit}>
      <DevFill onFill={() => {
        if (!name.trim()) setName("Northwind Mortgage");
        setPhone("4155550100");
        setSupportEmail("hello@northwind.example");
        setBrand({ accent: "#D4653A", radius: "round", headline: "italic" });
      }} />
      <SectionHeader title={t("app.settings")} />
      {host ? <p className="text-sm text-muted-foreground">{t("app.mortgageproxHost", { host })}</p> : null}
      {ownDomain ? <Input aria-label={t("wizard.domain")} placeholder={t("wizard.domain")} value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} /> : null}
      <StyleStudio value={brand} onChange={setBrand} brokerageName={name || user?.tenantName || ""} firstName={user?.firstName} note={t("brand.live")} logoUrl={logoUrl} />
      <AssetField label={t("brand.logo")} hint={t("brand.logoHint")} accept="image/png,image/jpeg,image/webp" url={logoUrl} busy={assetBusy === "logo"} onFile={(file) => void onAsset("logo", file)} onClear={() => void onAsset("logo", null, true)} />
      <AssetField label={t("brand.favicon")} hint={t("brand.faviconHint")} accept="image/png,image/jpeg,image/webp,image/x-icon,.ico" url={faviconUrl} busy={assetBusy === "favicon"} onFile={(file) => void onAsset("favicon", file)} onClear={() => void onAsset("favicon", null, true)} />
      {assetError ? <p className="text-sm text-destructive">{t(assetError)}</p> : null}
      <Input aria-label={t("app.brokerageName")} value={name} onChange={(event) => setName(event.target.value)} />
      <Input aria-label={t("app.nmls")} placeholder={t("app.nmls")} value={nmls} onChange={(event) => setNmls(event.target.value)} />
      <Input aria-label={t("app.address")} placeholder={t("app.address")} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input aria-label={t("app.city")} placeholder={t("app.city")} value={city} onChange={(event) => setCity(event.target.value)} />
        <Input aria-label={t("app.region")} placeholder={t("app.region")} value={region} onChange={(event) => setRegion(event.target.value)} />
        <Input aria-label={t("app.postal")} placeholder={t("app.postal")} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={letterHold} onChange={(event) => setLetterHold(event.target.checked)} />
        <span>{t("app.letterHold")}</span>
      </label>
      <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
      <Input aria-label={t("app.supportEmail")} value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <Button type="submit">{t("app.save")}</Button>
    </form>
    <div className="mt-10">
      <TenantLegalEditors />
    </div>
    <OfficeMenu />
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AssetField({
  label,
  hint,
  accept,
  url,
  busy,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  accept: string;
  url: string | null;
  busy: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {url ? <img src={url} alt="" className="max-h-12 max-w-full object-contain" /> : null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input
          type="file"
          accept={accept}
          aria-label={label}
          disabled={busy}
          className="block w-full min-w-0 max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
        {url ? <Button type="button" variant="outline" disabled={busy} onClick={onClear}>{t("brand.removeFile")}</Button> : null}
      </div>
    </fieldset>
  );
}
