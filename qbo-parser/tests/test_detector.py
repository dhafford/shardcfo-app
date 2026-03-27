"""Tests for the report-type detector."""

from pathlib import Path

import pytest

from qbo_parser.detector import (
    DetectionResult,
    _extract_basis,
    _find_data_start_row,
    _match_report_type,
    _parse_date_range,
    detect_report_type,
)
from qbo_parser.models import ReportBasis, ReportType

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# _match_report_type
# ---------------------------------------------------------------------------


class TestMatchReportType:
    # --- P&L variants ---
    def test_profit_and_loss(self):
        assert _match_report_type("Profit and Loss") == ReportType.PROFIT_AND_LOSS

    def test_profit_and_loss_case_insensitive(self):
        assert _match_report_type("PROFIT AND LOSS") == ReportType.PROFIT_AND_LOSS

    def test_profit_ampersand_loss(self):
        assert _match_report_type("Profit & Loss") == ReportType.PROFIT_AND_LOSS

    def test_income_statement(self):
        assert _match_report_type("Income Statement") == ReportType.PROFIT_AND_LOSS

    def test_pnl_with_basis_annotation(self):
        assert (
            _match_report_type("Profit and Loss (Accrual Basis)")
            == ReportType.PROFIT_AND_LOSS
        )

    # --- Balance Sheet ---
    def test_balance_sheet(self):
        assert _match_report_type("Balance Sheet") == ReportType.BALANCE_SHEET

    def test_balance_sheet_lowercase(self):
        assert _match_report_type("balance sheet") == ReportType.BALANCE_SHEET

    # --- Cash Flow ---
    def test_statement_of_cash_flows(self):
        assert (
            _match_report_type("Statement of Cash Flows")
            == ReportType.CASH_FLOW_STATEMENT
        )

    def test_cash_flow_short(self):
        assert _match_report_type("Cash Flow") == ReportType.CASH_FLOW_STATEMENT

    # --- Unknown ---
    def test_unknown_text(self):
        assert _match_report_type("Riptide Waters LLC") == ReportType.UNKNOWN

    def test_empty_string(self):
        assert _match_report_type("") == ReportType.UNKNOWN

    def test_partial_match_not_triggered(self):
        """'cash' alone shouldn't match (it's a common account name)."""
        assert _match_report_type("Cash and Cash Equivalents") == ReportType.UNKNOWN


# ---------------------------------------------------------------------------
# _extract_basis
# ---------------------------------------------------------------------------


class TestExtractBasis:
    def test_accrual_parenthetical(self):
        assert (
            _extract_basis("Profit and Loss (Accrual Basis)") == ReportBasis.ACCRUAL
        )

    def test_accrual_standalone(self):
        assert _extract_basis("Accrual Basis  January - December 2024") == ReportBasis.ACCRUAL

    def test_accrual_word_boundary(self):
        assert _extract_basis("accrual") == ReportBasis.ACCRUAL

    def test_cash_basis_phrase(self):
        assert _extract_basis("Cash Basis") == ReportBasis.CASH

    def test_cash_parenthetical(self):
        assert _extract_basis("Balance Sheet (Cash)") == ReportBasis.CASH

    def test_cash_account_name_not_matched(self):
        """Plain 'Cash' or 'Cash and Cash Equivalents' must not trigger."""
        assert _extract_basis("Cash and Cash Equivalents") == ReportBasis.UNKNOWN

    def test_unknown(self):
        assert _extract_basis("January - May, 2019") == ReportBasis.UNKNOWN

    def test_empty(self):
        assert _extract_basis("") == ReportBasis.UNKNOWN


# ---------------------------------------------------------------------------
# _parse_date_range
# ---------------------------------------------------------------------------


class TestParseDateRange:
    # --- Pattern 1: "As of" (Balance Sheet) ---
    def test_as_of(self):
        assert _parse_date_range("As of December 31, 2024") == ("", "2024-12-31")

    def test_as_of_no_comma(self):
        assert _parse_date_range("As of December 31 2024") == ("", "2024-12-31")

    def test_as_of_lowercase(self):
        assert _parse_date_range("as of March 15, 2023") == ("", "2023-03-15")

    # --- Pattern 2: full dates with years on both sides ---
    def test_full_date_both_years(self):
        assert _parse_date_range("January 1, 2024 - December 31, 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    def test_full_date_both_years_no_commas(self):
        assert _parse_date_range("January 1 2024 - December 31 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    # --- Pattern 3: full dates, year only at end ---
    def test_full_date_year_at_end(self):
        assert _parse_date_range("January 1 - December 31, 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    def test_full_date_through_separator(self):
        assert _parse_date_range("January 1 through December 31, 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    # --- Pattern 4: month-only range ---
    def test_month_range_comma(self):
        """Our actual fixture format."""
        assert _parse_date_range("January - May, 2019") == (
            "2019-01-01",
            "2019-05-31",
        )

    def test_month_range_no_comma(self):
        assert _parse_date_range("January - December 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    def test_month_range_abbreviated(self):
        assert _parse_date_range("Jan - Dec 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    def test_month_range_en_dash(self):
        assert _parse_date_range("January \u2013 May, 2019") == (
            "2019-01-01",
            "2019-05-31",
        )

    def test_month_range_thru(self):
        assert _parse_date_range("January thru December, 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    def test_feb_leap_year(self):
        """End of February in a leap year should be the 29th."""
        assert _parse_date_range("January - February, 2024") == (
            "2024-01-01",
            "2024-02-29",
        )

    def test_feb_non_leap_year(self):
        assert _parse_date_range("January - February, 2023") == (
            "2023-01-01",
            "2023-02-28",
        )

    # --- Embedded in other text ---
    def test_with_basis_prefix(self):
        assert _parse_date_range("Accrual Basis  January - December 2024") == (
            "2024-01-01",
            "2024-12-31",
        )

    # --- No match ---
    def test_no_date(self):
        assert _parse_date_range("Riptide Waters LLC") == ("", "")

    def test_empty(self):
        assert _parse_date_range("") == ("", "")


# ---------------------------------------------------------------------------
# _find_data_start_row
# ---------------------------------------------------------------------------


class TestFindDataStartRow:
    def test_standard_qbo_layout(self):
        """Company, title, date, blank, data → data starts at row 5."""
        rows = [
            ["Riptide Waters LLC"],
            ["Profit and Loss"],
            ["January - May, 2019"],
            [None],
            [None, "Jan 2019", "Feb 2019"],  # column headers
            ["Income"],
        ]
        assert _find_data_start_row(rows) == 5

    def test_no_blank_gap(self):
        """If there's no blank row between headers and data."""
        rows = [
            ["Company Name"],
            ["Profit and Loss"],
            ["January - December, 2024"],
            [None, "Jan 2024", "Feb 2024"],  # data right after headers
        ]
        assert _find_data_start_row(rows) == 4

    def test_multiple_blank_rows(self):
        """Multiple blank rows between headers and data."""
        rows = [
            ["Company"],
            ["Balance Sheet"],
            ["As of Dec 31, 2024"],
            [None],
            [None],
            ["Assets"],
        ]
        assert _find_data_start_row(rows) == 6

    def test_empty_file(self):
        assert _find_data_start_row([]) == 1

    def test_all_blank(self):
        assert _find_data_start_row([[None], [None], [None]]) == 1


# ---------------------------------------------------------------------------
# detect_report_type (integration — file I/O)
# ---------------------------------------------------------------------------


class TestDetectReportType:
    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            detect_report_type("/nonexistent/file.xlsx")

    def test_sample_pnl_fixture(self):
        """Integration test against the real QBO P&L fixture."""
        result = detect_report_type(FIXTURES_DIR / "sample_pnl.xlsx")

        assert result.report_type == ReportType.PROFIT_AND_LOSS
        assert result.company_name == "Riptide Waters LLC"
        assert result.period_start == "2019-01-01"
        assert result.period_end == "2019-05-31"
        # The fixture doesn't annotate basis
        assert result.basis == ReportBasis.UNKNOWN
        # Data starts at row 5 (the datetime column-header row)
        assert result.data_start_row == 5

    def test_result_is_dataclass(self):
        result = detect_report_type(FIXTURES_DIR / "sample_pnl.xlsx")
        assert isinstance(result, DetectionResult)
