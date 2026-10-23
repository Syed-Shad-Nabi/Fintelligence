# FinTelligence — Financial Analysis Platform

> 100% local financial analysis. Upload SEC filings, CSV exports, or scanned documents — get instant anomaly detection, metrics, and executive summaries.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Docker Compose                  │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Next.js  │  │ FastAPI  │  │  Local    │ │
│  │ Frontend │→ │ Backend  │→ │  Runtime  │ │
│  │ :3000    │  │ :8000    │  │  :11434   │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│                     │                       │
│              ┌──────┴──────┐               │
│              │   SQLite DB │               │
│              │  ChromaDB   │               │
│              └─────────────┘               │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer       | Technology                                               |
|-------------|----------------------------------------------------------|
| Frontend    | Next.js 14, TypeScript, TailwindCSS, Framer Motion       |
| Charts      | Recharts                                                  |
| Backend     | Python 3.11, FastAPI, SQLAlchemy (SQLite)                |
| ML          | scikit-learn (Isolation Forest), Pandas, NumPy           |
| Vector DB   | ChromaDB (local persistent)                              |
| Auth        | JWT + bcrypt                                             |
| OCR         | PyMuPDF (primary)                                        |

---

## Prerequisites

- Docker Desktop (with Compose v2)
- 16 GB RAM recommended (8 GB minimum)
- GPU optional — for GPU: uncomment `deploy` section in `docker-compose.yml`

---

## Quick Start

```bash
# 1. Clone the project
git clone <repo-url>
cd Fintelligence_Local

# 2. Start everything (first run pulls models — ~15 GB total)
docker compose up --build

# 3. Open the app
open http://localhost:3000
```

---

## Feature Walkthrough

### 1. Authentication
- Sign up / Log in at `http://localhost:3000`
- Passwords hashed with bcrypt, sessions managed via JWT

### 2. File Upload
- Drag-and-drop CSV, XLSX, JSON, PDF, or scanned images
- Real-time progress bar through the pipeline stages

### 3. Analysis Pipeline
```
Upload → OCR (if PDF/image) → Normalize DataFrame
       → Financial Metrics → Anomaly Detection
       → Chart Data → Executive Summary
       → Index in ChromaDB
```

### 4. Dashboard
- Liquidity Ratio, Stress Score, Compliance Score, Anomaly Count
- Revenue trend chart, Anomaly distribution chart
- Executive summary

### 5. Reports Page
- Full history of all analyses
- Click any report for detailed view

### 6. Chat Assistant
- RAG-powered chat: select a report for context-aware answers
- Streaming responses
- Suggested prompts for common queries

---

## Financial Metrics

| Metric           | Formula                                                     |
|------------------|-------------------------------------------------------------|
| Liquidity Ratio  | `current_assets / current_liabilities`                     |
| Debt Ratio       | `total_debt / total_assets`                                 |
| Revenue Growth   | `(period_last - period_first) / abs(period_first)`         |
| Stress Score     | `0.3×volatility + 0.3×debt_ratio + 0.2×liq_penalty`       |
| Compliance Score | Starts at 100, deducted for high debt, low liquidity, etc. |

## Anomaly Severity Rules

| Score Range   | Severity |
|---------------|----------|
| `< -0.2`      | HIGH     |
| `-0.2` to `-0.1` | MEDIUM |
| `≥ -0.1`      | LOW      |

---

## Project Structure

```
Fintelligence_Local/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── data_pipeline.py
│   ├── models/
│   │   ├── database.py          # SQLAlchemy models
│   │   └── schemas.py           # Pydantic schemas
│   ├── routes/
│   │   ├── auth.py              # /api/auth/*
│   │   ├── analysis.py          # /api/analysis/*
│   │   └── reports.py           # /api/reports/*
│   └── services/
│       ├── llm_router.py        # Model routing
│       ├── anomaly_detection.py # Isolation Forest
│       ├── financial_metrics.py # Deterministic metrics
│       └── rag_service.py       # ChromaDB RAG
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Auth (login/signup)
│       │   ├── dashboard/        # Main dashboard
│       │   ├── reports/          # Reports list + detail
│       │   └── chat/             # Chat interface
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── FileUpload.tsx
│       │   ├── MetricsCard.tsx
│       │   ├── RevenueChart.tsx
│       │   └── AnomalyChart.tsx
│       └── lib/
│           ├── api.ts            # Axios + SSE client
│           └── auth.ts           # JWT helpers
└── data/
    └── example_financial_data.csv
```

---

## GPU Support

To enable GPU acceleration, uncomment in `docker-compose.yml`:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires NVIDIA Container Toolkit installed on the host.

---

## Development (without Docker)

### Backend
```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export OLLAMA_HOST=http://localhost:11434
export JWT_SECRET=dev-secret

uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install

echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Local Runtime
```bash
# Install: https://ollama.ai
ollama serve &
ollama pull mistral:7b-instruct
ollama pull llama3:8b-instruct
ollama pull deepseek-llm:7b
```

---

## Supported File Formats

| Format | Method              |
|--------|---------------------|
| CSV    | Pandas read_csv     |
| XLSX   | Pandas read_excel   |
| JSON   | Pandas DataFrame    |
| PDF    | PyMuPDF             |
| Images | Vision processing   |

---

## API Reference

| Method | Endpoint                       | Description              |
|--------|--------------------------------|--------------------------|
| POST   | `/api/auth/signup`             | Register new user        |
| POST   | `/api/auth/login`              | Get JWT token            |
| GET    | `/api/auth/me`                 | Current user info        |
| POST   | `/api/analysis/upload`         | Upload & analyze file    |
| GET    | `/api/analysis/status/{id}`    | Poll analysis progress   |
| POST   | `/api/analysis/chat`           | Streaming RAG chat       |
| GET    | `/api/reports/`                | List user reports        |
| GET    | `/api/reports/{id}`            | Get report detail        |
| DELETE | `/api/reports/{id}`            | Delete report            |

Interactive API docs: `http://localhost:8000/docs`

---

## College Compliance (Local Models, No API Keys)

- This project runs fully local inference through Ollama (`OLLAMA_HOST`).
- No OpenAI/Anthropic/cloud API keys are required.
- Configure explicit local models with:
  - `LLM_MODEL` for text analysis/chat/summary
  - `VISION_MODEL` for scanned/image document extraction
- Build custom team model variants with:
  - `scripts/setup-local-models.ps1`
  - `models/Modelfile.fintel-analyst`
  - `models/Modelfile.fintel-vision`
- Live model info is available at `GET /api/system/model-info` for demo proof.

## Self-Trained Models (Required Deliverable)

This project now includes two self-trained ML models (trained locally by your team):

- `risk_classifier.pkl` — classifies financial state: `healthy | warning | risk`
- `anomaly_model.pkl` — unsupervised anomaly signal over financial feature vector

Train and save artifacts:

```bash
python scripts/train_self_models.py
```

Artifacts are written to:

- `backend/ml_artifacts/risk_classifier.pkl`
- `backend/ml_artifacts/anomaly_model.pkl`
- `backend/ml_artifacts/training_metrics.json`

At runtime, these model outputs are added into each report's metrics as:

- `ml_risk_label`
- `ml_risk_confidence`
- `ml_anomaly_score`
- `ml_anomaly_flag`
- `ml_models_loaded`

---

## License

MIT
