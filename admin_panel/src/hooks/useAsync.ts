"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDataChanged } from "@/lib/api/client";

type UseAsyncOptions = {
  /** Keep previous data visible while deps change (no full-page flash). */
  keepPrevious?: boolean;
  /**
   * Jonli yangilanish oralig'i (ms). Standart — 5000. `false` bo'lsa o'chadi.
   * Fon yangilanishi skeleton ko'rsatmaydi va ma'lumot o'zgarmasa qayta render qilmaydi.
   */
  live?: number | false;
};

type Settled<T> = { key: string | null; data: T | null; error: string | null; at: number };

const DEFAULT_LIVE_MS = 5000;

function sameJson(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
) {
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: null, error: null, at: 0 });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  const waiters = useRef<(() => void)[]>([]);
  const key = `${JSON.stringify(deps)}#${nonce}`;
  const keyRef = useRef(key);
  const settledRef = useRef(settled);
  const inFlight = useRef(false);
  const liveMs = options.live === undefined ? DEFAULT_LIVE_MS : options.live;

  useEffect(() => {
    loaderRef.current = loader;
    keyRef.current = key;
    settledRef.current = settled;
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
          data: res.error ? prev.data : sameJson(prev.data, res.data) ? prev.data : (res.data as T),
          error: res.error,
          at: Date.now(),
        }));
        const pending = waiters.current;
        waiters.current = [];
        pending.forEach((resolve) => resolve());
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const silentRefresh = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const startKey = keyRef.current;
    if (settledRef.current.key !== startKey) return;
    inFlight.current = true;
    try {
      const data = await loaderRef.current();
      if (keyRef.current !== startKey) return;
      setSettled((prev) => {
        if (prev.key !== startKey) return prev;
        if (sameJson(prev.data, data) && !prev.error) return { ...prev, at: Date.now() };
        return { key: startKey, data, error: null, at: Date.now() };
      });
    } catch {
      // Fon yangilanishidagi xato ko'rsatilmaydi — oldingi ma'lumot qoladi.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (liveMs === false || liveMs <= 0) return;
    const timer = window.setInterval(silentRefresh, liveMs);
    let debounce: number | undefined;
    const soon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(silentRefresh, 200);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    const unsubscribe = subscribeDataChanged(soon);
    window.addEventListener("focus", soon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(debounce);
      unsubscribe();
      window.removeEventListener("focus", soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [liveMs, silentRefresh]);

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
    updatedAt: settled.at,
    reload,
    setData,
  };
}
