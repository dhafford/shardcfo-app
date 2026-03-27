"""
qbo-parser — Parse QuickBooks Online Excel exports into structured data.

Quick start::

    from qbo_parser import parse_qbo_report

    # Returns a dict matching the ParsedReport schema
    result = parse_qbo_report("path/to/export.xlsx")
    print(result["report_type"])        # "profit_and_loss"
    print(result["sections"][0]["name"])  # "Income"

    # JSON string output
    json_str = parse_qbo_report("export.xlsx", output_format="json")

    # Flat rows for DataFrame loading
    rows = parse_qbo_report("export.xlsx", output_format="flat")
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Union

from qbo_parser.detector import DetectionResult, detect_report_type
from qbo_parser.models import ParsedReport, ReportType
from qbo_parser.parser import parse_qbo_report as _parse_to_dict

__all__ = [
    "parse_qbo_report",
    "detect_report_type",
    "flatten_report",
    "DetectionResult",
    "ParsedReport",
    "ReportType",
]
__version__ = "0.1.0"


# ---------------------------------------------------------------------------
# Flatten helper
# ---------------------------------------------------------------------------

def _walk_rows(
    rows: List[Dict],
    section_name: str,
    columns: List[str],
    out: List[Dict],
) -> None:
    """Recursively flatten a nested row tree into *out* (DFS order)."""
    for row in rows:
        flat = {
            "section": section_name,
            "account_name": row["account_name"],
            "account_code": row.get("account_code", ""),
            "depth": row["depth"],
            "is_total": row["is_total"],
        }
        for col in columns:
            flat[col] = row["amounts"].get(col)
        out.append(flat)

        if row.get("children"):
            _walk_rows(row["children"], section_name, columns, out)


def flatten_report(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert a hierarchical ParsedReport dict into a flat list of rows.

    Each row is a dict with keys:
      ``section``, ``account_name``, ``account_code``, ``depth``,
      ``is_total``, plus one key per column header (e.g. ``"Jan 2019"``).

    Rows appear in document order (DFS traversal of the tree).  Section
    totals that were extracted into ``Section.total`` during tree building
    are re-emitted at the end of each section so the flat output mirrors
    the original spreadsheet.

    Standalone sections like "Gross Profit" appear as a single row.

    Args:
        report: A dict from :func:`parse_qbo_report` (``output_format="dict"``).

    Returns:
        A flat list of row dicts, suitable for ``pandas.DataFrame(rows)``.
    """
    columns = report.get("columns", [])
    out = []  # type: List[Dict[str, Any]]

    for section in report.get("sections", []):
        section_name = section["name"]
        rows = section.get("rows", [])
        total = section.get("total", {})
        has_total = total and any(v is not None for v in total.values())

        # Emit the tree rows
        _walk_rows(rows, section_name, columns, out)

        # Emit the section-level total (or standalone summary value)
        if has_total:
            label = (
                "Total " + section_name
                if rows  # sections with child rows → "Total Income"
                else section_name  # standalone → "Gross Profit"
            )
            flat = {
                "section": section_name,
                "account_name": label,
                "account_code": "",
                "depth": 0,
                "is_total": True,
            }
            for col in columns:
                flat[col] = total.get(col)
            out.append(flat)

    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_qbo_report(
    filepath: str,
    output_format: str = "dict",
    include_percent_cols: bool = False,
) -> Any:
    """Parse a QBO Excel export and return structured financial data.

    This is the primary entry point.  It orchestrates detection, parsing,
    tree building, and Pydantic validation, then returns the result in
    the requested format.

    Args:
        filepath: Path to the ``.xlsx`` file exported from QBO.
        output_format:
            - ``"dict"`` (default) — Python dict matching the
              :class:`ParsedReport` schema.
            - ``"json"`` — Pretty-printed JSON string.
            - ``"flat"`` — Flat list of row dicts (no nesting), useful for
              loading into a pandas DataFrame.
        include_percent_cols: When ``True``, keep ``"% of Income"``-style
            percentage columns in the output.  When ``False`` (default),
            they are stripped so only monetary columns remain.

    Returns:
        A dict, JSON string, or list depending on *output_format*.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file is not a valid ``.xlsx`` or contains no data.

    Examples::

        # Dict (default)
        result = parse_qbo_report("pnl.xlsx")
        result["report_type"]  # 'profit_and_loss'

        # Include percentage columns
        result = parse_qbo_report("pnl.xlsx", include_percent_cols=True)

        # Flat rows for pandas
        import pandas as pd
        rows = parse_qbo_report("pnl.xlsx", output_format="flat")
        df = pd.DataFrame(rows)
    """
    result = _parse_to_dict(filepath, include_percent_cols=include_percent_cols)

    if output_format == "json":
        return json.dumps(result, indent=2, default=str)
    elif output_format == "flat":
        return flatten_report(result)
    else:
        return result
