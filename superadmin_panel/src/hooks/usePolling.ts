"use client";

import { useEffect, useRef } from "react";

/** Calls `callback` every `ms` while the tab is visible. */
export function usePolling(callback: () => void, ms: number, enabled = true) {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") ref.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}
