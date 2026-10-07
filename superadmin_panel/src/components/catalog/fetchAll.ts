import { api, asPage } from "@/lib/api/client";

const PAGE_SIZE = 100;

export type FetchAllResult<T> = { results: T[]; count: number; truncated: boolean };

/** Backend `max_page_size` = 100 — kerakli ro'yxatni bir nechta sahifada yig'adi. */
export async function fetchAll<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined | null> = {},
  maxPages = 10,
): Promise<FetchAllResult<T>> {
  const results: T[] = [];
  let count = 0;
  for (let page = 1; page <= maxPages; page++) {
    const raw = await api(path, { query: { ...query, page_size: PAGE_SIZE, page } });
    const chunk = asPage<T>(raw);
    count = chunk.count;
    results.push(...chunk.results);
    if (Array.isArray(raw) || chunk.results.length < PAGE_SIZE || results.length >= count) break;
  }
  return { results, count: Math.max(count, results.length), truncated: results.length < count };
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
