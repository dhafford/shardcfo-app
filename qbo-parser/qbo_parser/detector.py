"""Report type detection — determines if a sheet is P&L, Balance Sheet, or Cash Flow.

Uses a multi-signal approach:
  1. Primary: the report-title row (typically row 2) is matched against known
     QBO title strings.
  2. Secondary: if the title is missing or ambiguous, all text cells in the
     first 10 rows are scanned as a fallback.
  3. Accounting basis is extracted from parenthetical annotations on the title
     or date-range row (e.g. "Profit and Loss (Accrual Basis)").
  4. The date period is parsed from the date-range row (typically row 3).
  5. ``data_start_row`` locates the first row after the header block where
     column headers or account data begins.

All I/O is done through openpyxl in **read-only** mode so that even large
workbooks are opened without loading every cell into memory.
"""

from __future__ import annotations

import re
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Tuple, Union

import openpyxl

from qbo_parser.models import ReportBasis, ReportType


# ---------------------------------------------------------------------------
# Month-name lookup (full + common abbreviations)
# ---------------------------------------------------------------------------

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12,
}

# Regex fragment for date-range separators: -, –, —, "through", "thru"
_SEP = r"\s*(?:[-\u2013\u2014]|through|thru)\s*"


# ---------------------------------------------------------------------------
# DetectionResult
# ---------------------------------------------------------------------------

@dataclass
class DetectionResult:
    """Result of detecting the report type and metadata from a QBO export header.

    Attributes:
        report_type: Detected financial statement type.
        company_name: Company name from the first header row.
        basis: Accounting basis (accrual / cash) if annotated.
        period_start: ISO date (YYYY-MM-DD) for the start of the period,
            or "" if not found (e.g. Balance Sheet "As of" format).
        period_end: ISO date (YYYY-MM-DD) for the end of the period,
            or "" if not found.
        data_start_row: 1-based row number where column headers or financial
            data begins (after the metadata/blank-row block).
    """
    report_type: ReportType = ReportType.UNKNOWN
    company_name: str = ""
    basis: ReportBasis = ReportBasis.UNKNOWN
    period_start: str = ""
    period_end: str = ""
    data_start_row: int = 1


# ---------------------------------------------------------------------------
# Internal helpers — pure functions, no file I/O
# ---------------------------------------------------------------------------

def _month_to_num(name: str) -> Optional[int]:
    """Convert a month name or abbreviation to its number (1-12)."""
    return _MONTH_MAP.get(name.lower().rstrip("."))


def _last_day(year: int, month: int) -> int:
    """Return the last calendar day of *month* in *year*."""
    return monthrange(year, month)[1]


def _match_report_type(text: str) -> ReportType:
    """Detect report type from a single text string (case-insensitive).

    Checks against known QBO report-title patterns.  Order matters:
    more-specific patterns are tested before shorter substrings so that
    "Statement of Cash Flows" matches before the generic "cash flow".
    """
    lower = text.lower()

    for pattern in ("profit and loss", "profit & loss", "income statement"):
        if pattern in lower:
            return ReportType.PROFIT_AND_LOSS

    if "balance sheet" in lower:
        return ReportType.BALANCE_SHEET

    # "statement of cash flows" before the shorter "cash flow"
    for pattern in ("statement of cash flows", "cash flow"):
        if pattern in lower:
            return ReportType.CASH_FLOW_STATEMENT

    return ReportType.UNKNOWN


def _extract_basis(text: str) -> ReportBasis:
    """Extract accounting basis from text.

    Handles:
      - "Profit and Loss (Accrual Basis)"
      - "Accrual Basis  January - December 2024"
      - "(Cash)"  or  "Cash Basis"
    """
    lower = text.lower()

    if re.search(r"\baccrual\b", lower):
        return ReportBasis.ACCRUAL

    # Require "cash basis" or "(cash)" to avoid matching account names
    # like "Cash and Cash Equivalents".
    if re.search(r"\bcash\s+basis\b", lower):
        return ReportBasis.CASH
    if re.search(r"\(\s*cash\s*\)", lower):
        return ReportBasis.CASH

    return ReportBasis.UNKNOWN


def _parse_date_range(text: str) -> Tuple[str, str]:
    """Parse a QBO date-range string into ``(start_iso, end_iso)``.

    Supports these QBO formats (case-insensitive):

    ===  ==========================================  ==========================
    #    Format example                              Result
    ===  ==========================================  ==========================
    1    As of December 31, 2024                     ("", "2024-12-31")
    2    January 1, 2024 - December 31, 2024         ("2024-01-01","2024-12-31")
    3    January 1 - December 31, 2024               ("2024-01-01","2024-12-31")
    4    January - May, 2019                         ("2019-01-01","2019-05-31")
    5    January - December 2024                     ("2024-01-01","2024-12-31")
    ===  ==========================================  ==========================

    Returns ``("", "")`` if no date is recognised.
    """
    text = text.strip()

    # ------------------------------------------------------------------
    # Pattern 1  —  "As of Month Day, Year"  (Balance Sheet point-in-time)
    # ------------------------------------------------------------------
    m = re.search(
        r"[Aa]s\s+of\s+(\w+)\s+(\d{1,2})\s*,?\s*(\d{4})",
        text,
    )
    if m:
        month = _month_to_num(m.group(1))
        if month:
            d = date(int(m.group(3)), month, int(m.group(2)))
            return ("", d.isoformat())

    # ------------------------------------------------------------------
    # Pattern 2  —  "Month Day, Year <sep> Month Day, Year"
    # ------------------------------------------------------------------
    m = re.search(
        r"(\w+)\s+(\d{1,2})\s*,?\s*(\d{4})"
        + _SEP
        + r"(\w+)\s+(\d{1,2})\s*,?\s*(\d{4})",
        text,
    )
    if m:
        sm, em = _month_to_num(m.group(1)), _month_to_num(m.group(4))
        if sm and em:
            start = date(int(m.group(3)), sm, int(m.group(2)))
            end = date(int(m.group(6)), em, int(m.group(5)))
            return (start.isoformat(), end.isoformat())

    # ------------------------------------------------------------------
    # Pattern 3  —  "Month Day <sep> Month Day, Year"  (year only at end)
    # ------------------------------------------------------------------
    m = re.search(
        r"(\w+)\s+(\d{1,2})\s*,?"
        + _SEP
        + r"(\w+)\s+(\d{1,2})\s*,?\s*(\d{4})",
        text,
    )
    if m:
        sm, em = _month_to_num(m.group(1)), _month_to_num(m.group(3))
        if sm and em:
            year = int(m.group(5))
            start = date(year, sm, int(m.group(2)))
            end = date(year, em, int(m.group(4)))
            return (start.isoformat(), end.isoformat())

    # ------------------------------------------------------------------
    # Pattern 4  —  "Month <sep> Month, Year"  (month-only range)
    # The end-date is set to the last day of the end month.
    # ------------------------------------------------------------------
    m = re.search(
        r"(\w+)" + _SEP + r"(\w+)\s*,?\s*(\d{4})",
        text,
    )
    if m:
        sm, em = _month_to_num(m.group(1)), _month_to_num(m.group(2))
        if sm and em:
            year = int(m.group(3))
            start = date(year, sm, 1)
            end = date(year, em, _last_day(year, em))
            return (start.isoformat(), end.isoformat())

    return ("", "")


def _cell_to_str(value: object) -> str:
    """Coerce a cell value to a string for text matching.

    Returns "" for None, numeric, or datetime values — those cells
    are not part of the text-based header metadata.
    """
    if value is None:
        return ""
    if isinstance(value, (int, float, datetime, date)):
        return ""
    return str(value).strip()


def _find_data_start_row(rows: List[List]) -> int:
    """Locate the first row after the QBO header/blank-row block.

    Scans for the pattern:
      1. One or more single-text-value rows (company, title, date range)
      2. Zero or more blank rows
      3. First row with any content → data_start_row

    Args:
        rows: First N rows as lists of raw cell values.

    Returns:
        1-based row number.
    """
    saw_header = False
    saw_gap = False

    for i, row_values in enumerate(rows):
        non_empty = [v for v in row_values if v is not None]
        count = len(non_empty)

        if not saw_gap:
            # Phase 1: looking for single-cell header rows
            if count == 1 and isinstance(non_empty[0], str):
                saw_header = True
            elif count == 0 and saw_header:
                saw_gap = True
            elif count > 0 and saw_header:
                # Multi-value row right after headers (no blank gap)
                return i + 1  # 1-based
        else:
            # Phase 2: skip blank rows after header block
            if count > 0:
                return i + 1  # 1-based

    return 1  # fallback if the file is very short


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_report_type(filepath: Union[str, Path]) -> DetectionResult:
    """Open a QBO Excel export and detect its type, metadata, and data layout.

    Reads **only the first 10 rows** using openpyxl in read-only mode, making
    it fast even on large workbooks.

    Detection strategy:

    1. Collect single-text-value rows at the top of the sheet — these are the
       QBO header block (company name, report title, date range).
    2. Row 1 → ``company_name``.
    3. Row 2 → report title → ``report_type`` + optional ``basis``.
    4. Row 3 → date range → ``period_start`` / ``period_end`` + fallback
       ``basis``.
    5. If the title didn't yield a report type, scan all text in the first
       10 rows as a fallback.
    6. ``data_start_row`` is the first row after the header block.

    Args:
        filepath: Path to the ``.xlsx`` file.

    Returns:
        A :class:`DetectionResult` with all extracted metadata.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If openpyxl cannot open the file.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    result = DetectionResult()

    try:
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError(f"Cannot read workbook: {exc}") from exc

    try:
        ws = wb.active
        if ws is None:
            return result

        # Read first 10 rows into plain lists
        raw_rows = []  # type: List[List]
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True)):
            raw_rows.append(list(row))
            if i >= 9:
                break

        if not raw_rows:
            return result

        # -- Collect the single-text-value header rows --
        header_texts = []  # type: List[str]
        for row_values in raw_rows:
            texts = [_cell_to_str(v) for v in row_values if _cell_to_str(v)]
            if len(texts) == 1:
                header_texts.append(texts[0])
            elif len(texts) == 0:
                # Blank row — stop collecting if we already have headers
                if header_texts:
                    break
            else:
                break  # multi-value row = end of header block

        # -- Company name (first header row) --
        if len(header_texts) >= 1:
            result.company_name = header_texts[0]

        # -- Report type + basis from title row --
        if len(header_texts) >= 2:
            title = header_texts[1]
            result.report_type = _match_report_type(title)
            result.basis = _extract_basis(title)

        # -- Date period (+ fallback basis) from date-range row --
        if len(header_texts) >= 3:
            date_text = header_texts[2]
            result.period_start, result.period_end = _parse_date_range(date_text)
            if result.basis == ReportBasis.UNKNOWN:
                result.basis = _extract_basis(date_text)

        # -- Fallback: scan all cells if report type still unknown --
        if result.report_type == ReportType.UNKNOWN:
            for row_values in raw_rows:
                for val in row_values:
                    text = _cell_to_str(val)
                    if text:
                        rt = _match_report_type(text)
                        if rt != ReportType.UNKNOWN:
                            result.report_type = rt
                            break
                if result.report_type != ReportType.UNKNOWN:
                    break

        # -- Fallback: scan all header texts for dates if still empty --
        if not result.period_start and not result.period_end:
            for text in header_texts:
                s, e = _parse_date_range(text)
                if s or e:
                    result.period_start, result.period_end = s, e
                    break

        # -- Fallback: scan all header texts for basis if still unknown --
        if result.basis == ReportBasis.UNKNOWN:
            for text in header_texts:
                b = _extract_basis(text)
                if b != ReportBasis.UNKNOWN:
                    result.basis = b
                    break

        # -- Data start row --
        result.data_start_row = _find_data_start_row(raw_rows)

    finally:
        wb.close()

    return result
