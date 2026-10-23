interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function SectionHeader({ title, subtitle, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && (
        <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-blue" />
        </div>
      )}
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-muted -mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
