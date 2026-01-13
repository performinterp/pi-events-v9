#!/usr/bin/env python3
"""
O2 Events → Google Sheets Complete Sync
Orchestrates the complete sync pipeline with Claude Code MCP tools
"""

import json
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Set, Tuple, Optional
import pytz

SPREADSHEET_ID = "1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU"
LONDON_TZ = pytz.timezone('Europe/London')


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


def normalize_url(url: str) -> str:
    """
    Normalize URL for deduplication
    Strips tracking params, protocol, trailing slashes
    """
    if not url:
        return ""

    # Convert to lowercase
    url = url.lower().strip()

    # Remove protocol
    url = url.replace('https://', '').replace('http://', '')

    # Remove common tracking parameters
    if '?' in url:
        base_url, params = url.split('?', 1)
        # Keep only essential params, strip tracking ones
        # For O2 events, we usually don't need query params
        url = base_url

    # Remove trailing slash
    url = url.rstrip('/')

    # Remove www.
    url = url.replace('www.', '')

    return url


def create_event_key(event_name: str, event_date: str, venue_name: str) -> str:
    """Create a unique key for event matching"""
    name = event_name.lower().strip()
    date = normalize_date(event_date)
    venue = normalize_venue(venue_name)

    return f"{name}|{date}|{venue}"


def extract_o2_events_from_public_approved(public_approved_data: List[List[str]]) -> Tuple[Set[str], Set[str]]:
    """
    Extract O2 events from PUBLIC_APPROVED sheet data
    Returns (url_keys, name_date_venue_keys)
    """
    url_keys = set()
    name_keys = set()

    # Skip header row
    if not public_approved_data or len(public_approved_data) <= 1:
        return url_keys, name_keys

    headers = public_approved_data[0]
    # Find column indices - try both column naming conventions
    try:
        # Try PI Work Flow style first (EVENT_NAME, EVENT_DATE, VENUE_NAME, EVENT_URL)
        if "EVENT_NAME" in headers:
            name_idx = headers.index("EVENT_NAME")
            date_idx = headers.index("EVENT_DATE")
            venue_idx = headers.index("VENUE_NAME")
            url_idx = headers.index("EVENT_URL") if "EVENT_URL" in headers else -1
        else:
            # Fallback to Public Events Feed style (EVENT, DATE, VENUE)
            event_idx = headers.index("EVENT")
            date_idx = headers.index("DATE")
            venue_idx = headers.index("VENUE")
            name_idx = event_idx
            url_idx = headers.index("URL") if "URL" in headers else -1
    except ValueError:
        print("⚠️  Warning: Could not find expected columns in PUBLIC_APPROVED sheet")
        return url_keys, name_keys

    # Process each row
    for row in public_approved_data[1:]:
        if len(row) <= max(name_idx, date_idx, venue_idx):
            continue

        venue = row[venue_idx] if venue_idx < len(row) else ""

        # Only include O2 events
        if 'o2' not in venue.lower():
            continue

        event_name = row[name_idx] if name_idx < len(row) else ""
        event_date = row[date_idx] if date_idx < len(row) else ""
        event_url = row[url_idx] if url_idx >= 0 and url_idx < len(row) else ""

        # Add URL-based key if URL exists
        if event_url:
            normalized_url = normalize_url(event_url)
            if normalized_url:
                url_keys.add(normalized_url)

        # Add name|date|venue key
        if event_name and event_date:
            key = create_event_key(event_name, event_date, venue)
            name_keys.add(key)

    return url_keys, name_keys


def extract_events_from_pre_approved(pre_approved_data: List[List[str]]) -> Tuple[Set[str], Set[str]]:
    """
    Extract events from PRE_APPROVED EVENTS sheet
    Returns (url_keys, name_date_venue_keys)
    """
    url_keys = set()
    name_keys = set()

    # Skip header row
    if not pre_approved_data or len(pre_approved_data) <= 1:
        return url_keys, name_keys

    headers = pre_approved_data[0]
    # Find column indices
    try:
        name_idx = headers.index("EVENT_NAME")
        date_idx = headers.index("EVENT_DATE")
        venue_idx = headers.index("VENUE_NAME")
        url_idx = headers.index("EVENT_URL") if "EVENT_URL" in headers else -1
    except ValueError:
        print("⚠️  Warning: Could not find expected columns in PRE_APPROVED EVENTS sheet")
        return url_keys, name_keys

    # Process each row
    for row in pre_approved_data[1:]:
        if len(row) <= max(name_idx, date_idx, venue_idx):
            continue

        event_name = row[name_idx] if name_idx < len(row) else ""
        event_date = row[date_idx] if date_idx < len(row) else ""
        venue_name = row[venue_idx] if venue_idx < len(row) else ""
        event_url = row[url_idx] if url_idx >= 0 and url_idx < len(row) else ""

        # Add URL-based key if URL exists
        if event_url:
            normalized_url = normalize_url(event_url)
            if normalized_url:
                url_keys.add(normalized_url)

        # Add name|date|venue key
        if event_name and event_date:
            key = create_event_key(event_name, event_date, venue_name)
            name_keys.add(key)

    return url_keys, name_keys


def dedupe_events(
    scraped_events: List[Dict],
    public_approved_data: List[List[str]],
    pre_approved_data: List[List[str]]
) -> Tuple[List[Dict], Dict[str, int]]:
    """
    De-duplicate scraped events against existing sheets
    Uses URL-first matching: if EVENT_URL exists, use normalized URL as key
    Otherwise fallback to (EVENT_NAME | EVENT_DATE | VENUE_NAME)
    Returns: (new_events, stats_dict)
    """
    print("\n🔍 De-duplicating events (URL-first strategy)...")

    # Extract existing events from both sheets (returns url_keys, name_keys)
    public_url_keys, public_name_keys = extract_o2_events_from_public_approved(public_approved_data)
    pre_url_keys, pre_name_keys = extract_events_from_pre_approved(pre_approved_data)

    print(f"   PUBLIC_APPROVED: {len(public_url_keys)} URL keys, {len(public_name_keys)} name|date|venue keys")
    print(f"   PRE_APPROVED EVENTS: {len(pre_url_keys)} URL keys, {len(pre_name_keys)} name|date|venue keys")

    new_events = []
    skipped_public_approved = 0
    skipped_pre_approved = 0
    skipped_no_date = 0
    url_matches = 0
    name_matches = 0

    for event in scraped_events:
        # Skip events without dates
        if not event.get('event_date'):
            skipped_no_date += 1
            continue

        # Get event URL and create normalized URL key
        event_url = event.get('event_url', '')
        normalized_url = normalize_url(event_url) if event_url else ""

        # Create name|date|venue key as fallback
        name_key = create_event_key(
            event['event_name'],
            event['event_date'],
            event['venue_name']
        )

        is_duplicate = False
        duplicate_source = ""

        # PRIORITY 1: Check URL match if URL exists
        if normalized_url:
            if normalized_url in public_url_keys:
                print(f"   ⏭️  Skipping (URL in PUBLIC_APPROVED): {event['event_name']}")
                skipped_public_approved += 1
                url_matches += 1
                is_duplicate = True
                duplicate_source = "PUBLIC_APPROVED (URL)"
            elif normalized_url in pre_url_keys:
                print(f"   ⏭️  Skipping (URL in PRE_APPROVED): {event['event_name']}")
                skipped_pre_approved += 1
                url_matches += 1
                is_duplicate = True
                duplicate_source = "PRE_APPROVED (URL)"

        # PRIORITY 2: Check name|date|venue match if no URL match found
        if not is_duplicate:
            if name_key in public_name_keys:
                print(f"   ⏭️  Skipping (name|date|venue in PUBLIC_APPROVED): {event['event_name']} on {event['event_date']}")
                skipped_public_approved += 1
                name_matches += 1
                is_duplicate = True
                duplicate_source = "PUBLIC_APPROVED (name|date|venue)"
            elif name_key in pre_name_keys:
                print(f"   ⏭️  Skipping (name|date|venue in PRE_APPROVED): {event['event_name']} on {event['event_date']}")
                skipped_pre_approved += 1
                name_matches += 1
                is_duplicate = True
                duplicate_source = "PRE_APPROVED (name|date|venue)"

        # If not a duplicate, this is a new event
        if not is_duplicate:
            new_events.append(event)

    stats = {
        'total_scraped': len(scraped_events),
        'new_events': len(new_events),
        'skipped_public_approved': skipped_public_approved,
        'skipped_pre_approved': skipped_pre_approved,
        'skipped_no_date': skipped_no_date,
        'url_matches': url_matches,
        'name_matches': name_matches
    }

    print(f"\n✅ De-dupe complete:")
    print(f"   Total scraped: {stats['total_scraped']}")
    print(f"   New events: {stats['new_events']}")
    print(f"   Skipped (in PUBLIC_APPROVED): {stats['skipped_public_approved']}")
    print(f"   Skipped (in PRE_APPROVED): {stats['skipped_pre_approved']}")
    print(f"   Match method: {url_matches} by URL, {name_matches} by name|date|venue")
    if stats['skipped_no_date'] > 0:
        print(f"   Skipped (no date): {stats['skipped_no_date']}")

    return new_events, stats


def is_o2_sourced_event(row: List[str], headers: List[str]) -> bool:
    """
    Detect if an event is O2-sourced using priority order:
    1. SOURCE column = "O2"
    2. EVENT_URL contains "theo2.co.uk"
    3. VENUE_ID starts with "o2-"
    """
    # Find column indices
    source_idx = headers.index("SOURCE") if "SOURCE" in headers else -1
    url_idx = headers.index("EVENT_URL") if "EVENT_URL" in headers else -1
    venue_id_idx = headers.index("VENUE_ID") if "VENUE_ID" in headers else -1

    # Priority 1: Check SOURCE column
    if source_idx >= 0 and source_idx < len(row):
        source = row[source_idx].strip().upper()
        if source == "O2":
            return True

    # Priority 2: Check EVENT_URL
    if url_idx >= 0 and url_idx < len(row):
        url = row[url_idx].lower()
        if "theo2.co.uk" in url:
            return True

    # Priority 3: Check VENUE_ID
    if venue_id_idx >= 0 and venue_id_idx < len(row):
        venue_id = row[venue_id_idx].lower()
        if venue_id.startswith("o2-"):
            return True

    return False


def parse_event_datetime(date_str: str, time_str: str = "") -> Optional[datetime]:
    """
    Parse event date and time into datetime object (Europe/London timezone)
    If time is missing, assume 23:59 (conservative - don't prune unless clearly past)
    """
    if not date_str:
        return None

    # Normalize date to YYYY-MM-DD
    normalized_date = normalize_date(date_str)

    # Parse date
    try:
        # Try to parse normalized date
        if len(normalized_date) == 10 and normalized_date[4] == '-':
            year, month, day = normalized_date.split('-')
            year, month, day = int(year), int(month), int(day)
        else:
            return None

        # Parse time or use 23:59 as default (conservative)
        if time_str and time_str.strip():
            # Try to extract hour:minute from various formats
            # Examples: "19:30", "14:30 / 19:30", "KO - 20:00", "14:00 - 16:30"
            time_clean = time_str.strip()

            # Take first time if multiple times listed
            if '/' in time_clean:
                time_clean = time_clean.split('/')[0].strip()
            elif '-' in time_clean and ':' in time_clean:
                # Extract time after or before dash
                parts = time_clean.split('-')
                for part in parts:
                    if ':' in part:
                        time_clean = part.strip()
                        break

            # Remove common prefixes
            time_clean = time_clean.replace('KO', '').replace('Start', '').strip()

            # Extract HH:MM
            if ':' in time_clean:
                time_parts = time_clean.split(':')
                if len(time_parts) >= 2:
                    try:
                        hour = int(time_parts[0].strip())
                        minute = int(time_parts[1][:2])  # Take first 2 digits
                    except:
                        hour, minute = 23, 59
                else:
                    hour, minute = 23, 59
            else:
                hour, minute = 23, 59
        else:
            hour, minute = 23, 59

        # Create datetime in London timezone
        dt = LONDON_TZ.localize(datetime(year, month, day, hour, minute))
        return dt

    except Exception as e:
        print(f"⚠️  Could not parse date/time: {date_str} {time_str} - {e}")
        return None


def is_event_outdated(row: List[str], headers: List[str]) -> bool:
    """
    Check if event is outdated (start time < now - 6 hours in Europe/London)
    """
    # Find date and time columns
    date_idx = headers.index("EVENT_DATE") if "EVENT_DATE" in headers else -1
    if date_idx < 0:
        date_idx = headers.index("DATE") if "DATE" in headers else -1

    time_idx = headers.index("EVENT_TIME") if "EVENT_TIME" in headers else -1
    if time_idx < 0:
        time_idx = headers.index("TIME") if "TIME" in headers else -1

    if date_idx < 0 or date_idx >= len(row):
        return False

    date_str = row[date_idx]
    time_str = row[time_idx] if time_idx >= 0 and time_idx < len(row) else ""

    # Parse event datetime
    event_dt = parse_event_datetime(date_str, time_str)
    if not event_dt:
        return False

    # Get current time in London timezone
    now = datetime.now(LONDON_TZ)

    # Event is outdated if it ended more than 6 hours ago
    cutoff = now - timedelta(hours=6)

    return event_dt < cutoff


def prune_pre_approved_events(
    pre_approved_data: List[List[str]]
) -> Tuple[List[List[str]], int]:
    """
    Delete outdated O2-sourced events from PRE_APPROVED EVENTS
    Only removes O2-sourced events, leaves other events untouched
    Returns: (cleaned_data, count_deleted)
    """
    if not pre_approved_data or len(pre_approved_data) <= 1:
        return pre_approved_data, 0

    headers = pre_approved_data[0]
    cleaned_rows = [headers]  # Keep headers
    deleted_count = 0
    deleted_samples = []

    for row in pre_approved_data[1:]:
        # Check if O2-sourced and outdated
        if is_o2_sourced_event(row, headers) and is_event_outdated(row, headers):
            # Delete this row (don't add to cleaned_rows)
            deleted_count += 1
            # Store sample for logging
            event_name_idx = headers.index("EVENT_NAME") if "EVENT_NAME" in headers else 0
            event_name = row[event_name_idx] if event_name_idx < len(row) else "Unknown"
            if len(deleted_samples) < 5:
                deleted_samples.append(event_name)
        else:
            # Keep this row
            cleaned_rows.append(row)

    if deleted_count > 0:
        print(f"\n🗑️  Deleting outdated O2 events from PRE_APPROVED EVENTS:")
        print(f"   Deleted {deleted_count} outdated O2-sourced events")
        for i, name in enumerate(deleted_samples, 1):
            print(f"   {i}. {name}")
        if deleted_count > len(deleted_samples):
            print(f"   ... and {deleted_count - len(deleted_samples)} more")

    return cleaned_rows, deleted_count


def prune_public_approved_events(
    public_approved_data: List[List[str]]
) -> Tuple[List[List[str]], int]:
    """
    Delete ALL outdated events from PUBLIC_APPROVED (regardless of source)
    PUBLIC_APPROVED is a customer-facing feed - safe to delete past events
    Returns: (cleaned_data, count_deleted)
    """
    if not public_approved_data or len(public_approved_data) <= 1:
        return public_approved_data, 0

    headers = public_approved_data[0]
    cleaned_rows = [headers]  # Keep headers
    deleted_count = 0
    deleted_samples = []

    for row in public_approved_data[1:]:
        # Check if outdated (any source)
        if is_event_outdated(row, headers):
            # Delete this row (don't add to cleaned_rows)
            deleted_count += 1
            # Store sample for logging
            event_name_idx = -1
            if "EVENT" in headers:
                event_name_idx = headers.index("EVENT")
            elif "EVENT_NAME" in headers:
                event_name_idx = headers.index("EVENT_NAME")

            event_name = row[event_name_idx] if event_name_idx >= 0 and event_name_idx < len(row) else "Unknown"
            if len(deleted_samples) < 5:
                deleted_samples.append(event_name)
        else:
            # Keep this row
            cleaned_rows.append(row)

    if deleted_count > 0:
        print(f"\n🗑️  Deleting outdated events from PUBLIC_APPROVED:")
        print(f"   Deleted {deleted_count} outdated events (all sources)")
        for i, name in enumerate(deleted_samples, 1):
            print(f"   {i}. {name}")
        if deleted_count > len(deleted_samples):
            print(f"   ... and {deleted_count - len(deleted_samples)} more")

    return cleaned_rows, deleted_count


def format_events_for_sheet(events: List[Dict]) -> List[List[str]]:
    """
    Format events for Google Sheets insertion
    Matches PRE_APPROVED EVENTS column order:
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
    """Main orchestration with pruning"""
    print("=" * 70)
    print("🔄 O2 EVENTS → GOOGLE SHEETS COMPLETE SYNC + PRUNE")
    print("=" * 70)

    # Load scraped events from JSON
    try:
        with open('o2-events-all.json', 'r') as f:
            scraped_events = json.load(f)
        print(f"\n✅ Loaded {len(scraped_events)} scraped events")
    except FileNotFoundError:
        print("❌ Error: o2-events-all.json not found")
        sys.exit(1)

    # Load existing sheet data from JSON files (passed from Claude Code)
    try:
        with open('public-approved-data.json', 'r') as f:
            public_approved_data = json.load(f)
        print(f"✅ Loaded PUBLIC_APPROVED sheet data")
    except FileNotFoundError:
        print("⚠️  Warning: public-approved-data.json not found, using empty data")
        public_approved_data = [[]]

    try:
        with open('pre-approved-data.json', 'r') as f:
            pre_approved_data = json.load(f)
        print(f"✅ Loaded PRE_APPROVED EVENTS sheet data")
    except FileNotFoundError:
        print("⚠️  Warning: pre-approved-data.json not found, using empty data")
        pre_approved_data = [[]]

    # STEP 1: De-duplicate scraped events
    new_events, dedupe_stats = dedupe_events(scraped_events, public_approved_data, pre_approved_data)

    # STEP 2: Delete outdated O2 events from PRE_APPROVED EVENTS
    cleaned_pre_approved, deleted_pre_count = prune_pre_approved_events(pre_approved_data)

    # STEP 3: Delete ALL outdated events from PUBLIC_APPROVED
    cleaned_public_approved, deleted_pub_count = prune_public_approved_events(public_approved_data)

    # Format new events for sheets
    rows = format_events_for_sheet(new_events) if new_events else []

    # Show summary
    print(f"\n" + "=" * 70)
    print("📊 SYNC SUMMARY")
    print("=" * 70)
    print(f"   Scraped: {dedupe_stats['total_scraped']} events")
    print(f"   New events to add: {len(rows)}")
    print(f"   Duplicates skipped: {dedupe_stats['skipped_public_approved'] + dedupe_stats['skipped_pre_approved']}")
    print(f"     - In PUBLIC_APPROVED: {dedupe_stats['skipped_public_approved']}")
    print(f"     - In PRE_APPROVED: {dedupe_stats['skipped_pre_approved']}")
    print(f"   Outdated O2 events deleted from PRE_APPROVED: {deleted_pre_count}")
    print(f"   Outdated events deleted from PUBLIC_APPROVED: {deleted_pub_count}")

    # Show sample new events
    if new_events:
        print(f"\n📋 Sample new events to add:")
        for i, event in enumerate(new_events[:5], 1):
            print(f"   {i}. {event['event_name']} - {event['event_date']} at {event['venue_name']}")
        if len(new_events) > 5:
            print(f"   ... and {len(new_events) - 5} more")

    # Save output for Claude Code to write to sheets
    output = {
        'new_events': new_events,
        'rows': rows,
        'stats': {
            **dedupe_stats,
            'deleted_pre_count': deleted_pre_count,
            'deleted_pub_count': deleted_pub_count
        },
        'cleaned_pre_approved': cleaned_pre_approved,
        'cleaned_public_approved': cleaned_public_approved
    }

    with open('sync-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to sync-output.json")
    print(f"   Ready to write to Google Sheets")
    print(f"   Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"   Sheets to update: PRE_APPROVED EVENTS, PUBLIC_APPROVED")


if __name__ == "__main__":
    main()
