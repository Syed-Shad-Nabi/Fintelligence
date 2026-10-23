"""
RAG Service — ChromaDB vector store for report context retrieval.

"""

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")


class RAGService:
    def __init__(self):
        self._client = None
        self._collection = None

    def _get_collection(self):
        if self._collection is not None:
            return self._collection
        try:
            import chromadb
            client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
            self._collection = client.get_or_create_collection(
                name="fintelligence_reports",
                metadata={"hnsw:space": "cosine"},
            )
            return self._collection
        except Exception as e:
            logger.error(f"ChromaDB init error: {e}")
            return None

    async def index_report(
        self,
        report_id: str,
        summary: str,
        metrics: Dict[str, Any],
        column_mapping: Dict[str, str],
    ) -> None:
        """Index a report's summary and metrics into ChromaDB."""
        collection = self._get_collection()
        if collection is None:
            return

        metrics_text = "\n".join(
            f"{k}: {v}" for k, v in metrics.items() if v is not None
        )
        columns_text = "Financial columns: " + ", ".join(
            f"{k}={v}" for k, v in column_mapping.items()
        )

        document = f"{summary}\n\n{metrics_text}\n\n{columns_text}"

        try:
            collection.upsert(
                documents=[document],
                ids=[report_id],
                metadatas=[{"report_id": report_id}],
            )
            logger.info(f"Report {report_id} indexed in ChromaDB.")
        except Exception as e:
            logger.error(f"ChromaDB upsert error: {e}")

    async def retrieve_context(self, query: str, report_id: Optional[str] = None) -> str:
        """Retrieve relevant context for a user query."""
        collection = self._get_collection()
        if collection is None:
            return ""

        try:
            where = {"report_id": report_id} if report_id else None
            count = collection.count()
            if count == 0:
                return ""
            results = collection.query(
                query_texts=[query],
                n_results=min(3, count),
                where=where,
            )
            docs = results.get("documents", [[]])[0]
            return "\n---\n".join(docs) if docs else ""
        except Exception as e:
            logger.error(f"ChromaDB query error: {e}")
            return ""
