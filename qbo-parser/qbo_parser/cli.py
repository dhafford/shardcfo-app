"""Command-line interface for qbo-parser.

Usage::

    $ qbo-parse report.xlsx                    # Pretty-print JSON to stdout
    $ qbo-parse report.xlsx -o output.json     # Write to file
    $ qbo-parse report.xlsx --format flat      # Flat rows (no tree)
    $ qbo-parse report.xlsx --validate         # Detect type only
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click

from qbo_parser import __version__


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("filepath", type=click.Path(exists=True))
@click.option(
    "-o", "--output",
    type=click.Path(),
    default=None,
    help="Write output to a file instead of stdout.",
)
@click.option(
    "--format", "fmt",
    type=click.Choice(["tree", "flat"], case_sensitive=False),
    default="tree",
    help="Output format: 'tree' (default) is the nested JSON; 'flat' is a JSON array of row dicts.",
)
@click.option(
    "--validate",
    is_flag=True,
    default=False,
    help="Only detect the report type and metadata — don't parse the full file.",
)
@click.option(
    "--compact",
    is_flag=True,
    default=False,
    help="Compact JSON (no indentation).",
)
@click.option(
    "--include-pct",
    is_flag=True,
    default=False,
    help="Include '% of Income' / '% of Revenue' percentage columns in the output.",
)
@click.version_option(version=__version__, prog_name="qbo-parse")
def main(
    filepath: str,
    output: str | None,
    fmt: str,
    validate: bool,
    compact: bool,
    include_pct: bool,
) -> None:
    """Parse a QuickBooks Online Excel export into structured JSON.

    FILEPATH is the path to an .xlsx file exported from QuickBooks Online.
    """
    indent = None if compact else 2

    try:
        if validate:
            _run_validate(filepath, indent, output)
        else:
            _run_parse(filepath, fmt, indent, output, include_pct)
    except FileNotFoundError as exc:
        click.echo(f"Error: {exc}", err=True)
        sys.exit(1)
    except ValueError as exc:
        click.echo(f"Error: {exc}", err=True)
        sys.exit(1)
    except Exception as exc:
        click.echo(f"Error: {exc}", err=True)
        sys.exit(2)


def _run_validate(filepath: str, indent: int | None, output: str | None) -> None:
    """--validate mode: detect report type and print metadata."""
    from qbo_parser import detect_report_type

    detection = detect_report_type(filepath)

    info = {
        "file": str(Path(filepath).resolve()),
        "report_type": detection.report_type.value,
        "company_name": detection.company_name,
        "basis": detection.basis.value,
        "period_start": detection.period_start,
        "period_end": detection.period_end,
        "data_start_row": detection.data_start_row,
    }

    text = json.dumps(info, indent=indent)
    _write_output(text, output)

    # Also print a human-readable summary to stderr
    click.echo(
        f"  Report type : {detection.report_type.value}\n"
        f"  Company     : {detection.company_name}\n"
        f"  Basis       : {detection.basis.value}\n"
        f"  Period      : {detection.period_start or '?'} → {detection.period_end or '?'}\n"
        f"  Data row    : {detection.data_start_row}",
        err=True,
    )


def _run_parse(
    filepath: str,
    fmt: str,
    indent: int | None,
    output: str | None,
    include_pct: bool = False,
) -> None:
    """Full parse mode."""
    from qbo_parser import parse_qbo_report

    output_format = "flat" if fmt == "flat" else "dict"
    result = parse_qbo_report(
        filepath,
        output_format=output_format,
        include_percent_cols=include_pct,
    )

    text = json.dumps(result, indent=indent, default=str)
    _write_output(text, output)

    # Summary to stderr
    if fmt == "flat":
        row_count = len(result) if isinstance(result, list) else 0
        click.echo(f"  Wrote {row_count} flat rows.", err=True)
    else:
        sections = result.get("sections", []) if isinstance(result, dict) else []
        click.echo(
            f"  {result.get('company_name', '?')} — "
            f"{result.get('report_type', '?')} — "
            f"{len(sections)} sections, "
            f"{len(result.get('columns', []))} columns",
            err=True,
        )


def _write_output(text: str, output_path: str | None) -> None:
    """Write text to a file or stdout."""
    if output_path:
        Path(output_path).write_text(text + "\n", encoding="utf-8")
        click.echo(f"  Written to {output_path}", err=True)
    else:
        click.echo(text)
