'use client';

import { useEffect, useState } from 'react';

export type RebalanceEntry = {
  id:          number;
  executed_at: string;
  tx_hash:     string | null;
  prev_alloc:  Record<string, number>;
  new_alloc:   Record<string, number>;
  explanation: string;
  triggered:   boolean;
};

export function useRebalanceHistory(limit = 20) {
  const [data, setData]       = useState<RebalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/rebalance-history?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Refresh every 30 s
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [limit]);

  return { data, loading, error };
}
