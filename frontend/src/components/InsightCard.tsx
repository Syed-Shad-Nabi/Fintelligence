"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, TrendingUp, TrendingDown, Minus, BookOpen, Calculator, Target, Lightbulb } from "lucide-react";
import { clsx } from "clsx";

export interface MetricInsight {
  definition: string;
  formula: string;
  interpretation: string;
  signal: "positive" | "negative" | "neutral";
  recommendation: string;
}

interface Props {
  metricKey: string;
  label: string;
  value: string | number | null;
  insight: MetricInsight | null;
  loading?: boolean;
}

const SIGNAL_CONFIG = {
  positive: {
    icon: TrendingUp,
    color: "text-fin-green",
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-50 text-fin-green border border-green-200",
    label: "Positive",
  },
  negative: {
    icon: TrendingDown,
    color: "text-fin-red",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-50 text-fin-red border border-red-200",
    label: "Risk Signal",
  },
  neutral: {
    icon: Minus,
    color: "text-fin-amber",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-50 text-fin-amber border border-amber-200",
    label: "Neutral",
  },
};

export default function InsightCard({ metricKey, label, value, insight, loading }: Props) {
  const [open, setOpen] = useState(false);
  const signal = insight?.signal ?? "neutral";
  const cfg = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.neutral;
  const SignalIcon = cfg.icon;

  return (
    <div className={clsx(
      "rounded-xl border transition-all duration-150 overflow-hidden",
      open ? "border-brand-blue shadow-card" : "border-slate-border hover:border-gray-300 shadow-card"
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-4 text-left bg-white"
      >
        <div className={clsx("w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0", cfg.bg)}>
          <SignalIcon className={clsx("w-4 h-4", cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            {insight && (
              <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", cfg.badge)}>
                {cfg.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-muted mt-0.5 font-mono">{value ?? "—"}</p>
        </div>

        {loading ? (
          <div className="w-4 h-4 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin flex-shrink-0" />
        ) : insight ? (
          <ChevronDown className={clsx("w-4 h-4 text-slate-muted flex-shrink-0 transition-transform", open && "rotate-180")} />
        ) : (
          <span className="text-xs text-slate-muted flex-shrink-0">No data</span>
        )}
      </button>

      <AnimatePresence>
        {open && insight && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-border bg-gray-50">
              <InfoRow icon={BookOpen}    label="Definition"      value={insight.definition} />
              <InfoRow icon={Calculator}  label="Formula"         value={insight.formula} mono />
              <InfoRow icon={Target}      label="Interpretation"  value={insight.interpretation} />
              <InfoRow icon={Lightbulb}   label="Recommendation"  value={insight.recommendation} highlight />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono, highlight }: {
  icon: any; label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 bg-white rounded-lg border border-slate-border flex items-center justify-center flex-shrink-0 mt-0.5 shadow-card">
        <Icon className="w-3.5 h-3.5 text-slate-text" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-muted uppercase tracking-wider mb-0.5">{label}</p>
        <p className={clsx(
          "text-xs leading-relaxed",
          mono ? "font-mono text-brand-blue" : "text-gray-700",
          highlight && "text-fin-green font-medium"
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}
