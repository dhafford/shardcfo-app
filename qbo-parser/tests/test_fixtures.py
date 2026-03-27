"""Comprehensive fixture tests — parse each report type and validate."""

from __future__ import annotations

from pathlib import Path

import pytest

from qbo_parser import parse_qbo_report
from qbo_parser.models import ParsedReport, ReportType

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---- HELPERS ----


def find_section(sections, name):
    """Case-insensitive section finder."""
    for s in sections:
        if s["name"].lower() == name.lower():
            return s
    return None


def find_section_containing(sections, substring):
    """Find first section whose name contains substring."""
    for s in sections:
        if substring.lower() in s["name"].lower():
            return s
    return None


def find_row(rows, name_substring):
    """Recursively find a row by name substring."""
    for r in rows:
        if name_substring.lower() in r["account_name"].lower():
            return r
        found = find_row(r.get("children", []), name_substring)
        if found:
            return found
    return None


# ===========================================================================
# TestSamplePL — annual P&L
# ===========================================================================


class TestSamplePL:
    @pytest.fixture(scope="class")
    def result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_pl.xlsx"))

    def test_report_type(self, result):
        assert result["report_type"] == "profit_and_loss"

    def test_company_name(self, result):
        assert result["company_name"] == "Demo Startup Inc"

    def test_basis_detected(self, result):
        assert result["report_basis"] == "accrual"

    def test_columns(self, result):
        assert result["columns"] == ["Total"]

    def test_period(self, result):
        # Single-column P&L: period inferred from date-range header row
        assert result["period"]["start_date"] == "2024-01-01"
        assert result["period"]["end_date"] == "2024-12-31"

    def test_section_count(self, result):
        # Income, COGS, Gross Profit, Expenses, Net Operating Income,
        # Other Expenses, Net Other Income, Net Income = 8 sections
        assert len(result["sections"]) == 8

    def test_section_order(self, result):
        names = [s["name"] for s in result["sections"]]
        assert names[0].lower() == "income"
        assert "cost of goods sold" in names[1].lower()
        assert "gross profit" in names[2].lower()
        assert "expenses" in names[3].lower()
        assert "net operating income" in names[4].lower()
        assert "other expenses" in names[5].lower()
        assert "net other income" in names[6].lower()
        assert "net income" in names[7].lower()

    def test_income_total(self, result):
        section = find_section_containing(result["sections"], "income")
        assert section["total"]["Total"] == pytest.approx(912000, abs=1.0)

    def test_cogs_total(self, result):
        section = find_section_containing(result["sections"], "cost of goods sold")
        assert section["total"]["Total"] == pytest.approx(206400, abs=1.0)

    def test_gross_profit(self, result):
        section = find_section_containing(result["sections"], "gross profit")
        assert section["total"]["Total"] == pytest.approx(705600, abs=1.0)

    def test_expenses_total(self, result):
        # Find the "Expenses" section (not "Other Expenses")
        expenses = None
        for s in result["sections"]:
            name = s["name"].lower()
            if name == "expenses":
                expenses = s
                break
        assert expenses is not None, "Expenses section not found"
        assert expenses["total"]["Total"] == pytest.approx(679800, abs=1.0)

    def test_net_income(self, result):
        section = find_section_containing(result["sections"], "net income")
        assert section["total"]["Total"] == pytest.approx(5400, abs=1.0)

    def test_payroll_has_children(self, result):
        # Find the Expenses section and look for 60000 Payroll row
        expenses = find_section(result["sections"], "Expenses")
        assert expenses is not None
        payroll = find_row(expenses["rows"], "payroll")
        assert payroll is not None
        children = payroll.get("children", [])
        child_names = [c["account_name"].lower() for c in children]
        assert any("salaries" in n for n in child_names)
        assert any("payroll taxes" in n or "taxes" in n for n in child_names)
        assert any("benefits" in n for n in child_names)

    def test_payroll_total_is_child(self, result):
        expenses = find_section(result["sections"], "Expenses")
        assert expenses is not None
        payroll = find_row(expenses["rows"], "payroll")
        assert payroll is not None
        children = payroll.get("children", [])
        # Last child should be the total row
        total_children = [c for c in children if c["is_total"]]
        assert len(total_children) >= 1
        assert total_children[-1]["is_total"] is True

    def test_account_codes_extracted(self, result):
        # SaaS Revenue should have code "40000"
        income = find_section(result["sections"], "Income")
        assert income is not None
        saas = find_row(income["rows"], "saas revenue")
        assert saas is not None
        assert saas["account_code"] == "40000"

        # 60000 Payroll
        expenses = find_section(result["sections"], "Expenses")
        assert expenses is not None
        payroll = find_row(expenses["rows"], "payroll")
        assert payroll is not None
        assert payroll["account_code"] == "60000"

    def test_validation_passes(self, result):
        assert result["validation_warnings"] == []

    def test_pydantic_roundtrip(self, result):
        report = ParsedReport.model_validate(result)
        assert report.report_type == ReportType.PROFIT_AND_LOSS


# ===========================================================================
# TestSampleBS — balance sheet
# ===========================================================================


class TestSampleBS:
    @pytest.fixture(scope="class")
    def result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_bs.xlsx"))

    def test_report_type(self, result):
        assert result["report_type"] == "balance_sheet"

    def test_period_as_of(self, result):
        # Balance Sheet uses "As of" format — no start date
        assert result["period"]["start_date"] == ""
        assert result["period"]["end_date"] == "2024-12-31"

    def test_section_names(self, result):
        names = [s["name"] for s in result["sections"]]
        assert any("assets" in n.lower() for n in names)
        assert any("liabilities and equity" in n.lower() for n in names)

    def test_total_assets(self, result):
        section = find_section_containing(result["sections"], "assets")
        assert section["total"]["Total"] == pytest.approx(476000, abs=1.0)

    def test_total_liabilities_and_equity(self, result):
        section = find_section_containing(result["sections"], "liabilities and equity")
        assert section["total"]["Total"] == pytest.approx(476000, abs=1.0)

    def test_assets_equals_liab_equity(self, result):
        assets_sec = find_section_containing(result["sections"], "assets")
        liab_eq_sec = find_section_containing(result["sections"], "liabilities and equity")
        assert assets_sec is not None
        assert liab_eq_sec is not None
        assert assets_sec["total"]["Total"] == pytest.approx(
            liab_eq_sec["total"]["Total"], abs=1.0
        )

    def test_current_assets_nested(self, result):
        assets_sec = find_section_containing(result["sections"], "assets")
        assert assets_sec is not None
        current_assets = find_row(assets_sec["rows"], "current assets")
        assert current_assets is not None
        assert len(current_assets.get("children", [])) > 0

    def test_cash_value(self, result):
        assets_sec = find_section_containing(result["sections"], "assets")
        assert assets_sec is not None
        cash_row = find_row(assets_sec["rows"], "cash and cash equivalents")
        assert cash_row is not None
        assert cash_row["amounts"]["Total"] == pytest.approx(285000, abs=1.0)

    def test_fixed_assets(self, result):
        assets_sec = find_section_containing(result["sections"], "assets")
        assert assets_sec is not None
        equip = find_row(assets_sec["rows"], "equipment")
        assert equip is not None
        assert equip["amounts"]["Total"] == pytest.approx(120000, abs=1.0)

        accum = find_row(assets_sec["rows"], "accumulated depreciation")
        assert accum is not None
        assert accum["amounts"]["Total"] == pytest.approx(-42000, abs=1.0)

    def test_equity_section(self, result):
        liab_eq = find_section_containing(result["sections"], "liabilities and equity")
        assert liab_eq is not None
        retained = find_row(liab_eq["rows"], "retained earnings")
        assert retained is not None
        assert retained["amounts"]["Total"] == pytest.approx(30600, abs=1.0)

    def test_net_income_in_equity(self, result):
        liab_eq = find_section_containing(result["sections"], "liabilities and equity")
        assert liab_eq is not None
        net_income = find_row(liab_eq["rows"], "net income")
        assert net_income is not None
        assert net_income["amounts"]["Total"] == pytest.approx(5400, abs=1.0)

    def test_validation_passes(self, result):
        assert result["validation_warnings"] == []


# ===========================================================================
# TestSampleSCF — statement of cash flows
# ===========================================================================


class TestSampleSCF:
    @pytest.fixture(scope="class")
    def result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_scf.xlsx"))

    def test_report_type(self, result):
        assert result["report_type"] == "cash_flow_statement"

    def test_section_names_contain(self, result):
        names = [s["name"].lower() for s in result["sections"]]
        assert any("operating" in n for n in names)
        assert any("investing" in n for n in names)
        assert any("financing" in n for n in names)
        assert any("net" in n and "cash" in n for n in names)

    def test_operating_total(self, result):
        section = find_section_containing(result["sections"], "operating")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(34400, abs=1.0)

    def test_investing_total(self, result):
        section = find_section_containing(result["sections"], "investing")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(-45000, abs=1.0)

    def test_financing_total(self, result):
        section = find_section_containing(result["sections"], "financing")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(55000, abs=1.0)

    def test_net_change(self, result):
        section = find_section_containing(result["sections"], "net change in cash")
        if section is None:
            # Parser may use "NET CHANGE IN CASH" or similar
            section = find_section_containing(result["sections"], "net change")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(44400, abs=1.0)

    def test_activities_sum_to_net_change(self, result):
        operating = find_section_containing(result["sections"], "operating")
        investing = find_section_containing(result["sections"], "investing")
        financing = find_section_containing(result["sections"], "financing")
        assert operating is not None
        assert investing is not None
        assert financing is not None
        total = (
            operating["total"]["Total"]
            + investing["total"]["Total"]
            + financing["total"]["Total"]
        )
        assert total == pytest.approx(44400, abs=1.0)

    def test_cash_beginning(self, result):
        section = find_section_containing(result["sections"], "cash at beginning")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(240600, abs=1.0)

    def test_cash_end(self, result):
        section = find_section_containing(result["sections"], "cash at end")
        assert section is not None
        assert section["total"]["Total"] == pytest.approx(285000, abs=1.0)

    def test_cash_beginning_plus_change_equals_end(self, result):
        beginning = find_section_containing(result["sections"], "cash at beginning")
        end = find_section_containing(result["sections"], "cash at end")
        assert beginning is not None
        assert end is not None
        assert beginning["total"]["Total"] + 44400 == pytest.approx(
            end["total"]["Total"], abs=1.0
        )

    def test_operating_contains_net_income(self, result):
        section = find_section_containing(result["sections"], "operating")
        assert section is not None
        net_income_row = find_row(section["rows"], "net income")
        assert net_income_row is not None
        assert net_income_row["amounts"]["Total"] == pytest.approx(5400, abs=1.0)

    def test_operating_contains_depreciation(self, result):
        section = find_section_containing(result["sections"], "operating")
        assert section is not None
        dep_row = find_row(section["rows"], "depreciation")
        assert dep_row is not None
        assert dep_row["amounts"]["Total"] == pytest.approx(12000, abs=1.0)

    def test_validation_passes(self, result):
        assert result["validation_warnings"] == []


# ===========================================================================
# TestSamplePLMonthly — monthly P&L
# ===========================================================================


class TestSamplePLMonthly:
    @pytest.fixture(scope="class")
    def result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_pl_monthly.xlsx"))

    @pytest.fixture(scope="class")
    def result_with_pct(self):
        return parse_qbo_report(
            str(FIXTURES_DIR / "sample_pl_monthly.xlsx"),
            include_percent_cols=True,
        )

    def test_report_type(self, result):
        assert result["report_type"] == "profit_and_loss"

    def test_column_count(self, result):
        # 12 months + Total = 13 (% of Income stripped by default)
        assert len(result["columns"]) == 13

    def test_column_names(self, result):
        expected = [
            "Jan 2024", "Feb 2024", "Mar 2024", "Apr 2024",
            "May 2024", "Jun 2024", "Jul 2024", "Aug 2024",
            "Sep 2024", "Oct 2024", "Nov 2024", "Dec 2024",
            "Total",
        ]
        assert result["columns"] == expected

    def test_pct_column_stripped(self, result):
        assert "% of Income" not in result["columns"]

    def test_pct_column_included_with_flag(self, result_with_pct):
        assert "% of Income" in result_with_pct["columns"]

    def test_period_inferred(self, result):
        # Period inferred from datetime column headers
        assert result["period"]["start_date"] == "2024-01-01"
        assert result["period"]["end_date"] == "2024-12-31"

    def test_monthly_values_sum_to_total(self, result):
        # For each row in Income section, sum of 12 monthly amounts ≈ Total column
        income = find_section(result["sections"], "Income")
        assert income is not None
        month_cols = [f"{m} 2024" for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]]
        for row in income["rows"]:
            monthly_sum = sum(
                (row["amounts"].get(col) or 0.0) for col in month_cols
            )
            total_val = row["amounts"].get("Total") or 0.0
            if total_val != 0.0:
                assert monthly_sum == pytest.approx(total_val, abs=1.0)

    def test_revenue_growth(self, result):
        income = find_section(result["sections"], "Income")
        assert income is not None
        saas = find_row(income["rows"], "saas revenue")
        assert saas is not None
        jan_val = saas["amounts"].get("Jan 2024")
        dec_val = saas["amounts"].get("Dec 2024")
        assert jan_val is not None
        assert dec_val is not None
        assert jan_val < dec_val, "SaaS Revenue should grow Jan→Dec"

    def test_net_income_total(self, result):
        net_income = find_section_containing(result["sections"], "net income")
        assert net_income is not None
        # Annual net income: ~193200
        total_val = net_income["total"].get("Total")
        assert total_val is not None
        assert total_val == pytest.approx(193200, abs=50.0)

    def test_validation_passes(self, result):
        assert result["validation_warnings"] == []


# ===========================================================================
# TestCrossReport — cross-report consistency
# ===========================================================================


class TestCrossReport:
    @pytest.fixture(scope="class")
    def pl_result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_pl.xlsx"))

    @pytest.fixture(scope="class")
    def bs_result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_bs.xlsx"))

    @pytest.fixture(scope="class")
    def scf_result(self):
        return parse_qbo_report(str(FIXTURES_DIR / "sample_scf.xlsx"))

    def test_net_income_matches_pl_and_bs(self, pl_result, bs_result):
        # P&L Net Income
        pl_ni = find_section_containing(pl_result["sections"], "net income")
        assert pl_ni is not None
        pl_val = pl_ni["total"]["Total"]

        # BS Net Income (inside Equity within LIABILITIES AND EQUITY)
        liab_eq = find_section_containing(bs_result["sections"], "liabilities and equity")
        assert liab_eq is not None
        bs_ni_row = find_row(liab_eq["rows"], "net income")
        assert bs_ni_row is not None
        bs_val = bs_ni_row["amounts"]["Total"]

        assert pl_val == pytest.approx(5400, abs=1.0)
        assert bs_val == pytest.approx(5400, abs=1.0)
        assert pl_val == pytest.approx(bs_val, abs=1.0)

    def test_cash_end_matches_bs(self, bs_result, scf_result):
        # BS Cash and Cash Equivalents
        assets_sec = find_section_containing(bs_result["sections"], "assets")
        assert assets_sec is not None
        cash_row = find_row(assets_sec["rows"], "cash and cash equivalents")
        assert cash_row is not None
        bs_cash = cash_row["amounts"]["Total"]

        # SCF Cash at end of period
        scf_end = find_section_containing(scf_result["sections"], "cash at end")
        assert scf_end is not None
        scf_cash = scf_end["total"]["Total"]

        assert bs_cash == pytest.approx(285000, abs=1.0)
        assert scf_cash == pytest.approx(285000, abs=1.0)
        assert bs_cash == pytest.approx(scf_cash, abs=1.0)

    def test_all_reports_same_company(self, pl_result, bs_result, scf_result):
        assert pl_result["company_name"] == "Demo Startup Inc"
        assert bs_result["company_name"] == "Demo Startup Inc"
        assert scf_result["company_name"] == "Demo Startup Inc"
