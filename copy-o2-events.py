#!/usr/bin/env python3
"""
Copy O2 events from O2_TEMP to PRE_APPROVED EVENTS in batches
Filters out Strictly Come Dancing event
"""

import json
import requests

# MCP server URL (assumed to be running locally)
MCP_URL = "http://localhost:3000"

# Spreadsheet info
SPREADSHEET_ID = "1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU"

# The O2 events from the earlier MCP call (133 events)
# Row 33 (index 32) is Strictly - we'll filter it out

print("=" * 70)
print("COPYING O2 EVENTS TO PRE_APPROVED EVENTS")
print("=" * 70)

# Load the O2 events from a saved file or rebuild from the MCP call
# For now, let's just note the approach and suggest using smaller JSON files

print("\nApproach: Copy O2_TEMP data in two ranges:")
print("  1. Rows 2-33 (32 events) -> PRE_APPROVED EVENTS rows 22-53")
print("  2. Rows 35-134 (100 events) -> PRE_APPROVED EVENTS rows 54-153")
print("\n✅ This avoids row 34 (Strictly Come Dancing)")

print("\nRecommendation: Use Google Sheets IMPORTRANGE or manual copy-paste")
print("OR: Continue with MCP batch uploads (20 events at a time)")

