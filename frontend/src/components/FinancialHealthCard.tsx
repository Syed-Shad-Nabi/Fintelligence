"use client";

import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";

interface FinancialHealthCardProps {
  score: number | null | undefined;
  metrics: Record<string, any>;
}

export default function FinancialHealthCard({ score, metrics }: FinancialHealthCardProps) {
  if (score == null) return null;

  const getGrade = (s: number): { letter: string; color: string; bg: string; desc: string } => {
    if (s >= 90) return { letter: "A+", color: "text-fin-green", bg: "bg-green-50 border-green-200", desc: "Excellent" };
    if (s >= 80) return { letter: "A", color: "text-fin-green", bg: "bg-green-50 border-green-200", desc: "Strong" };
    if (s >= 70) return { letter: "B", color: "text-brand-blue", bg: "bg-blue-50 border-blue-200", desc: "Good" };
    if (s >= 60) return { letter: "C", color: "text-fin-amber", bg: "bg-amber-50 border-amber-200", desc: "Fair" };
    if (s >= 50) return { letter: "D", color: "text-fin-red", bg: "bg-red-50 border-red-200", desc: "Weak" };
    return { letter: "F", color: "text-fin-red", bg: "bg-red-50 border-red-200", desc: "Critical" };
  };

  const grade = getGrade(score);

  const factors = [];
  if (metrics.liquidity_ratio != null) {
    factors.push({
      label: "Liquidity",
      value: metrics.liquidity_ratio.toFixed(2),
      status: metrics.liquidity_ratio >= 1.5 ? "good" : metrics.liquidity_ratio >= 1 ? "ok" : "bad",
    });
  }
  if (metrics.debt_ratio != null) {
    factors.push({
      label: "Leverage",
      value: metrics.debt_ratio.toFixed(2),
      status: metrics.debt_ratio <= 0.4 ? "good" : metrics.debt_ratio <= 0.7 ? "ok" : "bad",
    });
  }
  if (metrics.operating_margin_pct != null) {
    factors.push({
      label: "Op. Margin",
      value: `${metrics.operating_margin_pct.toFixed(1)}%`,
      status: metrics.operating_margin_pct >= 10 ? "good" : metrics.operating_margin_pct >= 3 ? "ok" : "bad",
    });
  }
  if (metrics.revenue_growth != null) {
    factors.push({
      label: "Growth",
      value: `${(metrics.revenue_growth * 100).toFixed(1)}%`,
      status: metrics.revenue_growth >= 0.05 ? "good" : metrics.revenue_growth >= 0 ? "ok" : "bad",
    });
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-brand-purple" />
        <p className="text-sm font-semibold text-gray-900">Financial Health Assessment</p>
      </div>

      <div className="flex items-center gap-5 mb-4">
        <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center ${grade.bg}`}>
          <span className={`text-3xl font-bold ${grade.color}`}>{grade.letter}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-gray-900">{score.toFixed(0)}</span>
            <span className="text-sm text-slate-muted">/ 100</span>
          </div>
          <p className="text-sm text-slate-text">{grade.desc} financial position</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                score >= 80 ? "bg-fin-green" : score >= 60 ? "bg-brand-blue" : score >= 50 ? "bg-fin-amber" : "bg-fin-red"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {factors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-border">
          {factors.map((f) => {
            const Icon = f.status === "good" ? CheckCircle2 : f.status === "ok" ? TrendingUp : AlertTriangle;
            const iconColor = f.status === "good" ? "text-fin-green" : f.status === "ok" ? "text-brand-blue" : "text-fin-red";
            return (
              <div key={f.label} className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-muted truncate">{f.label}</p>
                  <p className="text-xs font-semibold font-mono text-gray-900">{f.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
