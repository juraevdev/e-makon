import { api, asPage } from "@/lib/api/client";

const PAGE_SIZE = 100;

type Query = Record<string, string | number | boolean | undefined | null>;

/** Backend `max_page_size=100`, shuning uchun sahifalarni parallel yig'amiz (`maxPages` bilan cheklangan). */
export async function fetchAllPages<T>(path: string, query: Query = {}, maxPages = 10) {
  const first = asPage<T>(await api(path, { query: { ...query, page_size: PAGE_SIZE, page: 1 } }));
  const pages = Math.min(Math.ceil(first.count / PAGE_SIZE), maxPages);
  if (pages <= 1) return { count: first.count, results: first.results, truncated: first.count > first.results.length };
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      api(path, { query: { ...query, page_size: PAGE_SIZE, page: i + 2 } }).then((raw) => asPage<T>(raw).results),
    ),
  );
  const results = [...first.results, ...rest.flat()];
  return { count: first.count, results, truncated: first.count > results.length };
}
