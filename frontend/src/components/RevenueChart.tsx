"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  data: { labels: string[]; values: number[] };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-border rounded-lg px-3 py-2 shadow-card-md text-sm">
      <p className="text-slate-muted text-xs mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900">
        {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
};

export default function RevenueChart({ data }: Props) {
  const chartData = data.labels.map((label, i) => ({ period: label, revenue: data.values[i] }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={48}
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
            : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
            : String(v)
          }
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
        <Area
          type="monotone" dataKey="revenue"
          stroke="#2563eb" strokeWidth={2}
          fill="url(#revGrad)"
          dot={{ fill: "#2563eb", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
