#!/usr/bin/env python3
"""
Run O2 sync and write cleaned data back to Google Sheets
This script is called by Claude Code which has access to Google Sheets MCP
"""
import json
import sys
import subprocess

def run_sync():
    """Run the sync script"""
    print("=" * 70)
    print("RUNNING O2 SYNC WITH DELETION LOGIC")
    print("=" * 70)

    # Check required files exist
    required_files = ['o2-events-all.json', 'public-approved-data.json', 'pre-approved-data.json']
    for fname in required_files:
        try:
            with open(fname, 'r') as f:
                data = json.load(f)
                print(f"✓ {fname}: {len(data)} rows")
        except FileNotFoundError:
            print(f"✗ Missing: {fname}")
            return False

    # Run the sync
    print("\nRunning o2-sync-complete.py...")
    result = subprocess.run([sys.executable, 'o2-sync-complete.py'],
                          capture_output=True, text=True)

    if result.returncode != 0:
        print(f"✗ Sync failed!")
        print(f"STDERR: {result.stderr}")
        return False

    print(result.stdout)

    # Load the sync output
    try:
        with open('sync-output.json', 'r') as f:
            output = json.load(f)

        stats = output['stats']
        print("\n" + "=" * 70)
        print("SYNC RESULTS:")
        print("=" * 70)
        print(f"  Scraped: {stats['total_scraped']}")
        print(f"  New events: {len(output['rows'])}")
        print(f"  Deleted from PRE_APPROVED: {stats['deleted_pre_count']}")
        print(f"  Deleted from PUBLIC_APPROVED: {stats['deleted_pub_count']}")
        print(f"  Cleaned PRE_APPROVED rows: {len(output['cleaned_pre_approved'])}")
        print(f"  Cleaned PUBLIC_APPROVED rows: {len(output['cleaned_public_approved'])}")

        return True

    except Exception as e:
        print(f"✗ Error reading sync output: {e}")
        return False

if __name__ == "__main__":
    success = run_sync()
    sys.exit(0 if success else 1)
