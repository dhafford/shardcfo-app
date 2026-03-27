"""Tests for the public API in qbo_parser.__init__."""

import json
from pathlib import Path

import pytest

from qbo_parser import (
    ParsedReport,
    ReportType,
    flatten_report,
    parse_qbo_report,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE = str(FIXTURES_DIR / "sample_pnl.xlsx")


# ===================================================================
# parse_qbo_report — output_format
# ===================================================================


class TestParseQboReportFormats:
    def test_dict_format_default(self):
        result = parse_qbo_report(SAMPLE)
        assert isinstance(result, dict)
        assert result["report_type"] == "profit_and_loss"

    def test_dict_format_explicit(self):
        result = parse_qbo_report(SAMPLE, output_format="dict")
        assert isinstance(result, dict)
        assert "sections" in result

    def test_json_format(self):
        result = parse_qbo_report(SAMPLE, output_format="json")
        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed["report_type"] == "profit_and_loss"
        assert parsed["company_name"] == "Riptide Waters LLC"

    def test_json_format_is_pretty_printed(self):
        result = parse_qbo_report(SAMPLE, output_format="json")
        assert "\n" in result  # indented JSON has newlines

    def test_flat_format(self):
        result = parse_qbo_report(SAMPLE, output_format="flat")
        assert isinstance(result, list)
        assert len(result) > 0
        # Each row should have the expected keys
        row = result[0]
        assert "section" in row
        assert "account_name" in row
        assert "account_code" in row
        assert "depth" in row
        assert "is_total" in row
        assert "Jan 2019" in row

    def test_flat_format_has_all_columns(self):
        result = parse_qbo_report(SAMPLE, output_format="flat")
        row = result[0]
        expected_cols = ["Jan 2019", "Feb 2019", "Mar 2019", "Apr 2019",
                         "May 2019", "Jun 2019", "Jul 2019"]
        for col in expected_cols:
            assert col in row

    def test_errors_propagate(self):
        with pytest.raises(FileNotFoundError):
            parse_qbo_report("/nonexistent.xlsx")
        with pytest.raises(ValueError):
            parse_qbo_report("not_excel.csv")


# ===================================================================
# flatten_report
# ===================================================================


class TestFlattenReport:
    @pytest.fixture()
    def report(self):
        return parse_qbo_report(SAMPLE, output_format="dict")

    def test_returns_list(self, report):
        flat = flatten_report(report)
        assert isinstance(flat, list)

    def test_row_count(self, report):
        """57 = 48 tree rows + 9 section totals (including standalone)."""
        flat = flatten_report(report)
        assert len(flat) == 57

    def test_first_row_is_sales(self, report):
        flat = flatten_report(report)
        assert flat[0]["section"] == "Income"
        assert flat[0]["account_name"] == "Sales"
        assert flat[0]["account_code"] == "41000"
        assert flat[0]["depth"] == 1
        assert flat[0]["is_total"] is False
        assert flat[0]["Jan 2019"] == 20701.02

    def test_section_total_emitted(self, report):
        """Each section with rows should emit a 'Total X' row."""
        flat = flatten_report(report)
        total_names = [r["account_name"] for r in flat if r["is_total"]]
        assert "Total Income" in total_names
        assert "Total Cost of Goods Sold" in total_names
        assert "Total Expenses" in total_names

    def test_standalone_sections(self, report):
        """Standalone sections (Gross Profit, Net Income) appear as single rows."""
        flat = flatten_report(report)
        gp_rows = [r for r in flat if r["section"] == "Gross Profit"]
        assert len(gp_rows) == 1
        assert gp_rows[0]["account_name"] == "Gross Profit"
        assert gp_rows[0]["is_total"] is True

    def test_nested_children_appear(self, report):
        """Sub-accounts from the tree appear in flat output."""
        flat = flatten_report(report)
        names = [r["account_name"] for r in flat]
        assert "Advertising/Online" in names
        assert "Contractors" in names
        assert "Salary and Wages" in names

    def test_dfs_order(self, report):
        """Children appear immediately after their parent (DFS)."""
        flat = flatten_report(report)
        names = [r["account_name"] for r in flat]
        # A&M parent should come before its children
        am_idx = names.index("Advertising & Marketing")
        online_idx = names.index("Advertising/Online")
        assert online_idx == am_idx + 1

    def test_flat_rows_loadable_as_json(self, report):
        flat = flatten_report(report)
        serialized = json.dumps(flat, default=str)
        roundtripped = json.loads(serialized)
        assert len(roundtripped) == len(flat)

    def test_pydantic_roundtrip_still_works(self, report):
        """The dict format should still validate against ParsedReport."""
        parsed = ParsedReport.model_validate(report)
        assert parsed.report_type == ReportType.PROFIT_AND_LOSS
