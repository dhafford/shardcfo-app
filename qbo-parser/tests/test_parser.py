"""Tests for the QBO parser — models, normalizer helpers, and integration."""

from pathlib import Path

import pytest

from qbo_parser import parse_qbo_report
from qbo_parser.models import (
    ParsedReport,
    ParseMetadata,
    ReportBasis,
    ReportPeriod,
    ReportType,
    Row,
    Section,
)
from qbo_parser.normalizer import (
    compute_depth,
    is_total_row,
    clean_amount,
    extract_account_code,
)
from qbo_parser.parser import (
    _build_row_tree,
    build_tree,
)
from qbo_parser.utils import excel_serial_to_date

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ===================================================================
# Model tests
# ===================================================================


class TestReportType:
    def test_enum_values(self):
        assert ReportType.PROFIT_AND_LOSS.value == "profit_and_loss"
        assert ReportType.BALANCE_SHEET.value == "balance_sheet"
        assert ReportType.CASH_FLOW_STATEMENT.value == "cash_flow_statement"
        assert ReportType.UNKNOWN.value == "unknown"

    def test_string_comparison(self):
        assert ReportType.PROFIT_AND_LOSS == "profit_and_loss"


class TestRow:
    def test_defaults(self):
        row = Row(account_name="Sales")
        assert row.account_name == "Sales"
        assert row.account_code == ""
        assert row.depth == 0
        assert row.amounts == {}
        assert row.is_total is False
        assert row.children == []

    def test_nested_children(self):
        child = Row(account_name="Product Sales", depth=2, amounts={"Total": 100000.0})
        parent = Row(account_name="Sales", depth=1, amounts={"Total": 150000.0}, children=[child])
        assert len(parent.children) == 1
        assert parent.children[0].account_name == "Product Sales"

    def test_amounts_with_none(self):
        row = Row(account_name="Test", amounts={"Jan": 100.0, "Feb": None})
        dumped = row.model_dump(mode="json")
        assert dumped["amounts"]["Jan"] == 100.0
        assert dumped["amounts"]["Feb"] is None

    def test_json_serialization(self):
        row = Row(
            account_name="Sales", account_code="41000", depth=1,
            amounts={"Total": 150000.0}, is_total=False,
            children=[Row(account_name="Product Sales", depth=2, amounts={"Total": 100000.0})],
        )
        data = row.model_dump(mode="json")
        assert data["account_name"] == "Sales"
        assert data["account_code"] == "41000"
        assert len(data["children"]) == 1
        assert data["children"][0]["amounts"]["Total"] == 100000.0


class TestSection:
    def test_defaults(self):
        section = Section(name="Income")
        assert section.rows == []
        assert section.total == {}

    def test_with_rows_and_total(self):
        section = Section(
            name="Income",
            rows=[Row(account_name="Sales", amounts={"Total": 150000.0})],
            total={"Total": 150000.0},
        )
        assert len(section.rows) == 1
        assert section.total["Total"] == 150000.0


class TestParsedReport:
    def test_defaults(self):
        report = ParsedReport()
        assert report.report_type == ReportType.UNKNOWN
        assert report.company_name == ""
        assert report.report_basis == ReportBasis.UNKNOWN
        assert report.columns == []
        assert report.sections == []
        assert report.metadata.source == "quickbooks_online"

    def test_full_report_json_roundtrip(self):
        report = ParsedReport(
            report_type=ReportType.PROFIT_AND_LOSS,
            company_name="Acme Corp",
            report_basis=ReportBasis.ACCRUAL,
            period=ReportPeriod(start_date="2024-01-01", end_date="2024-12-31"),
            columns=["Total"],
            sections=[
                Section(
                    name="Income",
                    rows=[Row(
                        account_name="Sales", depth=1, amounts={"Total": 150000.0},
                        children=[
                            Row(account_name="Product Sales", depth=2, amounts={"Total": 100000.0}),
                            Row(account_name="Service Revenue", depth=2, amounts={"Total": 50000.0}),
                            Row(account_name="Total Sales", depth=1, amounts={"Total": 150000.0}, is_total=True),
                        ],
                    )],
                    total={"Total": 150000.0},
                ),
            ],
        )
        data = report.model_dump(mode="json")
        assert data["report_type"] == "profit_and_loss"
        assert data["sections"][0]["rows"][0]["children"][2]["is_total"] is True
        restored = ParsedReport.model_validate(data)
        assert restored.sections[0].rows[0].children[0].account_name == "Product Sales"

    def test_multi_period_columns(self):
        report = ParsedReport(
            columns=["Jan 2019", "Feb 2019", "Mar 2019"],
            sections=[Section(
                name="Income",
                rows=[Row(account_name="Sales", depth=1, amounts={
                    "Jan 2019": 20701.02, "Feb 2019": 41203.03, "Mar 2019": 40433.48,
                })],
                total={"Jan 2019": 20701.02, "Feb 2019": 41203.03, "Mar 2019": 40433.48},
            )],
        )
        data = report.model_dump(mode="json")
        assert data["sections"][0]["rows"][0]["amounts"]["Feb 2019"] == 41203.03


# ===================================================================
# Normalizer helper tests
# ===================================================================


class TestComputeDepth:
    def test_top_level(self):
        assert compute_depth("Income") == 0

    def test_one_indent(self):
        assert compute_depth("   41000 Sales") == 1

    def test_two_indents(self):
        assert compute_depth("      Advertising/Online") == 2

    def test_empty(self):
        assert compute_depth("") == 0

    def test_one_space(self):
        """Fewer than 3 spaces rounds down to 0."""
        assert compute_depth(" X") == 0

    def test_five_spaces(self):
        """5 spaces → depth 1 (5 // 3 = 1)."""
        assert compute_depth("     X") == 1

    def test_nine_spaces(self):
        assert compute_depth("         X") == 3


class TestIsTotalRow:
    def test_total_prefix(self):
        assert is_total_row("Total Income") is True

    def test_total_with_code(self):
        assert is_total_row("Total 61000 Advertising & Marketing") is True

    def test_total_all_caps(self):
        assert is_total_row("TOTAL EXPENSES") is True

    def test_just_total(self):
        assert is_total_row("Total") is True

    def test_non_total(self):
        assert is_total_row("   41000 Sales") is False

    def test_total_in_middle(self):
        """'Total' must be at the start."""
        assert is_total_row("Grand Total") is False

    def test_empty(self):
        assert is_total_row("") is False


class TestCleanAmount:
    def test_int(self):
        assert clean_amount(18935) == 18935.0

    def test_float(self):
        assert clean_amount(20701.02) == 20701.02

    def test_negative_float(self):
        assert clean_amount(-37884.94) == -37884.94

    def test_zero(self):
        assert clean_amount(0) == 0.0

    def test_none(self):
        assert clean_amount(None) is None

    def test_bool_false(self):
        assert clean_amount(False) is None

    def test_string_with_commas(self):
        assert clean_amount("20,701.02") == 20701.02

    def test_string_with_dollar(self):
        assert clean_amount("$1,234.56") == 1234.56

    def test_parenthetical_negative(self):
        assert clean_amount("(1,234.56)") == -1234.56

    def test_empty_string(self):
        assert clean_amount("") is None

    def test_dash(self):
        assert clean_amount("-") is None

    def test_plain_string_number(self):
        assert clean_amount("42") == 42.0

    def test_non_numeric_string(self):
        assert clean_amount("hello") is None


class TestExtractAccountCode:
    def test_code_present(self):
        code, label = extract_account_code("   41000 Sales")
        assert code == "41000"
        assert label == "Sales"

    def test_no_code(self):
        code, label = extract_account_code("Income")
        assert code == ""
        assert label == "Income"

    def test_total_with_code(self):
        code, label = extract_account_code("   Total 61000 Advertising & Marketing")
        assert code == "61000"
        assert label == "Total Advertising & Marketing"

    def test_total_without_code(self):
        code, label = extract_account_code("Total Income")
        assert code == ""
        assert label == "Total Income"

    def test_five_digit_code(self):
        code, label = extract_account_code("80000 Management Fees")
        assert code == "80000"
        assert label == "Management Fees"

    def test_no_code_subaccount(self):
        code, label = extract_account_code("      Advertising/Online")
        assert code == ""
        assert label == "Advertising/Online"


# ===================================================================
# Tree-building tests
# ===================================================================


class TestBuildRowTree:
    """Test _build_row_tree with hand-crafted flat rows."""

    @staticmethod
    def _row(name, depth=1, is_total=False, amounts=None):
        return {
            "account_name": name,
            "account_code": "",
            "depth": depth,
            "is_total": is_total,
            "amounts": amounts or {"Total": 100.0},
            "has_amounts": True,
        }

    def test_flat_siblings(self):
        rows = [self._row("A"), self._row("B"), self._row("C")]
        tree = _build_row_tree(rows)
        assert len(tree) == 3
        assert [r.account_name for r in tree] == ["A", "B", "C"]
        assert all(len(r.children) == 0 for r in tree)

    def test_parent_with_children(self):
        rows = [
            self._row("Parent", depth=1),
            self._row("Child1", depth=2),
            self._row("Child2", depth=2),
        ]
        tree = _build_row_tree(rows)
        assert len(tree) == 1
        assert tree[0].account_name == "Parent"
        assert len(tree[0].children) == 2
        assert tree[0].children[0].account_name == "Child1"

    def test_total_attaches_to_parent(self):
        """Total row at depth 1 should become a child of matching depth-1 parent."""
        rows = [
            self._row("Parent", depth=1),
            self._row("Child1", depth=2),
            self._row("Child2", depth=2),
            self._row("Total Parent", depth=1, is_total=True),
        ]
        tree = _build_row_tree(rows)
        assert len(tree) == 1  # only "Parent" at top level
        parent = tree[0]
        assert len(parent.children) == 3  # Child1, Child2, Total
        assert parent.children[2].is_total is True
        assert parent.children[2].account_name == "Total Parent"

    def test_multiple_groups(self):
        """Two parent-children groups followed by leaf rows."""
        rows = [
            self._row("Group1", depth=1),
            self._row("G1-Sub", depth=2),
            self._row("Total Group1", depth=1, is_total=True),
            self._row("Leaf", depth=1),
            self._row("Group2", depth=1),
            self._row("G2-Sub", depth=2),
            self._row("Total Group2", depth=1, is_total=True),
        ]
        tree = _build_row_tree(rows)
        assert len(tree) == 3  # Group1, Leaf, Group2
        assert tree[0].account_name == "Group1"
        assert len(tree[0].children) == 2  # G1-Sub, Total Group1
        assert tree[1].account_name == "Leaf"
        assert len(tree[1].children) == 0
        assert tree[2].account_name == "Group2"
        assert len(tree[2].children) == 2  # G2-Sub, Total Group2

    def test_three_levels_deep(self):
        rows = [
            self._row("L1", depth=1),
            self._row("L2", depth=2),
            self._row("L3", depth=3),
            self._row("Total L2", depth=2, is_total=True),
            self._row("Total L1", depth=1, is_total=True),
        ]
        tree = _build_row_tree(rows)
        assert len(tree) == 1
        l1 = tree[0]
        assert l1.account_name == "L1"
        # L1 children: L2, Total L1
        assert len(l1.children) == 2
        l2 = l1.children[0]
        assert l2.account_name == "L2"
        # L2 children: L3, Total L2
        assert len(l2.children) == 2
        assert l2.children[0].account_name == "L3"
        assert l2.children[1].is_total is True


class TestBuildTree:
    """Test build_tree (section grouping) with crafted flat rows."""

    @staticmethod
    def _row(name, depth=0, is_total=False, has_amounts=False, amounts=None):
        return {
            "account_name": name,
            "account_code": "",
            "depth": depth,
            "is_total": is_total,
            "amounts": amounts or ({"T": 100.0} if has_amounts else {"T": None}),
            "has_amounts": has_amounts,
        }

    def test_single_section(self):
        rows = [
            self._row("Income", depth=0),
            self._row("Sales", depth=1, has_amounts=True, amounts={"T": 500.0}),
            self._row("Total Income", depth=0, is_total=True, has_amounts=True, amounts={"T": 500.0}),
        ]
        sections = build_tree(rows)
        assert len(sections) == 1
        assert sections[0].name == "Income"
        assert len(sections[0].rows) == 1
        assert sections[0].rows[0].account_name == "Sales"
        assert sections[0].total == {"T": 500.0}

    def test_calculated_row_becomes_standalone_section(self):
        rows = [
            self._row("Income", depth=0),
            self._row("Sales", depth=1, has_amounts=True),
            self._row("Total Income", depth=0, is_total=True, has_amounts=True),
            self._row("Gross Profit", depth=0, has_amounts=True, amounts={"T": 200.0}),
        ]
        sections = build_tree(rows)
        assert len(sections) == 2
        assert sections[0].name == "Income"
        assert sections[1].name == "Gross Profit"
        assert sections[1].rows == []
        assert sections[1].total == {"T": 200.0}

    def test_multiple_sections_with_calculated(self):
        """Simulates a minimal P&L: Income, COGS, Gross Profit, Expenses, Net Income."""
        rows = [
            self._row("Income", depth=0),
            self._row("Sales", depth=1, has_amounts=True),
            self._row("Total Income", depth=0, is_total=True, has_amounts=True),
            self._row("Cost of Goods Sold", depth=0),
            self._row("Materials", depth=1, has_amounts=True),
            self._row("Total Cost of Goods Sold", depth=0, is_total=True, has_amounts=True),
            self._row("Gross Profit", depth=0, has_amounts=True),
            self._row("Expenses", depth=0),
            self._row("Rent", depth=1, has_amounts=True),
            self._row("Total Expenses", depth=0, is_total=True, has_amounts=True),
            self._row("Net Income", depth=0, has_amounts=True),
        ]
        sections = build_tree(rows)
        names = [s.name for s in sections]
        assert names == [
            "Income",
            "Cost of Goods Sold",
            "Gross Profit",
            "Expenses",
            "Net Income",
        ]


# ===================================================================
# Utils
# ===================================================================


class TestExcelSerialToDate:
    @pytest.mark.skip(reason="Not yet implemented")
    def test_jan_2019(self):
        from datetime import date
        assert excel_serial_to_date(43466) == date(2019, 1, 1)

    @pytest.mark.skip(reason="Not yet implemented")
    def test_none_for_bad_serial(self):
        assert excel_serial_to_date(-1) is None


# ===================================================================
# Integration — parse_qbo_report against real fixture
# ===================================================================


class TestParseQboReport:
    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            parse_qbo_report("/nonexistent/file.xlsx")

    def test_wrong_extension(self):
        with pytest.raises(ValueError, match="Expected an .xlsx file"):
            parse_qbo_report("somefile.csv")

    def test_metadata(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        assert result["report_type"] == "profit_and_loss"
        assert result["company_name"] == "Riptide Waters LLC"
        assert result["period"]["start_date"] == "2019-01-01"
        # Column-inferred period: columns span Jan–Jul 2019, overriding
        # the header text "January - May, 2019"
        assert result["period"]["end_date"] == "2019-07-31"
        assert result["metadata"]["source"] == "quickbooks_online"

    def test_columns_detected(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        cols = result["columns"]
        assert len(cols) == 7
        assert cols[0] == "Jan 2019"
        assert cols[6] == "Jul 2019"

    def test_section_names(self):
        """Verify all sections are detected in the right order."""
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        names = [s["name"] for s in result["sections"]]
        assert names == [
            "Income",
            "Cost of Goods Sold",
            "Gross Profit",
            "Expenses",
            "Net Operating Income",
            "Other Income",
            "Other Expenses",
            "Net Other Income",
            "Net Income",
        ]

    def test_income_section(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        income = result["sections"][0]
        assert income["name"] == "Income"

        # Two accounts: 41000 Sales, 49999 Uncategorized Income
        assert len(income["rows"]) == 2
        sales = income["rows"][0]
        assert sales["account_name"] == "Sales"
        assert sales["account_code"] == "41000"
        assert sales["depth"] == 1
        assert sales["amounts"]["Jan 2019"] == 20701.02

        # Total Income amounts
        assert income["total"]["Jan 2019"] == 20701.02

    def test_expenses_section_nested_hierarchy(self):
        """Expenses should have nested accounts (A&M sub-accounts, Payroll sub-accounts)."""
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        expenses = result["sections"][3]
        assert expenses["name"] == "Expenses"

        # Find Advertising & Marketing
        am = None
        for row in expenses["rows"]:
            if row["account_code"] == "61000":
                am = row
                break
        assert am is not None, "61000 Advertising & Marketing not found"
        assert am["account_name"] == "Advertising & Marketing"

        # A&M should have sub-accounts as children
        child_names = [c["account_name"] for c in am["children"]]
        assert "Advertising/Online" in child_names
        assert "Social Media" in child_names

        # Last child should be the total
        total_child = am["children"][-1]
        assert total_child["is_total"] is True
        assert "Advertising & Marketing" in total_child["account_name"]

    def test_payroll_nested(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        expenses = result["sections"][3]

        payroll = None
        for row in expenses["rows"]:
            if row["account_code"] == "66000":
                payroll = row
                break
        assert payroll is not None, "66000 Payroll Expenses not found"

        child_names = [c["account_name"] for c in payroll["children"]]
        assert "Contractors" in child_names
        assert "Salary and Wages" in child_names

        # Total should be last child
        assert payroll["children"][-1]["is_total"] is True

    def test_gross_profit_is_standalone_section(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        gp = result["sections"][2]
        assert gp["name"] == "Gross Profit"
        assert gp["rows"] == []  # no child rows
        assert gp["total"]["Jan 2019"] == pytest.approx(10080.41, abs=0.01)

    def test_net_income_is_standalone_section(self):
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        ni = result["sections"][-1]
        assert ni["name"] == "Net Income"
        assert ni["rows"] == []
        # Net Income for Jan 2019 should be negative
        assert ni["total"]["Jan 2019"] < 0

    def test_json_roundtrip(self):
        """The full output should deserialize back into a valid ParsedReport."""
        result = parse_qbo_report(FIXTURES_DIR / "sample_pnl.xlsx")
        report = ParsedReport.model_validate(result)
        assert report.report_type == ReportType.PROFIT_AND_LOSS
        assert len(report.sections) == 9
        assert report.sections[0].rows[0].account_name == "Sales"
