import type { EmailDraft } from "@shared/api";
import type { BrandHeadline, BrandRadius } from "@/lib/brand";
import { previewDraft, EMAIL_SAMPLE } from "@/lib/emailFill";

export interface EmailBrandView {
  name: string;
  logoUrl?: string | null;
  accent: string;
  radius: BrandRadius;
  headline: BrandHeadline;
}

export default function EmailPreview({ brand, draft, sampleName }: { brand: EmailBrandView; draft: EmailDraft; sampleName?: string }) {
  const filled = previewDraft(draft, { ...EMAIL_SAMPLE, brokerage: sampleName || brand.name });
  const cardRadius = brand.radius === "sharp" ? "8px" : brand.radius === "round" ? "28px" : "18px";
  const buttonRadius = brand.radius === "sharp" ? "6px" : brand.radius === "round" ? "999px" : "14px";
  const headlineFont = brand.headline === "sans" ? "Inter, Arial, sans-serif" : "Georgia, 'Times New Roman', serif";
  const buttonHref = /^https?:\/\//.test(filled.buttonUrl) ? filled.buttonUrl : "";
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl px-4 py-8" style={{ background: "#F3F1EC" }}>
      <div className="mx-auto max-w-[560px] text-center">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="mx-auto mb-5 h-9 max-w-[180px] object-contain" />
        ) : (
          <p className="mb-5 text-[22px] text-[#0B0F19]" style={{ fontFamily: headlineFont, fontStyle: brand.headline === "italic" ? "italic" : "normal" }}>{brand.name}</p>
        )}
        {filled.greeting ? <p className="text-[13px] text-[#78716C]">{filled.greeting}</p> : null}
        <h2 className="mt-2 text-balance text-4xl font-medium leading-tight text-[#0B0F19]" style={{ fontFamily: headlineFont, fontStyle: brand.headline === "italic" ? "italic" : "normal" }}>{filled.headline}</h2>
        <p className="mt-4 whitespace-pre-wrap text-left text-base leading-relaxed text-[#292524]">{filled.body}</p>
        {filled.buttonLabel && buttonHref ? (
          <a href={buttonHref} onClick={(event) => event.preventDefault()} className="mt-7 inline-block px-7 py-3.5 text-[15px] font-semibold text-white no-underline" style={{ background: brand.accent, borderRadius: buttonRadius }}>{filled.buttonLabel}</a>
        ) : null}
        {filled.details.length ? (
          <div className="mt-7 border border-[#E7E5E4] bg-white px-5 pb-4 pt-2 text-left" style={{ borderRadius: cardRadius }}>
            {filled.details.map((detail, index) => (
              <div key={`${detail.label}-${index}`} className="mt-4">
                <p className="text-xs uppercase tracking-wide text-[#78716C]">{detail.label}</p>
                <p className="mt-1 break-words text-base text-[#0B0F19]">{detail.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-7 text-xs leading-relaxed text-[#78716C]">{filled.footer}</p>
      </div>
    </div>
  );
}
