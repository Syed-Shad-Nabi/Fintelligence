"use client";

import { Briefcase, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface ExecutiveSummaryCardProps {
  metrics: Record<string, any>;
  anomalyCount?: number;
}

export default function ExecutiveSummaryCard({ metrics, anomalyCount = 0 }: ExecutiveSummaryCardProps) {
  const highlights = [];
  const alerts = [];

  if (metrics.revenue_growth != null) {
    if (metrics.revenue_growth >= 0.1) {
      highlights.push({ icon: TrendingUp, text: `Strong revenue growth of ${(metrics.revenue_growth * 100).toFixed(1)}%`, type: "success" });
    } else if (metrics.revenue_growth < 0) {
      alerts.push({ icon: TrendingDown, text: `Revenue declined by ${Math.abs(metrics.revenue_growth * 100).toFixed(1)}%`, type: "warning" });
    }
  }

  if (metrics.net_margin_pct != null) {
    if (metrics.net_margin_pct >= 15) {
      highlights.push({ icon: CheckCircle2, text: `Healthy net margin at ${metrics.net_margin_pct.toFixed(1)}%`, type: "success" });
    } else if (metrics.net_margin_pct < 3) {
      alerts.push({ icon: AlertCircle, text: `Low net margin of ${metrics.net_margin_pct.toFixed(1)}%`, type: "warning" });
    }
  }

  if (metrics.liquidity_ratio != null) {
    if (metrics.liquidity_ratio < 1.0) {
      alerts.push({ icon: AlertCircle, text: `Liquidity ratio ${metrics.liquidity_ratio.toFixed(2)} below safe threshold`, type: "critical" });
    } else if (metrics.liquidity_ratio >= 2.0) {
      highlights.push({ icon: CheckCircle2, text: `Strong liquidity position (${metrics.liquidity_ratio.toFixed(2)})`, type: "success" });
    }
  }

  if (metrics.debt_ratio != null && metrics.debt_ratio > 0.7) {
    alerts.push({ icon: AlertCircle, text: `High leverage — debt ratio at ${(metrics.debt_ratio * 100).toFixed(0)}%`, type: "critical" });
  }

  if (metrics.return_on_equity != null && metrics.return_on_equity >= 15) {
    highlights.push({ icon: TrendingUp, text: `Excellent ROE of ${metrics.return_on_equity.toFixed(1)}%`, type: "success" });
  }

  if (metrics.operating_margin_pct != null && metrics.operating_margin_pct < 0) {
    alerts.push({ icon: AlertCircle, text: `Negative operating margin — operations unprofitable`, type: "critical" });
  }

  if (anomalyCount > 10) {
    alerts.push({ icon: Info, text: `${anomalyCount} data anomalies detected — review recommended`, type: "info" });
  }

  if (highlights.length === 0 && alerts.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-4 h-4 text-brand-blue" />
        <p className="text-sm font-semibold text-gray-900">Executive Summary</p>
      </div>

      {highlights.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-semibold text-slate-muted uppercase tracking-wide">Key Highlights</p>
          {highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <h.icon className="w-3.5 h-3.5 text-fin-green flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed">{h.text}</p>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-muted uppercase tracking-wide">Alerts & Considerations</p>
          {alerts.map((a, i) => {
            const bg = a.type === "critical" ? "bg-red-50 border-red-200" : a.type === "warning" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200";
            const iconColor = a.type === "critical" ? "text-fin-red" : a.type === "warning" ? "text-fin-amber" : "text-brand-blue";
            return (
              <div key={i} className={`flex items-start gap-2 p-2.5 border rounded-lg ${bg}`}>
                <a.icon className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-0.5`} />
                <p className="text-xs text-gray-700 leading-relaxed">{a.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
