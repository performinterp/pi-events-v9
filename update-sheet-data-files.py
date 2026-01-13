#!/usr/bin/env python3
"""
Update JSON data files with real Google Sheets data
Run this before o2-sync-complete.py
"""
import json
import sys

# This will be populated by Claude Code with actual MCP data
PRE_APPROVED_DATA = None  # Claude Code will set this
PUBLIC_APPROVED_DATA = None  # Claude Code will set this

if len(sys.argv) > 1:
    # Load from file arguments
    if sys.argv[1] == "--from-files":
        with open('temp-pre-approved.json', 'r') as f:
            PRE_APPROVED_DATA = json.load(f)
        with open('temp-public-approved.json', 'r') as f:
            PUBLIC_APPROVED_DATA = json.load(f)

if PRE_APPROVED_DATA and PUBLIC_APPROVED_DATA:
    with open('pre-approved-data.json', 'w') as f:
        json.dump(PRE_APPROVED_DATA, f)
    print(f"✓ Saved PRE_APPROVED: {len(PRE_APPROVED_DATA)} rows")

    with open('public-approved-data.json', 'w') as f:
        json.dump(PUBLIC_APPROVED_DATA, f)
    print(f"✓ Saved PUBLIC_APPROVED: {len(PUBLIC_APPROVED_DATA)} rows")

    print("\n✅ Ready to run: python3 o2-sync-complete.py")
else:
    print("❌ No data provided. Claude Code should set PRE_APPROVED_DATA and PUBLIC_APPROVED_DATA")
    print("   Or run with: --from-files (expects temp-pre-approved.json and temp-public-approved.json)")
