#!/usr/bin/env python3
"""
Job 2: Build STAGED_EVENTS

Merges PRE_APPROVED EVENTS + INGEST_FROM_MONTHLY
Deduplicates using URL-first strategy
Preserves manual APPROVE values from existing STAGED_EVENTS
Adds SOURCE column (O2 | MONTHLY | MANUAL)

Key behaviors:
- MONTHLY events take precedence over O2 events (more accurate)
- Uses "More info" event URL for O2 (not box office URL)
- Preserves APPROVE and override columns from existing data
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.config import STAGED_EVENTS_COLUMNS
from pipeline.utils import (
    normalize_url, normalize_event_name, normalize_venue_name,
    generate_event_id, create_event_key
)


def extract_pre_approved_events(data: list) -> list:
    """
    Extract events from PRE_APPROVED EVENTS sheet

    Args:
        data: 2D array from PRE_APPROVED EVENTS sheet

    Returns:
        List of event dicts
    """
    if not data or len(data) < 2:
        return []

    headers = data[0]
    events = []

    # Build column map
    col_map = {h: i for i, h in enumerate(headers)}

    for row in data[1:]:
        if len(row) < 3:
            continue

        # Determine source (O2 vs MANUAL)
        source_val = row[col_map.get('SOURCE', -1)] if col_map.get('SOURCE', -1) >= 0 and col_map.get('SOURCE', -1) < len(row) else ""
        is_o2 = 'O2' in str(source_val).upper() or 'O2' in str(source_val)

        # For O2 events, EVENT_URL should be the "More info" event URL (not box office)
        # The scraper already extracts this correctly
        event_url = row[col_map.get('EVENT_URL', -1)] if col_map.get('EVENT_URL', -1) >= 0 and col_map.get('EVENT_URL', -1) < len(row) else ""

        event = {
            'source': 'O2' if is_o2 else 'MANUAL',
            'source_reference': 'PRE_APPROVED EVENTS',
            'event_date': row[col_map.get('EVENT_DATE', -1)] if col_map.get('EVENT_DATE', -1) >= 0 and col_map.get('EVENT_DATE', -1) < len(row) else "",
            'event_time': row[col_map.get('EVENT_TIME', -1)] if col_map.get('EVENT_TIME', -1) >= 0 and col_map.get('EVENT_TIME', -1) < len(row) else "",
            'event_name': row[col_map.get('EVENT_NAME', -1)] if col_map.get('EVENT_NAME', -1) >= 0 and col_map.get('EVENT_NAME', -1) < len(row) else "",
            'artist_name': row[col_map.get('ARTIST_NAME', -1)] if col_map.get('ARTIST_NAME', -1) >= 0 and col_map.get('ARTIST_NAME', -1) < len(row) else "",
            'event_organiser': row[col_map.get('EVENT_ORGANISER', -1)] if col_map.get('EVENT_ORGANISER', -1) >= 0 and col_map.get('EVENT_ORGANISER', -1) < len(row) else "",
            'venue_name': row[col_map.get('VENUE_NAME', -1)] if col_map.get('VENUE_NAME', -1) >= 0 and col_map.get('VENUE_NAME', -1) < len(row) else "",
            'event_url': event_url,  # This is the "More info" URL for O2
            'image_url': row[col_map.get('IMAGE_URL', -1)] if col_map.get('IMAGE_URL', -1) >= 0 and col_map.get('IMAGE_URL', -1) < len(row) else "",
            'category': row[col_map.get('CATEGORY', -1)] if col_map.get('CATEGORY', -1) >= 0 and col_map.get('CATEGORY', -1) < len(row) else "",
            'access_status': row[col_map.get('ACCESS_STATUS', -1)] if col_map.get('ACCESS_STATUS', -1) >= 0 and col_map.get('ACCESS_STATUS', -1) < len(row) else "",
            'notes': row[col_map.get('NOTES', -1)] if col_map.get('NOTES', -1) >= 0 and col_map.get('NOTES', -1) < len(row) else "",
        }

        if event['event_name'] and event['event_date']:
            events.append(event)

    return events


def extract_monthly_events(data: list) -> list:
    """
    Extract events from INGEST_FROM_MONTHLY sheet

    Args:
        data: 2D array from INGEST_FROM_MONTHLY sheet

    Returns:
        List of event dicts
    """
    if not data or len(data) < 2:
        return []

    events = []

    # INGEST_FROM_MONTHLY columns: SOURCE_TAB, SOURCE_ROW, EVENT_DATE, EVENT_NAME, VENUE_NAME, EVENT_TIME, INTERPRETERS, EVENT_ORGANISER
    for row in data[1:]:
        if len(row) < 5:
            continue

        event = {
            'source': 'MONTHLY',
            'source_reference': row[0],  # SOURCE_TAB
            'event_date': row[2],  # EVENT_DATE
            'event_time': row[5] if len(row) > 5 else "",  # EVENT_TIME
            'event_name': row[3],  # EVENT_NAME
            'artist_name': "",
            'event_organiser': row[7] if len(row) > 7 else "",  # EVENT_ORGANISER
            'venue_name': row[4],  # VENUE_NAME
            'event_url': "",  # No URL from monthly tabs
            'image_url': "",  # No image from monthly tabs
            'category': "",
            'access_status': "",
            'notes': row[6] if len(row) > 6 else "",  # INTERPRETERS in notes
        }

        if event['event_name'] and event['event_date']:
            events.append(event)

    return events


def deduplicate_events(events: list) -> list:
    """
    Deduplicate events using URL-first strategy

    Priority order: MONTHLY > MANUAL > O2
    (MONTHLY events are more accurate than O2 advertising versions)

    Deduplication keys:
    1. Primary: Normalized EVENT_URL (if exists)
    2. Fallback: date|normalized_name|normalized_venue

    Args:
        events: List of event dicts

    Returns:
        List of unique events
    """
    # Sort by priority
    priority_order = {'MONTHLY': 0, 'MANUAL': 1, 'O2': 2}
    events_sorted = sorted(events, key=lambda e: priority_order.get(e['source'], 99))

    url_keys = {}
    event_keys = {}

    for event in events_sorted:
        # Generate keys
        url_key = normalize_url(event['event_url']) if event['event_url'] else None
        venue_normalized = normalize_venue_name(event['venue_name'])
        event_key = create_event_key(event['event_date'], event['event_name'], venue_normalized)

        # Check URL key first (higher priority)
        if url_key and url_key in url_keys:
            print(f"   ⏭️  Skipping duplicate (URL): {event['event_name']} (source: {event['source']})")
            continue

        # Check event key
        if event_key in event_keys:
            print(f"   ⏭️  Skipping duplicate (event key): {event['event_name']} (source: {event['source']})")
            continue

        # Add to dedupe sets
        if url_key:
            url_keys[url_key] = event
        event_keys[event_key] = event

    return list(event_keys.values())


def preserve_approval_status(new_events: list, existing_staged_data: list) -> list:
    """
    Preserve APPROVE and override values from existing STAGED_EVENTS

    Args:
        new_events: List of new event dicts
        existing_staged_data: 2D array from existing STAGED_EVENTS sheet

    Returns:
        List of events with preserved approval status
    """
    if not existing_staged_data or len(existing_staged_data) < 2:
        return new_events

    # Build map of existing approvals by EVENT_ID
    headers = existing_staged_data[0]
    col_map = {h: i for i, h in enumerate(headers)}

    existing_approvals = {}
    for row in existing_staged_data[1:]:
        if len(row) < 3:
            continue

        event_id = row[col_map.get('EVENT_ID', 0)]
        existing_approvals[event_id] = {
            'approve': row[col_map.get('APPROVE', -1)] if col_map.get('APPROVE', -1) >= 0 and col_map.get('APPROVE', -1) < len(row) else "FALSE",
            'venue_id_override': row[col_map.get('VENUE_ID_OVERRIDE', -1)] if col_map.get('VENUE_ID_OVERRIDE', -1) >= 0 and col_map.get('VENUE_ID_OVERRIDE', -1) < len(row) else "",
            'category_override': row[col_map.get('CATEGORY_OVERRIDE', -1)] if col_map.get('CATEGORY_OVERRIDE', -1) >= 0 and col_map.get('CATEGORY_OVERRIDE', -1) < len(row) else "",
            'ticket_url_override': row[col_map.get('TICKET_URL_OVERRIDE', -1)] if col_map.get('TICKET_URL_OVERRIDE', -1) >= 0 and col_map.get('TICKET_URL_OVERRIDE', -1) < len(row) else "",
            'image_url_override': row[col_map.get('IMAGE_URL_OVERRIDE', -1)] if col_map.get('IMAGE_URL_OVERRIDE', -1) >= 0 and col_map.get('IMAGE_URL_OVERRIDE', -1) < len(row) else "",
        }

    # Merge approvals into new events
    for event in new_events:
        venue_normalized = normalize_venue_name(event['venue_name'])
        event_id = generate_event_id(event['event_date'], event['event_name'], venue_normalized)

        if event_id in existing_approvals:
            event['_approval_data'] = existing_approvals[event_id]
        else:
            event['_approval_data'] = {
                'approve': "FALSE",
                'venue_id_override': "",
                'category_override': "",
                'ticket_url_override': "",
                'image_url_override': ""
            }

    return new_events


def format_for_staged_events(events: list) -> list:
    """
    Format events for STAGED_EVENTS sheet

    Note: VENUE_ID, CITY, COUNTRY, LANGUAGE will be filled by Job 3 (enrichment)
    We set them to empty here, as they will be recomputed from VENUE_ID or override

    Args:
        events: List of event dicts

    Returns:
        2D array for STAGED_EVENTS sheet
    """
    rows = []

    for event in events:
        venue_normalized = normalize_venue_name(event['venue_name'])
        event_id = generate_event_id(event['event_date'], event['event_name'], venue_normalized)

        approval_data = event.get('_approval_data', {
            'approve': "FALSE",
            'venue_id_override': "",
            'category_override': "",
            'ticket_url_override': "",
            'image_url_override': ""
        })

        row = [
            event_id,                                      # EVENT_ID
            event['source'],                               # SOURCE
            event['source_reference'],                     # SOURCE_REFERENCE
            event['event_date'],                           # EVENT_DATE
            event['event_time'],                           # EVENT_TIME
            event['event_name'],                           # EVENT_NAME
            event['artist_name'],                          # ARTIST_NAME
            event['event_organiser'],                      # EVENT_ORGANISER
            "",                                            # VENUE_ID (to be enriched)
            event['venue_name'],                           # VENUE_NAME
            "",                                            # CITY (to be enriched)
            "",                                            # COUNTRY (to be enriched)
            "",                                            # LANGUAGE (to be enriched)
            event['event_url'],                            # TICKET_URL (will use event URL or enriched)
            event['image_url'],                            # IMAGE_URL (to be enriched)
            "",                                            # CATEGORY_ID (to be enriched)
            event['category'],                             # CATEGORY_SUGGESTION (from PRE_APPROVED or auto-detect)
            approval_data['venue_id_override'],            # VENUE_ID_OVERRIDE
            approval_data['category_override'],            # CATEGORY_OVERRIDE
            approval_data['ticket_url_override'],          # TICKET_URL_OVERRIDE
            approval_data['image_url_override'],           # IMAGE_URL_OVERRIDE
            event['access_status'],                        # ACCESS_STATUS
            event['notes'],                                # NOTES
            "",                                            # VALIDATION_STATUS (to be set by Job 4)
            approval_data['approve']                       # APPROVE
        ]
        rows.append(row)

    return rows


def main():
    """
    Main orchestration

    Expects:
        - pre-approved-events-data.json (from PRE_APPROVED EVENTS sheet)
        - ingest-from-monthly-data.json (from INGEST_FROM_MONTHLY sheet)
        - staged-events-existing.json (existing STAGED_EVENTS, if any)

    Outputs:
        - staged-events-output.json (ready to write to STAGED_EVENTS sheet)
    """
    print("=" * 70)
    print("🔨 JOB 2: BUILD STAGED_EVENTS")
    print("=" * 70)

    # Load PRE_APPROVED EVENTS data
    try:
        with open('pre-approved-events-data.json', 'r') as f:
            pre_approved_data = json.load(f)
        print("✅ Loaded PRE_APPROVED EVENTS data")
    except FileNotFoundError:
        print("❌ Error: pre-approved-events-data.json not found")
        sys.exit(1)

    # Load INGEST_FROM_MONTHLY data
    try:
        with open('ingest-from-monthly-data.json', 'r') as f:
            ingest_data = json.load(f)
        print("✅ Loaded INGEST_FROM_MONTHLY data")
    except FileNotFoundError:
        print("⚠️  Warning: ingest-from-monthly-data.json not found, using empty data")
        ingest_data = [[]]

    # Load existing STAGED_EVENTS (to preserve APPROVE values)
    try:
        with open('staged-events-existing.json', 'r') as f:
            existing_staged_data = json.load(f)
        print("✅ Loaded existing STAGED_EVENTS data (to preserve approvals)")
    except FileNotFoundError:
        print("ℹ️  No existing STAGED_EVENTS data found (first run)")
        existing_staged_data = [[]]

    # Extract events
    print(f"\n📥 Extracting events...")
    pre_approved_events = extract_pre_approved_events(pre_approved_data)
    monthly_events = extract_monthly_events(ingest_data)

    print(f"   PRE_APPROVED EVENTS: {len(pre_approved_events)} events")
    print(f"   INGEST_FROM_MONTHLY: {len(monthly_events)} events")

    # Merge
    all_events = pre_approved_events + monthly_events

    # Deduplicate
    print(f"\n🔍 Deduplicating events...")
    unique_events = deduplicate_events(all_events)

    print(f"\n✅ Deduplication complete:")
    print(f"   Total before dedupe: {len(all_events)}")
    print(f"   Unique events: {len(unique_events)}")
    print(f"   Duplicates removed: {len(all_events) - len(unique_events)}")

    # Preserve approval status
    print(f"\n🔄 Preserving approval status from existing STAGED_EVENTS...")
    events_with_approvals = preserve_approval_status(unique_events, existing_staged_data)

    # Format for sheet
    output_rows = format_for_staged_events(events_with_approvals)

    print(f"\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"=" * 70)
    print(f"   Total unique events: {len(output_rows)}")
    print(f"   Sources:")
    source_counts = {}
    for event in unique_events:
        source = event['source']
        source_counts[source] = source_counts.get(source, 0) + 1
    for source, count in sorted(source_counts.items()):
        print(f"      {source}: {count}")

    # Save output
    output = {
        'headers': STAGED_EVENTS_COLUMNS,
        'rows': output_rows
    }

    with open('staged-events-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to: staged-events-output.json")
    print(f"   Ready to write to STAGED_EVENTS sheet")


if __name__ == "__main__":
    main()
