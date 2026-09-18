"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseAsyncOptions = {
  /** Keep previous data visible while deps change (no full-page flash). */
  keepPrevious?: boolean;
};

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);

  const reload = useCallback(async () => {
    const soft = Boolean(options.keepPrevious && hasData.current);
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      hasData.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, refreshing, reload, setData };
}
