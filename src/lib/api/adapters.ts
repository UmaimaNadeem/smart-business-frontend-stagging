/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Normalizes real Laravel responses into the shapes the screens use (the same shapes the
 * mock returns and API_CONTRACT.md documents). Every mapper is defensive: unknown fields pass
 * through untouched and missing ones get safe defaults, so the UI works against both.
 */
type Json = any;
type LiveGet = (path: string, query?: Record<string, string | number>) => Promise<Json>;

const num = (v: any, d = 0) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v));
const nameOf = (v: any) => (v && typeof v === "object" ? v.name ?? null : v ?? null);

/* ------------------------------------------------------------ defensive extractors (ported from the old frontend) */
const PREFERRED = ["products", "purchases", "inwards", "outwards", "sales", "companies", "businesses", "roles", "users",
  "invitations", "members", "permissions", "items", "records", "results", "list", "data"];
const SKIP = new Set(["links", "meta", "pagination", "message", "success"]);

function findObjectArray(v: any, depth = 0): any[] | null {
  if (depth > 5 || !v || typeof v !== "object") return null;
  if (Array.isArray(v)) return v.length === 0 || typeof v[0] === "object" ? v : null;
  for (const [k, child] of Object.entries(v)) {
    if (SKIP.has(k)) continue;
    const hit = findObjectArray(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export function extractListDeep<T>(res: any): T[] {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== "object") return [];
  for (const k of PREFERRED) if (Array.isArray(res[k])) return res[k];
  if (res.data && typeof res.data === "object") {
    if (Array.isArray(res.data)) return res.data;
    for (const k of PREFERRED) if (Array.isArray(res.data[k])) return res.data[k];
  }
  return (findObjectArray(res) as T[]) ?? [];
}

export function extractItem<T>(res: any): T {
  return res && typeof res === "object" && res.data && typeof res.data === "object" && !Array.isArray(res.data) ? res.data : res;
}

/** Replaces the list inside an envelope, keeping the envelope (totals, pagination) intact. */
function mapListIn(res: any, fn: (r: any) => any): any {
  if (Array.isArray(res)) return res.map(fn);
  if (!res || typeof res !== "object") return res;
  for (const k of PREFERRED.filter((k) => k !== "data")) if (Array.isArray(res[k])) return { ...res, [k]: res[k].map(fn) };
  if (Array.isArray(res.data)) return { ...res, data: res.data.map(fn) };
  if (res.data && typeof res.data === "object") return { ...res, data: mapListIn(res.data, fn) };
  return res;
}
function mapItemIn(res: any, fn: (r: any) => any): any {
  if (res && typeof res === "object" && res.data && typeof res.data === "object" && !Array.isArray(res.data)) return { ...res, data: fn(res.data) };
  return fn(res);
}

/* ------------------------------------------------------------ entities */
const PURCHASE_STATUS: Record<string, string> = { pending: "draft" };
const SALE_STATUS: Record<string, string> = { pending: "draft", out_for_delivery: "dispatched", completed: "delivered" };
const FLOW_STATUS: Record<string, string> = { completed: "received", out_for_delivery: "dispatched" };

export function normProduct(p: any) {
  if (!p || typeof p !== "object") return p;
  const stock = num(p.current_stock ?? p.stock ?? p.opening_stock);
  const min = num(p.min_stock_alert);
  const status = p.status === 1 || p.status === true || p.status === "1" ? "active" : p.status === 0 || p.status === false || p.status === "0" ? "inactive" : p.status ?? "active";
  return {
    ...p,
    selling_price: num(p.selling_price ?? p.price),
    cost_price: num(p.cost_price),
    opening_stock: num(p.opening_stock),
    current_stock: stock,
    min_stock_alert: min,
    business: nameOf(p.business) ?? p.business_name ?? null,
    business_name: p.business_name ?? nameOf(p.business),
    unit: nameOf(p.unit) ?? p.unit ?? null,
    status,
    is_low_stock: p.is_low_stock ?? (min > 0 && stock <= min),
  };
}

function normLine(l: any) {
  const qty = num(l.quantity ?? l.ordered_quantity);
  const price = num(l.unit_price ?? l.price);
  return {
    ...l,
    product_name: l.product_name ?? l.product?.name ?? (l.product_id ? `Product #${l.product_id}` : "—"),
    sku: l.sku ?? l.product?.sku ?? null,
    unit: l.unit ?? nameOf(l.product?.unit) ?? null,
    quantity: qty,
    unit_price: price,
    discount: num(l.discount),
    tax_rate: num(l.tax_rate),
    total: num(l.total ?? l.total_price ?? l.line_total, qty * price),
    received_quantity: num(l.received_quantity),
    returned_quantity: num(l.returned_quantity),
  };
}

function normFlow(f: any, kind: "inward" | "outward", parentItems?: any[]) {
  if (!f || typeof f !== "object") return f;
  const doc = kind === "inward" ? f.purchase : f.sale;
  const srcItems: any[] = parentItems ?? doc?.items ?? [];
  const items = (f.items ?? []).map((l: any) => {
    const ordered = num(l.ordered_quantity ?? srcItems.find((s) => s.product_id === l.product_id)?.quantity ?? l.quantity);
    const received = num(l.received_quantity ?? (kind === "outward" ? l.quantity : 0));
    return { ...l, product_name: l.product_name ?? l.product?.name ?? `Product #${l.product_id}`, sku: l.sku ?? l.product?.sku ?? null,
      ordered_quantity: ordered, received_quantity: received, pending_quantity: Math.max(0, ordered - received), quantity: num(l.quantity ?? ordered) };
  });
  const base = {
    ...f,
    status: FLOW_STATUS[f.status] ?? f.status,
    business: nameOf(f.business) ?? nameOf(doc?.business),
    warehouse: nameOf(f.warehouse) ?? null,
    items,
    total_ordered: items.reduce((s: number, l: any) => s + l.ordered_quantity, 0),
    total_received: items.reduce((s: number, l: any) => s + l.received_quantity, 0),
    total_quantity: items.reduce((s: number, l: any) => s + l.quantity, 0),
  };
  if (kind === "inward") return { ...base, purchase_no: f.purchase_no ?? doc?.invoice_no ?? null, supplier_name: f.supplier_name ?? nameOf(doc?.supplier) ?? null, purchase_date: doc?.purchase_date ?? null };
  return { ...base, sale_no: f.sale_no ?? doc?.invoice_no ?? null, customer_name: f.customer_name ?? nameOf(doc?.customer) ?? "Walk-in", sale_date: doc?.sale_date ?? null, total_amount: num(doc?.total_amount) };
}

export function normDoc(d: any, kind: "purchase" | "sale") {
  if (!d || typeof d !== "object") return d;
  if (kind === "purchase" && d.purchase && typeof d.purchase === "object" && !d.id) d = { ...d.purchase, ...d, purchase: undefined };
  if (kind === "sale" && d.sale && typeof d.sale === "object" && !d.id) d = { ...d.sale, ...d, sale: undefined };
  const total = num(d.total_amount);
  const status = (kind === "purchase" ? PURCHASE_STATUS : SALE_STATUS)[d.status] ?? d.status ?? "draft";
  const billed = num(d.billed_amount, status === "draft" || status === "cancelled" ? 0 : total);
  const paid = num(d.paid_amount);
  const items = Array.isArray(d.items) ? d.items.map(normLine) : [];
  const out: any = {
    ...d,
    live_status: d.status,
    status,
    invoice_no: d.invoice_no ?? d.number ?? `#${d.id}`,
    business: nameOf(d.business) ?? d.business_name ?? null,
    warehouse: nameOf(d.warehouse) ?? null,
    subtotal: num(d.subtotal, total),
    discount_amount: num(d.discount_amount),
    tax_amount: num(d.tax_amount),
    total_amount: total,
    billed_amount: billed,
    paid_amount: paid,
    returned_amount: num(d.returned_amount),
    outstanding_amount: num(d.outstanding_amount, Math.max(0, billed - paid)),
    payment_status: d.payment_status ?? (billed === 0 ? "not_billed" : paid >= billed ? "paid" : paid > 0 ? "partial" : "unpaid"),
    items,
    total_items: d.total_items ?? items.length,
    payments: d.payments ?? [],
    returns: d.returns ?? [],
    journals: d.journals ?? [],
  };
  if (kind === "purchase") {
    out.supplier_id = d.supplier_id ?? d.supplier?.id ?? null;
    out.supplier_name = d.supplier_name ?? nameOf(d.supplier) ?? (out.supplier_id ? `Supplier #${out.supplier_id}` : "—");
    if (d.inward) out.inward = normFlow(d.inward, "inward", d.items);
  } else {
    out.customer_id = d.customer_id ?? d.customer?.id ?? null;
    out.customer_name = d.customer_name ?? nameOf(d.customer) ?? "Walk-in";
    if (d.outward) out.outward = normFlow(d.outward, "outward", d.items);
  }
  return out;
}

function normUser(u: any) {
  if (!u || typeof u !== "object") return u;
  const names = (v: any) => (Array.isArray(v) ? v.map((x) => nameOf(x)).filter((x) => x && x !== "Not Assigned") : []);
  return {
    ...u,
    roles: names(u.roles),
    companies: names(u.companies),
    businesses: names(u.businesses),
    assignments: Array.isArray(u.assignments) ? u.assignments.map((a: any) => ({ ...a, role: a.role ?? a.role_name, business: a.business ?? a.business_name ?? null })) : [],
    email_verified: u.email_verified ?? !!u.email_verified_at,
    status: u.status ?? "active",
  };
}

/* ------------------------------------------------------------ dispatcher */
/**
 * `pattern` is the matched route from routing.ts. `get` performs extra live GETs when the
 * backend splits data the screen needs (e.g. ordered quantities live on the purchase).
 */
export async function adaptLive(method: string, pattern: string, res: Json, get: LiveGet): Promise<Json> {
  try {
    if (pattern.startsWith("/products/")) {
      return method === "GET" ? mapListIn(res, normProduct) : mapItemIn(res, (x) => (x?.product ? { ...x, product: normProduct(x.product) } : normProduct(x)));
    }
    if (pattern === "/purchases/inwards/pending") return mapListIn(res, (f) => normFlow(f, "inward"));
    if (pattern === "/purchases/inwards/:id" && method === "GET") {
      const inward = extractItem<any>(res);
      let parentItems: any[] | undefined;
      if (inward?.purchase_id && !inward?.purchase?.items) {
        parentItems = extractItem<any>(await get(`/purchases/${inward.purchase_id}`).catch(() => null))?.items;
      }
      return mapItemIn(res, (f) => normFlow(f, "inward", parentItems));
    }
    if (pattern === "/sales/outwards/pending") return mapListIn(res, (f) => normFlow(f, "outward"));
    if (pattern === "/sales/outwards/:id" && method === "GET") return mapItemIn(res, (f) => normFlow(f, "outward"));
    if (pattern.startsWith("/purchases")) return method === "GET" && /^\/purchases(\/business\/:id)?$/.test(pattern) ? mapListIn(res, (d) => normDoc(d, "purchase")) : mapItemIn(res, (d) => normDoc(d, "purchase"));
    if (pattern.startsWith("/sales")) return method === "GET" && /^\/sales(\/business\/:id)?$/.test(pattern) ? mapListIn(res, (d) => normDoc(d, "sale")) : mapItemIn(res, (d) => normDoc(d, "sale"));
    if (pattern === "/users" && method === "GET") {
      // Laravel paginates users 10 per page: pull the remaining pages so the table is complete.
      let all = extractListDeep<any>(res);
      const total = num(res?.data?.total_users ?? res?.data?.pagination?.total, all.length);
      for (let page = 2; all.length < total && page <= 50; page++) {
        const more = extractListDeep<any>(await get("/users", { page }));
        if (!more.length) break;
        all = all.concat(more);
      }
      return { ...res, data: { ...(res?.data ?? {}), users: all.map(normUser) } };
    }
    if (pattern === "/users/detail/:id" || pattern === "/users/create" || pattern === "/users/update/:id") return mapItemIn(res, (u) => (u?.user ? { ...u, user: normUser(u.user) } : normUser(u)));
    if (pattern === "/platform/users") return mapListIn(res, normUser);
  } catch {
    /* never let an adapter break a successful response */
  }
  return res;
}
