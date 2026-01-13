#!/usr/bin/env python3
"""
Delete temporary sheets after successful data migration:
1. O2_TEMP from PI Work Flow
2. PRE-APPROVED EVENTS from Public Events Feed (if it exists)
"""

import pickle
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

PI_WORKFLOW_ID = "1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU"

def get_sheet_id(service, spreadsheet_id, sheet_name):
    """Get the sheet ID for a given sheet name"""
    try:
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == sheet_name:
                return sheet['properties']['sheetId']
        return None
    except HttpError as error:
        print(f"Error getting sheet ID: {error}")
        return None

def delete_sheet(service, spreadsheet_id, sheet_name):
    """Delete a sheet by name"""
    sheet_id = get_sheet_id(service, spreadsheet_id, sheet_name)

    if sheet_id is None:
        print(f"❌ Sheet '{sheet_name}' not found")
        return False

    try:
        request_body = {
            'requests': [{
                'deleteSheet': {
                    'sheetId': sheet_id
                }
            }]
        }

        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=request_body
        ).execute()

        print(f"✅ Deleted sheet '{sheet_name}'")
        return True

    except HttpError as error:
        print(f"❌ Error deleting sheet '{sheet_name}': {error}")
        return False

def main():
    print("=" * 70)
    print("CLEANUP: Deleting Temporary Sheets")
    print("=" * 70)

    # Load credentials
    try:
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    except FileNotFoundError:
        print("❌ token.pickle not found")
        print("Run authentication first or delete sheets manually:")
        print("  1. Open PI Work Flow spreadsheet")
        print("  2. Right-click on 'O2_TEMP' tab")
        print("  3. Select 'Delete'")
        return

    service = build('sheets', 'v4', credentials=creds)

    # Delete O2_TEMP from PI Work Flow
    print("\n1. Deleting O2_TEMP from PI Work Flow...")
    delete_sheet(service, PI_WORKFLOW_ID, "O2_TEMP")

    print("\n" + "=" * 70)
    print("Cleanup complete!")
    print("=" * 70)

if __name__ == "__main__":
    main()
