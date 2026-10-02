"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseAsyncOptions = {
  /** Keep previous data visible while deps change (no full-page flash). */
  keepPrevious?: boolean;
};

type Settled<T> = { key: string | null; data: T | null; error: string | null };

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
) {
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  const waiters = useRef<(() => void)[]>([]);
  const key = `${JSON.stringify(deps)}#${nonce}`;

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then(
        (data) => ({ data, error: null }),
        (err: unknown) => ({ data: undefined, error: err instanceof Error ? err.message : "Xatolik" }),
      )
      .then((res) => {
        if (cancelled) return;
        setSettled((prev) => ({
          key,
          data: res.error ? prev.data : (res.data as T),
          error: res.error,
        }));
        const pending = waiters.current;
        waiters.current = [];
        pending.forEach((resolve) => resolve());
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        setNonce((n) => n + 1);
      }),
    [],
  );

  const setData = useCallback((value: T | null | ((prev: T | null) => T | null)) => {
    setSettled((prev) => ({
      ...prev,
      data: typeof value === "function" ? (value as (p: T | null) => T | null)(prev.data) : value,
    }));
  }, []);

  const pending = settled.key !== key;
  const soft = Boolean(options.keepPrevious) && settled.data !== null;

  return {
    data: settled.data,
    error: pending ? null : settled.error,
    loading: pending && !soft,
    refreshing: pending && soft,
    reload,
    setData,
  };
}
