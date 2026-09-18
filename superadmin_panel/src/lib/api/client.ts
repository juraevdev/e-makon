export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const ACCESS_KEY = "emakon_access";
const REFRESH_KEY = "emakon_refresh";

export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000/api/v1"
  );
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${p}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function unwrap(json: unknown) {
  if (json && typeof json === "object" && "data" in json && "success" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccess(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(buildUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  const json = await parseBody(res);
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = unwrap(json) as { access?: string; refresh?: string };
  const access = data?.access;
  if (!access) return null;
  saveTokens(access, data.refresh || refresh);
  return access;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const send = (hdrs: Record<string, string>) =>
    fetch(buildUrl(path, query), {
      method,
      headers: hdrs,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });

  let res = await send(headers);
  if (res.status === 401 && auth) {
    const next = await refreshAccess();
    if (next) {
      headers.Authorization = `Bearer ${next}`;
      res = await send(headers);
    }
  }

  const json = await parseBody(res);
  if (!res.ok) {
    let message = `Xatolik (${res.status})`;
    if (json && typeof json === "object") {
      const obj = json as { message?: string; detail?: string; errors?: unknown };
      message = String(obj.message || obj.detail || message);
    }
    throw new ApiError(message, res.status);
  }
  return unwrap(json) as T;
}

export function asPage<T>(raw: unknown): { count: number; results: T[] } {
  if (Array.isArray(raw)) return { count: raw.length, results: raw as T[] };
  if (raw && typeof raw === "object" && "results" in raw) {
    const page = raw as { count?: number; results: T[] };
    return { count: page.count ?? page.results.length, results: page.results };
  }
  return { count: 0, results: [] };
}
