"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { streamChat, reportsApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, Loader2, FileText, ChevronDown, Sparkles, MessageSquare } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; streaming?: boolean; }
interface ReportOption { id: string; filename: string; }

const GENERAL_SUGGESTIONS = [
  "What is a liquidity ratio and why does it matter?",
  "How is the debt-to-assets ratio calculated?",
  "What does a high stress score indicate?",
  "Explain revenue growth and how to interpret it",
  "What is the Isolation Forest anomaly detection algorithm?",
  "What are common financial red flags in SEC filings?",
];

const REPORT_SUGGESTIONS = [
  "Summarise the key financial highlights of this report",
  "Are there any compliance or risk concerns?",
  "Explain the detected anomalies and their severity",
  "How does revenue compare to the prior period?",
  "What does the gross margin tell us about this business?",
  "What strategic actions would you recommend based on these results?",
];

function ChatContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [reports,        setReports]        = useState<ReportOption[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showReports,    setShowReports]    = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/"); return; }
    loadReports();
    const rp = searchParams.get("report");
    if (rp) setSelectedReport(rp);
  }, [router, searchParams]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadReports = async () => {
    try {
      const res = await reportsApi.list();
      setReports(res.data.filter((r: any) => r.status === "completed"));
    } catch { /* ignore */ }
  };

  const selectedReportName = reports.find((r) => r.id === selectedReport)?.filename;

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "assistant", content: "", streaming: true },
    ]);
    setLoading(true);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    streamChat(msg, selectedReport, history,
      (token) => setMessages((prev) => {
        const u = [...prev];
        const last = u[u.length - 1];
        if (last.role === "assistant") u[u.length - 1] = { ...last, content: last.content + token };
        return u;
      }),
      () => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last.role === "assistant") u[u.length - 1] = { ...last, streaming: false };
          return u;
        });
        setLoading(false);
      },
      (err) => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last.role === "assistant") u[u.length - 1] = { ...last, content: `Error: ${err}`, streaming: false };
          return u;
        });
        setLoading(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col pt-14 max-w-3xl mx-auto w-full px-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-blue" />
            <span className="text-sm font-semibold text-gray-900">Financial Assistant</span>
            <span className="text-xs bg-blue-50 text-brand-blue border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              Local · Private
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowReports(!showReports)}
              className="flex items-center gap-1.5 btn-secondary py-1.5 px-3"
            >
              <FileText className="w-3.5 h-3.5 text-slate-muted" />
              <span className="max-w-[130px] truncate text-xs">{selectedReportName || "No report"}</span>
              <ChevronDown className={`w-3 h-3 text-slate-muted transition-transform ${showReports ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showReports && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.97 }}
                  className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-border rounded-xl shadow-card-md z-50 overflow-hidden"
                >
                  <button
                    onClick={() => { setSelectedReport(null); setShowReports(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${!selectedReport ? "text-brand-blue font-medium" : "text-gray-700"}`}
                  >
                    No context (general)
                  </button>
                  {reports.map((r) => (
                    <button key={r.id}
                      onClick={() => { setSelectedReport(r.id); setShowReports(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors truncate ${selectedReport === r.id ? "text-brand-blue font-medium" : "text-gray-700"}`}
                    >
                      {r.filename}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-16"
            >
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-brand-blue" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Ask about your financial data</h2>
              <p className="text-slate-muted text-sm max-w-sm mb-6">
                {selectedReport ? `Chatting with context from: ${selectedReportName}` : "Select a report above for context-aware answers"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {(selectedReport ? REPORT_SUGGESTIONS : GENERAL_SUGGESTIONS).map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left text-xs text-gray-600 bg-white border border-slate-border hover:border-brand-blue/40 hover:text-brand-blue px-3 py-2.5 rounded-xl transition-all duration-150 shadow-card"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-brand-blue" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-blue text-white rounded-tr-sm"
                  : "bg-white border border-slate-border text-gray-800 rounded-tl-sm shadow-card"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.streaming && <span className="inline-block w-1.5 h-4 bg-brand-blue ml-0.5 cursor-blink" />}
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-text" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-brand-blue" />
              </div>
              <div className="bg-white border border-slate-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-1.5 h-1.5 bg-slate-muted rounded-full"
                      animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-border py-4">
          <div className="flex gap-2.5 items-end">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about anomalies, ratios, revenue trends…"
                disabled={loading}
                rows={1}
                className="input resize-none max-h-32 overflow-y-auto"
                style={{ minHeight: "44px" }}
              />
            </div>
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="btn-primary px-4 py-2.5 flex-shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-muted mt-2 text-center">
            Enter to send · Shift+Enter for new line · Local processing · Private
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
