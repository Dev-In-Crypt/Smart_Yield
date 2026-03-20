import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

const MOCK_DATA = [
  {
    id: 1,
    executed_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    tx_hash: '0xabc123def456789012345678901234567890abcd',
    prev_alloc: { '0x1111': 3000, '0x2222': 3500, '0x3333': 3500 },
    new_alloc:  { '0x1111': 3500, '0x2222': 3000, '0x3333': 3500 },
    explanation: 'Strategy 1 APY improved to 6.2%. Reallocated 5% from Strategy 2 to capture higher yield.',
    triggered: true,
  },
  {
    id: 2,
    executed_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    tx_hash: null,
    prev_alloc: { '0x1111': 3000, '0x2222': 3500, '0x3333': 3500 },
    new_alloc:  { '0x1111': 3000, '0x2222': 3500, '0x3333': 3500 },
    explanation: 'No significant APY improvement detected. Skipping rebalance (delta < 25bps threshold).',
    triggered: false,
  },
  {
    id: 3,
    executed_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    tx_hash: '0xdef789abc01234567890abcdef12345678901234',
    prev_alloc: { '0x1111': 2500, '0x2222': 4000, '0x3333': 3500 },
    new_alloc:  { '0x1111': 3000, '0x2222': 3500, '0x3333': 3500 },
    explanation: 'Risk score on Strategy 2 increased. Redistributed 5% to lower-risk Strategy 1.',
    triggered: true,
  },
];

let pool: Pool | null = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? '20'),
    100,
  );

  if (!pool) {
    return NextResponse.json({ data: MOCK_DATA.slice(0, limit) });
  }

  try {
    const result = await pool.query(
      `SELECT id, executed_at, tx_hash, prev_alloc, new_alloc, explanation, triggered
       FROM rebalance_history
       ORDER BY executed_at DESC
       LIMIT $1`,
      [limit],
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[api/rebalance-history]', err);
    return NextResponse.json({ data: MOCK_DATA.slice(0, limit) });
  }
}
