"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getUser } from "@/lib/auth";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  LogOut,
  TrendingUp,
  BarChart3,
  Briefcase,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/executive", label: "Executive Brief", icon: Briefcase },
  { href: "/reports",   label: "Reports",   icon: FileText },
  { href: "/insights",  label: "Analysis",  icon: BarChart3 },
  { href: "/chat",      label: "Assistant", icon: MessageSquare },
];

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-brand-purple rounded-lg flex items-center justify-center shadow-sm">
            <TrendingUp className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base tracking-tight">FinTelligence</span>
            <p className="text-xs text-slate-muted -mt-0.5 hidden lg:block">Financial Intelligence Platform</p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-blue-50 text-brand-blue shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:block">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden lg:block text-xs text-slate-text font-medium">{user?.username}</span>
          <button
            onClick={() => { clearAuth(); router.push("/"); }}
            className="flex items-center gap-2 text-sm text-slate-text hover:text-gray-900 hover:bg-gray-50 transition-all px-3 py-1.5 rounded-lg font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
