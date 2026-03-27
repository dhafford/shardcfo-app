"""Vercel Python serverless function — QBO parser API.

Vercel routes requests to /api/qbo/* to this handler.
The qbo_parser package is added to sys.path from the repo's qbo-parser/ dir.
"""

import sys
import os
import tempfile
from pathlib import Path

# Add qbo-parser package to path so we can import it
_repo_root = Path(__file__).resolve().parent.parent
_qbo_path = _repo_root / "qbo-parser"
if str(_qbo_path) not in sys.path:
    sys.path.insert(0, str(_qbo_path))

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from qbo_parser import __version__, flatten_report, parse_qbo_report
from qbo_parser.validator import _find_section

# ===================================================================
# App
# ===================================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================================================
# Helpers
# ===================================================================

def _save_upload(upload: UploadFile) -> Path:
    if not upload.filename:
        raise HTTPException(400, "No filename provided.")
    suffix = Path(upload.filename).suffix.lower()
    if suffix not in (".xlsx", ".xls"):
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Upload a .xlsx file.")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(upload.file.read())
    finally:
        tmp.close()
    return Path(tmp.name)


def _safe_div(a, b):
    if a is None or b is None or b == 0:
        return None
    return round(a / b, 4)


def _section_total(sections, include, col, exclude=None):
    sec = _find_section(sections, include, exclude=exclude)
    if sec is None:
        return None
    val = sec.get("total", {}).get(col)
    return float(val) if val is not None else None


def _walk_for_total(rows, name_l, col):
    for row in rows:
        if name_l in row["account_name"].lower() and row.get("is_total", False):
            val = row["amounts"].get(col)
            if val is not None:
                return float(val)
        found = _walk_for_total(row.get("children", []), name_l, col)
        if found is not None:
            return found
    return None


def _find_subtotal(sections, name, col):
    name_l = name.lower()
    for sec in sections:
        val = _walk_for_total(sec.get("rows", []), name_l, col)
        if val is not None:
            return val
    return None


# ===================================================================
# Endpoints
# ===================================================================

@app.get("/api/qbo/health")
def health():
    return {"status": "ok", "parser_version": __version__}


@app.post("/api/qbo/parse")
def parse(
    file: UploadFile = File(...),
    format: str = Query("tree", pattern="^(tree|flat)$"),
    validate: bool = Query(True),
    include_percent_cols: bool = Query(False),
):
    tmp_path = _save_upload(file)
    try:
        result = parse_qbo_report(
            str(tmp_path),
            output_format="dict",
            include_percent_cols=include_percent_cols,
        )
    except Exception as exc:
        raise HTTPException(422, str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)

    if not validate:
        result["validation_warnings"] = []

    if format == "flat":
        return flatten_report(result)

    return result


@app.post("/api/qbo/parse/summary")
def parse_summary(file: UploadFile = File(...)):
    tmp_path = _save_upload(file)
    try:
        result = parse_qbo_report(str(tmp_path), output_format="dict")
    except Exception as exc:
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
        "metrics": {},
    }

    if rtype == "profit_and_loss":
        revenue = _section_total(sections, "income", col, exclude=["other", "net", "gross"])
        cogs = _section_total(sections, "cost of goods", col, exclude=["net"])
        gross_profit = _section_total(sections, "gross profit", col)
        expenses = _section_total(sections, "expenses", col, exclude=["other", "net"])
        net_income = _section_total(sections, "net income", col, exclude=["other", "operating"])
        summary["metrics"] = {
            "total_revenue": revenue,
            "total_cogs": cogs,
            "gross_profit": gross_profit,
            "total_expenses": expenses,
            "net_income": net_income,
            "gross_margin": _safe_div(gross_profit, revenue),
            "net_margin": _safe_div(net_income, revenue),
        }
    elif rtype == "balance_sheet":
        total_assets = _section_total(sections, "assets", col, exclude=["current", "fixed", "other", "non-current"])
        total_liab_eq = _section_total(sections, "liabilities and equity", col)
        current_assets = _find_subtotal(sections, "current assets", col)
        current_liab = _find_subtotal(sections, "current liabilities", col)
        total_liab = _find_subtotal(sections, "total liabilities", col)
        total_equity = _find_subtotal(sections, "total equity", col)
        summary["metrics"] = {
            "total_assets": total_assets,
            "total_liabilities": total_liab,
            "total_equity": total_equity,
            "total_liabilities_and_equity": total_liab_eq,
            "current_ratio": _safe_div(current_assets, current_liab),
            "debt_to_equity": _safe_div(total_liab, total_equity),
        }
    elif rtype == "cash_flow_statement":
        operating = _section_total(sections, "operating", col)
        investing = _section_total(sections, "investing", col)
        financing = _section_total(sections, "financing", col)
        net_change = (
            _section_total(sections, "net change in cash", col)
            or _section_total(sections, "net increase", col)
            or _section_total(sections, "net decrease", col)
        )
        summary["metrics"] = {
            "operating_cash_flow": operating,
            "investing_cash_flow": investing,
            "financing_cash_flow": financing,
            "net_change_in_cash": net_change,
        }

    return summary
