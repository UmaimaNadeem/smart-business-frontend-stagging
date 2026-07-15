export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://smart-business-backend-stagging.test";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(^| )token=([^;]+)/);
  return match ? match[2] : null;
};

export const getUserId = (): number | null => {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(^| )user_id=([^;]+)/);
  return match ? Number(match[2]) : null;
};

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { auth = true, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (data as { message?: string })?.message ?? "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export function extractList<T>(response: unknown): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];
  if (typeof response !== "object") return [];

  const data = response as Record<string, unknown>;

  const preferredKeys = [
    "products",
    "purchases",
    "inwards",
    "companies",
    "businesses",
    "roles",
    "users",
    "items",
    "records",
    "results",
    "list",
    "data",
  ];

  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) return data[key] as T[];
  }

  const nested = data.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    for (const key of preferredKeys) {
      if (Array.isArray(nestedObj[key])) return nestedObj[key] as T[];
    }
  }

  // Deep fallback: first array of objects (handles paginated / nested API shapes)
  const deep = findObjectArray<T>(response, 0);
  return deep ?? [];
}

function findObjectArray<T>(value: unknown, depth: number): T[] | null {
  if (depth > 5 || value == null) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return value as T[];
    if (typeof value[0] === "object" && value[0] !== null) return value as T[];
    return null;
  }

  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const skip = new Set(["links", "meta", "pagination", "message", "success"]);

  // Prefer known collection keys first at this level
  for (const key of [
    "products",
    "data",
    "items",
    "purchases",
    "inwards",
    "records",
    "results",
  ]) {
    if (skip.has(key)) continue;
    if (!(key in obj)) continue;
    const found = findObjectArray<T>(obj[key], depth + 1);
    if (found) return found;
  }

  for (const [key, child] of Object.entries(obj)) {
    if (skip.has(key)) continue;
    const found = findObjectArray<T>(child, depth + 1);
    if (found) return found;
  }

  return null;
}

/** Normalize entity id from common API shapes */
export function entityId(item: Record<string, unknown> | null | undefined): number {
  if (!item) return 0;
  const raw = item.id ?? item.role_id ?? item.company_id ?? item.business_id;
  return Number(raw) || 0;
}

export function extractItem<T>(response: unknown): T | null {
  if (!response || typeof response !== "object") return null;
  const data = response as Record<string, unknown>;
  if (data.data && typeof data.data === "object") return data.data as T;
  return response as T;
}
