export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** DRF `custom_exception_handler` va oddiy JSON javoblardan foydalanuvchiga xabar. */
export function messageFromApiBody(json: unknown, status: number): string {
  if (!json || typeof json !== "object") {
    return status === 403
      ? "Bu amal uchun ruxsat yo'q."
      : status === 401
        ? "Sessiya tugagan. Qayta kiring."
        : `Xatolik (${status})`;
  }
  const obj = json as {
    message?: string;
    detail?: string | string[];
    errors?: Record<string, unknown>;
    code?: string;
  };

  if (typeof obj.detail === "string" && obj.detail.trim()) {
    return obj.detail.trim();
  }
  if (Array.isArray(obj.detail) && obj.detail[0]) {
    return String(obj.detail[0]);
  }

  if (obj.message && obj.message !== "Validation error") {
    return String(obj.message);
  }

  if (obj.errors && typeof obj.errors === "object") {
    for (const val of Object.values(obj.errors)) {
      if (typeof val === "string" && val.trim()) return val;
      if (Array.isArray(val) && val[0]) return String(val[0]);
    }
  }

  if (obj.code === "forbidden" || status === 403) {
    return "Bu amal uchun admin huquqi yetarli emas.";
  }

  return `Xatolik (${status})`;
}

export function userFacingError(err: unknown, fallback = "Xatolik"): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
