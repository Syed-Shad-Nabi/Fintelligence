"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  distribution: { high: number; medium: number; low: number };
}

const COLORS = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-border rounded-lg px-3 py-2 shadow-card-md text-sm">
      <p className="text-slate-muted text-xs mb-0.5 capitalize">{label} severity</p>
      <p className="font-semibold text-gray-900">{payload[0].value} anomalies</p>
    </div>
  );
};

export default function AnomalyChart({ distribution }: Props) {
  const data = [
    { name: "High",   count: distribution.high   || 0 },
    { name: "Medium", count: distribution.medium || 0 },
    { name: "Low",    count: distribution.low    || 0 },
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barCategoryGap="40%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
