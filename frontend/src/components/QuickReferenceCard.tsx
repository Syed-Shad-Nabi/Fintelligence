"use client";

import { BookOpen, TrendingUp, Shield, DollarSign, Target } from "lucide-react";

export default function QuickReferenceCard() {
  const metrics = [
    {
      category: "Profitability",
      icon: DollarSign,
      items: [
        { name: "Gross Margin", benchmark: "> 40%", desc: "Revenue efficiency after COGS" },
        { name: "Operating Margin", benchmark: "> 15%", desc: "Core business profitability" },
        { name: "Net Margin", benchmark: "> 10%", desc: "Bottom-line after all expenses" },
      ],
    },
    {
      category: "Liquidity",
      icon: Shield,
      items: [
        { name: "Current Ratio", benchmark: "> 1.5", desc: "Short-term debt coverage" },
        { name: "Working Capital", benchmark: "Positive", desc: "Operational cash buffer" },
      ],
    },
    {
      category: "Returns",
      icon: Target,
      items: [
        { name: "ROE", benchmark: "> 15%", desc: "Shareholder return" },
        { name: "ROA", benchmark: "> 5%", desc: "Asset efficiency" },
      ],
    },
    {
      category: "Leverage",
      icon: TrendingUp,
      items: [
        { name: "Debt Ratio", benchmark: "< 0.4", desc: "Total debt / assets" },
        { name: "Debt / EBITDA", benchmark: "< 3×", desc: "Leverage coverage" },
      ],
    },
  ];

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-brand-purple" />
        <p className="text-sm font-semibold text-gray-900">CFO Quick Reference</p>
      </div>

      <div className="space-y-4">
        {metrics.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.category}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 text-brand-blue" />
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{cat.category}</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {cat.items.map((item) => (
                  <div key={item.name} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">{item.name}</p>
                      <p className="text-xs text-slate-muted">{item.desc}</p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-brand-blue flex-shrink-0">
                      {item.benchmark}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-border">
        <p className="text-xs text-slate-text leading-relaxed">
          These benchmarks are industry averages. Actual targets vary by sector, company size, and growth stage.
        </p>
      </div>
    </div>
  );
}
