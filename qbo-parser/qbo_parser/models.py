"""Pydantic models for structured QBO report output.

Defines the schema for parsed QuickBooks Online exports. Supports all three
report types (P&L, Balance Sheet, Cash Flow Statement) with a recursive row
hierarchy that preserves the original QBO account nesting.

Design decisions:
  - Rows use recursive ``children`` to represent the account tree, rather than
    a flat list with depth integers. This lets consumers walk the tree without
    re-inferring parent-child relationships.
  - ``amounts`` is a ``Dict[str, float]`` keyed by column header (e.g.
    ``{"Jan 2019": 20701.02, "Feb 2019": 41203.03}``). This is resilient to
    column reordering and supports both single-total and multi-period layouts.
  - ``Section`` groups rows under the top-level QBO headings (Income, COGS,
    Expenses, etc.) with its own ``total`` dict for quick access.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ReportType(str, Enum):
    """Financial statement type detected from the QBO export."""
    PROFIT_AND_LOSS = "profit_and_loss"
    BALANCE_SHEET = "balance_sheet"
    CASH_FLOW_STATEMENT = "cash_flow_statement"
    UNKNOWN = "unknown"


class ReportBasis(str, Enum):
    """Accounting basis for the report."""
    ACCRUAL = "accrual"
    CASH = "cash"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class ReportPeriod(BaseModel):
    """Date range the report covers."""
    start_date: str = Field(
        default="",
        description="ISO date (YYYY-MM-DD) for the start of the reporting period",
    )
    end_date: str = Field(
        default="",
        description="ISO date (YYYY-MM-DD) for the end of the reporting period",
    )


class Row(BaseModel):
    """A single account row in the report, potentially with nested children.

    The tree structure mirrors QBO's indentation-based hierarchy:
      - depth 0: section headers (Income, Expenses, …)
      - depth 1: top-level accounts (41000 Sales)
      - depth 2+: sub-accounts (Product Sales, Service Revenue)

    Total rows (e.g. "Total Sales") appear as the last child of their parent
    with ``is_total=True``.
    """
    account_name: str = Field(
        description="Display name of the account or subtotal line",
    )
    account_code: str = Field(
        default="",
        description="Numeric account code extracted from the label (e.g. '41000')",
    )
    depth: int = Field(
        default=0,
        description="Nesting level — 0 = section header, 1 = account, 2+ = sub-account",
    )
    amounts: Dict[str, Optional[float]] = Field(
        default_factory=dict,
        description=(
            "Column header → amount. Keys match entries in ParsedReport.columns. "
            "None for blank cells."
        ),
    )
    is_total: bool = Field(
        default=False,
        description="True for subtotal/total rows like 'Total Income'",
    )
    children: List[Row] = Field(
        default_factory=list,
        description="Nested child rows preserving the QBO account hierarchy",
    )


# Pydantic v2 needs an explicit model_rebuild() for self-referencing models
Row.model_rebuild()


class Section(BaseModel):
    """A top-level grouping in the financial statement.

    Maps to the major QBO headings:
      - P&L:  Income, Cost of Goods Sold, Gross Profit, Expenses, Net Income, …
      - BS:   Assets, Liabilities, Equity
      - SCF:  Operating Activities, Investing Activities, Financing Activities
    """
    name: str = Field(
        description="Section heading as it appears in the export",
    )
    depth: int = Field(
        default=0,
        description="Always 0 for top-level sections",
    )
    rows: List[Row] = Field(
        default_factory=list,
        description="Account rows within this section",
    )
    total: Dict[str, Optional[float]] = Field(
        default_factory=dict,
        description="Section total amounts, keyed by column header",
    )


class ParseMetadata(BaseModel):
    """Metadata about the parse operation itself (not the report content)."""
    source: str = Field(
        default="quickbooks_online",
        description="Origin system",
    )
    export_format: str = Field(
        default="xlsx",
        description="File format of the original export",
    )
    parsed_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z",
        description="ISO-8601 timestamp of when parsing occurred",
    )
    parser_version: str = Field(
        default="0.1.0",
        description="Version of qbo-parser that produced this output",
    )


# ---------------------------------------------------------------------------
# Top-level output model
# ---------------------------------------------------------------------------

class ParsedReport(BaseModel):
    """Complete structured output from parsing a QBO Excel export.

    This is the top-level model returned by ``parse_qbo_report()``. It is
    designed to ``model_dump(mode='json')`` cleanly for API responses,
    file storage, or piping into downstream systems.

    Example (P&L)::

        {
          "report_type": "profit_and_loss",
          "company_name": "Acme Corp",
          "report_basis": "accrual",
          "period": {"start_date": "2024-01-01", "end_date": "2024-12-31"},
          "columns": ["Total"],
          "sections": [...],
          "metadata": {...}
        }
    """
    report_type: ReportType = Field(
        default=ReportType.UNKNOWN,
        description="Detected financial statement type",
    )
    company_name: str = Field(
        default="",
        description="Company name from the QBO header rows",
    )
    report_basis: ReportBasis = Field(
        default=ReportBasis.UNKNOWN,
        description="Accounting basis (accrual or cash)",
    )
    period: ReportPeriod = Field(
        default_factory=ReportPeriod,
        description="Date range the report covers",
    )
    columns: List[str] = Field(
        default_factory=list,
        description=(
            "Ordered list of column headers (e.g. ['Jan 2019', 'Feb 2019'] "
            "or ['Total']). These are the keys used in Row.amounts and "
            "Section.total dicts."
        ),
    )
    sections: List[Section] = Field(
        default_factory=list,
        description="Top-level report sections containing the account hierarchy",
    )
    metadata: ParseMetadata = Field(
        default_factory=ParseMetadata,
        description="Parser metadata (source, version, timestamp)",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Non-fatal issues encountered during parsing",
    )
    validation_warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Accounting-identity checks that didn't reconcile.  Populated "
            "after parsing for P&L (Revenue-Expenses≈Net Income), BS "
            "(Assets≈Liabilities+Equity), and SCF (Activities≈Net Cash Change)."
        ),
    )
