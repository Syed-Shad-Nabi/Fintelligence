"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import MetricsCard from "@/components/MetricsCard";
import SectionHeader from "@/components/SectionHeader";
import { reportsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  ArrowLeft, Droplets, AlertTriangle, Shield, TrendingUp, TrendingDown,
  MessageSquare, Loader2, AlertCircle, RefreshCw, DollarSign, BarChart3,
  Percent, Building2, Calendar, Lightbulb, Coins, Activity, BookOpen,
  PieChart, Target, Zap, ArrowUpRight, ArrowDownRight, Briefcase, ChevronRight,
} from "lucide-react";

const RevenueChart          = dynamic(() => import("@/components/RevenueChart"),          { ssr: false });
const AnomalyChart          = dynamic(() => import("@/components/AnomalyChart"),           { ssr: false });
const PeriodComparisonChart = dynamic(() => import("@/components/PeriodComparisonChart"), { ssr: false });

interface ReportDetail {
  id: string; filename: string; file_type: string; status: string;
  progress: number; row_count: number; col_count: number; anomaly_count: number;
  metrics: Record<string, any> | null; anomalies: any[] | null;
  charts: Record<string, any> | null; summary: string | null;
  column_mapping: Record<string, string> | null; created_at: string;
}

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000)     return `${(val / 1_000).toFixed(decimals)}K`;
  return val.toFixed(decimals);
}

function fmtPct(val: number | null | undefined, isRatio = false): string {
  if (val == null) return "—";
  const v = isRatio ? val * 100 : val;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function GrowthBadge({ value, isRatio = false }: { value: number | null | undefined; isRatio?: boolean }) {
  if (value == null) return null;
  const v = isRatio ? value * 100 : value;
  const pos = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
      pos ? "text-fin-green bg-green-50" : "text-fin-red bg-red-50"
    }`}>
      {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
      <span className="text-xs text-slate-text">{label}</span>
      <div className="text-right">
        <span className="text-xs font-mono text-gray-900 font-semibold">{value}</span>
        {sub && <span className="block text-xs text-slate-muted font-normal">{sub}</span>}
      </div>
    </div>
  );
}

function PLRow({ label, value, unit, indent = false, bold = false, highlight }: {
  label: string; value: number | null | undefined; unit?: string;
  indent?: boolean; bold?: boolean; highlight?: "green" | "red" | "none";
}) {
  const formatted = value != null ? fmt(value) : "—";
  const textClass = highlight === "green" ? "text-fin-green"
    : highlight === "red" ? "text-fin-red"
    : bold ? "text-gray-900" : "text-gray-700";

  return (
    <div className={`flex justify-between items-center py-2 border-b border-slate-border last:border-0 ${indent ? "pl-4" : ""}`}>
      <span className={`text-xs ${bold ? "font-semibold text-gray-900" : "text-slate-text"}`}>{label}</span>
      <span className={`text-xs font-mono font-semibold ${textClass}`}>
        {value != null && value < 0 ? `(${fmt(Math.abs(value))})` : formatted}
        {unit && value != null ? <span className="text-slate-muted font-normal ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport]   = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.replace("/"); return; }
    load();
  }, [id, router, mounted]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.get(id);
      setReport(res.data);
      if (res.data.status === "processing") startPolling();
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const startPolling = () => {
    const iv = setInterval(async () => {
      try {
        const res = await reportsApi.get(id);
        setReport(res.data);
        if (res.data.status !== "processing") clearInterval(iv);
      } catch { clearInterval(iv); }
    }, 2000);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-fin-red mx-auto mb-3" />
          <p className="text-gray-900 font-semibold">Report not found</p>
          <button onClick={() => router.push("/reports")} className="btn-primary mt-4">Back to Reports</button>
        </div>
      </div>
    );
  }

  if (report.status === "processing") {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <main className="pt-20 flex items-center justify-center min-h-[calc(100vh-56px)]">
          <div className="card text-center max-w-sm w-full mx-4">
            <Loader2 className="w-9 h-9 text-brand-blue animate-spin mx-auto mb-4" />
            <p className="text-gray-900 font-semibold">Analysis in Progress</p>
            <p className="text-slate-muted text-sm mt-1 mb-4 truncate">{report.filename}</p>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-blue rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${report.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-slate-muted mt-2">{report.progress}% complete</p>
          </div>
        </main>
      </div>
    );
  }

  const m        = report.metrics  || {};
  const anomalies = report.anomalies || [];
  const charts   = report.charts   || {};
  const unit     = m.unit ?? "";

  const hasPL = m.revenue != null;
  const hasBalance = m.total_assets != null || m.current_assets != null || m.cash != null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main className="pt-20 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          <button
            onClick={() => router.push("/reports")}
            className="flex items-center gap-1.5 text-sm text-slate-text hover:text-gray-900 transition-colors w-fit mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" /> Reports
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{report.filename}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-muted">
              <span className="uppercase font-medium">{report.file_type}</span>
              {report.row_count ? <><span>·</span><span>{report.row_count.toLocaleString()} rows</span></> : null}
              <span>·</span>
              <span>{new Date(report.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => router.push(`/insights?report=${report.id}`)} className="btn-secondary flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Insights
            </button>
            <button onClick={() => router.push(`/chat?report=${report.id}`)} className="btn-secondary flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Ask AI
            </button>
            <button onClick={load} className="btn-secondary p-2.5">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Company / Document banner */}
        {(m.company || m.period_1_label) && (
          <div className="bg-white border border-slate-border rounded-xl px-5 py-3.5 shadow-card flex flex-wrap items-center gap-4 mb-6">
            <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{m.company ?? report.filename}</p>
              <p className="text-xs text-slate-muted">{m.document_type ?? "Financial Report"}</p>
            </div>
            {m.period_1_label && (
              <div className="flex items-center gap-1.5 text-xs text-slate-muted border-l border-slate-border pl-4">
                <Calendar className="w-3.5 h-3.5" />
                {m.period_2_label && <span>{m.period_2_label} →</span>}
                <span className="font-semibold text-gray-900">{m.period_1_label}</span>
              </div>
            )}
            {m.currency && (
              <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
                {m.currency}{unit ? ` · ${unit}` : ""}
              </span>
            )}
          </div>
        )}

        {/* ── KPI Summary Strip ───────────────────────────────────────────────── */}
        {hasPL && (
          <section className="mb-6">
            <SectionHeader title="Key Performance Indicators" subtitle="Current period financial highlights" icon={BarChart3} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricsCard label="Revenue" value={fmt(m.revenue)} unit={unit} icon={DollarSign} color="blue"
                description={m.period_1_label ?? "Current period"} />
              <MetricsCard label="Gross Margin"
                value={m.gross_margin_pct != null ? `${m.gross_margin_pct.toFixed(1)}%` : fmt(m.gross_margin)}
                icon={Percent}
                color={!m.gross_margin_pct ? "blue" : m.gross_margin_pct > 40 ? "green" : m.gross_margin_pct > 20 ? "amber" : "red"}
                description="Revenue − COGS" />
              <MetricsCard label="Operating Margin"
                value={m.operating_margin_pct != null ? `${m.operating_margin_pct.toFixed(1)}%` : null}
                icon={BarChart3}
                color={!m.operating_margin_pct ? "blue" : m.operating_margin_pct > 15 ? "green" : m.operating_margin_pct > 5 ? "amber" : "red"}
                description="Operating income / revenue" />
              <MetricsCard label="Net Margin"
                value={m.net_margin_pct != null ? `${m.net_margin_pct.toFixed(1)}%` : null}
                icon={m.net_margin_pct != null && m.net_margin_pct < 0 ? TrendingDown : TrendingUp}
                color={!m.net_margin_pct ? "blue" : m.net_margin_pct < 0 ? "red" : m.net_margin_pct > 10 ? "green" : "amber"}
                description="Bottom-line profitability" />
              <MetricsCard label="EBITDA"
                value={fmt(m.ebitda)} unit={unit} icon={Zap}
                color={m.ebitda == null ? "blue" : m.ebitda < 0 ? "red" : "green"}
                description={m.ebitda_margin_pct != null ? `${m.ebitda_margin_pct.toFixed(1)}% margin` : "Op income + D&A"} />
              <MetricsCard label="Revenue Growth"
                value={m.revenue_growth != null ? `${(m.revenue_growth * 100).toFixed(1)}%` : null}
                icon={m.revenue_growth != null && m.revenue_growth < 0 ? TrendingDown : TrendingUp}
                color={m.revenue_growth == null ? "blue" : m.revenue_growth < 0 ? "red" : m.revenue_growth < 0.05 ? "amber" : "green"}
                description="Period-over-period YoY" />
            </div>
          </section>
        )}

        {/* ── Main two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-5">

            {/* Income Statement */}
            {hasPL && (
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-muted" />
                  <p className="text-sm font-semibold text-gray-900">Income Statement</p>
                  {unit && <span className="text-xs text-slate-muted ml-auto">in {unit}</span>}
                </div>
                <p className="text-xs text-slate-muted mb-3">
                  {m.period_2_label && <span>{m.period_2_label} → </span>}
                  <span className="font-medium text-gray-700">{m.period_1_label ?? "Current Period"}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <div>
                    <PLRow label="Revenue"                       value={m.revenue}               bold />
                    <PLRow label="Cost of Revenue"               value={m.cost_of_goods_sold}    indent />
                    <PLRow label="Gross Profit"                  value={m.gross_margin}          bold
                      highlight={m.gross_margin != null && m.gross_margin < 0 ? "red" : "none"} />
                    <PLRow label="Research & Development"        value={m.research_and_development} indent />
                    <PLRow label="Selling, General & Admin"      value={m.selling_general_admin} indent />
                    <PLRow label="Total Operating Expenses"      value={m.operating_expenses} />
                    <PLRow label="Operating Income"              value={m.operating_income} bold
                      highlight={m.operating_income != null ? (m.operating_income >= 0 ? "green" : "red") : "none"} />
                  </div>
                  <div>
                    <PLRow label="Income Before Tax"             value={m.income_before_tax} />
                    <PLRow label="Income Tax Expense"            value={m.income_tax} indent />
                    <PLRow label="Net Income"                    value={m.net_income} bold
                      highlight={m.net_income != null ? (m.net_income >= 0 ? "green" : "red") : "none"} />
                    {m.eps_basic != null && <PLRow label="EPS — Basic"  value={m.eps_basic} />}
                    {m.eps_diluted != null && <PLRow label="EPS — Diluted" value={m.eps_diluted} />}
                    {m.ebitda != null && <PLRow label="EBITDA (adj.)" value={m.ebitda} bold />}
                    {m.depreciation != null && <PLRow label="Depreciation & Amortisation" value={m.depreciation} indent />}
                  </div>
                </div>

                {/* YoY comparison summary row */}
                {(m.revenue_prior != null || m.net_income_prior != null) && (
                  <div className="mt-4 pt-3 border-t border-slate-border">
                    <p className="text-xs font-semibold text-slate-muted uppercase tracking-wide mb-2">Prior Period ({m.period_2_label ?? "Comparison"})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {m.revenue_prior != null && (
                        <div>
                          <p className="text-xs text-slate-text">Revenue</p>
                          <p className="text-sm font-semibold font-mono text-gray-900">{fmt(m.revenue_prior)}</p>
                          <GrowthBadge value={m.revenue_growth} isRatio />
                        </div>
                      )}
                      {m.gross_margin_prior != null && (
                        <div>
                          <p className="text-xs text-slate-text">Gross Profit</p>
                          <p className="text-sm font-semibold font-mono text-gray-900">{fmt(m.gross_margin_prior)}</p>
                        </div>
                      )}
                      {m.operating_income_prior != null && (
                        <div>
                          <p className="text-xs text-slate-text">Op. Income</p>
                          <p className="text-sm font-semibold font-mono text-gray-900">{fmt(m.operating_income_prior)}</p>
                          <GrowthBadge value={m.operating_income_growth} isRatio />
                        </div>
                      )}
                      {m.net_income_prior != null && (
                        <div>
                          <p className="text-xs text-slate-text">Net Income</p>
                          <p className="text-sm font-semibold font-mono text-gray-900">{fmt(m.net_income_prior)}</p>
                          <GrowthBadge value={m.net_income_growth} isRatio />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Period comparison chart */}
            {charts.period_comparison && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-900">Period-over-Period Comparison</p>
                  <span className="text-xs text-slate-muted">{unit}</span>
                </div>
                <PeriodComparisonChart data={charts.period_comparison} unit={unit} />
              </div>
            )}

            {/* Revenue trend */}
            {charts.revenue_trend && (
              <div className="card">
                <p className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend</p>
                <RevenueChart data={charts.revenue_trend} />
              </div>
            )}

            {/* Financial ratios */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-3.5 h-3.5 text-slate-muted" />
                <p className="text-sm font-semibold text-gray-900">Financial Ratios</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricsCard label="Liquidity Ratio"  value={m.liquidity_ratio?.toFixed(2) ?? null} icon={Droplets}
                  color={!m.liquidity_ratio ? "blue" : m.liquidity_ratio < 1 ? "red" : m.liquidity_ratio < 1.5 ? "amber" : "green"}
                  description="Current assets / liabilities" />
                <MetricsCard label="Debt Ratio"        value={m.debt_ratio?.toFixed(3) ?? null} icon={Activity}
                  color={!m.debt_ratio ? "blue" : m.debt_ratio > 0.7 ? "red" : m.debt_ratio > 0.4 ? "amber" : "green"}
                  description="Total debt / total assets" />
                <MetricsCard label="Debt / Equity"     value={m.debt_to_equity?.toFixed(2) ?? null} icon={BarChart3}
                  color={!m.debt_to_equity ? "blue" : m.debt_to_equity > 2 ? "red" : m.debt_to_equity > 1 ? "amber" : "green"}
                  description="Leverage multiple" />
                <MetricsCard label="Compliance"        value={m.compliance_score ?? null} unit="/100" icon={Shield}
                  color={!m.compliance_score ? "blue" : m.compliance_score < 60 ? "red" : m.compliance_score < 80 ? "amber" : "green"}
                  description="Heuristic risk score" />
              </div>
            </div>

            {/* Anomaly section */}
            {anomalies.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 text-fin-amber" />
                  <p className="text-sm font-semibold text-gray-900">
                    Statistical Anomalies
                    <span className="ml-2 text-xs text-slate-muted font-normal">({anomalies.length} flagged by Isolation Forest)</span>
                  </p>
                </div>
                {charts.anomaly_distribution && (
                  <div className="mb-4">
                    <AnomalyChart distribution={charts.anomaly_distribution} />
                  </div>
                )}
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {anomalies.slice(0, 15).map((a, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-slate-border">
                      <span className={`flex-shrink-0 mt-0.5 ${
                        a.severity === "high" ? "badge-high" : a.severity === "medium" ? "badge-medium" : "badge-low"
                      }`}>
                        {a.severity.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-text">Row {a.row_index} · Score: {a.anomaly_score.toFixed(4)}</p>
                        <p className="text-xs text-slate-muted font-mono mt-0.5 truncate">
                          {Object.entries(a.data || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-5">

            {/* Quick Actions */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</p>
              <div className="space-y-2">
                <button
                  onClick={() => router.push("/executive")}
                  className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-brand-purple" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Executive Brief</p>
                      <p className="text-xs text-slate-muted">Financial health & insights</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-muted" />
                </button>
                <button
                  onClick={() => router.push(`/insights?report=${report.id}`)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-brand-blue" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Deep Analysis</p>
                      <p className="text-xs text-slate-muted">Metric-by-metric breakdown</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-muted" />
                </button>
                <button
                  onClick={() => router.push(`/chat?report=${report.id}`)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-blue" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">AI Assistant</p>
                      <p className="text-xs text-slate-muted">Ask questions about this report</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-muted" />
                </button>
              </div>
            </div>

            {/* Balance Sheet Summary */}
            {hasBalance && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-3.5 h-3.5 text-slate-muted" />
                  <p className="text-sm font-semibold text-gray-900">Balance Sheet</p>
                  {unit && <span className="text-xs text-slate-muted ml-auto">{unit}</span>}
                </div>
                {m.total_assets != null       && <StatRow label="Total Assets"          value={fmt(m.total_assets)} />}
                {m.total_liabilities != null  && <StatRow label="Total Liabilities"     value={fmt(m.total_liabilities)} />}
                {m.equity != null             && <StatRow label="Shareholders' Equity"  value={fmt(m.equity)} />}
                {m.cash != null               && <StatRow label="Cash & Equivalents"   value={fmt(m.cash)} />}
              </div>
            )}

            {/* Risk Summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5 text-slate-muted" />
                <p className="text-sm font-semibold text-gray-900">Risk Summary</p>
              </div>
              {m.stress_score != null && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-text">Stress Index</span>
                    <span className={`font-semibold ${
                      m.stress_score > 0.6 ? "text-fin-red" : m.stress_score > 0.3 ? "text-fin-amber" : "text-fin-green"
                    }`}>
                      {(m.stress_score * 100).toFixed(0)}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        m.stress_score > 0.6 ? "bg-fin-red" : m.stress_score > 0.3 ? "bg-fin-amber" : "bg-fin-green"
                      }`}
                      style={{ width: `${Math.min(m.stress_score * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="pt-1 border-t border-slate-border space-y-0">
                <StatRow label="Compliance Score"   value={`${m.compliance_score ?? "—"}/100`} />
                <StatRow label="Anomalies detected" value={String(anomalies.length)} />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
