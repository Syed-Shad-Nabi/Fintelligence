"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import { saveAuth, isAuthenticated } from "@/lib/auth";
import { TrendingUp, Shield, FileText, BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";

const features = [
  { icon: FileText,  label: "Executive Summaries", desc: "Automated financial insights" },
  { icon: TrendingUp, label: "Revenue Trends",   desc: "Interactive financial charts" },
  { icon: Shield,    label: "Anomaly Detection", desc: "Isolation Forest ML engine" },
  { icon: BarChart3, label: "Metrics Engine",    desc: "Liquidity, debt & stress scores" },
];

export default function AuthPage() {
  const router = useRouter();
  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form,     setForm]     = useState({ username: "", email: "", password: "" });

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = mode === "signup"
        ? await authApi.signup(form.username, form.email, form.password)
        : await authApi.login(form.username, form.password);
      saveAuth(res.data.access_token, res.data.user);
      toast.success(`Welcome, ${res.data.user.username}`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] p-14 bg-white border-r border-slate-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">FinTelligence</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Intelligent financial<br />analysis, locally.
            </h1>
            <p className="text-slate-text text-sm mt-3 leading-relaxed max-w-xs">
              Upload SEC filings, spreadsheets, or scanned reports and get instant
              anomaly detection, ratios, and executive summaries — 100% on your machine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="border border-slate-border rounded-xl p-4 bg-gray-50">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-3.5 h-3.5 text-brand-blue" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-slate-muted mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-muted">All data stays local · No external APIs · No telemetry</p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-2.5 mb-7 lg:hidden">
            <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">FinTelligence</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-border shadow-card-md p-7">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {mode === "login" ? "Sign in to your account" : "Create an account"}
            </h2>
            <p className="text-xs text-slate-muted mb-6">
              {mode === "login" ? "Enter your credentials to continue" : "Fill in the details below to get started"}
            </p>

            <div className="flex bg-gray-100 rounded-lg p-0.5 mb-6 border border-gray-200">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    mode === m
                      ? "bg-white text-gray-900 shadow-card"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Username</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="your_username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    autoComplete="username"
                  />
                </div>

                {mode === "signup" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="text-xs font-medium text-gray-700 block mb-1.5">Email</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </motion.div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      className="input pr-11"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted hover:text-gray-600 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-1">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </motion.form>
            </AnimatePresence>

            <p className="text-center text-xs text-slate-muted mt-5 pt-4 border-t border-slate-border">
              All data stays local · No external APIs
            </p>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
