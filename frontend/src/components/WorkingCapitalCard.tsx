"use client";

import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

interface WorkingCapitalCardProps {
  metrics: Record<string, any>;
  unit?: string;
}

function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(1);
}

export default function WorkingCapitalCard({ metrics, unit = "" }: WorkingCapitalCardProps) {
  const wc = metrics.working_capital;
  const ca = metrics.current_assets;
  const cl = metrics.current_liabilities;
  const cr = metrics.current_ratio;

  if (wc == null && ca == null && cl == null) return null;

  const isPositive = wc != null && wc >= 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-slate-muted" />
        <p className="text-sm font-semibold text-gray-900">Working Capital Analysis</p>
      </div>

      {wc != null && (
        <div className="mb-4">
          <p className="text-xs text-slate-muted mb-1">Net Working Capital</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isPositive ? "text-fin-green" : "text-fin-red"}`}>
              {isPositive ? "" : "("}
              {fmt(Math.abs(wc))}
              {isPositive ? "" : ")"}
            </span>
            {unit && <span className="text-sm text-slate-muted">{unit}</span>}
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-fin-green ml-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-fin-red ml-1" />
            )}
          </div>
          <p className="text-xs text-slate-text mt-1">
            {isPositive
              ? "Sufficient short-term assets to cover liabilities"
              : "Negative working capital — potential liquidity concern"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-border">
        {ca != null && (
          <div>
            <p className="text-xs text-slate-muted mb-0.5">Current Assets</p>
            <p className="text-sm font-semibold font-mono text-gray-900">{fmt(ca)}</p>
          </div>
        )}
        {cl != null && (
          <div>
            <p className="text-xs text-slate-muted mb-0.5">Current Liabilities</p>
            <p className="text-sm font-semibold font-mono text-gray-900">{fmt(cl)}</p>
          </div>
        )}
        {cr != null && (
          <div className="col-span-2">
            <p className="text-xs text-slate-muted mb-0.5">Current Ratio</p>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold font-mono ${
                cr >= 1.5 ? "text-fin-green" : cr >= 1 ? "text-brand-blue" : "text-fin-red"
              }`}>
                {cr.toFixed(2)}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                cr >= 1.5 ? "bg-green-50 text-fin-green border border-green-200"
                : cr >= 1 ? "bg-blue-50 text-brand-blue border border-blue-200"
                : "bg-red-50 text-fin-red border border-red-200"
              }`}>
                {cr >= 1.5 ? "Healthy" : cr >= 1 ? "Adequate" : "At Risk"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
