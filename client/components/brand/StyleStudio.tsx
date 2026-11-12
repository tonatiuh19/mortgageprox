import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  BRAND_ACCENTS,
  type BrandDirection,
  type BrandHeadline,
  type BrandRadius,
  brandVars,
  foregroundHex,
  headlineClass,
  initials,
  normalizeHex,
  radiusClasses,
} from "@/lib/brand";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RADII: BrandRadius[] = ["sharp", "soft", "round"];
const HEADLINES: BrandHeadline[] = ["serif", "sans", "italic"];

export default function StyleStudio({
  value,
  onChange,
  brokerageName,
  firstName,
  note,
  insideNote,
  logoUrl,
}: {
  value: BrandDirection;
  onChange: (next: BrandDirection) => void;
  brokerageName: string;
  firstName?: string;
  note?: string;
  insideNote?: string;
  logoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const shape = radiusClasses(value.radius);
  const name = brokerageName.trim() || t("brand.sampleBrokerage");
  const welcomeName = firstName?.trim() || name.split(" ")[0];
  const previewStyle = brandVars(value) as CSSProperties;
  const [hexDraft, setHexDraft] = useState(value.accent);
  const [hexTouched, setHexTouched] = useState(false);
  useEffect(() => {
    setHexDraft(value.accent);
  }, [value.accent]);
  const parsedHex = normalizeHex(hexDraft);
  const hexInvalid = hexTouched && hexDraft.trim() !== "" && !parsedHex;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-glow" aria-label={t("brand.title")}>
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-display text-2xl tracking-tight">{t("brand.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("brand.lead")}</p>
      </div>
      <div className="grid min-w-0 gap-5 p-5 md:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">{t("brand.color")}</legend>
            {insideNote ? <p className="mt-1 text-sm text-muted-foreground">{insideNote}</p> : null}
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label={t("brand.customColor")}
                value={(normalizeHex(value.accent) || BRAND_ACCENTS[0].hex).toLowerCase()}
                onChange={(event) => {
                  const next = normalizeHex(event.target.value);
                  if (!next) return;
                  setHexTouched(false);
                  onChange({ ...value, accent: next });
                }}
                className="size-11 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-full border border-black/10 bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <Input
                aria-label={t("brand.hex")}
                value={hexDraft}
                spellCheck={false}
                autoCapitalize="characters"
                onBlur={() => setHexTouched(true)}
                onChange={(event) => {
                  const next = event.target.value.slice(0, 7);
                  setHexDraft(next);
                  const parsed = normalizeHex(next);
                  if (parsed) onChange({ ...value, accent: parsed });
                }}
                className="w-[9.5rem] max-w-full font-mono uppercase"
              />
            </div>
            {hexInvalid ? <p className="mt-1 text-sm text-destructive">{t("brand.hexInvalid")}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {BRAND_ACCENTS.map((swatch) => {
                const on = swatch.hex.toLowerCase() === value.accent.toLowerCase();
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    aria-label={t(`brand.colors.${swatch.id}`)}
                    aria-pressed={on}
                    onClick={() => onChange({ ...value, accent: swatch.hex })}
                    className={cn("size-11 rounded-full border border-black/10 transition-transform", on && "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                    style={{ background: swatch.hex }}
                  />
                );
              })}
            </div>
          </fieldset>
          <Choice
            legend={t("brand.corners")}
            value={value.radius}
            options={RADII.map((id) => ({ id, label: t(`brand.${id}`) }))}
            onPick={(radius) => onChange({ ...value, radius })}
          />
          <Choice
            legend={t("brand.headline")}
            value={value.headline}
            options={HEADLINES.map((id) => ({ id, label: t(`brand.${id}`) }))}
            onPick={(headline) => onChange({ ...value, headline })}
          />
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
        <div className="min-w-0" style={previewStyle} data-testid="style-preview">
          <div className={cn("overflow-hidden border border-border bg-background shadow-card", shape.card)}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="ml-2 min-w-0 truncate rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
                {t("brand.previewHost")}
              </span>
            </div>
            <div className="p-5">
              <div className="flex min-w-0 items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-9 max-w-[9rem] object-contain" />
                ) : (
                  <span className={cn("flex size-9 shrink-0 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground", shape.avatar)}>
                    {initials(name)}
                  </span>
                )}
                <span className="min-w-0 truncate font-semibold">{name}</span>
              </div>
              <h4 className={cn("mt-8", headlineClass(value.headline))}>{t("brand.welcome", { name: welcomeName })}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{t("brand.moving")}</p>
              <div className="mt-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("brand.step")}</span>
                  <span className="tabular-nums">{t("brand.progress")}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-full w-2/3 rounded-full bg-primary" />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn("inline-flex h-11 appearance-none items-center px-5 text-sm font-medium", shape.button)}
                  style={{ background: value.accent, color: foregroundHex(value.accent) }}
                >
                  {t("brand.upload")}
                </button>
                <button
                  type="button"
                  className={cn("inline-flex h-11 appearance-none items-center border border-border bg-background px-5 text-sm font-medium", shape.button)}
                >
                  {t("brand.message")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Choice<T extends string>({
  legend,
  value,
  options,
  onPick,
}: {
  legend: string;
  value: T;
  options: { id: T; label: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            onClick={() => onPick(option.id)}
            className={cn(
              "min-w-0 rounded-xl border px-2 py-2 text-sm",
              option.id === value ? "border-primary bg-accent text-foreground" : "border-border bg-background text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
