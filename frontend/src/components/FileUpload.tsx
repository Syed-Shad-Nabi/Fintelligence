"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { analysisApi } from "@/lib/api";
import { Upload, FileType, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props { onComplete: (reportId: string) => void; }
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

const ACCEPTED = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/json": [".json"],
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff"],
};

export default function FileUpload({ onComplete }: Props) {
  const [state,    setState]    = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  const pollStatus = useCallback(async (id: string) => {
    const iv = setInterval(async () => {
      try {
        const res = await analysisApi.status(id);
        const { status, progress: pct } = res.data;
        setProgress(pct);
        if (status === "completed") {
          clearInterval(iv);
          setState("done");
          setTimeout(() => onComplete(id), 700);
        } else if (status === "failed") {
          clearInterval(iv);
          setState("error");
          toast.error(res.data.error_message || "Analysis failed");
        }
      } catch { clearInterval(iv); setState("error"); }
    }, 1500);
  }, [onComplete]);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    const file = accepted[0];
    setFileName(file.name);
    setState("uploading");
    setProgress(0);
    try {
      const res = await analysisApi.upload(file);
      setState("processing");
      pollStatus(res.data.report_id);
    } catch (err: any) {
      setState("error");
      toast.error(err.response?.data?.detail || "Upload failed");
    }
  }, [pollStatus]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop, accept: ACCEPTED, maxFiles: 1, maxSize: 50 * 1024 * 1024,
    disabled: state !== "idle" && state !== "error",
  });

  const reset = () => { setState("idle"); setProgress(0); setFileName(""); };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {(state === "idle" || state === "error") && (
          <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            {...(getRootProps() as any)}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragReject     ? "border-fin-red bg-red-50"
              : isDragActive   ? "border-brand-blue bg-blue-50"
              : state === "error" ? "border-fin-red/50 bg-red-50"
              : "border-gray-200 hover:border-brand-blue hover:bg-blue-50/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {state === "error" ? (
                <AlertCircle className="w-9 h-9 text-fin-red" />
              ) : (
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isDragActive ? "bg-brand-blue text-white" : "bg-gray-100"}`}>
                  <Upload className={`w-5 h-5 ${isDragActive ? "text-white" : "text-slate-text"}`} />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {state === "error" ? "Upload failed — try again" : isDragActive ? "Drop your file here" : "Drag & drop or click to upload"}
                </p>
                <p className="text-xs text-slate-muted mt-0.5">CSV, XLSX, JSON, PDF, or images (max 50 MB)</p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {["CSV", "XLSX", "JSON", "PDF", "PNG"].map((ext) => (
                  <span key={ext} className="text-xs bg-white border border-slate-border px-2 py-0.5 rounded font-medium text-slate-text">{ext}</span>
                ))}
              </div>
              {state === "error" && (
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="btn-secondary text-xs py-1.5">Reset</button>
              )}
            </div>
          </motion.div>
        )}

        {(state === "uploading" || state === "processing") && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-gray-50 border border-slate-border rounded-xl p-7 text-center"
          >
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-blue-100 bg-blue-50 flex items-center justify-center">
                  <FileType className="w-6 h-6 text-brand-blue" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Loader2 className="w-5 h-5 text-brand-blue animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">{fileName}</p>
                <p className="text-xs text-slate-muted mt-0.5">
                  {state === "uploading" ? "Uploading file…" : "Running analysis pipeline…"}
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-slate-muted mb-1.5">
                  <span>Progress</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-brand-blue rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {["Extract", "Metrics", "Anomalies", "Summary"].map((step, i) => (
                  <span key={step} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    progress > i * 25
                      ? "border-blue-200 text-brand-blue bg-blue-50"
                      : "border-gray-200 text-slate-muted"
                  }`}>{step}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {state === "done" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-green-50 border border-green-200 rounded-xl p-7 text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-green-100 border border-green-300 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-fin-green" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Analysis Complete</p>
                <p className="text-xs text-slate-muted mt-0.5">Redirecting to report…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
