#!/usr/bin/env python3
"""
Upload complete combined dataset to PRE_APPROVED EVENTS in PI Work Flow
Combines headers + 20 existing events + 132 O2 events (filtering Strictly)
"""

import json
import pickle
from googleapiclient.discovery import build

# Spreadsheet IDs
PI_WORKFLOW_ID = "1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU"
PUBLIC_FEED_ID = "1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8"

def main():
    # Load credentials
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)

    service = build('sheets', 'v4', credentials=creds)

    print("=" * 70)
    print("UPLOADING COMPLETE DATASET TO PRE_APPROVED EVENTS")
    print("=" * 70)

    # Load existing events
    with open('ready-for-claude-final-step.json', 'r') as f:
        data = json.load(f)

    headers = data['headers']
    existing_events = data['existing_events']

    print(f"\n✅ Loaded {len(existing_events)} existing events")

    # Get O2 events from O2_TEMP
    print(f"\n📥 Reading O2 events from O2_TEMP...")
    result = service.spreadsheets().values().get(
        spreadsheetId=PI_WORKFLOW_ID,
        range='O2_TEMP!A2:N134'  # Skip header, get all 133 events
    ).execute()

    o2_events_raw = result.get('values', [])
    print(f"✅ Retrieved {len(o2_events_raw)} O2 events")

    # Filter out Strictly Come Dancing (row 33, index 32)
    o2_events_filtered = []
    strictly_filtered = False

    for idx, event in enumerate(o2_events_raw):
        event_name = event[0] if len(event) > 0 else ""
        if "Strictly Come Dancing" in event_name:
            print(f"\n🚫 Filtering out: {event_name} (row {idx + 2})")
            strictly_filtered = True
        else:
            o2_events_filtered.append(event)

    print(f"✅ After filtering: {len(o2_events_filtered)} O2 events")

    # Combine all data
    complete_dataset = [headers] + existing_events + o2_events_filtered

    print(f"\n📊 Final dataset:")
    print(f"   Headers: 1 row")
    print(f"   Existing events: {len(existing_events)} rows")
    print(f"   O2 events: {len(o2_events_filtered)} rows")
    print(f"   TOTAL: {len(complete_dataset)} rows")

    # Upload to PRE_APPROVED EVENTS
    print(f"\n🚀 Uploading to PRE_APPROVED EVENTS...")

    body = {
        'values': complete_dataset
    }

    result = service.spreadsheets().values().update(
        spreadsheetId=PI_WORKFLOW_ID,
        range='PRE_APPROVED EVENTS!A1:N' + str(len(complete_dataset)),
        valueInputOption='RAW',
        body=body
    ).execute()

    print(f"\n✅ Upload complete!")
    print(f"   Updated range: {result.get('updatedRange')}")
    print(f"   Updated rows: {result.get('updatedRows')}")
    print(f"   Updated cells: {result.get('updatedCells')}")

    # Save summary
    with open('upload-complete-summary.json', 'w') as f:
        json.dump({
            'success': True,
            'total_rows': len(complete_dataset),
            'existing_events': len(existing_events),
            'o2_events': len(o2_events_filtered),
            'strictly_filtered': strictly_filtered,
            'updated_range': result.get('updatedRange'),
            'updated_rows': result.get('updatedRows')
        }, f, indent=2)

    print(f"\n" + "=" * 70)
    print(f"SUCCESS! {len(complete_dataset)} rows uploaded to PRE_APPROVED EVENTS")
    print(f"=" * 70)

if __name__ == '__main__':
    main()
