"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import InsightCard, { MetricInsight } from "@/components/InsightCard";
import { reportsApi, insightsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  Lightbulb, FileText, ChevronDown, Loader2, AlertCircle,
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus,
  DollarSign, BarChart3, Percent, Droplets, Activity, Shield,
  Target, Zap,
} from "lucide-react";

const METRIC_CONFIG: Record<string, { label: string; format: (v: any) => string; icon: any }> = {
  revenue:              { label: "Revenue",              format: (v) => fmtNum(v),                                     icon: DollarSign },
  net_income:           { label: "Net Income",           format: (v) => fmtNum(v),                                     icon: BarChart3 },
  ebitda:               { label: "EBITDA",               format: (v) => fmtNum(v),                                     icon: Zap },
  eps_basic:            { label: "EPS (Basic)",          format: (v) => v?.toFixed(2) ?? "—",                          icon: TrendingUp },
  gross_margin_pct:     { label: "Gross Margin %",       format: (v) => v != null ? `${v.toFixed(1)}%` : "—",          icon: Percent },
  operating_margin_pct: { label: "Operating Margin %",   format: (v) => v != null ? `${v.toFixed(1)}%` : "—",          icon: Percent },
  net_margin_pct:       { label: "Net Margin %",         format: (v) => v != null ? `${v.toFixed(1)}%` : "—",          icon: Percent },
  ebitda_margin_pct:    { label: "EBITDA Margin %",      format: (v) => v != null ? `${v.toFixed(1)}%` : "—",          icon: Percent },
  revenue_growth:       { label: "Revenue Growth",       format: (v) => v != null ? `${(v*100).toFixed(1)}%` : "—",    icon: TrendingUp },
  operating_income_growth: { label: "Op. Income Growth", format: (v) => v != null ? `${(v*100).toFixed(1)}%` : "—",   icon: TrendingUp },
  return_on_equity:     { label: "Return on Equity (ROE)", format: (v) => v != null ? `${v.toFixed(1)}%` : "—",        icon: Target },
  return_on_assets:     { label: "Return on Assets (ROA)", format: (v) => v != null ? `${v.toFixed(1)}%` : "—",        icon: Target },
  asset_turnover:       { label: "Asset Turnover",       format: (v) => v != null ? `${v.toFixed(3)}×` : "—",          icon: Activity },
  liquidity_ratio:      { label: "Liquidity Ratio",      format: (v) => v?.toFixed(2) ?? "—",                          icon: Droplets },
  debt_ratio:           { label: "Debt Ratio",           format: (v) => v?.toFixed(3) ?? "—",                          icon: Activity },
  debt_to_equity:       { label: "Debt / Equity",        format: (v) => v != null ? `${v.toFixed(2)}×` : "—",          icon: Activity },
  effective_tax_rate:   { label: "Effective Tax Rate",   format: (v) => v != null ? `${v.toFixed(1)}%` : "—",          icon: Percent },
  stress_score:         { label: "Stress Index",         format: (v) => v != null ? `${(v*100).toFixed(0)}/100` : "—", icon: AlertCircle },
  compliance_score:     { label: "Compliance Score",     format: (v) => v != null ? `${v}/100` : "—",                  icon: Shield },
};

function fmtNum(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function RiskMatrix({ metrics }: { metrics: Record<string, any> }) {
  const cells = [
    { label: "Liquidity",     desc: "Current ratio",        display: metrics.liquidity_ratio?.toFixed(2) ?? "—",
      signal: !metrics.liquidity_ratio ? "neutral" : metrics.liquidity_ratio >= 2 ? "positive" : metrics.liquidity_ratio >= 1 ? "neutral" : "negative" },
    { label: "Leverage",      desc: "Debt / assets",        display: metrics.debt_ratio?.toFixed(2) ?? "—",
      signal: !metrics.debt_ratio ? "neutral" : metrics.debt_ratio <= 0.3 ? "positive" : metrics.debt_ratio <= 0.6 ? "neutral" : "negative" },
    { label: "Op. Margin",    desc: "Operating profitability", display: metrics.operating_margin_pct != null ? `${metrics.operating_margin_pct.toFixed(1)}%` : "—",
      signal: metrics.operating_margin_pct == null ? "neutral" : metrics.operating_margin_pct >= 15 ? "positive" : metrics.operating_margin_pct >= 5 ? "neutral" : "negative" },
    { label: "Net Margin",    desc: "Bottom-line margin",   display: metrics.net_margin_pct != null ? `${metrics.net_margin_pct.toFixed(1)}%` : "—",
      signal: metrics.net_margin_pct == null ? "neutral" : metrics.net_margin_pct >= 10 ? "positive" : metrics.net_margin_pct >= 3 ? "neutral" : "negative" },
    { label: "Growth",        desc: "Revenue YoY",          display: metrics.revenue_growth != null ? `${(metrics.revenue_growth*100).toFixed(1)}%` : "—",
      signal: metrics.revenue_growth == null ? "neutral" : metrics.revenue_growth >= 0.1 ? "positive" : metrics.revenue_growth >= 0 ? "neutral" : "negative" },
    { label: "Gross Margin",  desc: "Revenue minus COGS",   display: metrics.gross_margin_pct != null ? `${metrics.gross_margin_pct.toFixed(1)}%` : "—",
      signal: metrics.gross_margin_pct == null ? "neutral" : metrics.gross_margin_pct >= 40 ? "positive" : metrics.gross_margin_pct >= 20 ? "neutral" : "negative" },
    { label: "ROE",           desc: "Return on equity",     display: metrics.return_on_equity != null ? `${metrics.return_on_equity.toFixed(1)}%` : "—",
      signal: metrics.return_on_equity == null ? "neutral" : metrics.return_on_equity >= 15 ? "positive" : metrics.return_on_equity >= 8 ? "neutral" : "negative" },
    { label: "ROA",           desc: "Return on assets",     display: metrics.return_on_assets != null ? `${metrics.return_on_assets.toFixed(1)}%` : "—",
      signal: metrics.return_on_assets == null ? "neutral" : metrics.return_on_assets >= 5 ? "positive" : metrics.return_on_assets >= 2 ? "neutral" : "negative" },
    { label: "Compliance",    desc: "Heuristic risk flag",  display: metrics.compliance_score != null ? `${metrics.compliance_score}/100` : "—",
      signal: metrics.compliance_score == null ? "neutral" : metrics.compliance_score >= 80 ? "positive" : metrics.compliance_score >= 60 ? "neutral" : "negative" },
  ];

  const signalStyle = {
    positive: { card: "bg-green-50 border-green-200", text: "text-fin-green", badge: "bg-green-100 text-fin-green" },
    neutral:  { card: "bg-amber-50 border-amber-200", text: "text-fin-amber", badge: "bg-amber-100 text-fin-amber" },
    negative: { card: "bg-red-50   border-red-200",   text: "text-fin-red",   badge: "bg-red-100 text-fin-red"     },
  } as const;

  const SignalIcon = { positive: TrendingUp, neutral: Minus, negative: TrendingDown } as const;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-brand-purple" />
        <p className="text-sm font-semibold text-gray-900">Risk Assessment Matrix</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
        {cells.map((c) => {
          const s = signalStyle[c.signal as keyof typeof signalStyle];
          const Icon = SignalIcon[c.signal as keyof typeof SignalIcon] ?? Minus;
          return (
            <div key={c.label} className={`rounded-xl border px-4 py-3 ${s.card}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${s.text}`} />
                <span className={`text-xs font-semibold ${s.text}`}>{c.label}</span>
              </div>
              <p className={`text-xl font-bold font-mono ${s.text}`}>{c.display}</p>
              <p className="text-xs text-slate-muted mt-0.5">{c.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BENCHMARKS = [
  { metric: "Gross Margin",       good: "> 40%",    ok: "20 – 40%",    bad: "< 20%",    desc: "Revenue after cost of goods sold" },
  { metric: "Operating Margin",   good: "> 15%",    ok: "5 – 15%",     bad: "< 5%",     desc: "Core business profitability" },
  { metric: "Net Margin",         good: "> 10%",    ok: "3 – 10%",     bad: "< 3%",     desc: "Bottom-line after all expenses & tax" },
  { metric: "EBITDA Margin",      good: "> 20%",    ok: "8 – 20%",     bad: "< 8%",     desc: "Cash earnings proxy before non-cash items" },
  { metric: "Revenue Growth",     good: "> 10%",    ok: "0 – 10%",     bad: "< 0%",     desc: "Year-over-year top-line expansion" },
  { metric: "Liquidity Ratio",    good: "> 2.0",    ok: "1.0 – 2.0",   bad: "< 1.0",    desc: "Short-term debt coverage ability" },
  { metric: "Debt Ratio",         good: "< 0.3",    ok: "0.3 – 0.6",   bad: "> 0.6",    desc: "Higher = more leveraged / risky" },
  { metric: "Debt / Equity",      good: "< 1.0×",   ok: "1.0 – 2.0×",  bad: "> 2.0×",   desc: "Capital structure leverage multiple" },
  { metric: "Return on Equity",   good: "> 15%",    ok: "8 – 15%",     bad: "< 8%",     desc: "Shareholder return on invested equity" },
  { metric: "Return on Assets",   good: "> 5%",     ok: "2 – 5%",      bad: "< 2%",     desc: "Efficiency of asset utilisation" },
  { metric: "Compliance Score",   good: "> 80/100", ok: "60 – 80",     bad: "< 60",     desc: "Heuristic regulatory risk composite" },
];

function BenchmarkTable() {
  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-brand-blue" />
        <p className="text-sm font-semibold text-gray-900">Industry Benchmark Reference</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-border">
            <th className="text-left pb-2.5 text-slate-muted font-medium">Metric</th>
            <th className="text-center pb-2.5 text-fin-green font-semibold">Healthy</th>
            <th className="text-center pb-2.5 text-fin-amber font-semibold">Caution</th>
            <th className="text-center pb-2.5 text-fin-red font-semibold">Risk</th>
          </tr>
        </thead>
        <tbody>
          {BENCHMARKS.map((b) => (
            <tr key={b.metric} className="border-b border-slate-border last:border-0">
              <td className="py-3 pr-4">
                <p className="font-semibold text-gray-900">{b.metric}</p>
                <p className="text-slate-muted mt-0.5">{b.desc}</p>
              </td>
              <td className="text-center py-3"><span className="bg-green-50 text-fin-green border border-green-200 px-2 py-0.5 rounded-full font-medium">{b.good}</span></td>
              <td className="text-center py-3"><span className="bg-amber-50 text-fin-amber border border-amber-200 px-2 py-0.5 rounded-full font-medium">{b.ok}</span></td>
              <td className="text-center py-3"><span className="bg-red-50   text-fin-red   border border-red-200   px-2 py-0.5 rounded-full font-medium">{b.bad}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [reports,         setReports]         = useState<any[]>([]);
  const [selectedReport,  setSelectedReport]  = useState<string | null>(null);
  const [reportData,      setReportData]      = useState<any>(null);
  const [insights,        setInsights]        = useState<Record<string, MetricInsight>>({});
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError,   setInsightsError]   = useState<string | null>(null);
  const [showPicker,      setShowPicker]      = useState(false);
  const [mounted,         setMounted]         = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.replace("/"); return; }
    loadReports();
    const rp = searchParams.get("report");
    if (rp) setSelectedReport(rp);
  }, [router, searchParams, mounted]);

  useEffect(() => {
    if (selectedReport) loadReport(selectedReport);
  }, [selectedReport]);

  const loadReports = async () => {
    try {
      const res = await reportsApi.list();
      setReports(res.data.filter((r: any) => r.status === "completed"));
    } catch { /* ignore */ }
  };

  const loadReport = async (id: string) => {
    try {
      const res = await reportsApi.get(id);
      setReportData(res.data);
      setInsights({});
    } catch { /* ignore */ }
  };

  const generateInsights = async () => {
    if (!selectedReport) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await insightsApi.generate(selectedReport);
      setInsights(res.data.insights ?? {});
    } catch (e: any) {
      setInsightsError(e?.response?.data?.detail ?? "Failed to generate insights.");
    } finally { setInsightsLoading(false); }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    );
  }

  const metrics         = reportData?.metrics ?? {};
  const selectedName    = reports.find((r) => r.id === selectedReport)?.filename;
  const availableMetrics = Object.entries(METRIC_CONFIG).filter(([key]) => metrics[key] != null);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main className="pt-20 pb-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-brand-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Insights</h1>
            <p className="text-slate-muted text-sm">Deep-dive: how each metric is calculated, why it matters, and what to do</p>
          </div>
        </div>

        {/* Report picker + generate */}
        <div className="card mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-brand-blue" />
              </div>
              <div>
                <p className="text-xs text-slate-muted">Analysing report</p>
                <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">{selectedName ?? "None selected"}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <button onClick={() => setShowPicker(!showPicker)} className="btn-secondary flex items-center gap-1.5">
                  Change report <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPicker ? "rotate-180" : ""}`} />
                </button>
                {showPicker && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-border rounded-xl shadow-card-md z-50 overflow-hidden max-h-60 overflow-y-auto">
                    {reports.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-muted">No completed reports</p>
                    ) : reports.map((r) => (
                      <button key={r.id}
                        onClick={() => { setSelectedReport(r.id); setShowPicker(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors truncate ${
                          selectedReport === r.id ? "text-brand-blue font-medium" : "text-gray-700"
                        }`}
                      >
                        {r.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedReport && (
                <button onClick={generateInsights} disabled={insightsLoading} className="btn-primary flex items-center gap-1.5">
                  {insightsLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    : Object.keys(insights).length > 0
                    ? <><RefreshCw className="w-3.5 h-3.5" /> Regenerate</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Generate Insights</>
                  }
                </button>
              )}
            </div>
          </div>
          {insightsError && (
            <p className="mt-3 text-xs text-fin-red flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {insightsError}
            </p>
          )}
        </div>

        {!selectedReport ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center mb-4">
              <Lightbulb className="w-6 h-6 text-brand-purple" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Select a report to get started</p>
            <p className="text-slate-muted text-xs mt-1 max-w-xs">
              Choose a completed analysis from the dropdown, then click "Generate Insights"
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {metrics.company && (
              <div className="bg-white border border-slate-border rounded-xl px-5 py-3.5 shadow-card flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-gray-900">{metrics.company}</p>
                <span className="text-xs text-slate-muted">{metrics.document_type}</span>
                {metrics.period_1_label && (
                  <span className="text-xs bg-blue-50 text-brand-blue border border-blue-200 px-2.5 py-1 rounded-full font-medium ml-auto">
                    {metrics.period_1_label}
                  </span>
                )}
              </div>
            )}

            {reportData && <RiskMatrix metrics={metrics} />}

            {availableMetrics.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                  <p className="text-sm font-semibold text-gray-900">Metric Deep-Dives</p>
                  {Object.keys(insights).length === 0 && !insightsLoading && (
                    <span className="text-xs text-slate-muted">— click "Generate Insights" for detailed explanations</span>
                  )}
                  {insightsLoading && (
                    <span className="text-xs text-brand-blue flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Analysing…
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {availableMetrics.map(([key, cfg]) => (
                    <InsightCard key={key} metricKey={key} label={cfg.label}
                      value={cfg.format(metrics[key])} insight={insights[key] ?? null} loading={insightsLoading} />
                  ))}
                </div>
              </div>
            )}

            <BenchmarkTable />

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-brand-purple" />
                <p className="text-sm font-semibold text-gray-900">How FinTelligence Analyses Your Documents</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { step: "1", title: "Document Ingestion",      desc: "PDFs parsed with PyMuPDF. Digital PDFs use native table extraction; scanned documents use vision processing." },
                  { step: "2", title: "Metric Extraction",       desc: "Raw text is processed to identify revenue, income, assets, periods — no hardcoded rules." },
                  { step: "3", title: "Ratio Computation",       desc: "Derived metrics (liquidity, debt ratio, margins, growth rates) are computed from the extracted raw figures." },
                  { step: "4", title: "Anomaly Detection",       desc: "Isolation Forest scans tabular data for statistical outliers, flagging rows that deviate significantly from the pattern." },
                  { step: "5", title: "Context Indexing",        desc: "The summary and metrics are embedded in ChromaDB. Chat uses retrieval to answer in context." },
                  { step: "6", title: "Insight Generation",      desc: "On demand, per-metric explanations are generated tailored to the actual values in your report." },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-xs font-bold text-brand-blue flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-0.5">{title}</p>
                      <p className="text-xs text-slate-text leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    }>
      <InsightsContent />
    </Suspense>
  );
}
