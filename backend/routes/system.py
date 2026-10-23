import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()


@router.get("/model-info")
def model_info():
    artifact_dir = Path(os.getenv("ML_ARTIFACT_DIR", "./ml_artifacts"))
    return {
        "ollama_host": os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        "llm_model": os.getenv("LLM_MODEL", "llama3.1:8b"),
        "vision_model": os.getenv("VISION_MODEL", "llava-phi3"),
        "self_trained_models": {
            "risk_classifier": (artifact_dir / "risk_classifier.pkl").exists(),
            "anomaly_model": (artifact_dir / "anomaly_model.pkl").exists(),
        },
        "api_keys_required": False,
        "inference_mode": "local_ollama",
    }
