import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()  # load .env before anything else reads os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.database import create_tables
from routes import auth, analysis, reports, system

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FinTelligence API starting up…")
    # Ensure runtime directories exist
    for d in ["uploads", "reports", "chroma_db", "db"]:
        os.makedirs(d, exist_ok=True)
    create_tables()
    logger.info("Database ready.")
    yield
    logger.info("FinTelligence API shut down.")


app = FastAPI(
    title="FinTelligence API",
    description="AI-powered local financial analysis platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


@app.get("/health")
def health():
    return {"status": "healthy", "service": "FinTelligence API"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})
