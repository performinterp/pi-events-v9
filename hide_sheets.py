#!/usr/bin/env python3
"""
Quick script to hide specific sheets in PI Work Flow spreadsheet
"""

import pickle
from googleapiclient.discovery import build

# Load credentials from pickle
with open('token.pickle', 'rb') as token:
    credentials = pickle.load(token)

service = build('sheets', 'v4', credentials=credentials)

SPREADSHEET_ID = '1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU'
SHEETS_TO_HIDE = ['__INGEST_FROM_MONTHLY', '__LEGACY_PUBLIC_APPROVED']

# Get spreadsheet metadata to find sheet IDs
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
sheets = spreadsheet.get('sheets', [])

# Find sheet IDs for the sheets we want to hide
sheet_ids_to_hide = []
for sheet in sheets:
    title = sheet['properties']['title']
    sheet_id = sheet['properties']['sheetId']
    if title in SHEETS_TO_HIDE:
        sheet_ids_to_hide.append({'title': title, 'id': sheet_id})
        print(f"Found sheet '{title}' with ID {sheet_id}")

# Build batch update requests
requests = []
for sheet_info in sheet_ids_to_hide:
    requests.append({
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_info['id'],
                'hidden': True
            },
            'fields': 'hidden'
        }
    })

# Execute batch update
if requests:
    batch_update_request = {'requests': requests}
    response = service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=batch_update_request
    ).execute()
    print(f"\n✅ Successfully hid {len(sheet_ids_to_hide)} sheets:")
    for sheet_info in sheet_ids_to_hide:
        print(f"   - {sheet_info['title']}")
else:
    print("❌ No sheets found to hide")
