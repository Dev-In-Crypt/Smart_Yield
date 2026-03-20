'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

type Slice = {
  name:  string;
  value: number; // bps
  apy?:  string;
};

export function AllocationChart({ data }: { data: Slice[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No active strategies
      </div>
    );
  }

  const chartData = data.map((s) => ({
    ...s,
    value: s.value / 100, // bps → %
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(val: number) => `${val.toFixed(2)}%`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
