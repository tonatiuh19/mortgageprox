import type { CSSProperties } from "react";

export const BRAND_ACCENTS = [
  { id: "ink", hex: "#2F4FD8" },
  { id: "harbor", hex: "#1F6F62" },
  { id: "juniper", hex: "#D4653A" },
  { id: "wine", hex: "#8C3A4B" },
  { id: "gold", hex: "#8A6A2F" },
  { id: "night", hex: "#243044" },
] as const;

export type BrandRadius = "sharp" | "soft" | "round";
export type BrandHeadline = "serif" | "sans" | "italic";

export interface BrandDirection {
  accent: string;
  radius: BrandRadius;
  headline: BrandHeadline;
}

export const DEFAULT_BRAND: BrandDirection = {
  accent: BRAND_ACCENTS[0].hex,
  radius: "soft",
  headline: "serif",
};

const RADII = new Set<BrandRadius>(["sharp", "soft", "round"]);
const HEADLINES = new Set<BrandHeadline>(["serif", "sans", "italic"]);

export function normalizeHex(value: unknown): string | null {
  let raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("#")) raw = raw.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(raw)) raw = raw.split("").map((ch) => `${ch}${ch}`).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

export function hexToHsl(hex: string): string | null {
  const normalized = normalizeHex(hex);
  const match = normalized ? /^#([0-9a-fA-F]{6})$/.exec(normalized) : null;
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  let hue = 0;
  let sat = 0;
  if (max !== min) {
    const delta = max - min;
    sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 1000) / 10}% ${Math.round(light * 1000) / 10}%`;
}

export function foregroundHex(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "#FFFFFF";
  const light = Number(hsl.split(" ")[2]?.replace("%", ""));
  return light > 62 ? "#0B0F19" : "#FFFFFF";
}

export function foregroundFor(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  const light = Number(hsl.split(" ")[2]?.replace("%", ""));
  return light > 62 ? "223 38.9% 7.1%" : "0 0% 100%";
}

export function brandVars(brand: { accent?: string | null; radius?: string | null }): CSSProperties {
  const style: Record<string, string> = {};
  if (brand.accent) {
    const hsl = hexToHsl(brand.accent);
    if (hsl) {
      style["--primary"] = hsl;
      style["--primary-foreground"] = foregroundFor(brand.accent);
      style["--ring"] = hsl;
      style["--accent"] = hsl.replace(/[\d.]+%$/, "96%");
    }
  }
  if (brand.radius === "sharp") style["--radius"] = "0.375rem";
  if (brand.radius === "soft") style["--radius"] = "0.75rem";
  if (brand.radius === "round") style["--radius"] = "1.25rem";
  return style as CSSProperties;
}

export function parseBrandDirection(value: unknown): BrandDirection | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const accent = normalizeHex(source.accent);
  const radius = String(source.radius || "") as BrandRadius;
  const headline = String(source.headline || "") as BrandHeadline;
  if (!accent || !RADII.has(radius) || !HEADLINES.has(headline)) return null;
  return { accent, radius, headline };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function radiusClasses(radius: BrandRadius): { card: string; avatar: string; button: string } {
  if (radius === "sharp") return { card: "rounded-md", avatar: "rounded-md", button: "rounded-sm" };
  if (radius === "round") return { card: "rounded-[1.75rem]", avatar: "rounded-full", button: "rounded-full" };
  return { card: "rounded-2xl", avatar: "rounded-xl", button: "rounded-xl" };
}

export function headlineClass(headline: BrandHeadline): string {
  if (headline === "sans") return "font-sans text-3xl font-semibold tracking-tight";
  if (headline === "italic") return "font-display text-3xl italic tracking-tight";
  return "font-display text-3xl tracking-tight";
}
