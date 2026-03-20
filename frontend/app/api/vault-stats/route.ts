import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const MOCK_STATS = {
  total_rebalances: '3',
  triggered_count: '2',
  last_rebalance_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
};

let pool: Pool | null = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function GET() {
  if (!pool) {
    return NextResponse.json({ data: MOCK_STATS });
  }

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                              AS total_rebalances,
        COUNT(*) FILTER (WHERE triggered)     AS triggered_count,
        MAX(executed_at)                      AS last_rebalance_at
      FROM rebalance_history
    `);
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[api/vault-stats]', err);
    return NextResponse.json({ data: MOCK_STATS });
  }
}
