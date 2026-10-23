import base64
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434")
VISION_MODEL   = os.getenv("VISION_MODEL", "llava-phi3")
MIN_TEXT_CHARS = 80

EXTRACT_PROMPT = """You are a financial document parser specialising in revenue statements and cost-of-operations tables.
Carefully read every number and label in this image.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "rows": [
    {"metric": "Total revenues",           "period_1": "28095", "period_2": "25182"},
    {"metric": "Total cost of revenues",   "period_1": "23041", "period_2": "20185"},
    {"metric": "Gross profit",             "period_1": "5054",  "period_2": "4997"},
    {"metric": "Research and development", "period_1": "1630",  "period_2": "1039"},
    {"metric": "Selling, general and administrative", "period_1": "1562", "period_2": "1186"},
    {"metric": "Total operating expenses", "period_1": "3430",  "period_2": "2280"},
    {"metric": "Income from operations",   "period_1": "1624",  "period_2": "2717"},
    {"metric": "Net income",               "period_1": "1389",  "period_2": "2189"}
  ],
  "dates":    ["Three Months Ended September 30, 2025", "Three Months Ended September 30, 2024"],
  "headings": ["Consolidated Statements of Operations", "in millions"],
  "raw_text": "all readable text from the image"
}

Rules:
- period_1 = most recent period (highest year / latest date)
- Strip $ signs, commas from numbers; parenthesised numbers like (1,234) = -1234
- Output ONLY the JSON object"""


def _clean_number(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in ("$", "\u20ac", "\xa3", "-", ""):
        return None
    s = re.sub(r"[$\u20ac\xa3\s]", "", s)
    s = re.sub(r"^\(([0-9,]+\.?\d*)\)$", r"-\1", s)
    s = s.replace(",", "")
    try:
        float(s)
        return s
    except ValueError:
        return None


def _is_number_token(text: str) -> bool:
    t = re.sub(r"[$\u20ac\xa3,\s]", "", text.strip())
    t = re.sub(r"^\(([0-9.]+)\)$", r"-\1", t)
    if not t or t in ("-", "—", "�"):
        return False
    try:
        float(t)
        return True
    except ValueError:
        return False


def _extract_period_headers(text: str) -> List[str]:
    flat = re.sub(r"\s+", " ", text)
    full_dates = re.findall(
        r"(?:January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+\d{1,2},\s+\d{4}",
        flat,
    )
    if full_dates:
        return list(dict.fromkeys(full_dates))
    quarter_labels = re.findall(r"Q[1-4]\s*(?:FY)?\s*20\d{2}", flat)
    if quarter_labels:
        return list(dict.fromkeys(quarter_labels))
    fy = re.findall(r"(?:FY|Year Ended|Fiscal Year)\s*(20\d{2})", flat, re.IGNORECASE)
    if fy:
        return [f"FY {y}" for y in dict.fromkeys(fy)]
    years = list(dict.fromkeys(re.findall(r"\b(20\d{2})\b", flat)))
    if years:
        return years[:4]
    return ["period_1", "period_2"]


def _pymupdf_spatial(pdf_path: str) -> Dict[str, Any]:
    """
    Spatial word-position extraction for SEC-style PDFs where PyMuPDF's table
    finder returns no tables (labels on the left, numbers floating on the right).
    Groups words by Y-row, detects column x-positions from period headers,
    assigns each number to its column, and merges rows where the label sits
    4–12 px below its numbers.
    """
    import fitz

    doc = fitz.open(pdf_path)
    all_rows: List[Dict[str, str]] = []
    all_dates: List[str] = []
    all_headings: List[str] = []
    raw_text_parts: List[str] = []

    for page in doc:
        raw_text_parts.append(page.get_text())
        words = page.get_text("words")  # (x0,y0,x1,y1,text,block,line,word)
        if not words:
            continue

        page_width = page.rect.width
        label_x_max = page_width * 0.38  # left 38% = label zone

        # ── Group words into visual rows (snap y to 4 px grid) ─────────────
        y_groups: Dict[int, List[Tuple[float, str]]] = {}
        for w in words:
            x0, y0, text = w[0], w[1], w[4]
            y_key = round(y0 / 4) * 4
            y_groups.setdefault(y_key, []).append((x0, text.strip()))

        sorted_ys = sorted(y_groups.keys())

        # ── Find period/column header rows ──────────────────────────────────
        # A "period-type" row has words like "Three", "Nine", "Quarter", "Ended"
        # A "year" row has only 4-digit years
        period_type_row: Optional[Dict[int, Tuple[float, float, str]]] = None
        year_row_y: Optional[int] = None
        year_positions: List[Tuple[float, str]] = []

        for y in sorted_ys:
            row_words = sorted(y_groups[y], key=lambda w: w[0])
            texts = [t for _, t in row_words]
            joined = " ".join(texts)
            is_year_only = all(re.match(r"^20\d{2}$", t) for t in texts if t)
            has_period_kw = bool(re.search(
                r"\b(Three|Nine|Quarter|Year|Ended|Months|Annual|Half)\b",
                joined, re.IGNORECASE
            ))
            if is_year_only and texts:
                year_row_y = y
                year_positions = [(x0, t) for x0, t in row_words if re.match(r"^20\d{2}$", t)]
            elif has_period_kw and not period_type_row:
                # Record x-span of each keyword cluster
                # We'll use this to label each year column
                period_type_row = {y: row_words}

        # Build column map: x_position → column_label
        col_map: List[Tuple[float, str]] = []
        if year_positions:
            if period_type_row:
                ptr_words = list(period_type_row.values())[0]

                # Find the x-gap between two period header groups
                # (e.g. gap between "Three Months...30," and "Nine Months...30,")
                # Use the LARGEST gap between consecutive words as the dividing boundary
                ptr_sorted = sorted(ptr_words, key=lambda w: w[0])
                gap_boundary: Optional[float] = None
                max_gap = 0.0
                for k in range(len(ptr_sorted) - 1):
                    gap = ptr_sorted[k + 1][0] - ptr_sorted[k][0]
                    if gap > max_gap:
                        max_gap = gap
                        gap_boundary = (ptr_sorted[k][0] + ptr_sorted[k + 1][0]) / 2

                # Find recognisable period prefixes
                three_x  = next((x0 for x0, t in ptr_words if t.lower() == "three"), None)
                nine_x   = next((x0 for x0, t in ptr_words if t.lower() in ("nine", "six")), None)
                half_x   = next((x0 for x0, t in ptr_words if t.lower() == "half"), None)
                quarter_x = next((x0 for x0, t in ptr_words if t.lower() == "quarter"), None)

                for col_x, year in year_positions:
                    prefix = ""
                    if gap_boundary is not None:
                        # Use the gap as the dividing line between period groups
                        in_first = col_x < gap_boundary
                        if three_x is not None and nine_x is not None:
                            prefix = "3M" if in_first else "9M"
                        elif three_x is not None and half_x is not None:
                            prefix = "3M" if in_first else "6M"
                        elif quarter_x is not None:
                            prefix = "Q"
                        else:
                            prefix = "P1" if in_first else "P2"
                    elif three_x is not None and nine_x is not None:
                        boundary = (three_x + nine_x) / 2
                        prefix = "3M" if col_x < boundary else "9M"
                    col_map.append((col_x, f"{prefix}_{year}" if prefix else year))
            else:
                used: Dict[str, int] = {}
                for col_x, year in year_positions:
                    n = used.get(year, 0)
                    used[year] = n + 1
                    col_map.append((col_x, year if n == 0 else f"{year}_prior"))
        else:
            # Fall back to date-based period headers from page text
            periods = _extract_period_headers(raw_text_parts[-1])
            for i, p in enumerate(periods):
                col_map.append((999 + i * 50, p))

        col_map.sort(key=lambda c: c[0])

        def x_to_col(x0: float) -> str:
            if not col_map:
                return "value"
            return min(col_map, key=lambda c: abs(c[0] - x0))[1]

        # ── Parse each visual row into label + number cells ─────────────────
        row_data: Dict[int, Dict] = {}
        for y in sorted_ys:
            row_words = sorted(y_groups[y], key=lambda w: w[0])
            label_parts: List[str] = []
            number_parts: List[Tuple[float, str]] = []
            for x0, text in row_words:
                if not text or text in ("$", "\u20ac", "\xa3", "—", "�"):
                    continue
                if _is_number_token(text) and x0 > label_x_max:
                    number_parts.append((x0, text))
                else:
                    label_parts.append(text)
            row_data[y] = {
                "label":   " ".join(label_parts).strip(),
                "numbers": number_parts,
                "_merged": False,
            }

        # ── Merge "numbers-only row" with its label sitting 4–12 px below ──
        final_rows: List[Dict] = []
        skip_ys: set = set()
        for i, y in enumerate(sorted_ys):
            if y in skip_ys:
                continue
            rd = row_data[y]
            if rd["numbers"] and not rd["label"]:
                # Look ahead up to 12 px for the matching label row
                for j in range(i + 1, min(i + 4, len(sorted_ys))):
                    ny = sorted_ys[j]
                    if ny - y > 12:
                        break
                    nrd = row_data[ny]
                    if nrd["label"] and not nrd["numbers"]:
                        final_rows.append({"label": nrd["label"], "numbers": rd["numbers"]})
                        skip_ys.add(ny)
                        break
                else:
                    final_rows.append(rd)
            else:
                final_rows.append(rd)

        # ── Build structured rows ────────────────────────────────────────────
        for rd in final_rows:
            label = rd["label"].strip()
            numbers = rd["numbers"]

            # Collect dates from header text
            dm = re.search(
                r"((?:January|February|March|April|May|June|July|August|September|"
                r"October|November|December)\s+\d{1,2},\s+\d{4})",
                label,
            )
            if dm:
                all_dates.append(dm.group(1))

            if not numbers:
                if label and len(label) < 100:
                    all_headings.append(label)
                continue

            row_dict: Dict[str, str] = {"metric": label or "—"}
            for x0, val in numbers:
                col = x_to_col(x0)
                cleaned = _clean_number(val)
                if cleaned:
                    row_dict[col] = cleaned

            if len(row_dict) > 1:
                all_rows.append(row_dict)

    doc.close()
    logger.info(
        "Spatial extraction | pdf=%s rows=%d dates=%d",
        pdf_path, len(all_rows), len(all_dates),
    )
    return {
        "rows":     all_rows,
        "dates":    list(dict.fromkeys(all_dates)),
        "headings": list(dict.fromkeys(h for h in all_headings if h)),
        "raw_text": "\n".join(raw_text_parts),
    }


def _pymupdf_text_only(pdf_path: str) -> Dict[str, Any]:
    import fitz
    doc = fitz.open(pdf_path)
    pages_text = [page.get_text() for page in doc]
    doc.close()
    full_text = "\n".join(pages_text)
    dates = re.findall(
        r"(?:January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+\d{1,2},\s+\d{4}",
        full_text,
    )
    headings = [
        ln.strip() for ln in full_text.splitlines()
        if ln.strip() and len(ln.strip()) < 100 and not re.search(r"\d{5,}", ln)
    ]
    logger.info("PyMuPDF text-only | pdf=%s chars=%d", pdf_path, len(full_text))
    return {
        "rows":     [],
        "dates":    list(dict.fromkeys(dates)),
        "headings": list(dict.fromkeys(headings[:50])),
        "raw_text": full_text,
    }


def _pdf_has_text(pdf_path: str) -> bool:
    import fitz
    doc = fitz.open(pdf_path)
    total_chars = sum(len(page.get_text()) for page in doc)
    doc.close()
    return total_chars >= MIN_TEXT_CHARS


def _image_to_b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _pdf_page_to_png(pdf_path: str, page_index: int) -> bytes:
    import fitz
    doc = fitz.open(pdf_path)
    pix = doc[page_index].get_pixmap(dpi=150)
    png = pix.tobytes("png")
    doc.close()
    return png


def _ask_vision_llm(image_b64: str, page_label: str = "") -> Dict[str, Any]:
    payload = {
        "model":   VISION_MODEL,
        "prompt":  EXTRACT_PROMPT,
        "images":  [image_b64],
        "stream":  False,
        "options": {"temperature": 0.05, "num_predict": -1, "num_ctx": 4096},
    }
    logger.info(
        "Vision LLM request | model=%s page=%s image_b64_chars=%d",
        VISION_MODEL, page_label, len(image_b64),
    )
    logger.debug("Vision LLM prompt:\n%s", EXTRACT_PROMPT)
    t0 = time.perf_counter()
    try:
        resp = httpx.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=httpx.Timeout(60.0, connect=10.0))
        resp.raise_for_status()
        raw = resp.json().get("response", "")
        elapsed = time.perf_counter() - t0
        logger.info(
            "Vision LLM response | page=%s response_chars=%d elapsed=%.1fs",
            page_label, len(raw), elapsed,
        )
        logger.debug("Vision LLM raw response [%s]:\n%s", page_label, raw)
        return _parse_llm_json(raw)
    except Exception as exc:
        logger.error("Vision LLM error | page=%s error=%s", page_label, exc)
        return {"rows": [], "dates": [], "headings": [], "raw_text": ""}


def _parse_llm_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()
    for candidate in [text, re.search(r"\{[\s\S]+\}", text)]:
        if candidate is None:
            continue
        s = candidate if isinstance(candidate, str) else candidate.group()
        try:
            data = json.loads(s)
            return {
                "rows":     data.get("rows")     or [],
                "dates":    data.get("dates")    or [],
                "headings": data.get("headings") or [],
                "raw_text": data.get("raw_text") or "",
            }
        except (json.JSONDecodeError, AttributeError):
            continue
    logger.warning("Vision LLM returned unparseable JSON. Raw (first 300): %s", text[:300])
    return {"rows": [], "dates": [], "headings": [], "raw_text": text}


class VisionService:
    def process_document(self, file_path: str) -> Dict[str, Any]:
        ext = Path(file_path).suffix.lower()

        if ext in {".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"}:
            logger.info("Image file | path=%s model=%s", file_path, VISION_MODEL)
            with open(file_path, "rb") as f:
                return _ask_vision_llm(_image_to_b64(f.read()), page_label="image")

        if ext == ".pdf":
            if _pdf_has_text(file_path):
                logger.info("Digital PDF | path=%s using spatial extraction", file_path)
                result = _pymupdf_spatial(file_path)
                if result["rows"]:
                    logger.info("Spatial extraction complete | rows=%d", len(result["rows"]))
                    return result
                logger.info("Spatial extraction found no rows | falling back to text-only")
                return _pymupdf_text_only(file_path)
            else:
                import fitz
                doc = fitz.open(file_path)
                n = min(len(doc), 10)
                doc.close()
                logger.info("Scanned PDF | path=%s pages=%d model=%s", file_path, n, VISION_MODEL)
                page_results = []
                for i in range(n):
                    png = _pdf_page_to_png(file_path, i)
                    page_results.append(_ask_vision_llm(_image_to_b64(png), page_label=f"page_{i+1}"))
                merged: Dict[str, Any] = {"rows": [], "dates": [], "headings": [], "raw_text": ""}
                for p in page_results:
                    merged["rows"].extend(p.get("rows") or [])
                    merged["dates"].extend(p.get("dates") or [])
                    merged["headings"].extend(p.get("headings") or [])
                    merged["raw_text"] += "\n" + p.get("raw_text", "")
                logger.info(
                    "Scanned PDF merge complete | total_rows=%d total_chars=%d",
                    len(merged["rows"]), len(merged["raw_text"]),
                )
                return merged

        logger.warning("Unsupported file type | path=%s ext=%s", file_path, ext)
        return {"rows": [], "dates": [], "headings": [], "raw_text": ""}
