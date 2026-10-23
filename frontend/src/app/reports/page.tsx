"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import { reportsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  FileText, Trash2, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, XCircle, Search, BarChart3,
} from "lucide-react";

interface ReportSummary {
  id: string; filename: string; file_type: string; status: string;
  row_count: number; col_count: number; anomaly_count: number;
  summary_preview: string; created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; label: string; cls: string }> = {
    completed:  { icon: CheckCircle2, label: "Completed",  cls: "text-fin-green border-green-200 bg-green-50" },
    processing: { icon: Clock,        label: "Processing", cls: "text-fin-amber border-amber-200 bg-amber-50" },
    failed:     { icon: XCircle,      label: "Failed",     cls: "text-fin-red   border-red-200   bg-red-50"   },
  };
  const s = map[status] || map.processing;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.cls}`}>
      <Icon className="w-3 h-3" />{s.label}
    </span>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/"); return; }
    loadReports();
  }, [router]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.list();
      setReports(res.data);
    } catch { toast.error("Failed to load reports"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this report?")) return;
    setDeleting(id);
    try {
      await reportsApi.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report deleted");
    } catch { toast.error("Delete failed"); }
    finally { setDeleting(null); }
  };

  const filtered = reports.filter(
    (r) => r.filename.toLowerCase().includes(search.toLowerCase()) ||
           r.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main className="pt-20 pb-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reports</h1>
            <p className="text-slate-text text-sm mt-0.5">{reports.length} total analyses</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-muted" />
            <input
              type="text" placeholder="Search reports…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full sm:w-60"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-slate-muted" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {search ? "No matching reports" : "No reports yet"}
            </p>
            <p className="text-slate-muted text-xs mt-1">
              {search ? "Try a different search term" : "Upload a file on the Dashboard to get started"}
            </p>
            {!search && (
              <button onClick={() => router.push("/dashboard")} className="btn-primary mt-4">
                Go to Dashboard
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-2">
              {filtered.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => router.push(`/reports/${report.id}`)}
                  className="bg-white border border-slate-border rounded-xl px-5 py-4 shadow-card cursor-pointer hover:shadow-card-md hover:border-gray-300 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 border border-slate-border rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4.5 h-4.5 text-slate-text" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate max-w-sm text-sm">{report.filename}</p>
                        <StatusBadge status={report.status} />
                        {report.anomaly_count > 0 && (
                          <span className="text-xs flex items-center gap-1 text-fin-amber font-medium">
                            <AlertTriangle className="w-3 h-3" />{report.anomaly_count} anomalies
                          </span>
                        )}
                      </div>
                      {report.summary_preview && (
                        <p className="text-xs text-slate-muted mt-0.5 line-clamp-1">{report.summary_preview}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-muted">
                        <span>{format(new Date(report.created_at), "MMM d, yyyy · h:mm a")}</span>
                        {report.row_count && <><span>·</span><span>{report.row_count.toLocaleString()} rows</span></>}
                        {report.file_type && <><span>·</span><span className="uppercase font-medium">{report.file_type}</span></>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, report.id)}
                        disabled={deleting === report.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-muted hover:text-fin-red hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-muted group-hover:text-gray-700 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
