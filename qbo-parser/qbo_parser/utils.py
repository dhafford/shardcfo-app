"""Helper functions for QBO export parsing."""

from __future__ import annotations

from datetime import date
from typing import List, Optional, Tuple, Union


def excel_serial_to_date(serial: Union[int, float]) -> Optional[date]:
    """Convert an Excel date serial number to a Python date.

    Excel's epoch is 1900-01-01 (serial 1), with the well-known
    Lotus 1-2-3 leap-year bug (serial 60 = Feb 29, 1900, which
    doesn't exist).

    Args:
        serial: The Excel serial number (e.g. 43466 → 2019-01-01).

    Returns:
        A date object, or None if the serial is out of range.
    """
    # TODO: Implement date conversion
    return None


def format_period_label(d: date) -> str:
    """Format a date as a human-readable period label (e.g. 'Jan 2019').

    Args:
        d: The date to format.

    Returns:
        A string like 'Jan 2019'.
    """
    # TODO: Implement formatting
    return ""


def strip_qbo_header(rows: List[list]) -> Tuple[List[str], List[list]]:
    """Remove the merged QBO header block (rows 0-3) and return metadata + data.

    QBO exports have 3 merged single-cell rows (company, title, date range)
    followed by a blank row. This function detects that pattern and separates
    metadata from data rows.

    Args:
        rows: All rows from the sheet as lists of cell values.

    Returns:
        A tuple of:
        - metadata: [company_name, report_title, date_range]
        - data_rows: Everything after the header block
    """
    # TODO: Implement header stripping
    return (["", "", ""], rows)
