#!/usr/bin/env python3
"""
Job 1: Populate INGEST_FROM_MONTHLY from monthly tabs

Scans tabs matching date pattern (e.g., "January 2026", "February 2026")
Extracts rows where "Public App" column is truthy
Outputs to INGEST_FROM_MONTHLY sheet

This script is called by Claude Code via run_full_pipeline.py
"""

import json
import sys
import os
import re

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.config import MONTH_NAMES, INGEST_FROM_MONTHLY_COLUMNS
from pipeline.utils import is_truthy_value, parse_date


def is_monthly_tab(sheet_name: str) -> bool:
    """
    Check if sheet name matches monthly pattern

    Pattern: (January|February|...) YYYY

    Examples:
        "January 2026" -> True
        "February 2025" -> True
        "PRE_APPROVED EVENTS" -> False
    """
    pattern = r'^(' + '|'.join(MONTH_NAMES) + r') \d{4}$'
    return bool(re.match(pattern, sheet_name, re.IGNORECASE))


def extract_monthly_rows(sheet_name: str, sheet_data: list) -> list:
    """
    Extract rows from monthly tab where "Public App" = truthy

    Args:
        sheet_name: Name of the monthly tab
        sheet_data: 2D array of sheet data (headers + rows)

    Returns:
        List of row dicts with extracted data
    """
    if not sheet_data or len(sheet_data) < 2:
        return []

    # Get headers (case-insensitive)
    headers = [h.strip().lower() if h else '' for h in sheet_data[0]]

    # Find column indices (case-insensitive matching)
    try:
        date_idx = headers.index('date')
        event_idx = headers.index('event')
        venue_idx = headers.index('venue')
    except ValueError as e:
        print(f"   ⚠️  Missing required columns in {sheet_name}: {e}")
        return []

    # Optional columns
    time_idx = headers.index('time') if 'time' in headers else -1
    interpreters_idx = headers.index('interpreters') if 'interpreters' in headers else -1
    public_app_idx = headers.index('public app') if 'public app' in headers else -1
    organiser_idx = headers.index('organiser') if 'organiser' in headers else -1
    if organiser_idx == -1:
        organiser_idx = headers.index('event organiser') if 'event organiser' in headers else -1

    # If no "Public App" column, skip this tab (not an error)
    if public_app_idx == -1:
        print(f"   ℹ️  No 'Public App' column in {sheet_name}, skipping")
        return []

    # Extract rows where Public App is truthy
    extracted = []
    for row_idx, row in enumerate(sheet_data[1:], start=2):
        if len(row) <= max(date_idx, event_idx, venue_idx):
            continue

        # Check Public App column
        public_app_value = row[public_app_idx] if public_app_idx < len(row) else ""
        if not is_truthy_value(public_app_value):
            continue

        # Parse and normalize date
        date_raw = row[date_idx] if date_idx < len(row) else ""
        date_normalized = parse_date(date_raw)

        # Extract data
        extracted.append({
            'source_tab': sheet_name,
            'source_row': row_idx,
            'event_date': date_normalized if date_normalized else date_raw,
            'event_name': row[event_idx],
            'venue_name': row[venue_idx],
            'event_time': row[time_idx] if time_idx >= 0 and time_idx < len(row) else "",
            'interpreters': row[interpreters_idx] if interpreters_idx >= 0 and interpreters_idx < len(row) else "",
            'event_organiser': row[organiser_idx] if organiser_idx >= 0 and organiser_idx < len(row) else ""
        })

    return extracted


def format_for_sheet(rows: list) -> list:
    """
    Format extracted rows for INGEST_FROM_MONTHLY sheet

    Args:
        rows: List of row dicts

    Returns:
        2D array formatted for sheet
    """
    formatted = []
    for row in rows:
        formatted.append([
            row['source_tab'],
            str(row['source_row']),
            row['event_date'],
            row['event_name'],
            row['venue_name'],
            row['event_time'],
            row['interpreters'],
            row['event_organiser']
        ])
    return formatted


def main():
    """
    Main orchestration

    Expects:
        - monthly-tabs-data.json (all sheet data from monthly tabs)

    Outputs:
        - ingest-from-monthly-output.json (ready to write to INGEST_FROM_MONTHLY sheet)
    """
    print("=" * 70)
    print("📅 JOB 1: POPULATE INGEST_FROM_MONTHLY")
    print("=" * 70)

    # Load monthly tabs data
    try:
        with open('monthly-tabs-data.json', 'r') as f:
            monthly_data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: monthly-tabs-data.json not found")
        print("   This file should be created by run_full_pipeline.py")
        sys.exit(1)

    print(f"\n📋 Found {len(monthly_data)} sheets to check")

    all_rows = []
    tabs_processed = 0

    for tab_name, tab_data in monthly_data.items():
        if not is_monthly_tab(tab_name):
            continue

        print(f"\n📅 Processing {tab_name}...")
        rows = extract_monthly_rows(tab_name, tab_data)

        if rows:
            print(f"   ✅ Extracted {len(rows)} rows")
            all_rows.extend(rows)
            tabs_processed += 1
        else:
            print(f"   ⏭️  No rows extracted")

    # Format for sheet
    output_rows = format_for_sheet(all_rows)

    print(f"\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"=" * 70)
    print(f"   Monthly tabs processed: {tabs_processed}")
    print(f"   Total rows extracted: {len(output_rows)}")

    # Save output
    output = {
        'headers': INGEST_FROM_MONTHLY_COLUMNS,
        'rows': output_rows
    }

    with open('ingest-from-monthly-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to: ingest-from-monthly-output.json")
    print(f"   Ready to write to INGEST_FROM_MONTHLY sheet")


if __name__ == "__main__":
    main()
