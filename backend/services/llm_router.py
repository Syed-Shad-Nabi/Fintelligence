import json
import logging
import os
import re
import time
from typing import Any, AsyncGenerator, Dict, List

import httpx

logger = logging.getLogger(__name__)

OLLAMA_HOST  = os.getenv("OLLAMA_HOST", "http://localhost:11434")
SINGLE_MODEL = os.getenv("MODEL", "llama3.1:8b")
CTX_WINDOW   = int(os.getenv("LLM_CTX", "8192"))


def route_llm(task_type: str) -> str:
    return SINGLE_MODEL


class LLMRouter:
    def __init__(self):
        self.base_url = OLLAMA_HOST
        self.model    = SINGLE_MODEL
        self.timeout  = httpx.Timeout(90.0, connect=10.0)

    def _opts(self, max_tokens: int = -1) -> Dict[str, Any]:
        return {
            "num_ctx":     CTX_WINDOW,
            "num_predict": max_tokens,
            "temperature": 0.1,
        }

    async def _generate(self, prompt: str, task: str = "generate", max_tokens: int = -1) -> str:
        payload = {
            "model":   self.model,
            "prompt":  prompt,
            "stream":  False,
            "options": self._opts(max_tokens),
        }
        logger.info(
            "LLM request  | task=%s model=%s ctx=%d prompt_chars=%d",
            task, self.model, CTX_WINDOW, len(prompt),
        )
        logger.debug("LLM prompt [%s]:\n%s", task, prompt)
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                result = resp.json().get("response", "").strip()
                elapsed = time.perf_counter() - t0
                logger.info(
                    "LLM response | task=%s response_chars=%d elapsed=%.1fs",
                    task, len(result), elapsed,
                )
                logger.debug("LLM response [%s]:\n%s", task, result)
                return result
        except Exception as exc:
            logger.error("LLM error | task=%s error=%s", task, exc)
            return f"[LLM error: {exc}]"

    async def extract_financial_metrics(self, document_text: str) -> Dict[str, Any]:
        text = document_text.strip()[:6000]

        prompt = (
            "Extract key financial fields from this statement text.\n"
            "Use the most recent quarterly period as period_1 and matching prior period as period_2.\n"
            "Return only JSON, use null when missing, and output plain numbers only.\n\n"
            "{\n"
            '  "company": "string or null",\n'
            '  "document_type": "Income Statement / Balance Sheet / etc.",\n'
            '  "period_1_label": "most recent period e.g. Three Months Ended September 30 2025",\n'
            '  "period_2_label": "prior period or null",\n'
            '  "currency": "USD or null",\n'
            '  "unit": "millions or thousands or units",\n'
            '  "revenue":                    number or null,\n'
            '  "revenue_prior":              number or null,\n'
            '  "cost_of_goods_sold":         number or null,\n'
            '  "cost_of_goods_sold_prior":   number or null,\n'
            '  "gross_margin":               number or null,\n'
            '  "gross_margin_prior":         number or null,\n'
            '  "selling_general_admin":      number or null,\n'
            '  "selling_general_admin_prior":number or null,\n'
            '  "research_and_development":   number or null,\n'
            '  "depreciation":               number or null,\n'
            '  "cost_of_operations":         number or null,\n'
            '  "cost_of_operations_prior":   number or null,\n'
            '  "operating_expenses":         number or null,\n'
            '  "operating_income":           number or null,\n'
            '  "operating_income_prior":     number or null,\n'
            '  "income_before_tax":          number or null,\n'
            '  "income_tax":                 number or null,\n'
            '  "net_income":                 number or null,\n'
            '  "net_income_prior":           number or null,\n'
            '  "total_assets":               number or null,\n'
            '  "current_assets":             number or null,\n'
            '  "current_liabilities":        number or null,\n'
            '  "total_liabilities":          number or null,\n'
            '  "total_debt":                 number or null,\n'
            '  "cash":                       number or null,\n'
            '  "equity":                     number or null,\n'
            '  "eps_basic":                  number or null,\n'
            '  "eps_diluted":                number or null\n'
            "}\n\n"
            f"Financial data:\n{text}\n\n"
            "JSON:"
        )

        raw = await self._generate(prompt, task="extract_metrics")
        result = _parse_json_response(raw)
        
        period_1 = result.get("period_1_label", "")
        period_2 = result.get("period_2_label", "")
        logger.info(
            "Metrics extracted | keys=%s | period_1=%s | period_2=%s",
            list(result.keys()), period_1, period_2
        )
        
        if result.get("revenue") and result.get("revenue_prior"):
            logger.info(
                "Revenue check | current=%s | prior=%s | growth_calc=%s",
                result["revenue"], result["revenue_prior"],
                round((result["revenue"] - result["revenue_prior"]) / result["revenue_prior"] * 100, 1) if result["revenue_prior"] else "N/A"
            )
        
        return result

    async def generate_summary(self, dataset_summary: Dict[str, Any]) -> str:
        trimmed = {
            "company":          dataset_summary.get("company"),
            "document_type":    dataset_summary.get("document_type"),
            "period":           dataset_summary.get("period"),
            "column_mapping":   dataset_summary.get("column_mapping"),
            "metrics":          dataset_summary.get("metrics"),
            "raw_text_snippet": (dataset_summary.get("raw_text") or "")[:1200],
        }
        j = json.dumps(trimmed, indent=2, default=str)

        prompt = (
            "You are a senior financial analyst.\n"
            "Write an executive summary (110-140 words) for this financial report.\n\n"
            f"Data:\n{j}\n\n"
            "Cover health, growth, risk, and one action item.\n\n"
            "Executive Summary:"
        )
        return await self._generate(prompt, task="summary")

    async def generate_metric_insights(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        company = metrics.get("company") or "the company"
        period  = metrics.get("period_1_label") or "current period"
        unit    = metrics.get("unit") or "units"

        numeric_fields = {
            "liquidity_ratio":  metrics.get("liquidity_ratio"),
            "debt_ratio":       metrics.get("debt_ratio"),
            "revenue_growth":   metrics.get("revenue_growth"),
            "gross_margin_pct": metrics.get("gross_margin_pct"),
            "net_margin_pct":   metrics.get("net_margin_pct"),
            "stress_score":     metrics.get("stress_score"),
            "compliance_score": metrics.get("compliance_score"),
            "revenue":          metrics.get("revenue"),
            "net_income":       metrics.get("net_income"),
            "eps_basic":        metrics.get("eps_basic"),
        }
        present      = {k: v for k, v in numeric_fields.items() if v is not None}
        values_block = "\n".join(f"  {k}: {v}" for k, v in present.items())

        prompt = (
            f"You are a senior financial analyst examining {company} for {period}.\n"
            f"Values are in {unit}.\n\n"
            f"Current metrics:\n{values_block}\n\n"
            "Return ONLY a JSON object where each key is a metric name from the list above.\n"
            "Each value must have these fields:\n"
            '  "definition": one-sentence plain-English definition,\n'
            '  "formula": the calculation formula as a string,\n'
            '  "interpretation": 1-2 short sentences for the SPECIFIC VALUE,\n'
            '  "signal": one of "positive", "negative", "neutral",\n'
            '  "recommendation": one specific, actionable recommendation\n\n'
            "Analyze only the metrics listed above. Return ONLY the JSON:"
        )

        raw    = await self._generate(prompt, task="insights")
        result = _parse_json_response(raw)
        logger.info("Insights generated | keys=%s", list(result.keys()))
        return result

    async def generate_technical_explanation(self, topic: str, context: str) -> str:
        prompt = (
            f"You are a financial data scientist. Explain '{topic}' clearly.\n\n"
            f"Context:\n{context}\n\n"
            "Cover: definition, formula, what the value means, and recommended action.\n\n"
            "Explanation:"
        )
        return await self._generate(prompt, task="technical_explanation")

    async def stream_chat(
        self,
        message: str,
        context: str,
        history: List[Dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        history_text = "".join(
            f"{t.get('role', 'user').upper()}: {t.get('content', '')[:400]}\n"
            for t in history[-2:]
        )
        ctx_block = f"\nContext from report:\n{context[:900]}\n" if context else ""
        prompt = (
            "You are FinTelligence, an expert financial analyst. Answer clearly.\n"
            f"{ctx_block}\n{history_text}"
            f"USER: {message}\n\nASSISTANT:"
        )

        payload = {
            "model":   self.model,
            "prompt":  prompt,
            "stream":  True,
            "options": self._opts(max_tokens=-1),
        }
        logger.info(
            "LLM stream request | task=chat model=%s prompt_chars=%d",
            self.model, len(prompt),
        )
        logger.debug("LLM chat prompt:\n%s", prompt)

        collected = []
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", f"{self.base_url}/api/generate", json=payload) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            try:
                                data  = json.loads(line)
                                token = data.get("response", "")
                                if token:
                                    collected.append(token)
                                    yield token
                                if data.get("done"):
                                    break
                            except json.JSONDecodeError:
                                continue
        except Exception as exc:
            logger.error("LLM stream error | task=chat error=%s", exc)
            yield f"\n[Error: {exc}]"

        full_response = "".join(collected)
        logger.info("LLM stream done | task=chat response_chars=%d", len(full_response))
        logger.debug("LLM chat response:\n%s", full_response)


def _parse_json_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    m = re.search(r"\{[\s\S]+\}", text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse LLM JSON response. Raw (first 300): %s", text[:300])
    return {}
