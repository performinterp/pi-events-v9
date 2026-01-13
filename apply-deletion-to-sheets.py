#!/usr/bin/env python3
"""
Apply O2 event deletion logic to Google Sheets data
This script is called BY Claude Code, which:
1. Fetches current sheet data via MCP
2. Passes it to this script as JSON
3. This script filters it
4. Returns the cleaned data
5. Claude Code writes it back via MCP
"""
import json
import sys
from datetime import datetime, timedelta
import pytz

LONDON_TZ = pytz.timezone('Europe/London')

def is_o2_sourced(row, headers):
    """Check if event is O2-sourced"""
    source_idx = headers.index("SOURCE") if "SOURCE" in headers else -1
    url_idx = headers.index("EVENT_URL") if "EVENT_URL" in headers else -1

    if source_idx >= 0 and source_idx < len(row):
        if "O2" in str(row[source_idx]).upper():
            return True

    if url_idx >= 0 and url_idx < len(row):
        if "theo2.co.uk" in str(row[url_idx]).lower():
            return True

    return False

def is_outdated(row, headers):
    """Check if event is outdated (>6h past)"""
    now = datetime.now(LONDON_TZ)
    cutoff = now - timedelta(hours=6)

    date_idx = headers.index("EVENT_DATE") if "EVENT_DATE" in headers else -1
    if date_idx < 0 or date_idx >= len(row):
        return False

    date_str = str(row[date_idx])
    try:
        parts = date_str.split('-')
        if len(parts) != 3:
            return False
        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
        event_dt = LONDON_TZ.localize(datetime(year, month, day, 23, 59))
        return event_dt < cutoff
    except:
        return False

def filter_pre_approved(data):
    """Remove outdated O2 events from PRE_APPROVED"""
    if not data or len(data) <= 1:
        return data, 0

    headers = data[0]
    filtered = [headers]
    deleted = 0

    for row in data[1:]:
        if is_o2_sourced(row, headers) and is_outdated(row, headers):
            deleted += 1
        else:
            filtered.append(row)

    return filtered, deleted

def filter_public_approved(data):
    """Remove ALL outdated events from PUBLIC_APPROVED"""
    if not data or len(data) <= 1:
        return data, 0

    headers = data[0]
    filtered = [headers]
    deleted = 0

    # Find DATE column (might be "DATE" instead of "EVENT_DATE")
    date_col = "DATE" if "DATE" in headers else "EVENT_DATE"
    date_idx = headers.index(date_col) if date_col in headers else -1

    if date_idx < 0:
        return data, 0

    now = datetime.now(LONDON_TZ)
    cutoff = now - timedelta(hours=6)

    for row in data[1:]:
        if date_idx >= len(row):
            filtered.append(row)
            continue

        date_str = str(row[date_idx])
        try:
            # Parse DD.MM.YY format
            parts = date_str.split('.')
            if len(parts) == 3:
                day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                year = 2000 + year if year < 100 else year
                event_dt = LONDON_TZ.localize(datetime(year, month, day, 23, 59))

                if event_dt < cutoff:
                    deleted += 1
                    continue

            filtered.append(row)
        except:
            filtered.append(row)

    return filtered, deleted

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 apply-deletion-to-sheets.py <pre_approved_json> <public_approved_json>")
        print("This script filters Google Sheets data to remove outdated events")
        return 1

    # Load input data
    with open(sys.argv[1], 'r') as f:
        pre_approved = json.load(f)

    with open(sys.argv[2], 'r') as f:
        public_approved = json.load(f)

    print(f"Input:")
    print(f"  PRE_APPROVED: {len(pre_approved)} rows")
    print(f"  PUBLIC_APPROVED: {len(public_approved)} rows")

    # Filter
    cleaned_pre, deleted_pre = filter_pre_approved(pre_approved)
    cleaned_pub, deleted_pub = filter_public_approved(public_approved)

    print(f"\nDeletion Results:")
    print(f"  PRE_APPROVED: deleted {deleted_pre} outdated O2 events")
    print(f"  PUBLIC_APPROVED: deleted {deleted_pub} outdated events")
    print(f"\nOutput:")
    print(f"  PRE_APPROVED: {len(cleaned_pre)} rows remaining")
    print(f"  PUBLIC_APPROVED: {len(cleaned_pub)} rows remaining")

    # Save output
    with open('cleaned-pre-approved.json', 'w') as f:
        json.dump(cleaned_pre, f, indent=2)

    with open('cleaned-public-approved.json', 'w') as f:
        json.dump(cleaned_pub, f, indent=2)

    print("\n✅ Cleaned data saved:")
    print("   - cleaned-pre-approved.json")
    print("   - cleaned-public-approved.json")

    return 0

if __name__ == "__main__":
    sys.exit(main())
