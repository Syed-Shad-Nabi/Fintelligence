"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ComparisonData {
  labels: string[];
  period_1: { label: string; values: number[] };
  period_2: { label: string; values: number[] };
}

interface Props { data: ComparisonData; unit?: string; }

function formatValue(value: number, unit?: string) {
  const abs = Math.abs(value);
  let f: string;
  if (abs >= 1_000_000) f = `${(value / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) f = `${(value / 1_000).toFixed(1)}K`;
  else f = value.toFixed(1);
  return unit ? `${f} ${unit}` : f;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-border rounded-lg px-3 py-2 shadow-card-md text-sm">
      <p className="font-semibold text-gray-900 mb-1.5 text-xs">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs mb-0.5">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: entry.fill }} />
          <span className="text-slate-muted">{entry.name}:</span>
          <span className="font-mono text-gray-900 ml-auto pl-3">{formatValue(entry.value, unit)}</span>
        </div>
      ))}
    </div>
  );
};

export default function PeriodComparisonChart({ data, unit }: Props) {
  const chartData = data.labels.map((label, i) => ({
    name: label,
    [data.period_2.label]: data.period_2.values[i] ?? 0,
    [data.period_1.label]: data.period_1.values[i] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={chartData} barCategoryGap="32%" barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatValue(v)} width={48} />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: "#f8fafc" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 10 }} />
        <Bar dataKey={data.period_2.label} fill="#e2e8f0" radius={[3, 3, 0, 0]} />
        <Bar dataKey={data.period_1.label} fill="#2563eb" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
