"use client";

import { LucideIcon } from "lucide-react";
import { useState } from "react";

interface Props {
  label: string;
  value: string | number | null;
  unit?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "red" | "amber" | "purple";
  description?: string;
  index?: number;
}

const colorMap = {
  blue:   { icon: "text-brand-blue bg-blue-50",   value: "text-gray-900" },
  green:  { icon: "text-fin-green bg-green-50",   value: "text-fin-green" },
  red:    { icon: "text-fin-red bg-red-50",        value: "text-fin-red" },
  amber:  { icon: "text-fin-amber bg-amber-50",   value: "text-fin-amber" },
  purple: { icon: "text-brand-purple bg-purple-50", value: "text-brand-purple" },
};

export default function MetricsCard({
  label, value, unit, icon: Icon,
  color = "blue", description, index = 0,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const c = colorMap[color];
  const isNA = value === null || value === undefined;

  return (
    <div 
      className="metric-card min-w-0 relative transition-all duration-300 ease-out cursor-pointer"
      style={{
        zIndex: isHovered ? 50 : 1,
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-medium text-slate-text flex-1 mr-2 transition-all duration-300 ${
          isHovered ? 'whitespace-normal' : 'truncate'
        }`}>
          {label}
        </p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${c.icon} ${
          isHovered ? 'scale-110' : 'scale-100'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight transition-all duration-300 ${
        isNA ? "text-slate-muted" : c.value
      } ${isHovered ? 'whitespace-normal break-words' : 'truncate'}`}>
        {isNA ? "—" : value}
        {!isNA && unit && <span className="text-sm font-normal text-slate-muted ml-1">{unit}</span>}
      </p>
      {description && (
        <p className={`text-xs text-slate-muted mt-1 transition-all duration-300 ${
          isHovered ? 'whitespace-normal' : 'truncate'
        }`}>
          {description}
        </p>
      )}
    </div>
  );
}
