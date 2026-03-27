#!/usr/bin/env python3
"""Example: parse a QBO export and work with the data programmatically.

Demonstrates:
  1. Basic parsing
  2. Accessing specific financial values
  3. Converting to a pandas DataFrame
  4. Generating a summary

Usage:
    python examples/parse_report.py [path/to/export.xlsx]

If no path is given, uses tests/fixtures/sample_pnl.xlsx.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from qbo_parser import parse_qbo_report, flatten_report


def find_section(sections: list, name: str) -> dict | None:
    """Find a section by name (case-insensitive)."""
    name_lower = name.lower()
    for s in sections:
        if s["name"].lower() == name_lower:
            return s
    return None


def main() -> None:
    # ── Resolve file path ──────────────────────────────────────────────
    if len(sys.argv) >= 2:
        filepath = sys.argv[1]
    else:
        # Default to the test fixture
        fixture = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "sample_pnl.xlsx"
        if not fixture.exists():
            print("Usage: python examples/parse_report.py <path-to-xlsx>")
            sys.exit(1)
        filepath = str(fixture)
        print(f"Using fixture: {filepath}\n")

    # ──────────────────────────────────────────────────────────────────
    # 1. Parse the report
    # ──────────────────────────────────────────────────────────────────
    print("=" * 60)
    print("1. PARSING")
    print("=" * 60)

    result = parse_qbo_report(filepath)

    print(f"  Company     : {result['company_name']}")
    print(f"  Report type : {result['report_type']}")
    print(f"  Basis       : {result['report_basis']}")
    print(f"  Period      : {result['period']['start_date']} → {result['period']['end_date']}")
    print(f"  Columns     : {result['columns']}")
    print(f"  Sections    : {[s['name'] for s in result['sections']]}")
    print()

    # ──────────────────────────────────────────────────────────────────
    # 2. Access specific financial values
    # ──────────────────────────────────────────────────────────────────
    print("=" * 60)
    print("2. ACCESSING VALUES")
    print("=" * 60)

    columns = result["columns"]
    sections = result["sections"]

    # Total Revenue (from the Income section's total)
    income = find_section(sections, "Income")
    if income and income["total"]:
        print("\n  Total Revenue by period:")
        for col in columns:
            val = income["total"].get(col)
            if val is not None:
                print(f"    {col:>12s}: ${val:>12,.2f}")

    # Total Expenses
    expenses = find_section(sections, "Expenses")
    if expenses and expenses["total"]:
        print("\n  Total Expenses by period:")
        for col in columns:
            val = expenses["total"].get(col)
            if val is not None:
                print(f"    {col:>12s}: ${val:>12,.2f}")

    # Net Income
    net_income = find_section(sections, "Net Income")
    if net_income and net_income["total"]:
        print("\n  Net Income by period:")
        for col in columns:
            val = net_income["total"].get(col)
            if val is not None:
                sign = "" if val >= 0 else "-"
                print(f"    {col:>12s}: {sign}${abs(val):>12,.2f}")

    # Drill into a specific account
    if expenses:
        for row in expenses["rows"]:
            if row["account_code"] == "61000":
                print(f"\n  Drill-down: {row['account_code']} {row['account_name']}")
                print(f"    Sub-accounts: {len([c for c in row['children'] if not c['is_total']])}")
                for child in row["children"]:
                    if not child["is_total"]:
                        first_val = child["amounts"].get(columns[0])
                        val_str = f"${first_val:,.2f}" if first_val is not None else "—"
                        print(f"      {child['account_name']:30s} {columns[0]}: {val_str}")
                break
    print()

    # ──────────────────────────────────────────────────────────────────
    # 3. Convert to a pandas DataFrame
    # ──────────────────────────────────────────────────────────────────
    print("=" * 60)
    print("3. FLAT FORMAT / DATAFRAME")
    print("=" * 60)

    flat_rows = flatten_report(result)
    print(f"\n  Total flat rows: {len(flat_rows)}")
    print(f"  Columns: section, account_name, account_code, depth, is_total, {', '.join(columns)}")

    # Show first 5 rows as a table
    print("\n  First 5 rows:")
    print(f"  {'Section':20s} {'Account':35s} {'Depth':>5s} {'Total?':>6s} {columns[0]:>12s}")
    print(f"  {'─'*20} {'─'*35} {'─'*5} {'─'*6} {'─'*12}")
    for row in flat_rows[:5]:
        val = row.get(columns[0])
        val_str = f"${val:>10,.2f}" if val is not None else "         —"
        print(
            f"  {row['section']:20s} "
            f"{row['account_name']:35s} "
            f"{row['depth']:>5d} "
            f"{'yes' if row['is_total'] else 'no':>6s} "
            f"{val_str}"
        )

    try:
        import pandas as pd

        df = pd.DataFrame(flat_rows)
        print(f"\n  DataFrame shape: {df.shape}")
        print(f"  DataFrame dtypes:\n{df.dtypes.to_string()}")

        # Quick analysis: total by section for the first column
        print(f"\n  Section totals ({columns[0]}):")
        totals = df[df["is_total"] & (df["depth"] == 0)]
        for _, row in totals.iterrows():
            val = row.get(columns[0])
            if val is not None and val != 0:
                print(f"    {row['account_name']:35s} ${val:>12,.2f}")

    except ImportError:
        print("\n  (pandas not installed — install with: pip install pandas)")

    print()

    # ──────────────────────────────────────────────────────────────────
    # 4. Summary
    # ──────────────────────────────────────────────────────────────────
    print("=" * 60)
    print("4. REPORT SUMMARY")
    print("=" * 60)
    print()
    print(f"  {result['company_name']}")
    print(f"  {result['report_type'].replace('_', ' ').title()}")
    print(f"  {result['period']['start_date']} to {result['period']['end_date']}")
    print()

    # Build a P&L summary table
    summary_sections = [
        ("Revenue", "Income"),
        ("COGS", "Cost of Goods Sold"),
        ("Gross Profit", "Gross Profit"),
        ("Expenses", "Expenses"),
        ("Net Operating Income", "Net Operating Income"),
        ("Net Income", "Net Income"),
    ]

    # Header
    col_headers = [c for c in columns]
    header = f"  {'':30s}" + "".join(f"{c:>14s}" for c in col_headers)
    print(header)
    print(f"  {'─' * 30}" + "─" * (14 * len(col_headers)))

    for label, section_name in summary_sections:
        section = find_section(sections, section_name)
        if section and section["total"]:
            vals = []
            for c in col_headers:
                v = section["total"].get(c)
                if v is not None:
                    vals.append(f"${v:>12,.2f}")
                else:
                    vals.append(f"{'—':>13s}")
            print(f"  {label:30s}" + "".join(f"{v:>14s}" for v in vals))

    print()


if __name__ == "__main__":
    main()
