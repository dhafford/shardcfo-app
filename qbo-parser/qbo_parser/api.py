"""FastAPI wrapper for qbo-parser.

Run with::

    uvicorn qbo_parser.api:app --reload

Or programmatically::

    import uvicorn
    uvicorn.run("qbo_parser.api:app", reload=True)
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from qbo_parser import __version__, flatten_report, parse_qbo_report
from qbo_parser.validator import _find_section, _get

# ===================================================================
# App
# ===================================================================

app = FastAPI(
    title="QBO Parser API",
    version=__version__,
    description="Parse QuickBooks Online Excel exports into structured JSON.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================================================
# Helpers
# ===================================================================

def _save_upload(upload: UploadFile) -> Path:
    """Write an uploaded file to a temp path and return it."""
    if not upload.filename:
        raise HTTPException(400, "No filename provided.")
    suffix = Path(upload.filename).suffix.lower()
    if suffix not in (".xlsx", ".xls"):
        raise HTTPException(
            400,
            f"Unsupported file type '{suffix}'. Upload a .xlsx file.",
        )
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(upload.file.read())
    finally:
        tmp.close()
    return Path(tmp.name)


def _section_total(
    sections: List[Dict],
    include: str,
    col: str,
    exclude: Optional[List[str]] = None,
) -> Optional[float]:
    """Find a section and return its total for *col*, or None."""
    sec = _find_section(sections, include, exclude=exclude)
    if sec is None:
        return None
    val = sec.get("total", {}).get(col)
    return float(val) if val is not None else None


def _safe_div(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None or b == 0:
        return None
    return round(a / b, 4)


# ===================================================================
# Endpoints
# ===================================================================

@app.get("/health")
def health():
    """Parser status and version."""
    return {
        "status": "ok",
        "parser_version": __version__,
    }


@app.post("/parse")
def parse(
    file: UploadFile = File(...),
    format: str = Query("tree", pattern="^(tree|flat)$"),
    validate: bool = Query(True),
    include_percent_cols: bool = Query(False),
):
    """Parse a QBO Excel export and return the full structured result.

    - **format**: ``tree`` (nested sections/rows) or ``flat`` (row list).
    - **validate**: include accounting-identity checks in the response.
    - **include_percent_cols**: keep "% of Income" columns.
    """
    tmp_path = _save_upload(file)
    try:
        result = parse_qbo_report(
            str(tmp_path),
            output_format="dict",
            include_percent_cols=include_percent_cols,
        )
    except (ValueError, Exception) as exc:
        raise HTTPException(422, str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)

    if not validate:
        result["validation_warnings"] = []

    if format == "flat":
        return flatten_report(result)

    return result


@app.post("/parse/summary")
def parse_summary(
    file: UploadFile = File(...),
):
    """Parse a QBO export and return key financial metrics only.

    The metrics returned depend on the report type:

    - **P&L**: revenue, cogs, gross profit, expenses, net income, margins
    - **BS**: assets, liabilities, equity, current ratio, D/E ratio
    - **SCF**: operating / investing / financing cash flows, net change
    """
    tmp_path = _save_upload(file)
    try:
        result = parse_qbo_report(str(tmp_path), output_format="dict")
    except (ValueError, Exception) as exc:
        raise HTTPException(422, str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)

    rtype = result.get("report_type", "unknown")
    sections = result.get("sections", [])
    columns = result.get("columns", [])
    col = columns[0] if columns else "Total"

    summary = {
        "report_type": rtype,
        "company_name": result.get("company_name", ""),
        "period": result.get("period", {}),
        "column": col,
        "validation_warnings": result.get("validation_warnings", []),
    }  # type: Dict[str, Any]

    if rtype == "profit_and_loss":
        summary["metrics"] = _summarize_pnl(sections, col)
    elif rtype == "balance_sheet":
        summary["metrics"] = _summarize_bs(sections, col)
    elif rtype == "cash_flow_statement":
        summary["metrics"] = _summarize_scf(sections, col)
    else:
        summary["metrics"] = {}

    return summary


# ===================================================================
# Summary builders
# ===================================================================

def _summarize_pnl(sections: List[Dict], col: str) -> Dict[str, Any]:
    revenue = _section_total(sections, "income", col, exclude=["other", "net", "gross"])
    cogs = _section_total(sections, "cost of goods", col, exclude=["net"])
    gross_profit = _section_total(sections, "gross profit", col)
    expenses = _section_total(sections, "expenses", col, exclude=["other", "net"])
    net_income = _section_total(sections, "net income", col, exclude=["other", "operating"])

    return {
        "total_revenue": revenue,
        "total_cogs": cogs,
        "gross_profit": gross_profit,
        "total_expenses": expenses,
        "net_income": net_income,
        "gross_margin": _safe_div(gross_profit, revenue),
        "net_margin": _safe_div(net_income, revenue),
    }


def _summarize_bs(sections: List[Dict], col: str) -> Dict[str, Any]:
    total_assets = _section_total(
        sections, "assets", col,
        exclude=["current", "fixed", "other", "non-current"],
    )
    total_liab_eq = _section_total(sections, "liabilities and equity", col)

    # For ratios, dig into the sub-sections inside the tree
    current_assets = _find_subtotal(sections, "current assets", col)
    current_liab = _find_subtotal(sections, "current liabilities", col)
    total_liab = _find_subtotal(sections, "total liabilities", col)
    total_equity = _find_subtotal(sections, "total equity", col)

    return {
        "total_assets": total_assets,
        "total_liabilities": total_liab,
        "total_equity": total_equity,
        "total_liabilities_and_equity": total_liab_eq,
        "current_ratio": _safe_div(current_assets, current_liab),
        "debt_to_equity": _safe_div(total_liab, total_equity),
    }


def _summarize_scf(sections: List[Dict], col: str) -> Dict[str, Any]:
    operating = _section_total(sections, "operating", col)
    investing = _section_total(sections, "investing", col)
    financing = _section_total(sections, "financing", col)
    net_change = (
        _section_total(sections, "net change in cash", col)
        or _section_total(sections, "net increase", col)
        or _section_total(sections, "net decrease", col)
    )

    return {
        "operating_cash_flow": operating,
        "investing_cash_flow": investing,
        "financing_cash_flow": financing,
        "net_change_in_cash": net_change,
    }


def _find_subtotal(
    sections: List[Dict],
    name: str,
    col: str,
) -> Optional[float]:
    """Search section rows (recursively) for a total row matching *name*.

    BS sub-totals like "Total Current Assets" live inside the row tree
    rather than as top-level sections.
    """
    name_l = name.lower()
    for sec in sections:
        val = _walk_for_total(sec.get("rows", []), name_l, col)
        if val is not None:
            return val
    return None


def _walk_for_total(
    rows: List[Dict],
    name_l: str,
    col: str,
) -> Optional[float]:
    for row in rows:
        if name_l in row["account_name"].lower() and row.get("is_total", False):
            val = row["amounts"].get(col)
            if val is not None:
                return float(val)
        found = _walk_for_total(row.get("children", []), name_l, col)
        if found is not None:
            return found
    return None
