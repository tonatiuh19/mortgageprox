import type { Appearance } from "@stripe/stripe-js";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Payment Element colors and corners follow the brokerage, on the warm page. */
export function stripeAppearance(accent: string | null, radius: string | null): Appearance {
  const primary = accent && HEX.test(accent) ? accent : "#2F4FD8";
  const borderRadius = radius === "sharp" ? "4px" : radius === "round" ? "16px" : "12px";
  return {
    theme: "stripe",
    variables: {
      colorPrimary: primary,
      colorBackground: "#FAFAF9",
      colorText: "#0B0F19",
      colorDanger: "#9F2D2D",
      colorTextSecondary: "#57534E",
      colorTextPlaceholder: "#A8A29E",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      borderRadius,
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        border: "1px solid #E7E5E4",
        boxShadow: "none",
        backgroundColor: "#FFFFFF",
      },
      ".Input:focus": {
        border: `1px solid ${primary}`,
        boxShadow: `0 0 0 3px ${primary}33`,
      },
      ".Label": {
        fontWeight: "500",
        color: "#0B0F19",
      },
      ".Tab": {
        border: "1px solid #E7E5E4",
        boxShadow: "none",
      },
      ".Tab--selected": {
        borderColor: primary,
      },
    },
  };
}
