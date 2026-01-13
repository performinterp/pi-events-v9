#!/usr/bin/env python3
"""
One-time migration script to create new sheets in PI Events system

This script prepares data for Claude Code to create sheets via MCP tools.
It generates JSON files with sheet definitions that Claude Code will use.
"""

import json
import sys
import os

# Add parent directory to path to import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.config import (
    PI_WORK_FLOW_ID,
    PUBLIC_EVENTS_FEED_ID,
    VENUES_COLUMNS,
    EVENT_CATEGORIES_COLUMNS,
    STAGED_EVENTS_COLUMNS,
    INGEST_FROM_MONTHLY_COLUMNS,
    READY_TO_PUBLISH_COLUMNS,
    INITIAL_CATEGORIES
)


def create_venues_sheet():
    """
    Prepare VENUES sheet definition

    Returns:
        Dict with sheet name and headers
    """
    return {
        'spreadsheet_id': PI_WORK_FLOW_ID,
        'sheet_name': 'VENUES',
        'headers': VENUES_COLUMNS
    }


def create_event_categories_sheet():
    """
    Prepare EVENT_CATEGORIES sheet definition with initial data

    Returns:
        Dict with sheet name, headers, and initial category data
    """
    # Format category rows for sheet
    category_rows = []
    for category in INITIAL_CATEGORIES:
        category_rows.append([
            category['category_id'],
            category['category_name'],
            category['keywords'],
            category['default_image_url']
        ])

    return {
        'spreadsheet_id': PI_WORK_FLOW_ID,
        'sheet_name': 'EVENT_CATEGORIES',
        'headers': EVENT_CATEGORIES_COLUMNS,
        'data': category_rows
    }


def create_staged_events_sheet():
    """
    Prepare STAGED_EVENTS sheet definition

    Returns:
        Dict with sheet name and headers
    """
    return {
        'spreadsheet_id': PI_WORK_FLOW_ID,
        'sheet_name': 'STAGED_EVENTS',
        'headers': STAGED_EVENTS_COLUMNS
    }


def create_ingest_from_monthly_sheet():
    """
    Prepare INGEST_FROM_MONTHLY sheet definition

    Returns:
        Dict with sheet name and headers
    """
    return {
        'spreadsheet_id': PI_WORK_FLOW_ID,
        'sheet_name': 'INGEST_FROM_MONTHLY',
        'headers': INGEST_FROM_MONTHLY_COLUMNS
    }


def create_ready_to_publish_sheet():
    """
    Prepare READY_TO_PUBLISH sheet definition (in PUBLIC EVENTS FEED)

    Returns:
        Dict with sheet name and headers
    """
    return {
        'spreadsheet_id': PUBLIC_EVENTS_FEED_ID,
        'sheet_name': 'READY_TO_PUBLISH',
        'headers': READY_TO_PUBLISH_COLUMNS
    }


def main():
    """
    Generate all sheet definitions and save to JSON file

    Claude Code will read this file and create sheets via MCP tools.
    """
    print("=" * 70)
    print("📋 CREATE NEW SHEETS - MIGRATION SCRIPT")
    print("=" * 70)

    sheets_to_create = [
        create_venues_sheet(),
        create_event_categories_sheet(),
        create_staged_events_sheet(),
        create_ingest_from_monthly_sheet(),
        create_ready_to_publish_sheet()
    ]

    print("\n📄 Sheets to create:")
    for sheet in sheets_to_create:
        print(f"   - {sheet['sheet_name']} (in {'PI Work Flow' if sheet['spreadsheet_id'] == PI_WORK_FLOW_ID else 'PUBLIC EVENTS FEED'})")
        print(f"     Columns: {len(sheet['headers'])}")
        if 'data' in sheet:
            print(f"     Initial rows: {len(sheet['data'])}")

    # Save to JSON file
    output = {
        'sheets': sheets_to_create
    }

    with open('migration/sheets-to-create.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Sheet definitions saved to: migration/sheets-to-create.json")
    print(f"\n✅ Ready for Claude Code to create sheets via MCP")
    print(f"\nNext steps:")
    print(f"   1. Claude Code will read sheets-to-create.json")
    print(f"   2. For each sheet, Claude Code will use mcp__google-sheets__create_sheet")
    print(f"   3. Then write headers (and initial data for EVENT_CATEGORIES)")


if __name__ == "__main__":
    main()
