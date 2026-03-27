"""Post-parse accounting-identity validation for QBO reports.

Runs after the tree is built and checks report-type-specific identities:

  - **P&L**: Income − COGS − Expenses + Other Income − Other Expenses ≈ Net Income
  - **BS**:  Total Assets ≈ Total Liabilities and Equity
  - **SCF**: Operating + Investing + Financing ≈ Net Change in Cash

Failures are returned as human-readable warning strings — they never
raise exceptions.  Rounding tolerance defaults to $1.00 to absorb the
floating-point drift that QBO's Excel exports introduce.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# Tolerance in dollars.  QBO exports accumulate float imprecision across
# hundreds of rows; $1.00 catches real errors while ignoring rounding.
TOLERANCE = 1.00


# ===================================================================
# Helpers
# ===================================================================

def _get(amounts: Dict[str, Any], col: str) -> float:
    """Read an amount from a dict, defaulting None/missing to 0."""
    val = amounts.get(col)
    if val is None:
        return 0.0
    return float(val)


def _find_section(
    sections: List[Dict],
    include: str,
    exclude: Optional[List[str]] = None,
) -> Optional[Dict]:
    """Find the first section whose name contains *include* (case-insensitive)
    but does NOT contain any of the *exclude* substrings.

    This is needed because QBO P&L sections have overlapping names:
    "Income", "Other Income", "Net Income", "Net Operating Income".
    """
    exclude = exclude or []
    include_l = include.lower()
    exclude_l = [e.lower() for e in exclude]

    for s in sections:
        name = s["name"].lower()
        if include_l not in name:
            continue
        if any(e in name for e in exclude_l):
            continue
        return s
    return None


def _section_total(section: Optional[Dict], col: str) -> float:
    """Get the total for *col* from a section, returning 0 if missing."""
    if section is None:
        return 0.0
    return _get(section.get("total", {}), col)


def _fmt(val: float) -> str:
    """Format a number for warning messages."""
    return f"{val:,.2f}"


# ===================================================================
# Per-report-type validators
# ===================================================================

def _validate_pnl(sections: List[Dict], columns: List[str]) -> List[str]:
    """P&L identity: Income − COGS − Expenses + OtherIncome − OtherExpenses ≈ Net Income."""
    warnings = []

    income = _find_section(sections, "income", exclude=["other", "net", "gross"])
    cogs = _find_section(sections, "cost of goods", exclude=["net", "total"])
    expenses = _find_section(sections, "expenses", exclude=["other", "net"])
    other_income = _find_section(sections, "other income", exclude=["net"])
    other_expenses = _find_section(sections, "other expense", exclude=["net"])
    net_income = _find_section(sections, "net income", exclude=["other", "operating"])

    if not income or not net_income:
        return warnings  # can't validate without both ends

    for col in columns:
        rev = _section_total(income, col)
        cg = _section_total(cogs, col)
        exp = _section_total(expenses, col)
        oi = _section_total(other_income, col)
        oe = _section_total(other_expenses, col)
        ni = _section_total(net_income, col)

        expected = rev - cg - exp + oi - oe
        diff = abs(expected - ni)
        if diff > TOLERANCE:
            warnings.append(
                f"P&L: {col}: Income({_fmt(rev)}) - COGS({_fmt(cg)}) "
                f"- Expenses({_fmt(exp)}) + Other Income({_fmt(oi)}) "
                f"- Other Expenses({_fmt(oe)}) = {_fmt(expected)}, "
                f"but Net Income = {_fmt(ni)} (diff: {_fmt(diff)})"
            )

    return warnings


def _validate_balance_sheet(
    sections: List[Dict],
    columns: List[str],
) -> List[str]:
    """BS identity: Total Assets ≈ Total Liabilities + Total Equity.

    Tries two strategies:
      1. Compare "Total Assets" section vs. "Total Liabilities and Equity" section.
      2. If (1) isn't available, compare "Assets" vs. "Liabilities" + "Equity".
    """
    warnings = []

    # Strategy 1: look for the combined "Liabilities and Equity" section
    assets_sec = _find_section(
        sections, "assets", exclude=["current", "fixed", "other", "non-current"],
    )
    liab_eq_sec = _find_section(sections, "liabilities and equity")

    if assets_sec and liab_eq_sec:
        for col in columns:
            a = _section_total(assets_sec, col)
            le = _section_total(liab_eq_sec, col)
            diff = abs(a - le)
            if diff > TOLERANCE:
                warnings.append(
                    f"BS: {col}: Total Assets({_fmt(a)}) != "
                    f"Total Liabilities and Equity({_fmt(le)}) "
                    f"(diff: {_fmt(diff)})"
                )
        return warnings

    # Strategy 2: separate Liabilities and Equity sections
    if not assets_sec:
        return warnings

    liab_sec = _find_section(
        sections, "liabilities",
        exclude=["current", "long", "equity", "and equity"],
    )
    equity_sec = _find_section(
        sections, "equity",
        exclude=["liabilities"],
    )

    if liab_sec and equity_sec:
        for col in columns:
            a = _section_total(assets_sec, col)
            l = _section_total(liab_sec, col)
            e = _section_total(equity_sec, col)
            diff = abs(a - (l + e))
            if diff > TOLERANCE:
                warnings.append(
                    f"BS: {col}: Total Assets({_fmt(a)}) != "
                    f"Liabilities({_fmt(l)}) + Equity({_fmt(e)}) = "
                    f"{_fmt(l + e)} (diff: {_fmt(diff)})"
                )

    return warnings


def _validate_cash_flow(
    sections: List[Dict],
    columns: List[str],
) -> List[str]:
    """SCF identity: Operating + Investing + Financing ≈ Net Change in Cash."""
    warnings = []

    operating = _find_section(sections, "operating")
    investing = _find_section(sections, "investing")
    financing = _find_section(sections, "financing")
    net_change = _find_section(
        sections, "net change in cash",
    ) or _find_section(
        sections, "net increase",
    ) or _find_section(
        sections, "net decrease",
    )

    if not net_change:
        return warnings  # can't validate without the bottom line

    for col in columns:
        op = _section_total(operating, col)
        inv = _section_total(investing, col)
        fin = _section_total(financing, col)
        nc = _section_total(net_change, col)

        expected = op + inv + fin
        diff = abs(expected - nc)
        if diff > TOLERANCE:
            warnings.append(
                f"SCF: {col}: Operating({_fmt(op)}) + Investing({_fmt(inv)}) "
                f"+ Financing({_fmt(fin)}) = {_fmt(expected)}, "
                f"but Net Change in Cash = {_fmt(nc)} (diff: {_fmt(diff)})"
            )

    return warnings


# ===================================================================
# Public entry point
# ===================================================================

def validate_report(report: Dict[str, Any]) -> List[str]:
    """Run accounting-identity checks on a parsed report.

    Dispatches to the appropriate validator based on ``report_type``.
    Returns an empty list for ``"unknown"`` type or if required sections
    are missing.

    Args:
        report: A dict produced by :func:`qbo_parser.parser.parse_qbo_report`.

    Returns:
        A list of human-readable warning strings (empty = all checks pass).
    """
    rtype = report.get("report_type", "unknown")
    sections = report.get("sections", [])
    columns = report.get("columns", [])

    if not sections or not columns:
        return []

    if rtype == "profit_and_loss":
        return _validate_pnl(sections, columns)
    elif rtype == "balance_sheet":
        return _validate_balance_sheet(sections, columns)
    elif rtype == "cash_flow_statement":
        return _validate_cash_flow(sections, columns)

    return []
