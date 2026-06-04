import { useState, useEffect, useCallback } from "react";
import { api } from "./client";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(path: string, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    if (data === null) setLoading(true);
    setError(null);
    api.get<T>(path)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e: unknown) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, refetch };
}
