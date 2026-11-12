/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-browser mock database. Persisted to localStorage so a refresh keeps the user's exploration.
 * Only used when NEXT_PUBLIC_USE_MOCK is true. Never used in production builds that talk to Laravel.
 */
export type Row = Record<string, any>;

export const TABLES = [
  "users", "companies", "businesses", "roles", "assignments", "invitations",
  "units", "products", "warehouses", "stock_balances", "stock_movements", "stock_adjustments", "stock_transfers",
  "suppliers", "customers", "purchases", "warehouse_inwards", "purchase_returns",
  "sales", "warehouse_outwards", "sales_returns",
  "payment_methods", "cash_bank_accounts", "accounts", "payments", "expense_categories", "expenses", "journals",
  "plans", "subscriptions", "subscription_invoices", "subscription_events",
] as const;
export type Table = (typeof TABLES)[number];

export interface DB {
  version: number;
  seq: Record<string, number>;
  docSeq: Record<string, number>;
  tables: Record<Table, Row[]>;
  tokens: Record<string, number>;
  resetTokens: Record<string, string>; // token -> email
  settings: Row;
}

export const DB_VERSION = 3;
let STORAGE_KEY = "sb_mock_db_v3";

/** Hybrid mode keeps its (initially empty) mock store separate from the full demo store. */
export function useStorageKey(key: string) {
  if (key !== STORAGE_KEY) { STORAGE_KEY = key; current = null; }
}

let current: DB | null = null;

export function emptyDB(): DB {
  const tables = {} as Record<Table, Row[]>;
  TABLES.forEach((t) => (tables[t] = []));
  return { version: DB_VERSION, seq: {}, docSeq: {}, tables, tokens: {}, resetTokens: {}, settings: {} };
}

export function getDB(seed: () => DB): DB {
  if (current) return current;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DB;
        if (parsed.version === DB_VERSION) {
          TABLES.forEach((t) => (parsed.tables[t] = parsed.tables[t] ?? []));
          current = parsed;
          return current;
        }
      }
    } catch {
      /* corrupted -> reseed */
    }
  }
  current = seed();
  saveDB();
  return current;
}

export function saveDB() {
  if (!current || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* quota exceeded - keep in memory */
  }
}

export function resetDB(seed: () => DB) {
  current = seed();
  saveDB();
}

/** Seeding can pin the clock so demo history is spread over past months. */
let clock: string | null = null;
export function setClock(dateIso: string | null) {
  clock = dateIso;
}

export function nowIso() {
  return clock ? new Date(`${clock.slice(0, 10)}T10:00:00.000Z`).toISOString() : new Date().toISOString();
}

export function today() {
  return nowIso().slice(0, 10);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateIso: string, n: number) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function insert(db: DB, table: Table, row: Row): Row {
  const id = (db.seq[table] ?? 0) + 1;
  db.seq[table] = id;
  const record = { id, ...row, created_at: row.created_at ?? nowIso(), updated_at: nowIso() };
  db.tables[table].push(record);
  return record;
}

export function find(db: DB, table: Table, id: number | string | null | undefined): Row | undefined {
  if (id === null || id === undefined || id === "") return undefined;
  return db.tables[table].find((r) => r.id === Number(id));
}

export function where(db: DB, table: Table, pred: (r: Row) => boolean): Row[] {
  return db.tables[table].filter(pred);
}

export function patch(row: Row, values: Row): Row {
  Object.assign(row, values, { updated_at: nowIso() });
  return row;
}

export function remove(db: DB, table: Table, id: number) {
  db.tables[table] = db.tables[table].filter((r) => r.id !== id);
}

/** Per-company document numbers, e.g. PO-2026-0007. Concurrency-safe sequences are a backend task. */
export function nextNumber(db: DB, companyId: number, prefix: string): string {
  const year = new Date().getFullYear();
  const key = `${companyId}:${prefix}:${year}`;
  const n = (db.docSeq[key] ?? 0) + 1;
  db.docSeq[key] = n;
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}
