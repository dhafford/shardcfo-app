"""Hierarchy reconstruction and amount cleaning for QBO exports.

QBO exports encode hierarchy through indentation (leading spaces in account
names) and "Total" prefix lines.  This module provides the low-level helpers
that the parser uses to turn raw cell values into structured data.

Functions fall into three categories:

**Amount parsing**
  - :func:`clean_amount` — raw cell → float | None  (None = blank / unparseable)
  - :func:`parse_amount` — raw cell → float | None  (0.0 for blanks, None = label text)

**Name / depth**
  - :func:`compute_depth` — pure-string depth from leading spaces
  - :func:`detect_indent_depth` — cell-aware depth (alignment → spaces → column offset)
  - :func:`clean_account_name` — sanitise text, *preserving* leading spaces
  - :func:`extract_account_code` — split ``"41000 Sales"`` → ``("41000", "Sales")``

**Row / column classification**
  - :func:`is_total_row` — detect totals, net-summary, and gross-profit rows
  - :func:`detect_column_layout` — scan a header row for label / amount columns
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, Optional, Tuple


# ===================================================================
# Depth detection
# ===================================================================

def compute_depth(label: str) -> int:
    """Determine nesting depth from leading whitespace.

    QBO uses groups of 3 spaces per indent level:
      - ``"Income"``               → 0
      - ``"   41000 Sales"``       → 1  (3 spaces)
      - ``"      Advertising"``    → 2  (6 spaces)

    Args:
        label: The raw cell text from column A.

    Returns:
        Integer depth (0 = top-level, 1 = first indent, etc.).
    """
    if not label:
        return 0
    stripped = label.lstrip(" ")
    spaces = len(label) - len(stripped)
    return spaces // 3


def detect_indent_depth(
    cell: Any,
    raw_value: str,
    indent_unit: int = 3,
) -> int:
    """Determine hierarchy depth from an openpyxl cell object.

    Uses a three-tier fallback:

    1. **cell.alignment.indent** — the most reliable signal when QBO sets
       the Excel indent property (each level is typically 1).
    2. **Leading whitespace** in *raw_value* divided by *indent_unit*.
    3. **Column offset** — if the text is in column B (2) or later, uses
       ``column_index − 1`` as the depth.  This handles rare QBO layouts
       where sub-accounts shift rightward instead of indenting.

    Args:
        cell: An openpyxl ``Cell`` (or any object with ``.alignment`` and
              ``.column`` attributes).  May be ``None`` for pure-string mode.
        raw_value: The raw string value of the cell.
        indent_unit: Number of leading spaces per depth level (default 3).

    Returns:
        Integer depth (0 = top-level).
    """
    # 1. Try cell.alignment.indent
    try:
        if cell is not None and hasattr(cell, "alignment"):
            align = cell.alignment
            if align and align.indent:
                indent = int(align.indent)
                if indent > 0:
                    return indent
    except (AttributeError, TypeError):
        pass

    # 2. Leading whitespace
    if raw_value and isinstance(raw_value, str):
        stripped = raw_value.lstrip(" ")
        spaces = len(raw_value) - len(stripped)
        if spaces > 0 and indent_unit > 0:
            return spaces // indent_unit

    # 3. Column offset (column B = depth 1, C = 2, …)
    try:
        if cell is not None and hasattr(cell, "column"):
            col = cell.column  # 1-based
            if isinstance(col, int) and col > 1:
                return col - 1
    except (AttributeError, TypeError):
        pass

    return 0


# ===================================================================
# Total / summary-row detection
# ===================================================================

def is_total_row(label: str) -> bool:
    """Check whether a label represents a total, subtotal, or summary row.

    Matches (case-insensitive):
      - ``"Total Income"``, ``"Total 61000 Advertising"`` — "Total " prefix
      - ``"TOTAL"`` — standalone
      - ``"Net Income"``, ``"Net Revenue"`` — "Net " prefix
      - ``"Gross Profit"`` — exact match

    Args:
        label: The row label (raw or stripped — leading spaces are ignored).

    Returns:
        True if the row is a summary / total line.
    """
    stripped = label.strip().lower()
    if not stripped:
        return False
    if stripped.startswith("total ") or stripped == "total":
        return True
    if stripped.startswith("net "):
        return True
    if stripped == "gross profit":
        return True
    return False


# ===================================================================
# Amount parsing
# ===================================================================

_CURRENCY_RE = re.compile(r"[\$\u20ac\u00a3]")  # $, €, £


def clean_amount(raw_value: object) -> Optional[float]:
    """Convert a raw cell value to a clean float.

    Designed for **raw extraction** where ``None`` means "no data present".

    Handles:
      - ``int`` / ``float`` → passthrough as float
      - ``None`` → ``None``
      - Strings with currency symbols, commas, parenthetical negatives
      - ``bool`` → ``None`` (openpyxl may yield booleans)
      - Bare ``"-"`` → ``None``

    Returns:
        A float, or ``None`` if the cell is empty / unparseable.
    """
    if raw_value is None:
        return None
    if isinstance(raw_value, bool):
        return None
    if isinstance(raw_value, (int, float)):
        return float(raw_value)

    s = str(raw_value).strip()
    if not s or s == "-":
        return None

    return _parse_numeric_string(s)


def parse_amount(value: object) -> Optional[float]:
    """Parse a cell value from a known amount column into a float.

    Unlike :func:`clean_amount` (which returns ``None`` for blanks), this
    function treats blank / ``None`` / empty-string as **0.0** — appropriate
    for amount columns where a missing value means zero, not "unknown".

    Non-numeric text returns ``None``, signalling the cell holds a label
    rather than an amount.

    Handles all QBO amount formats:
      - ``"1,234.56"`` → ``1234.56``
      - ``"(1,234.56)"`` → ``-1234.56``
      - ``"$1,234.56"`` → ``1234.56``
      - ``"-1,234.56"`` → ``-1234.56``
      - ``None`` / ``""`` / blank → ``0.0``
      - ``int`` / ``float`` → ``float(value)``
      - Non-numeric text → ``None``

    Args:
        value: The raw cell value (from openpyxl or manual input).

    Returns:
        A float, ``0.0`` for blanks, or ``None`` if the value is
        non-numeric text (i.e. a label).
    """
    # Blanks → 0.0
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()
    if not s or s == "-":
        return 0.0

    result = _parse_numeric_string(s)
    return result  # None if text is a label


def _parse_numeric_string(s: str) -> Optional[float]:
    """Shared string-to-float logic for clean_amount and parse_amount."""
    # Strip currency symbols
    s = _CURRENCY_RE.sub("", s).strip()
    if not s:
        return None

    # Parenthetical negatives: (1,234.56) → -1234.56
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1].strip()

    # Remove thousand separators
    s = s.replace(",", "")

    try:
        val = float(s)
        return -val if negative else val
    except ValueError:
        return None


# ===================================================================
# Account-name cleaning
# ===================================================================

# Non-printable characters: control codes 0x00-0x1F (except tab/newline)
# and 0x7F (DEL), plus some Unicode control chars.
_NON_PRINTABLE_RE = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x80-\x9f]"
)
_MULTI_SPACE_RE = re.compile(r"(?<=\S) {2,}(?=\S)")


def clean_account_name(value: str) -> str:
    """Sanitise an account-name string, **preserving** leading spaces.

    Leading spaces encode indent depth and must not be touched (use
    :func:`compute_depth` to interpret them).  Everything else is
    cleaned:

    - Non-printable / control characters are removed.
    - Trailing whitespace (spaces, tabs, newlines) is stripped.
    - Multiple consecutive *internal* spaces are collapsed to one.

    Args:
        value: The raw cell text.

    Returns:
        The cleaned string.  Returns ``""`` for ``None`` or blank input.

    Examples::

        >>> clean_account_name("   41000 Sales  \\n")
        '   41000 Sales'
        >>> clean_account_name("   Payroll\\x00  Expenses   ")
        '   Payroll Expenses'
    """
    if not value:
        return ""

    # Remove non-printable characters
    cleaned = _NON_PRINTABLE_RE.sub("", value)

    # Strip trailing whitespace only
    cleaned = cleaned.rstrip()

    if not cleaned:
        return ""

    # Separate leading spaces from the rest
    rest = cleaned.lstrip(" ")
    leading_spaces = cleaned[: len(cleaned) - len(rest)]

    # Collapse multiple internal spaces to one (inside the non-leading part)
    rest = _MULTI_SPACE_RE.sub(" ", rest)

    return leading_spaces + rest


# ===================================================================
# Account-code extraction
# ===================================================================

# Matches: optional "Total " prefix + 4-6 digit code + space + rest
_CODE_RE = re.compile(r"^(Total\s+)?(\d{4,6})\s+(.+)$", re.IGNORECASE)


def extract_account_code(label: str) -> Tuple[str, str]:
    """Split an account code from the label if present.

    Examples::

        "   41000 Sales"                          → ("41000", "Sales")
        "   Total 61000 Advertising & Marketing"  → ("61000", "Total Advertising & Marketing")
        "Income"                                  → ("", "Income")
        "Total Income"                            → ("", "Total Income")

    Args:
        label: The raw cell text (leading spaces are stripped internally).

    Returns:
        ``(account_code, cleaned_label)``.  If no code is found,
        ``account_code`` is ``""``.
    """
    stripped = label.strip()
    m = _CODE_RE.match(stripped)
    if m:
        prefix = (m.group(1) or "").rstrip()
        code = m.group(2)
        name = m.group(3)
        if prefix:
            name = prefix + " " + name
        return (code, name)
    return ("", stripped)


# ===================================================================
# Column-layout detection
# ===================================================================

def is_percent_column(label: str) -> bool:
    """Return True if a column header looks like a QBO percentage column.

    Matches ``"% of Income"``, ``"% of Revenue"``, ``"% of Expenses"``,
    ``"% of Row"``, etc.

    Examples::

        >>> is_percent_column("% of Income")
        True
        >>> is_percent_column("Jan 2024")
        False
        >>> is_percent_column("Total")
        False
    """
    stripped = label.strip()
    if stripped.startswith("%"):
        return True
    if re.search(r"%\s*of\b", stripped, re.IGNORECASE):
        return True
    return False


def detect_column_layout(ws: Any, header_row: int) -> Dict[str, Any]:
    """Scan a header row to identify label, amount, and percentage columns.

    QBO exports put account names in column A and amounts in columns B
    onward.  The header row contains column labels — either strings
    (``"Total"``) or datetime objects (``datetime(2019, 1, 1)``
    → ``"Jan 2019"``).  Percentage columns like ``"% of Income"`` are
    classified separately.

    Args:
        ws: An openpyxl Worksheet.
        header_row: 1-based row number containing column headers.

    Returns:
        A dict::

            {
                "label_col": 0,
                "amount_cols": {1: "Jan 2024", 2: "Feb 2024", 3: "Total"},
                "percent_cols": {4: "% of Income"},
            }
    """
    layout = {
        "label_col": 0,
        "amount_cols": {},
        "percent_cols": {},
    }  # type: Dict[str, Any]

    for row in ws.iter_rows(min_row=header_row, max_row=header_row):
        for cell in row:
            if cell.value is None:
                continue
            col_idx = cell.column - 1  # 0-based

            if col_idx == 0:
                layout["label_col"] = 0
                continue

            val = cell.value
            if isinstance(val, datetime):
                label = val.strftime("%b %Y")
            elif isinstance(val, date):
                label = val.strftime("%b %Y")
            else:
                label = str(val).strip()

            if not label:
                continue

            if is_percent_column(label):
                layout["percent_cols"][col_idx] = label
            else:
                layout["amount_cols"][col_idx] = label

    return layout
