#!/usr/bin/env python3
"""
COMPLETE RESTRUCTURE SCRIPT
1. Load existing transformed events
2. Load O2 events from Public Events Feed (via Claude MCP)
3. Filter Strictly Come Dancing4. Update ACCESS_STATUS to "Request Interpreter"
5. Combine all
6. Output final JSON for upload

This script expects o2-events-raw.json to exist (created by Claude using MCP)
"""

import json
import sys

# Load existing transformed events
print("=" * 70)
print("COMPLETE PRE_APPROVED EVENTS RESTRUCTURE")
print("=" * 70)

try:
    with open('restructured-existing-events.json', 'r') as f:
        existing_data = json.load(f)
    headers = existing_data['headers']
    existing_events = existing_data['existing_events']
    print(f"\n✅ Loaded {len(existing_events)} existing transformed events")
except FileNotFoundError:
    print("❌ Error: restructured-existing-events.json not found")
    sys.exit(1)

# Load O2 events (will be provided by Claude via MCP call saved to file)
try:
    with open('o2-events-from-public-feed.json', 'r') as f:
        o2_data = json.load(f)
    o2_events_raw = o2_data['events']  # Should be rows without header
    print(f"✅ Loaded {len(o2_events_raw)} O2 events from Public Events Feed")
except FileNotFoundError:
    print("⚠️  Warning: o2-events-from-public-feed.json not found")
    print("   Claude will need to fetch O2 events using MCP first")
    o2_events_raw = []

# Process O2 events
o2_events_processed = []
strictly_filtered = 0

for event in o2_events_raw:
    event_name = event[0] if len(event) > 0 else ""

    # Filter Strictly Come Dancing
    if "strictly come dancing" in event_name.lower():
        print(f"⏭️  Filtering: {event_name}")
        strictly_filtered += 1
        continue

    # Update ACCESS_STATUS (column index 9)
    if len(event) > 9:
        event[9] = "Request Interpreter"

    o2_events_processed.append(event)

print(f"✅ Processed {len(o2_events_processed)} O2 events")
if strictly_filtered > 0:
    print(f"   Filtered out {strictly_filtered} Strictly Come Dancing events")

# Combine all data
final_rows = [headers] + existing_events + o2_events_processed

print(f"\n📊 FINAL DATASET:")
print(f"   Header: 1 row")
print(f"   Existing events: {len(existing_events)} rows")
print(f"   O2 events: {len(o2_events_processed)} rows")
print(f"   TOTAL: {len(final_rows)} rows")
print(f"   Columns: {len(headers)}")

# Save complete dataset
output = {
    'complete_data': final_rows,
    'stats': {
        'total_rows': len(final_rows),
        'header_row': 1,
        'existing_events': len(existing_events),
        'o2_events': len(o2_events_processed),
        'columns': len(headers),
        'strictly_filtered': strictly_filtered
    }
}

with open('complete-pre-approved-events.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n💾 Saved to complete-pre-approved-events.json")
print(f"   Ready for upload to PI Work Flow PRE_APPROVED EVENTS")
print(f"   Range: A1:N{len(final_rows)}")
