CREATE TABLE IF NOT EXISTS rebalance_history (
    id          SERIAL PRIMARY KEY,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tx_hash     TEXT,                          -- NULL when triggered=false (skipped)
    prev_alloc  JSONB NOT NULL,                -- { "0xStrategy": bps }
    new_alloc   JSONB NOT NULL,
    explanation TEXT NOT NULL,
    triggered   BOOLEAN NOT NULL               -- false = below threshold, skipped
);

CREATE INDEX IF NOT EXISTS idx_rebalance_history_executed_at
    ON rebalance_history (executed_at DESC);
