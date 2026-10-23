"use client";

interface MarginBarProps {
  label: string;
  value: number | null | undefined;
  maxScale?: number;
  goodThreshold?: number;
  badThreshold?: number;
  unit?: string;
  invertColor?: boolean;
}

export default function MarginBar({
  label,
  value,
  maxScale = 60,
  goodThreshold,
  badThreshold,
  unit = "%",
  invertColor = false,
}: MarginBarProps) {
  if (value == null) return null;

  const isNeg   = value < 0;
  const absVal  = Math.abs(value);
  const barPct  = Math.min(absVal, maxScale) / maxScale * 100;

  let color = "bg-brand-blue";
  let textColor = "text-gray-900";

  if (goodThreshold !== undefined && badThreshold !== undefined) {
    const good = invertColor ? value <= goodThreshold : value >= goodThreshold;
    const bad  = invertColor ? value > badThreshold  : value < badThreshold;
    if (isNeg || bad) {
      color = "bg-fin-red";
      textColor = "text-fin-red";
    } else if (good) {
      color = "bg-fin-green";
      textColor = "text-fin-green";
    } else {
      color = "bg-fin-amber";
      textColor = "text-fin-amber";
    }
  } else if (isNeg) {
    color = "bg-fin-red";
    textColor = "text-fin-red";
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-slate-text w-40 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold font-mono w-14 text-right flex-shrink-0 ${textColor}`}>
        {isNeg ? "(" : ""}{absVal.toFixed(1)}{unit}{isNeg ? ")" : ""}
      </span>
    </div>
  );
}
