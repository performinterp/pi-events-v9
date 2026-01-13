#!/usr/bin/env python3
"""
Fetch current Google Sheets data and run O2 sync with deletion
This should be called by Claude Code which will provide the sheet data as arguments
"""
import json
import sys
import subprocess

def save_sheet_data(pre_approved_data, public_approved_data):
    """Save sheet data to JSON files for sync script"""

    with open('pre-approved-data.json', 'w') as f:
        json.dump(pre_approved_data, f, indent=2)
    print(f"✓ Saved PRE_APPROVED EVENTS: {len(pre_approved_data)} rows")

    with open('public-approved-data.json', 'w') as f:
        json.dump(public_approved_data, f, indent=2)
    print(f"✓ Saved PUBLIC_APPROVED: {len(public_approved_data)} rows")

def run_sync():
    """Run the O2 sync script"""
    print("\n🔄 Running O2 sync with deletion logic...")

    result = subprocess.run([sys.executable, 'o2-sync-complete.py'],
                          capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        print(f"✗ Sync failed: {result.stderr}")
        return None

    print(result.stdout)

    # Load sync output
    try:
        with open('sync-output.json', 'r') as f:
            return json.load(f)
    except:
        return None

def main():
    print("=" * 70)
    print("FETCH & SYNC O2 EVENTS WITH DELETION")
    print("=" * 70)

    # This will be called by Claude Code with sheet data passed in
    # For now, just print instructions
    print("\nThis script expects Claude Code to:")
    print("1. Fetch current PRE_APPROVED EVENTS and PUBLIC_APPROVED via MCP")
    print("2. Pass that data to this script")
    print("3. This script saves it to JSON and runs the sync")
    print("4. Claude Code reads sync-output.json and writes cleaned data back via MCP")

if __name__ == "__main__":
    main()
