import logging
import math
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

STRING_KEYS = {"company", "document_type", "period_1_label", "period_2_label", "currency", "unit"}


def _safe_div(a, b, default=None, pct: bool = False, decimals: int = 4):
    try:
        if b and not math.isnan(float(b)) and float(b) != 0:
            result = float(a) / float(b)
            if pct:
                result *= 100
            return round(result, decimals)
    except Exception:
        pass
    return default


def _n(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _pct(numerator, denominator, decimals=2) -> Optional[float]:
    return _safe_div(numerator, denominator, pct=True, decimals=decimals)


def _growth(current, prior, decimals=4) -> Optional[float]:
    try:
        c, p = float(current), float(prior)
        if p != 0:
            return round((c - p) / abs(p), decimals)
    except (TypeError, ValueError):
        pass
    return None


def compute_from_llm_extracted(llm_data: Dict[str, Any]) -> Dict[str, Any]:
    m: Dict[str, Any] = {}

    RAW_KEYS = [
        "company", "document_type", "period_1_label", "period_2_label",
        "currency", "unit",
        "revenue", "revenue_prior",
        "cost_of_goods_sold", "cost_of_goods_sold_prior",
        "gross_margin", "gross_margin_prior",
        "cost_of_operations", "cost_of_operations_prior",
        "selling_general_admin", "selling_general_admin_prior",
        "research_and_development",
        "depreciation",
        "operating_expenses",
        "operating_income", "operating_income_prior",
        "income_before_tax",
        "income_tax",
        "net_income", "net_income_prior",
        "total_assets", "current_assets",
        "current_liabilities", "total_liabilities", "total_debt",
        "cash", "equity",
        "eps_basic", "eps_diluted",
    ]
    for key in RAW_KEYS:
        val = llm_data.get(key)
        m[key] = val if key in STRING_KEYS else _n(val)
    
    m["anomaly_count"] = llm_data.get("anomaly_count", 0)

    rev  = m.get("revenue")
    revp = m.get("revenue_prior")
    ni   = m.get("net_income")
    oi   = m.get("operating_income")
    gm   = m.get("gross_margin")

    # ── Derive missing raw figures ────────────────────────────────────────────
    if gm is None and rev is not None and m.get("cost_of_goods_sold") is not None:
        gm = m["gross_margin"] = round(rev - m["cost_of_goods_sold"], 2)

    if oi is None and gm is not None:
        opex = m.get("operating_expenses") or m.get("cost_of_operations") or 0
        sga  = m.get("selling_general_admin") or 0
        rnd  = m.get("research_and_development") or 0
        dep  = m.get("depreciation") or 0
        total_opex = opex or (sga + rnd + dep)
        if total_opex:
            oi = m["operating_income"] = round(gm - total_opex, 2)

    # ── Margin ratios ─────────────────────────────────────────────────────────
    m["gross_margin_pct"]     = _pct(gm, rev)
    m["operating_margin_pct"] = _pct(oi, rev)
    m["net_margin_pct"]       = _pct(ni, rev)

    ebitda = None
    if oi is not None:
        dep = m.get("depreciation") or 0
        ebitda = round(oi + dep, 2)
    m["ebitda"]              = ebitda
    m["ebitda_margin_pct"]   = _pct(ebitda, rev)

    # ── Cost structure as % of revenue ───────────────────────────────────────
    m["cogs_pct_revenue"] = _pct(m.get("cost_of_goods_sold"), rev)
    m["rnd_pct_revenue"]  = _pct(m.get("research_and_development"), rev)
    m["sga_pct_revenue"]  = _pct(m.get("selling_general_admin"), rev)

    # ── Growth rates ─────────────────────────────────────────────────────────
    m["revenue_growth"]          = _growth(rev, revp)
    m["operating_income_growth"] = _growth(oi, m.get("operating_income_prior"))
    m["net_income_growth"]       = _growth(ni, m.get("net_income_prior"))

    # ── Balance sheet ratios ─────────────────────────────────────────────────
    m["liquidity_ratio"] = _safe_div(m.get("current_assets"), m.get("current_liabilities"))
    m["debt_ratio"]      = _safe_div(m.get("total_debt"), m.get("total_assets"))
    m["debt_to_equity"]  = _safe_div(m.get("total_debt"), m.get("equity"))

    # ── Returns ───────────────────────────────────────────────────────────────
    m["return_on_equity"]  = _pct(ni, m.get("equity"), decimals=2)
    m["return_on_assets"]  = _pct(ni, m.get("total_assets"), decimals=2)
    m["asset_turnover"]    = _safe_div(rev, m.get("total_assets"), decimals=3)

    # ── Interest coverage (Operating Income / |Interest Expense|) ─────────────
    # income_before_tax = operating_income + interest_income - interest_expense + other
    # We don't store interest_expense separately; approximate only if available
    m["interest_coverage"] = None  # populated if LLM adds interest_expense

    # ── Effective tax rate ────────────────────────────────────────────────────
    m["effective_tax_rate"] = _pct(m.get("income_tax"), m.get("income_before_tax"))

    ca = m.get("current_assets")
    cl = m.get("current_liabilities")
    if ca is not None and cl is not None and cl != 0:
        m["working_capital"] = round(ca - cl, 2)
        m["current_ratio"] = round(ca / cl, 3)
    else:
        m["working_capital"] = None
        m["current_ratio"] = None

    m["quick_ratio"] = None
    
    ta = m.get("total_assets")
    tl = m.get("total_liabilities")
    if ta is not None and tl is not None and ta != 0:
        m["equity_ratio"] = round((ta - tl) / ta, 3)
    else:
        m["equity_ratio"] = None

    if m.get("total_debt") is not None and m.get("ebitda") is not None and m["ebitda"] != 0:
        m["debt_to_ebitda"] = round(m["total_debt"] / m["ebitda"], 2)
    else:
        m["debt_to_ebitda"] = None

    if rev is not None and m.get("total_assets") is not None:
        m["revenue_per_asset"] = _safe_div(rev, m["total_assets"], decimals=3)
    else:
        m["revenue_per_asset"] = None

    if m.get("net_income") is not None and rev is not None and rev != 0:
        m["profit_per_revenue_dollar"] = round(m["net_income"] / rev, 4)
    else:
        m["profit_per_revenue_dollar"] = None

    health_score = 100.0
    if m.get("liquidity_ratio") is not None:
        if m["liquidity_ratio"] < 1.0:
            health_score -= 15
        elif m["liquidity_ratio"] < 1.5:
            health_score -= 5
    if m.get("debt_ratio") is not None:
        if m["debt_ratio"] > 0.7:
            health_score -= 20
        elif m["debt_ratio"] > 0.5:
            health_score -= 10
    if m.get("operating_margin_pct") is not None:
        if m["operating_margin_pct"] < 0:
            health_score -= 20
        elif m["operating_margin_pct"] < 5:
            health_score -= 10
    if m.get("revenue_growth") is not None:
        if m["revenue_growth"] < -0.1:
            health_score -= 15
        elif m["revenue_growth"] < 0:
            health_score -= 5
    if m.get("return_on_equity") is not None:
        if m["return_on_equity"] < 5:
            health_score -= 10
    m["financial_health_score"] = max(round(health_score, 1), 0.0)

    # ── Stress Score ─────────────────────────────────────────────────────────
    debt_r      = m["debt_ratio"]    or 0.0
    liq_r       = m["liquidity_ratio"] or 1.0
    rev_growth  = m["revenue_growth"] or 0.0
    liq_penalty = max(0.0, 1.0 - min(liq_r, 3.0) / 3.0)
    rev_penalty = max(0.0, -rev_growth)
    margin_pen  = max(0.0, -((m.get("operating_margin_pct") or 0) / 100))
    stress = (
        0.25 * min(debt_r, 1.0)
        + 0.20 * liq_penalty
        + 0.20 * min(rev_penalty, 1.0)
        + 0.15 * min(margin_pen, 1.0)
    )
    m["stress_score"] = round(min(stress, 1.0), 4)

    # ── Compliance Score ─────────────────────────────────────────────────────
    compliance = 100.0
    if m["debt_ratio"] is not None and m["debt_ratio"] > 0.7:
        compliance -= 20
    if m["liquidity_ratio"] is not None and m["liquidity_ratio"] < 1.0:
        compliance -= 20
    if rev_growth < -0.05:
        compliance -= 15
    if m.get("operating_margin_pct") is not None and m["operating_margin_pct"] < 0:
        compliance -= 15
    m["compliance_score"] = max(round(compliance, 1), 0.0)

    return m


class FinancialMetricsEngine:
    def compute(self, df: pd.DataFrame, column_mapping: Dict[str, str]) -> Dict[str, Any]:
        cm = column_mapping
        metrics: Dict[str, Any] = {}

        def col(name: str) -> Optional[pd.Series]:
            mapped = cm.get(name)
            if mapped and mapped in df.columns:
                return pd.to_numeric(df[mapped], errors="coerce").dropna()
            return None

        current_assets      = col("assets")
        current_liabilities = col("liabilities")
        if current_assets is not None and current_liabilities is not None:
            metrics["liquidity_ratio"] = _safe_div(current_assets.mean(), current_liabilities.mean())
        else:
            metrics["liquidity_ratio"] = None

        total_debt   = col("debt")
        total_assets = col("assets")
        if total_debt is not None and total_assets is not None:
            metrics["debt_ratio"] = _safe_div(total_debt.mean(), total_assets.mean())
        else:
            metrics["debt_ratio"] = None

        revenue = col("revenue")
        if revenue is not None and len(revenue) >= 2:
            p1 = float(revenue.iloc[0])
            p2 = float(revenue.iloc[-1])
            metrics["revenue_growth"] = _safe_div(p2 - p1, abs(p1)) if p1 != 0 else None
        else:
            metrics["revenue_growth"] = None

        ni_series = col("net_income")
        rev_mean  = float(revenue.mean()) if revenue is not None and len(revenue) > 0 else None
        if ni_series is not None and rev_mean:
            metrics["net_margin_pct"] = _pct(float(ni_series.mean()), rev_mean)

        rev_volatility = 0.0
        if revenue is not None and len(revenue) > 1:
            mean_rev = revenue.mean()
            if mean_rev != 0:
                rev_volatility = float(revenue.std() / abs(mean_rev))

        debt_r      = metrics.get("debt_ratio") or 0.0
        liq_r       = metrics.get("liquidity_ratio") or 1.0
        liq_penalty = max(0.0, 1.0 - min(liq_r, 3.0) / 3.0)
        stress = 0.3 * min(rev_volatility, 1.0) + 0.3 * min(debt_r, 1.0) + 0.2 * liq_penalty
        metrics["stress_score"] = round(min(stress, 1.0), 4)

        compliance = 100.0
        if debt_r > 0.7:
            compliance -= 20
        if liq_r is not None and liq_r < 1.0:
            compliance -= 20
        if rev_volatility > 0.5:
            compliance -= 15
        metrics["compliance_score"] = max(round(compliance, 1), 0.0)

        for field in ["revenue", "net_income", "assets", "liabilities", "cash"]:
            s = col(field)
            if s is not None and len(s) > 0:
                metrics[f"avg_{field}"] = round(float(s.mean()), 2)

        return metrics
