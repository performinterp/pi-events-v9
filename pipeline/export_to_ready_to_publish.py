#!/usr/bin/env python3
"""
Job 5: Export to READY_TO_PUBLISH

Exports approved events from STAGED_EVENTS to READY_TO_PUBLISH:
- Filters: APPROVE=TRUE AND VALIDATION_STATUS=OK
- Removes past events (>6h in Europe/London timezone)
- Full refresh (overwrites READY_TO_PUBLISH)
- Adds LAST_UPDATED timestamp
"""

import json
import sys
import os
from datetime import datetime
import pytz

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.config import READY_TO_PUBLISH_COLUMNS, TIMEZONE
from pipeline.utils import is_event_outdated


def filter_approved_events(staged_events_data: list) -> list:
    """
    Filter events where APPROVE=TRUE and VALIDATION_STATUS=OK

    Args:
        staged_events_data: STAGED_EVENTS sheet data

    Returns:
        List of approved event rows
    """
    if not staged_events_data or len(staged_events_data) < 2:
        return []

    headers = staged_events_data[0]
    col_map = {h: i for i, h in enumerate(headers)}

    approve_idx = col_map.get('APPROVE', -1)
    validation_idx = col_map.get('VALIDATION_STATUS', -1)

    approved = []
    for row in staged_events_data[1:]:
        is_approved = (approve_idx >= 0 and approve_idx < len(row) and
                      str(row[approve_idx]).upper() == 'TRUE')
        is_valid = (validation_idx >= 0 and validation_idx < len(row) and
                   str(row[validation_idx]) == 'OK')

        if is_approved and is_valid:
            approved.append(row)

    return approved


def remove_past_events(events: list, headers: list) -> list:
    """
    Remove events older than 6 hours (Europe/London timezone)

    Args:
        events: List of event rows
        headers: Column headers from STAGED_EVENTS

    Returns:
        Filtered events (current only)
    """
    col_map = {h: i for i, h in enumerate(headers)}
    date_idx = col_map.get('EVENT_DATE', -1)
    time_idx = col_map.get('EVENT_TIME', -1)

    current_events = []
    deleted_count = 0

    for row in events:
        event_date = row[date_idx] if date_idx >= 0 and date_idx < len(row) else ""
        event_time = row[time_idx] if time_idx >= 0 and time_idx < len(row) else ""

        if is_event_outdated(event_date, event_time):
            deleted_count += 1
        else:
            current_events.append(row)

    if deleted_count > 0:
        print(f"   🗑️  Removed {deleted_count} past events")

    return current_events


def format_for_ready_to_publish(approved_events: list, headers: list) -> list:
    """
    Format approved events for READY_TO_PUBLISH sheet

    Maps STAGED_EVENTS columns to READY_TO_PUBLISH columns:
    - EVENT_ID → EVENT_ID
    - EVENT_DATE → DATE
    - EVENT_TIME → TIME
    - EVENT_NAME → EVENT
    - ARTIST_NAME → ARTIST
    - EVENT_ORGANISER → ORGANISER
    - VENUE_NAME → VENUE
    - CITY → CITY
    - COUNTRY → COUNTRY
    - LANGUAGE → LANGUAGE
    - TICKET_URL → URL
    - IMAGE_URL → IMAGE
    - CATEGORY_ID → CATEGORY
    - ACCESS_STATUS → ACCESS_STATUS
    - (current timestamp) → LAST_UPDATED

    Args:
        approved_events: List of approved event rows
        headers: Column headers from STAGED_EVENTS

    Returns:
        2D array for READY_TO_PUBLISH sheet
    """
    col_map = {h: i for i, h in enumerate(headers)}
    formatted = []

    tz = pytz.timezone(TIMEZONE)
    now = datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')

    for row in approved_events:
        formatted_row = [
            row[col_map.get('EVENT_ID', -1)] if col_map.get('EVENT_ID', -1) >= 0 and col_map.get('EVENT_ID', -1) < len(row) else "",
            row[col_map.get('EVENT_DATE', -1)] if col_map.get('EVENT_DATE', -1) >= 0 and col_map.get('EVENT_DATE', -1) < len(row) else "",
            row[col_map.get('EVENT_TIME', -1)] if col_map.get('EVENT_TIME', -1) >= 0 and col_map.get('EVENT_TIME', -1) < len(row) else "",
            row[col_map.get('EVENT_NAME', -1)] if col_map.get('EVENT_NAME', -1) >= 0 and col_map.get('EVENT_NAME', -1) < len(row) else "",
            row[col_map.get('ARTIST_NAME', -1)] if col_map.get('ARTIST_NAME', -1) >= 0 and col_map.get('ARTIST_NAME', -1) < len(row) else "",
            row[col_map.get('EVENT_ORGANISER', -1)] if col_map.get('EVENT_ORGANISER', -1) >= 0 and col_map.get('EVENT_ORGANISER', -1) < len(row) else "",
            row[col_map.get('VENUE_NAME', -1)] if col_map.get('VENUE_NAME', -1) >= 0 and col_map.get('VENUE_NAME', -1) < len(row) else "",
            row[col_map.get('CITY', -1)] if col_map.get('CITY', -1) >= 0 and col_map.get('CITY', -1) < len(row) else "",
            row[col_map.get('COUNTRY', -1)] if col_map.get('COUNTRY', -1) >= 0 and col_map.get('COUNTRY', -1) < len(row) else "",
            row[col_map.get('LANGUAGE', -1)] if col_map.get('LANGUAGE', -1) >= 0 and col_map.get('LANGUAGE', -1) < len(row) else "",
            row[col_map.get('TICKET_URL', -1)] if col_map.get('TICKET_URL', -1) >= 0 and col_map.get('TICKET_URL', -1) < len(row) else "",
            row[col_map.get('IMAGE_URL', -1)] if col_map.get('IMAGE_URL', -1) >= 0 and col_map.get('IMAGE_URL', -1) < len(row) else "",
            row[col_map.get('CATEGORY_ID', -1)] if col_map.get('CATEGORY_ID', -1) >= 0 and col_map.get('CATEGORY_ID', -1) < len(row) else "",
            row[col_map.get('ACCESS_STATUS', -1)] if col_map.get('ACCESS_STATUS', -1) >= 0 and col_map.get('ACCESS_STATUS', -1) < len(row) else "",
            now  # LAST_UPDATED
        ]
        formatted.append(formatted_row)

    return formatted


def main():
    """
    Main orchestration

    Expects:
        - staged-events-data.json (from STAGED_EVENTS sheet)

    Outputs:
        - ready-to-publish-output.json (ready to write to READY_TO_PUBLISH sheet)
    """
    print("=" * 70)
    print("📤 JOB 5: EXPORT TO READY_TO_PUBLISH")
    print("=" * 70)

    # Load data
    try:
        with open('staged-events-data.json', 'r') as f:
            staged_events_data = json.load(f)
        print("✅ Loaded STAGED_EVENTS data")
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

    headers = staged_events_data[0]

    # Filter approved events
    print(f"\n🔍 Filtering approved events...")
    approved_events = filter_approved_events(staged_events_data)
    print(f"   ✅ {len(approved_events)} approved events")

    # Remove past events
    print(f"\n🗑️  Removing past events...")
    current_events = remove_past_events(approved_events, headers)
    print(f"   ✅ {len(current_events)} current events")

    # Format for READY_TO_PUBLISH
    output_rows = format_for_ready_to_publish(current_events, headers)

    print(f"\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"=" * 70)
    print(f"   Total approved events: {len(approved_events)}")
    print(f"   Current events (after pruning): {len(current_events)}")
    print(f"   Events to publish: {len(output_rows)}")

    # Save output
    output = {
        'headers': READY_TO_PUBLISH_COLUMNS,
        'rows': output_rows
    }

    with open('ready-to-publish-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to: ready-to-publish-output.json")
    print(f"   Ready to write to READY_TO_PUBLISH sheet in PUBLIC EVENTS FEED")


if __name__ == "__main__":
    main()
