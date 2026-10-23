# FinTelligence — 30-Minute Presentation Guide

**Your app is running:**
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## Quick Demo Flow (5–7 min)

1. **Open** http://localhost:3000
2. **Sign up** — create a new account (username, email, password)
3. **Dashboard** — you land on Overview
4. **Upload a file** — drag & drop a CSV, Excel, or PDF (e.g. `data/example_financial_data.csv` if you have one)
5. **Watch the pipeline** — progress bar shows: Extract → Metrics → Anomalies → Summary
6. **View results** — KPIs, charts, executive summary, anomalies
7. **Chat** — go to Assistant, select the report, ask: "Summarise the key financial highlights"

---

## What Is Happening (Technical Walkthrough)

### 1. When You Open the App (Frontend)

- **Next.js** serves the React app from `http://localhost:3000`
- The **auth page** (`/`) checks `localStorage` for a JWT
- If no token → show login/signup
- If token exists → redirect to `/dashboard`

### 2. When You Sign Up or Log In

**Frontend:**
- Form submits to `POST /api/auth/signup` or `POST /api/auth/login`
- **Axios** sends the request with `Content-Type: application/json`
- Response contains `access_token` (JWT) and `user` object

**Backend:**
- **FastAPI** receives the request in `routes/auth.py`
- **bcrypt** hashes the password (12 rounds)
- User is stored in **SQLite** via **SQLAlchemy**
- **python-jose** creates a JWT with `sub=user_id` and `exp=24h`
- Returns `{ access_token, token_type: "bearer", user }`

**Frontend:**
- `saveAuth()` stores token and user in `localStorage`
- **Axios interceptor** adds `Authorization: Bearer <token>` to all future requests
- Redirects to `/dashboard`

### 3. When You Upload a File

**Frontend:**
- **react-dropzone** handles drag & drop
- On drop: `analysisApi.upload(file)` → `POST /api/analysis/upload` with `FormData`
- Backend returns `{ report_id, status: "processing" }`
- Frontend starts **polling** `GET /api/analysis/status/{report_id}` every 1.5 seconds
- Progress bar updates as `progress` (0–100) increases

**Backend (Background Task):**
The `run_analysis_pipeline` runs in a background task. Steps:

| Step | Progress | What Happens |
|------|----------|--------------|
| 1 | 5% | **VisionService** (if PDF/image): PyMuPDF extracts text, or LLaVA vision model parses scanned pages |
| 2 | 20% | **load_file** or structured data from vision → Pandas DataFrame |
| 3 | 35% | **normalize_dataframe**: clean column names, detect numeric/date columns, map financial columns (revenue, assets, etc.) |
| 4 | 50% | **Financial metrics**: If PDF/image → LLM extracts metrics from text. If CSV/Excel → column-mapping engine computes liquidity, debt ratio, revenue growth |
| 5 | 60% | **Anomaly detection**: scikit-learn **Isolation Forest** on numeric columns. Flags statistical outliers. Severity: high (< -0.2), medium (-0.2 to -0.1), low (≥ -0.1) |
| 6 | 72% | **build_chart_data**: Revenue trend, period comparison, anomaly distribution |
| 7 | 80% | **LLM generate_summary**: Ollama (Mistral) writes 150–200 word executive summary |
| 8 | 92% | **RAG index**: ChromaDB indexes summary + metrics for chat retrieval |
| 9 | 97% | Write `reports/{id}/metrics.json`, `anomalies.json`, `charts.json`, `summary.txt` |
| 10 | 100% | Report status = `completed` |

**Note:** If **Ollama** is not running (`ollama serve`), LLM steps (summary, insights, chat) will fail. CSV/Excel uploads will still work for metrics and anomalies.

### 4. When You View the Dashboard / Report

**Frontend:**
- `reportsApi.list()` → `GET /api/reports/` (with JWT)
- `reportsApi.get(latestId)` → `GET /api/reports/{id}` for full detail
- Renders **MetricsCard** components for each KPI
- **Recharts** draws RevenueChart, AnomalyChart, PeriodComparisonChart
- Executive summary is displayed as plain text

**Backend:**
- `get_current_user` validates JWT via `oauth2_scheme`
- Queries SQLite for reports belonging to that user
- Returns JSON: `metrics`, `anomalies`, `charts`, `summary`, `column_mapping`

### 5. When You Use the Chat Assistant

**Frontend:**
- User selects a report (or "No context") from dropdown
- `streamChat(message, reportId, history)` → `POST /api/analysis/chat` with `{ message, report_id, history }`
- Uses **fetch** + **ReadableStream** to consume **Server-Sent Events (SSE)**
- Each `data: {"content": "token"}` line appends to the assistant message
- **ReactMarkdown** renders the response

**Backend:**
- If `report_id` provided: **RAGService** queries ChromaDB for top 3 relevant chunks
- **LLMRouter** builds prompt: system role + context from RAG + last 4 messages + user message
- **Ollama** `/api/generate` with `stream: true`
- Yields tokens as SSE: `data: {"content": "..."}\n\n`
- Sends `data: [DONE]\n\n` when complete

### 6. When You Request Insights

**Frontend:**
- User picks report, clicks "Generate Insights"
- `insightsApi.generate(reportId)` → `GET /api/analysis/insights/{report_id}`

**Backend:**
- Loads report metrics from DB
- **LLMRouter.generate_metric_insights()** sends metrics to Ollama
- Prompt asks for: definition, formula, interpretation, signal (positive/negative/neutral), recommendation
- Returns JSON keyed by metric name
- **InsightCard** components display each one

---

## Architecture Summary (1 min)

```
User Browser (React/Next.js)
        │
        │  JWT in Authorization header
        ▼
FastAPI Backend (Python)
        │
        ├── SQLite (users, reports)
        ├── ChromaDB (RAG vectors)
        ├── Self-trained ML models (risk classifier + anomaly model)
        ├── Ollama (Mistral for text, LLaVA for vision)
        └── Pandas + scikit-learn (data + anomalies)
```

---

## Key Technologies to Mention

| Layer | Tech | Role |
|-------|------|------|
| Frontend | Next.js 14 | React framework, App Router |
| Frontend | Tailwind + Framer Motion | Styling, animations |
| Frontend | Recharts | Charts |
| Backend | FastAPI | REST API |
| Backend | SQLAlchemy + SQLite | Users, reports |
| Backend | ChromaDB | Vector store for RAG |
| Backend | Ollama (Mistral, LLaVA) | LLM for extraction, summary, chat |
| Backend | scikit-learn Isolation Forest | Anomaly detection |
| Backend | Pandas | Data processing |
| Auth | JWT + bcrypt | Stateless auth, password hashing |

---

## Common Questions & Answers

**Q: Where is the data stored?**  
A: Locally — SQLite for users/reports, ChromaDB for RAG embeddings, files in `uploads/` and `reports/`.

**Q: Does it use external APIs?**  
A: No. Inference is local only. No API keys are required.

**Q: Which models are self-trained by your team?**  
A: Two scikit-learn models trained locally: a risk classifier (`healthy/warning/risk`) and an anomaly model. Training artifacts and metrics are stored in `backend/ml_artifacts/`.

**Q: What file formats are supported?**  
A: CSV, XLSX, JSON, PDF (digital and scanned), PNG, JPG, TIFF.

**Q: How does anomaly detection work?**  
A: Isolation Forest — an unsupervised ML algorithm that flags rows that are statistically different from the rest. Lower scores = more anomalous.

**Q: How does the chat get context?**  
A: RAG (Retrieval-Augmented Generation). When you select a report, ChromaDB retrieves the most relevant chunks (summary + metrics). Those are injected into the LLM prompt so answers are grounded in your data.

---

## If Something Breaks

- **Backend won't start:** Ensure `db/`, `uploads/`, `reports/`, `chroma_db/` exist in `backend/`
- **401 on API calls:** Token expired or missing — log out and log back in
- **LLM errors:** Ollama must be running (`ollama serve`) and models pulled (`ollama pull mistral`, `ollama pull llava`)
- **CORS errors:** Backend has `allow_origins=["*"]` — should work. Check `NEXT_PUBLIC_API_URL` points to backend

---

## Demo Checklist

- [ ] Backend running (http://localhost:8000/health)
- [ ] Frontend running (http://localhost:3000)
- [ ] Ollama running (optional but needed for summary, chat, insights)
- [ ] Test file ready (CSV or Excel)
- [ ] Account created
- [ ] One successful upload + analysis
- [ ] Chat with report context works
