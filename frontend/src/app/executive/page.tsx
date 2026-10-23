"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import FinancialHealthCard from "@/components/FinancialHealthCard";
import ExecutiveSummaryCard from "@/components/ExecutiveSummaryCard";
import WorkingCapitalCard from "@/components/WorkingCapitalCard";
import QuickReferenceCard from "@/components/QuickReferenceCard";
import MetricsCard from "@/components/MetricsCard";
import MarginBar from "@/components/MarginBar";
import { reportsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  Briefcase, DollarSign, TrendingUp, TrendingDown, Percent, BarChart3,
  Loader2, Building2, Calendar, FileText, ChevronRight, Zap, MessageSquare,
  PieChart, Target, BookOpen,
} from "lucide-react";

function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(1);
}

export default function ExecutiveBriefPage() {
  const router = useRouter();
  const [latestReport, setLatestReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.replace("/"); return; }
    loadLatest();
  }, [router, mounted]);

  const loadLatest = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.list();
      const list = res.data;
      if (list.length > 0 && list[0].status === "completed") {
        const detail = await reportsApi.get(list[0].id);
        setLatestReport(detail.data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (!latestReport) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <main className="pt-20 pb-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6 text-brand-purple" />
            </div>
            <p className="text-sm font-semibold text-gray-900">No Financial Data Available</p>
            <p className="text-slate-muted text-xs mt-1 max-w-xs">
              Upload a financial report from the Overview page to generate an executive brief
            </p>
            <button onClick={() => router.push("/dashboard")} className="btn-primary mt-4">
              Go to Overview
            </button>
          </div>
        </main>
      </div>
    );
  }

  const m = latestReport.metrics || {};
  const anomalies = latestReport.anomalies || [];
  const unit = m.unit ?? "";

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main className="pt-20 pb-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-brand-purple" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Executive Brief</h1>
              <p className="text-sm text-slate-muted">Comprehensive financial overview and key insights</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/reports/${latestReport.id}`)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Full Report
          </button>
        </div>

        {/* Company Banner */}
        {m.company && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-border rounded-xl px-5 py-4 shadow-card flex flex-wrap items-center gap-4 mb-6"
          >
            <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900">{m.company}</p>
              <p className="text-sm text-slate-muted">{m.document_type ?? "Financial Report"}</p>
            </div>
            {m.period_1_label && (
              <div className="flex items-center gap-2 text-sm text-slate-muted border-l border-slate-border pl-4">
                <Calendar className="w-4 h-4" />
                {m.period_2_label && <span>{m.period_2_label} →</span>}
                <span className="font-semibold text-gray-900">{m.period_1_label}</span>
              </div>
            )}
            {m.currency && (
              <span className="text-sm bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full font-medium">
                {m.currency}{unit ? ` · ${unit}` : ""}
              </span>
            )}
          </motion.div>
        )}

        {/* Simple Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left Column */}
          <div className="space-y-5">
            {/* Financial Health */}
            {m.financial_health_score != null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <FinancialHealthCard score={m.financial_health_score} metrics={m} />
              </motion.div>
            )}

            {/* Executive Summary */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <ExecutiveSummaryCard metrics={m} anomalyCount={anomalies.length} />
            </motion.div>

            {/* Key Metrics */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="card">
                <p className="text-sm font-semibold text-gray-900 mb-4">Key Financial Metrics</p>
                <div className="grid grid-cols-2 gap-3">
                  {m.revenue != null && (
                    <MetricsCard label="Revenue" value={fmt(m.revenue)} unit={unit} icon={DollarSign} color="blue" description="" />
                  )}
                  {m.net_income != null && (
                    <MetricsCard label="Net Income" value={fmt(m.net_income)} unit={unit}
                      icon={m.net_income < 0 ? TrendingDown : TrendingUp}
                      color={m.net_income < 0 ? "red" : "green"} description="" />
                  )}
                  {m.ebitda != null && (
                    <MetricsCard label="EBITDA" value={fmt(m.ebitda)} unit={unit} icon={Zap}
                      color={m.ebitda < 0 ? "red" : "green"} description="" />
                  )}
                  {m.gross_margin_pct != null && (
                    <MetricsCard label="Gross Margin" value={`${m.gross_margin_pct.toFixed(1)}%`} icon={Percent}
                      color={m.gross_margin_pct > 40 ? "green" : m.gross_margin_pct > 20 ? "amber" : "red"} description="" />
                  )}
                  {m.operating_margin_pct != null && (
                    <MetricsCard label="Op. Margin" value={`${m.operating_margin_pct.toFixed(1)}%`} icon={BarChart3}
                      color={m.operating_margin_pct > 15 ? "green" : m.operating_margin_pct > 5 ? "amber" : "red"} description="" />
                  )}
                  {m.revenue_growth != null && (
                    <MetricsCard label="Growth" value={`${(m.revenue_growth * 100).toFixed(1)}%`}
                      icon={m.revenue_growth < 0 ? TrendingDown : TrendingUp}
                      color={m.revenue_growth < 0 ? "red" : m.revenue_growth < 0.05 ? "amber" : "green"} description="" />
                  )}
                </div>
              </div>
            </motion.div>

            {/* Executive Summary */}
            {latestReport.summary && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Executive Summary</p>
                  </div>
                  <p className="text-sm text-slate-text leading-relaxed">{latestReport.summary}</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Working Capital */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <WorkingCapitalCard metrics={m} unit={unit} />
            </motion.div>

            {/* Margin Analysis */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="w-3.5 h-3.5 text-slate-muted" />
                  <p className="text-sm font-semibold text-gray-900">Margin Analysis</p>
                </div>
                <MarginBar label="Gross Margin"     value={m.gross_margin_pct}     goodThreshold={40} badThreshold={20} />
                <MarginBar label="Operating Margin" value={m.operating_margin_pct} goodThreshold={15} badThreshold={5} />
                <MarginBar label="Net Margin"        value={m.net_margin_pct}       goodThreshold={10} badThreshold={3} />
                <MarginBar label="EBITDA Margin"     value={m.ebitda_margin_pct}    goodThreshold={20} badThreshold={8} />
              </div>
            </motion.div>

            {/* Returns & Efficiency */}
            {(m.return_on_equity != null || m.return_on_assets != null) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-3.5 h-3.5 text-slate-muted" />
                    <p className="text-sm font-semibold text-gray-900">Returns & Efficiency</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {m.return_on_equity != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">ROE</span>
                        <span className="font-semibold text-gray-900">{m.return_on_equity.toFixed(1)}%</span>
                      </div>
                    )}
                    {m.return_on_assets != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">ROA</span>
                        <span className="font-semibold text-gray-900">{m.return_on_assets.toFixed(1)}%</span>
                      </div>
                    )}
                    {m.asset_turnover != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">Asset Turnover</span>
                        <span className="font-semibold text-gray-900">{m.asset_turnover.toFixed(3)}×</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Cost Structure */}
            {(m.cogs_pct_revenue != null || m.rnd_pct_revenue != null) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <PieChart className="w-3.5 h-3.5 text-slate-muted" />
                    <p className="text-sm font-semibold text-gray-900">Cost Structure</p>
                  </div>
                  {m.cogs_pct_revenue != null && <MarginBar label="Cost of Revenue" value={m.cogs_pct_revenue} maxScale={100} invertColor goodThreshold={60} badThreshold={80} />}
                  {m.rnd_pct_revenue != null && <MarginBar label="R&D Expense" value={m.rnd_pct_revenue} maxScale={30} goodThreshold={15} badThreshold={3} />}
                  {m.sga_pct_revenue != null && <MarginBar label="SG&A Expense" value={m.sga_pct_revenue} maxScale={30} goodThreshold={3} badThreshold={20} invertColor />}
                </div>
              </motion.div>
            )}

            {/* Balance Sheet */}
            {m.total_assets != null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-3.5 h-3.5 text-slate-muted" />
                    <p className="text-sm font-semibold text-gray-900">Balance Sheet</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {m.total_assets != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">Total Assets</span>
                        <span className="font-semibold text-gray-900">{fmt(m.total_assets)}</span>
                      </div>
                    )}
                    {m.total_liabilities != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">Total Liabilities</span>
                        <span className="font-semibold text-gray-900">{fmt(m.total_liabilities)}</span>
                      </div>
                    )}
                    {m.equity != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">Equity</span>
                        <span className="font-semibold text-gray-900">{fmt(m.equity)}</span>
                      </div>
                    )}
                    {m.cash != null && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-border last:border-0">
                        <span className="text-slate-text">Cash</span>
                        <span className="font-semibold text-gray-900">{fmt(m.cash)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
              <div className="card">
                <p className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push(`/reports/${latestReport.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-blue" />
                      <span className="text-sm font-medium text-gray-900">View Full Report</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-muted" />
                  </button>
                  <button
                    onClick={() => router.push(`/insights?report=${latestReport.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand-blue" />
                      <span className="text-sm font-medium text-gray-900">Deep Analysis</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-muted" />
                  </button>
                  <button
                    onClick={() => router.push(`/chat?report=${latestReport.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-brand-blue" />
                      <span className="text-sm font-medium text-gray-900">Ask Assistant</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-muted" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

      </main>
    </div>
  );
}
