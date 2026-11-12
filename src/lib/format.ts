let CURRENCY = "PKR";
export const setCurrency = (c?: string | null) => { CURRENCY = c || "PKR"; };
export function money(v: unknown, currency = CURRENCY) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "-";
  return `${currency} ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
export function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}
export function date(v: unknown) {
  if (!v) return "-";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function dateTime(v: unknown) {
  if (!v) return "-";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysAgoIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
export const label = (s: unknown) => String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const round2Safe = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
