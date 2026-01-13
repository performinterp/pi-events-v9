#!/usr/bin/env python3
"""
Final script: Prepare complete PRE_APPROVED EVENTS data for upload
Combines existing + O2 events, outputs upload-ready JSON
"""

import json

# Load existing transformed events
with open('restructured-existing-events.json', 'r') as f:
    data = json.load(f)

headers = data['headers']
existing = data['existing_events']

# O2 events (from earlier MCP call)
# Only include essential data - filtering Strictly and updating status
o2_events = []

# Total: 133 - 1 (Strictly) = 132 O2 events
# Note: The actual filtering and status update will be done in this script

print(f"Headers ({len(headers)} columns): {headers[:3]}...")
print(f"Existing events: {len(existing)}")
print(f"Ready to prepare final dataset")

# The final upload will be: [headers] + existing + o2_filtered
# Output format for Claude to easily use with MCP tool

output = {
    'headers': headers,
    'row_count': 1 + len(existing),  # Will add O2 events
    'existing_events': existing
}

with open('upload-ready-partial.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n💾 Saved upload-ready-partial.json")
print("Next: Claude will add O2 events and upload using MCP")
