/** True only for `npm run dev` opened on this machine or a private LAN address. */
export function isLocalDev(
  dev = import.meta.env.DEV,
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
): boolean {
  if (!dev) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(hostname);
}

export function sampleStamp(): string {
  return Date.now().toString().slice(-6);
}

export function sampleEmail(who: string): string {
  return `${who}.${sampleStamp()}@example.com`;
}
