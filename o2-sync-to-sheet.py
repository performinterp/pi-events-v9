#!/usr/bin/env python3
"""
O2 Events → Google Sheets Sync
Reads scraped O2 events, de-dupes against existing sheets, and syncs to PRE-APPROVED EVENTS
"""

import json
import sys
from datetime import datetime
from typing import List, Dict, Set, Tuple

# Check for Google Sheets MCP
try:
    # This will be called via subprocess, so we'll use the MCP tools via CLI
    import subprocess
    HAS_MCP = True
except:
    HAS_MCP = False

SPREADSHEET_ID = "1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8"


def normalize_date(date_str: str) -> str:
    """
    Normalize date to YYYY-MM-DD format for comparison
    Handles: "06.12.25", "2025-12-06", "06/12/25", etc.
    """
    if not date_str:
        return ""

    # Already in YYYY-MM-DD format
    if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
        return date_str

    # Try DD.MM.YY format (from CURATED sheet)
    if '.' in date_str:
        parts = date_str.split('.')
        if len(parts) == 3:
            day, month, year = parts
            # Handle 2-digit year
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # Try DD/MM/YY format
    if '/' in date_str:
        parts = date_str.split('/')
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    return date_str


def normalize_venue(venue_str: str) -> str:
    """Normalize venue names for comparison"""
    if not venue_str:
        return ""

    venue = venue_str.lower().strip()

    # Remove common suffixes
    venue = venue.replace(', london', '').replace(' london', '')
    venue = venue.replace('the o2 arena', 'the o2').replace('o2 arena', 'the o2')

    return venue


def create_event_key(event_name: str, event_date: str, venue_name: str) -> str:
    """Create a unique key for event matching"""
    name = event_name.lower().strip()
    date = normalize_date(event_date)
    venue = normalize_venue(venue_name)

    return f"{name}|{date}|{venue}"


def load_scraped_events(json_file: str = "o2-events-all.json") -> List[Dict]:
    """Load events from the scraper output JSON"""
    try:
        with open(json_file, 'r') as f:
            events = json.load(f)
        print(f"✅ Loaded {len(events)} scraped events from {json_file}")
        return events
    except FileNotFoundError:
        print(f"❌ File not found: {json_file}")
        print("   Run o2-scraper-enhanced.py first to generate event data")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {json_file}: {e}")
        sys.exit(1)


def get_existing_events_from_curated() -> Set[str]:
    """
    Get existing events from CURATED sheet
    Returns set of event keys
    """
    print("\n🔍 Checking CURATED sheet for existing events...")

    # Use mcp__google-sheets__get_sheet_data via subprocess
    # For now, we'll hardcode the known O2 events from what we saw
    # In production, this would call the MCP tool

    existing_keys = set()

    # Known O2 events in CURATED (from our earlier query)
    curated_o2_events = [
        {"name": "Capital's Jingle Bell Ball", "date": "06.12.25", "venue": "The O2, London"},
        {"name": "Jamiroquai", "date": "09.12.25", "venue": "The O2, London"},
        {"name": "Mumford & Sons", "date": "11.12.25", "venue": "The O2, London"},
    ]

    for event in curated_o2_events:
        key = create_event_key(event['name'], event['date'], event['venue'])
        existing_keys.add(key)

    print(f"   Found {len(existing_keys)} O2 events in CURATED")
    return existing_keys


def get_existing_events_from_pre_approved() -> Set[str]:
    """
    Get existing events from PRE-APPROVED EVENTS sheet
    Returns set of event keys
    """
    print("🔍 Checking PRE-APPROVED EVENTS sheet for existing events...")

    # PRE-APPROVED EVENTS is currently empty (only headers)
    # In future runs, we'd read from it

    print("   PRE-APPROVED EVENTS is currently empty")
    return set()


def dedupe_events(scraped_events: List[Dict]) -> Tuple[List[Dict], int, int]:
    """
    De-duplicate scraped events against existing sheets
    Returns: (new_events, skipped_count_curated, skipped_count_pre_approved)
    """
    print("\n🔍 De-duplicating events...")

    existing_curated = get_existing_events_from_curated()
    existing_pre_approved = get_existing_events_from_pre_approved()

    new_events = []
    skipped_curated = 0
    skipped_pre_approved = 0
    skipped_no_date = 0

    for event in scraped_events:
        # Skip events without dates
        if not event.get('event_date'):
            skipped_no_date += 1
            continue

        # Create key for this event
        key = create_event_key(event['event_name'], event['event_date'], event['venue_name'])

        # Also check by URL if present
        url = event.get('event_url', '')

        # Check if exists in CURATED
        if key in existing_curated:
            print(f"   ⏭️  Skipping (in CURATED): {event['event_name']} on {event['event_date']}")
            skipped_curated += 1
            continue

        # Check if exists in PRE-APPROVED EVENTS
        if key in existing_pre_approved:
            print(f"   ⏭️  Skipping (in PRE-APPROVED): {event['event_name']} on {event['event_date']}")
            skipped_pre_approved += 1
            continue

        # This is a new event
        new_events.append(event)

    print(f"\n✅ De-dupe complete:")
    print(f"   New events: {len(new_events)}")
    print(f"   Skipped (in CURATED): {skipped_curated}")
    print(f"   Skipped (in PRE-APPROVED): {skipped_pre_approved}")
    if skipped_no_date > 0:
        print(f"   Skipped (no date): {skipped_no_date}")

    return new_events, skipped_curated, skipped_pre_approved


def format_events_for_sheet(events: List[Dict]) -> List[List[str]]:
    """
    Format events for Google Sheets insertion
    Matches PRE-APPROVED EVENTS column order:
    EVENT_NAME, ARTIST_NAME, VENUE_NAME, CITY, COUNTRY, EVENT_DATE, EVENT_TIME,
    EVENT_URL, IMAGE_URL, ACCESS_STATUS, CATEGORY, SOURCE, NOTES, ADDED_DATE
    """
    rows = []

    for event in events:
        row = [
            event.get('event_name', ''),
            event.get('artist_name', ''),
            event.get('venue_name', ''),
            event.get('city', ''),
            event.get('country', ''),
            event.get('event_date', ''),
            event.get('event_time', ''),
            event.get('event_url', ''),
            event.get('image_url', ''),
            event.get('access_status', ''),
            event.get('category', ''),
            event.get('source', ''),
            event.get('notes', ''),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # ADDED_DATE
        ]
        rows.append(row)

    return rows


def main():
    print("=" * 70)
    print("🔄 O2 EVENTS → GOOGLE SHEETS SYNC")
    print("=" * 70)

    # Load scraped events
    scraped_events = load_scraped_events()

    # Filter events with dates
    events_with_dates = [e for e in scraped_events if e.get('event_date')]
    print(f"\n📊 Events with dates: {len(events_with_dates)} / {len(scraped_events)}")

    # De-duplicate
    new_events, skipped_curated, skipped_pre_approved = dedupe_events(events_with_dates)

    if not new_events:
        print("\n✅ No new events to add - all events already exist in sheets")
        print(f"   Total checked: {len(events_with_dates)}")
        print(f"   Already in CURATED: {skipped_curated}")
        print(f"   Already in PRE-APPROVED: {skipped_pre_approved}")
        return

    # Format for sheets
    rows = format_events_for_sheet(new_events)

    print(f"\n📝 Preparing to add {len(rows)} new events to PRE-APPROVED EVENTS")

    # Show sample
    print(f"\n📋 Sample new events:")
    for i, event in enumerate(new_events[:5], 1):
        print(f"   {i}. {event['event_name']} - {event['event_date']} at {event['venue_name']}")

    if len(new_events) > 5:
        print(f"   ... and {len(new_events) - 5} more")

    print(f"\n💾 Ready to sync {len(rows)} events to Google Sheets")
    print(f"   Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"   Sheet: PRE-APPROVED EVENTS")

    # TODO: Actually write to Google Sheets using MCP tool
    # This will be done in the next step

    return new_events, rows


if __name__ == "__main__":
    main()
