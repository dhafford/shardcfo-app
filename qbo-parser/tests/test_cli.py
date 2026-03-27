"""Tests for the qbo-parse CLI."""

import json
from pathlib import Path

from click.testing import CliRunner

from qbo_parser.cli import main

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE = str(FIXTURES_DIR / "sample_pnl.xlsx")


class TestCLI:
    def setup_method(self):
        self.runner = CliRunner(mix_stderr=False)

    def test_version(self):
        result = self.runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.1.0" in result.output

    def test_help(self):
        result = self.runner.invoke(main, ["--help"])
        assert result.exit_code == 0
        assert "Parse a QuickBooks" in result.output

    def test_default_tree_output(self):
        result = self.runner.invoke(main, [SAMPLE])
        assert result.exit_code == 0
        parsed = json.loads(result.output)
        assert parsed["report_type"] == "profit_and_loss"
        assert len(parsed["sections"]) == 9

    def test_validate_mode(self):
        result = self.runner.invoke(main, [SAMPLE, "--validate"])
        assert result.exit_code == 0
        parsed = json.loads(result.output)
        assert parsed["report_type"] == "profit_and_loss"
        assert parsed["company_name"] == "Riptide Waters LLC"

    def test_flat_format(self):
        result = self.runner.invoke(main, [SAMPLE, "--format", "flat"])
        assert result.exit_code == 0
        parsed = json.loads(result.output)
        assert isinstance(parsed, list)
        assert len(parsed) > 0
        assert "section" in parsed[0]

    def test_compact_flag(self):
        result = self.runner.invoke(main, [SAMPLE, "--compact"])
        assert result.exit_code == 0
        # Compact JSON should be a single line
        lines = result.output.strip().split("\n")
        assert len(lines) == 1

    def test_output_to_file(self, tmp_path):
        out_file = str(tmp_path / "output.json")
        result = self.runner.invoke(main, [SAMPLE, "-o", out_file])
        assert result.exit_code == 0
        assert Path(out_file).exists()
        content = json.loads(Path(out_file).read_text())
        assert content["report_type"] == "profit_and_loss"

    def test_missing_file(self):
        result = self.runner.invoke(main, ["/nonexistent/file.xlsx"])
        assert result.exit_code != 0
