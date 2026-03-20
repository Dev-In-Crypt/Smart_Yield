'use client';

import { useRebalanceHistory } from '@/hooks/useRebalanceHistory';

export function RebalanceHistory() {
  const { data, loading, error } = useRebalanceHistory(20);

  if (loading) return <p className="text-gray-500 text-sm">Loading history…</p>;
  if (error)   return <p className="text-red-400 text-sm">Error: {error}</p>;
  if (!data.length) return <p className="text-gray-500 text-sm">No rebalances yet.</p>;

  return (
    <div className="space-y-4">
      {data.map((entry) => {
        const date = new Date(entry.executed_at).toLocaleString();
        const changes = Object.entries(entry.new_alloc).map(([addr, newBps]) => {
          const prevBps = entry.prev_alloc[addr] ?? 0;
          const delta   = newBps - prevBps;
          const arrow   = delta > 0 ? '↑' : delta < 0 ? '↓' : '—';
          const color   = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400';
          return { addr, prevBps, newBps, delta, arrow, color };
        });

        return (
          <div
            key={entry.id}
            className={`rounded-xl p-4 border ${
              entry.triggered ? 'border-indigo-800 bg-indigo-950/30' : 'border-gray-800 bg-white/5 opacity-60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400">{date}</span>
              {entry.triggered ? (
                <span className="text-xs px-2 py-0.5 bg-indigo-700 rounded-full">Executed</span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full">Skipped</span>
              )}
            </div>

            <div className="space-y-1 mb-3">
              {changes.map(({ addr, prevBps, newBps, arrow, color }) => (
                <div key={addr} className="flex items-center gap-2 text-sm font-mono">
                  <span className="text-gray-500 truncate w-28">{addr.slice(0, 8)}…</span>
                  <span className="text-gray-300">{(prevBps / 100).toFixed(1)}%</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-white">{(newBps / 100).toFixed(1)}%</span>
                  <span className={color}>{arrow}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-300 italic">"{entry.explanation}"</p>

            {entry.tx_hash && (
              <a
                href={`https://scan.initia.tech/tx/${entry.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline mt-2 inline-block"
              >
                {entry.tx_hash.slice(0, 12)}… ↗
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
