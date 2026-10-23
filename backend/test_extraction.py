import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.vision_service import VisionService
from services.llm_router import LLMRouter
from services.financial_metrics import compute_from_llm_extracted

async def test_extraction(pdf_path: str):
    print(f"\n{'='*80}")
    print(f"Testing extraction for: {pdf_path}")
    print(f"{'='*80}\n")
    
    vision = VisionService()
    result = vision.process_document(pdf_path)
    
    print(f"Vision extraction complete:")
    print(f"  - Rows extracted: {len(result.get('rows', []))}")
    print(f"  - Dates found: {result.get('dates', [])}")
    print(f"  - Headings: {result.get('headings', [])}")
    print(f"  - Raw text length: {len(result.get('raw_text', ''))}")
    
    if result.get("rows"):
        print(f"\nFirst 5 rows:")
        for i, row in enumerate(result["rows"][:5]):
            print(f"  {i+1}. {row}")
        
        all_cols = set()
        for r in result["rows"]:
            all_cols.update(k for k in r.keys() if k != "metric")
        print(f"\nColumns detected: {sorted(all_cols)}")
    
    rows = result.get("rows") or []
    headings = result.get("headings") or []
    dates = result.get("dates") or []
    
    all_cols = set()
    for r in rows:
        all_cols.update(k for k in r.keys() if k != "metric")
    col_list = sorted(all_cols)
    
    header_parts = []
    if headings:
        header_parts.append("DOCUMENT: " + " | ".join(headings[:5]))
    if dates:
        header_parts.append("PERIODS: " + " | ".join(dates[:4]))
    if col_list:
        header_parts.append("COLUMNS: " + ", ".join(col_list))
    
    table_lines = []
    for r in rows[:100]:
        metric = r.get("metric", "")
        if not metric or len(metric) < 2:
            continue
        values = " | ".join(f"{col}: {r.get(col, '')}" for col in col_list if r.get(col))
        if values:
            table_lines.append(f"  metric: {metric} | {values}")
    
    synthesized_text = "\n".join(header_parts) + "\n\n" + "\n".join(table_lines)
    
    print(f"\n{'='*80}")
    print("Synthesized text for LLM:")
    print(f"{'='*80}")
    print(synthesized_text[:1500])
    print(f"\n... (total {len(synthesized_text)} chars)")
    
    print(f"\n{'='*80}")
    print("Sending to LLM for extraction...")
    print(f"{'='*80}\n")
    
    llm = LLMRouter()
    llm_extracted = await llm.extract_financial_metrics(synthesized_text)
    
    print(f"\nLLM Extracted Data:")
    print(json.dumps(llm_extracted, indent=2))
    
    print(f"\n{'='*80}")
    print("Computing derived metrics...")
    print(f"{'='*80}\n")
    
    metrics = compute_from_llm_extracted(llm_extracted)
    
    print(f"Final Metrics:")
    for key in ["company", "period_1_label", "period_2_label", "revenue", "revenue_prior", 
                "net_income", "net_income_prior", "gross_margin_pct", "operating_margin_pct",
                "revenue_growth", "liquidity_ratio", "debt_ratio"]:
        if key in metrics:
            print(f"  {key}: {metrics[key]}")
    
    print(f"\n{'='*80}")
    print("Test complete!")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    pdf = r"C:\Users\geash\AppData\Roaming\Cursor\User\workspaceStorage\ab5832cbc370bef80982424113c6423c\pdfs\8635bcb8-02e9-4c8b-b410-3fc25d3c3a39\Tesla_Operation_Revenue.pdf"
    asyncio.run(test_extraction(pdf))
