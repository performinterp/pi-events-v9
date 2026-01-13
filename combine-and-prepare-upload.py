#!/usr/bin/env python3
"""
Combine transformed existing events + filtered O2 events
Output ready for Google Sheets MCP tool upload
"""

import json

# Read transformed existing events
with open('restructured-existing-events.json', 'r') as f:
    existing_data = json.load(f)

headers = existing_data['headers']
existing_events = existing_data['existing_events']

print(f"✅ Loaded {len(existing_events)} existing events")
print(f"✅ Header: {headers}")

# The O2 events with updated status will be added by Claude using MCP tool
# This script just prepares the existing events for combination

# For now, save the existing events in the right format for upload
with open('existing-for-upload.json', 'w') as f:
    json.dump({
        'headers': headers,
        'existing_events': existing_events,
        'existing_count': len(existing_events)
    }, f, indent=2)

print(f"\n💾 Prepared {len(existing_events)} existing events for upload")
print("   Claude will add O2 events using MCP tool and upload combined dataset")
