import React, { useEffect, useState } from "react";

export function usePolling(fn, intervalMs = 1000, deps = []) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function tick() {
      try {
        await fn();
        if (alive) setError(null);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return error;
}
