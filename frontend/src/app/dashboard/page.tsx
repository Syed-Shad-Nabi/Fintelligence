"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import FileUpload from "@/components/FileUpload";
import MetricsCard from "@/components/MetricsCard";
import QuickReferenceCard from "@/components/QuickReferenceCard";
import { reportsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  Droplets, TrendingDown, TrendingUp, AlertTriangle, Shield,
  FileText, ChevronRight, RefreshCw, DollarSign, BarChart3,
  Building2, Calendar, Percent, CheckCircle2, Clock, XCircle, Loader2,
} from "lucide-react";

function CompanyBanner({ m }: { m: any }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-white border border-slate-border rounded-xl px-5 py-3.5 shadow-card transition-all duration-300 cursor-pointer"
      style={{
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${
          isHovered ? 'scale-110' : 'scale-100'
        }`}>
          <Building2 className="w-4.5 h-4.5 text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold text-gray-900 transition-all duration-300 ${
            isHovered ? 'whitespace-normal' : 'truncate'
          }`}>
            {m.company}
          </p>
          <p className={`text-xs text-slate-muted transition-all duration-300 ${
            isHovered ? 'whitespace-normal' : 'truncate'
          }`}>
            {m.document_type ?? "Financial Report"}
          </p>
        </div>
        {m.currency && (
          <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
            {m.currency}{m.unit ? ` · ${m.unit}` : ""}
          </span>
        )}
      </div>
      {m.period_1_label && (
        <div className="flex items-center gap-1.5 text-xs text-slate-muted pt-2 border-t border-slate-border">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className={`transition-all duration-300 ${
            isHovered ? 'whitespace-normal' : 'truncate'
          }`}>
            {m.period_1_label}
          </span>
        </div>
      )}
    </div>
  );
}

const RevenueChart     = dynamic(() => import("@/components/RevenueChart"), { ssr: false });
const AnomalyChart     = dynamic(() => import("@/components/AnomalyChart"), { ssr: false });
const PeriodComparison = dynamic(() => import("@/components/PeriodComparisonChart"), { ssr: false });

interface ReportSummary {
  id: string;
  filename: string;
  status: string;
  anomaly_count: number;
  summary_preview: string;
  created_at: string;
}

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(decimals);
}

const statusIcon = (s: string) =>
  s === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-fin-green" />
  : s === "failed"  ? <XCircle className="w-3.5 h-3.5 text-fin-red" />
  : <Clock className="w-3.5 h-3.5 text-fin-amber" />;

export default function DashboardPage() {
  const router = useRouter();
  const [latestReport, setLatestReport] = useState<any>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.replace("/"); return; }
    loadDashboard();
  }, [router, mounted]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.list();
      const list: ReportSummary[] = res.data;
      setReports(list);
      if (list.length > 0 && list[0].status === "completed") {
        const detail = await reportsApi.get(list[0].id);
        setLatestReport(detail.data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    );
  }

  const m      = latestReport?.metrics ?? {};
  const charts = latestReport?.charts  ?? {};

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main className="pt-20 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">Overview</h1>
            <p className="text-slate-text text-sm mt-0.5 truncate">Upload data or review your latest analysis</p>
          </div>
          <button onClick={loadDashboard} className="btn-secondary flex items-center gap-2 flex-shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left sidebar */}
          <div className="xl:col-span-1 space-y-4">
            <div className="card">
              <p className="text-sm font-semibold text-gray-900 mb-3">Upload Financial Data</p>
              <FileUpload onComplete={(id) => router.push(`/reports/${id}`)} />
            </div>

            <QuickReferenceCard />

            {reports.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-heading mb-0">Recent Reports</p>
                  <button
                    onClick={() => router.push("/reports")}
                    className="text-xs text-brand-blue hover:text-blue-700 flex items-center gap-0.5 font-medium"
                  >
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1">
                  {reports.slice(0, 5).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => router.push(`/reports/${r.id}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-slate-text" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{r.filename}</p>
                        <p className="text-xs text-slate-muted flex items-center gap-1 mt-0.5">
                          {statusIcon(r.status)} {r.status}
                          {r.anomaly_count > 0 && <span className="ml-1">· {r.anomaly_count} anomalies</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="xl:col-span-2 space-y-5">

            {/* Company / document banner */}
          {!loading && m.company && <CompanyBanner m={m} />}

            {/* KPI cards */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card h-28 animate-pulse bg-gray-100" />
                ))}
              </div>
            ) : m.revenue != null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricsCard label="Revenue" value={fmt(m.revenue)} unit={m.unit} icon={DollarSign} color="blue" description="" />
                <MetricsCard label="Net Income" value={fmt(m.net_income)} unit={m.unit}
                  icon={BarChart3} color={m.net_income != null && m.net_income < 0 ? "red" : "green"} description="" />
                <MetricsCard label="Gross Margin"
                  value={m.gross_margin_pct != null ? `${m.gross_margin_pct.toFixed(1)}%` : fmt(m.gross_margin)}
                  icon={Percent} color={m.gross_margin_pct != null && m.gross_margin_pct > 40 ? "green" : m.gross_margin_pct != null && m.gross_margin_pct > 20 ? "amber" : "red"}
                  description="" />
                <MetricsCard label="Op. Margin"
                  value={m.operating_margin_pct != null ? `${m.operating_margin_pct.toFixed(1)}%` : null}
                  icon={BarChart3}
                  color={!m.operating_margin_pct ? "blue" : m.operating_margin_pct > 15 ? "green" : m.operating_margin_pct > 5 ? "amber" : "red"}
                  description="" />
                <MetricsCard label="EBITDA" value={fmt(m.ebitda)} unit={m.unit} icon={Percent}
                  color={m.ebitda == null ? "blue" : m.ebitda < 0 ? "red" : "green"} description="" />
                <MetricsCard label="Growth"
                  value={m.revenue_growth != null ? `${(m.revenue_growth * 100).toFixed(1)}%` : null}
                  icon={m.revenue_growth != null && m.revenue_growth < 0 ? TrendingDown : TrendingUp}
                  color={m.revenue_growth == null ? "blue" : m.revenue_growth < 0 ? "red" : m.revenue_growth < 0.05 ? "amber" : "green"}
                  description="" />
              </div>
            ) : m.compliance_score != null ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricsCard label="Liquidity" value={m.liquidity_ratio?.toFixed(2) ?? null} icon={Droplets}
                  color={!m.liquidity_ratio ? "blue" : m.liquidity_ratio < 1 ? "red" : m.liquidity_ratio < 1.5 ? "amber" : "green"}
                  description="" />
                <MetricsCard label="Stress" value={m.stress_score != null ? `${(m.stress_score * 100).toFixed(0)}%` : null}
                  icon={AlertTriangle}
                  color={m.stress_score == null ? "blue" : m.stress_score > 0.6 ? "red" : m.stress_score > 0.3 ? "amber" : "green"}
                  description="" />
                <MetricsCard label="Compliance" value={m.compliance_score ?? null} unit="/100" icon={Shield}
                  color={m.compliance_score == null ? "blue" : m.compliance_score < 60 ? "red" : m.compliance_score < 80 ? "amber" : "green"}
                  description="" />
                <MetricsCard label="Anomalies" value={m.anomaly_count ?? 0}
                  icon={m.anomaly_count > 5 ? TrendingDown : TrendingUp}
                  color={!m.anomaly_count ? "green" : m.anomaly_count < 5 ? "amber" : "red"}
                  description="" />
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-brand-blue" />
                </div>
                <p className="text-sm font-semibold text-gray-900">No analyses yet</p>
                <p className="text-slate-muted text-xs mt-1">Upload a financial file to see metrics here</p>
              </div>
            )}

            {/* Period comparison chart */}
            {charts.period_comparison && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-900">Period Comparison</p>
                  <span className="text-xs text-slate-muted">{m.unit ?? ""}</span>
                </div>
                <PeriodComparison data={charts.period_comparison} unit={m.unit} />
              </div>
            )}

            {/* Revenue trend / anomaly distribution */}
            {(charts.revenue_trend || charts.anomaly_distribution) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {charts.revenue_trend && (
                  <div className="card">
                    <p className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend</p>
                    <RevenueChart data={charts.revenue_trend} />
                  </div>
                )}
                {charts.anomaly_distribution && (
                  <div className="card">
                    <p className="text-sm font-semibold text-gray-900 mb-4">Anomaly Distribution</p>
                    <AnomalyChart distribution={charts.anomaly_distribution} />
                  </div>
                )}
              </div>
            )}

            {/* Executive summary */}
            {latestReport?.summary && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">AI Executive Summary</p>
                  <span className="text-xs bg-purple-50 text-brand-purple border border-purple-100 px-2.5 py-1 rounded-full font-medium">
                    Powered by Ollama
                  </span>
                </div>
                <p className="text-sm text-slate-text leading-relaxed">{latestReport.summary}</p>
                <button
                  onClick={() => router.push(`/reports/${latestReport.id}`)}
                  className="mt-4 text-xs text-brand-blue hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  View full report <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
