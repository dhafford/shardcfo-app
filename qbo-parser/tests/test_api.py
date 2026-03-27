"""Tests for the FastAPI wrapper."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from qbo_parser.api import app

FIXTURES_DIR = Path(__file__).parent / "fixtures"
client = TestClient(app)


def _upload(path: Path, **params):
    """POST a fixture file to /parse with optional query params."""
    with open(path, "rb") as f:
        return client.post(
            "/parse",
            files={"file": (path.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            params=params,
        )


def _upload_summary(path: Path):
    """POST a fixture file to /parse/summary."""
    with open(path, "rb") as f:
        return client.post(
            "/parse/summary",
            files={"file": (path.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )


# ===================================================================
# GET /health
# ===================================================================


class TestHealth:
    def test_status(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "parser_version" in data


# ===================================================================
# POST /parse
# ===================================================================


class TestParse:
    def test_parse_pl_tree(self):
        r = _upload(FIXTURES_DIR / "sample_pl.xlsx")
        assert r.status_code == 200
        data = r.json()
        assert data["report_type"] == "profit_and_loss"
        assert data["company_name"] == "Demo Startup Inc"
        assert len(data["sections"]) == 8
        assert "validation_warnings" in data

    def test_parse_pl_flat(self):
        r = _upload(FIXTURES_DIR / "sample_pl.xlsx", format="flat")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "section" in data[0]
        assert "account_name" in data[0]

    def test_parse_bs(self):
        r = _upload(FIXTURES_DIR / "sample_bs.xlsx")
        assert r.status_code == 200
        data = r.json()
        assert data["report_type"] == "balance_sheet"

    def test_parse_scf(self):
        r = _upload(FIXTURES_DIR / "sample_scf.xlsx")
        assert r.status_code == 200
        data = r.json()
        assert data["report_type"] == "cash_flow_statement"

    def test_parse_monthly(self):
        r = _upload(FIXTURES_DIR / "sample_pl_monthly.xlsx")
        assert r.status_code == 200
        data = r.json()
        assert len(data["columns"]) == 13  # 12 months + Total

    def test_parse_monthly_with_pct(self):
        r = _upload(
            FIXTURES_DIR / "sample_pl_monthly.xlsx",
            include_percent_cols="true",
        )
        assert r.status_code == 200
        data = r.json()
        assert "% of Income" in data["columns"]

    def test_validate_false_strips_warnings(self):
        r = _upload(FIXTURES_DIR / "sample_pl.xlsx", validate="false")
        assert r.status_code == 200
        data = r.json()
        assert data["validation_warnings"] == []

    def test_bad_file_type(self):
        r = client.post(
            "/parse",
            files={"file": ("test.csv", b"a,b,c\n1,2,3", "text/csv")},
        )
        assert r.status_code == 400

    def test_no_file(self):
        r = client.post("/parse")
        assert r.status_code == 422  # FastAPI validation error

    def test_invalid_format(self):
        r = _upload(FIXTURES_DIR / "sample_pl.xlsx", format="xml")
        assert r.status_code == 422


# ===================================================================
# POST /parse/summary
# ===================================================================


class TestParseSummary:
    def test_pnl_summary(self):
        r = _upload_summary(FIXTURES_DIR / "sample_pl.xlsx")
        assert r.status_code == 200
        data = r.json()

        assert data["report_type"] == "profit_and_loss"
        assert data["company_name"] == "Demo Startup Inc"

        m = data["metrics"]
        assert m["total_revenue"] == pytest.approx(912000, abs=1)
        assert m["total_cogs"] == pytest.approx(206400, abs=1)
        assert m["gross_profit"] == pytest.approx(705600, abs=1)
        assert m["total_expenses"] == pytest.approx(679800, abs=1)
        assert m["net_income"] == pytest.approx(5400, abs=1)

        # Margins
        assert m["gross_margin"] == pytest.approx(705600 / 912000, abs=0.01)
        assert m["net_margin"] == pytest.approx(5400 / 912000, abs=0.01)

    def test_bs_summary(self):
        r = _upload_summary(FIXTURES_DIR / "sample_bs.xlsx")
        assert r.status_code == 200
        data = r.json()

        assert data["report_type"] == "balance_sheet"
        m = data["metrics"]
        assert m["total_assets"] == pytest.approx(476000, abs=1)
        assert m["total_liabilities_and_equity"] == pytest.approx(476000, abs=1)
        assert m["total_liabilities"] == pytest.approx(290000, abs=1)
        assert m["total_equity"] == pytest.approx(186000, abs=1)

        # Ratios
        assert m["current_ratio"] is not None
        assert m["current_ratio"] > 0
        assert m["debt_to_equity"] is not None
        assert m["debt_to_equity"] > 0

    def test_scf_summary(self):
        r = _upload_summary(FIXTURES_DIR / "sample_scf.xlsx")
        assert r.status_code == 200
        data = r.json()

        assert data["report_type"] == "cash_flow_statement"
        m = data["metrics"]
        assert m["operating_cash_flow"] == pytest.approx(34400, abs=1)
        assert m["investing_cash_flow"] == pytest.approx(-45000, abs=1)
        assert m["financing_cash_flow"] == pytest.approx(55000, abs=1)
        assert m["net_change_in_cash"] == pytest.approx(44400, abs=1)

    def test_summary_bad_file(self):
        r = client.post(
            "/parse/summary",
            files={"file": ("test.txt", b"not an xlsx", "text/plain")},
        )
        assert r.status_code == 400


# ===================================================================
# CORS
# ===================================================================


class TestCORS:
    def test_cors_localhost_3000(self):
        r = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_cors_disallowed_origin(self):
        r = client.options(
            "/health",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r.headers.get("access-control-allow-origin") != "http://evil.com"
