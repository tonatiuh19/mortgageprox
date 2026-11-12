export function formatMoney(cents: number, quote = false): string {
  if (quote || cents <= 0) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
