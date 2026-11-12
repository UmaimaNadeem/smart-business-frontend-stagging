/** Standardised API error. Mirrors the Laravel envelope `{ success:false, message, errors }`. */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;
  code: string | null;
  body: unknown;

  constructor(status: number, message: string, errors: Record<string, string[]> | null = null, code: string | null = null, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
    this.body = body;
  }

  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.errors?.[name]?.[0];
  }

  get isValidation() {
    return this.status === 422;
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    if (err.errors) {
      const first = Object.values(err.errors).find((v) => Array.isArray(v) && v.length);
      if (first && err.status === 422) return `${err.message}: ${first[0]}`;
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
