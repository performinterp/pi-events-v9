# O2 Sync Pipeline Updates - December 16, 2025

## Summary
Updated O2 sync pipeline to dedupe against PUBLIC_APPROVED instead of CURATED, with URL-first matching strategy.

## Changes Made

### 1. **admin-tools.html** (Documentation & UI)

**Line 232-236**: Updated documentation panel
```diff
- De-duplicates against: CURATED and PRE-APPROVED EVENTS sheets
+ De-duplicates against: PUBLIC_APPROVED and PRE_APPROVED EVENTS sheets (PI Work Flow)
+ Dedupe key: EVENT_URL (normalized) or EVENT_NAME|EVENT_DATE|VENUE_NAME
```

**Line 243-250**: Updated JavaScript comment
```diff
- 2. Apply de-duplication against CURATED + PRE-APPROVED
+ 2. Apply de-duplication against PUBLIC_APPROVED + PRE_APPROVED EVENTS (PI Work Flow)
+    - Uses URL-first matching (normalized EVENT_URL)
+    - Falls back to (EVENT_NAME | EVENT_DATE | VENUE_NAME)
```

### 2. **o2-sync-complete.py** (Core Deduplication Logic)

**Line 63-90**: Added `normalize_url()` function
- Strips protocol (http://, https://)
- Removes www.
- Removes query parameters (tracking params)
- Removes trailing slashes
- Converts to lowercase

**Line 102-160**: Updated `extract_o2_events_from_public_approved()`
- **Return type changed**: Now returns `Tuple[Set[str], Set[str]]` (url_keys, name_keys)
- Extracts both EVENT_URL and name|date|venue keys
- Normalizes URLs before adding to dedupe set
- Only includes O2 events (venue contains 'o2')

**Line 163-207**: Updated `extract_events_from_pre_approved()`
- **Return type changed**: Now returns `Tuple[Set[str], Set[str]]` (url_keys, name_keys)
- Extracts both EVENT_URL and name|date|venue keys
- Normalizes URLs before adding to dedupe set

**Line 210-310**: Updated `dedupe_events()` function
- **Priority 1**: Check normalized URL match if URL exists
- **Priority 2**: Check name|date|venue match as fallback
- Tracks match method (URL vs name|date|venue) in stats
- Enhanced logging shows which dedupe method was used

## Deduplication Strategy

### Priority Order:
1. **If EVENT_URL exists**: Use normalized URL as primary key
   - Example: `theo2.co.uk/events/abba` (normalized from `https://www.theo2.co.uk/events/abba?tracking=123`)

2. **Else**: Use `EVENT_NAME | EVENT_DATE | VENUE_NAME`
   - Example: `mumford & sons|2025-12-11|the o2`

### Sheets Checked (Both in PI Work Flow spreadsheet):
- **PUBLIC_APPROVED** - Only O2 events (venue contains 'o2')
- **PRE_APPROVED EVENTS** - All events

### URL Normalization Rules:
- Remove `http://` and `https://`
- Remove `www.`
- Strip query parameters (`?...`)
- Remove trailing `/`
- Convert to lowercase

## Idempotency Guarantee

✅ Running sync multiple times will add 0 duplicates because:
1. First run: Events written to PRE_APPROVED EVENTS with URLs
2. Second run: URL match detected, events skipped
3. For events without URLs: name|date|venue match detected, events skipped

## Testing Notes

### Acceptance Test #1: PUBLIC_APPROVED Dedupe
Pick an event in PUBLIC_APPROVED that matches O2 event page → Confirm NOT added to PRE_APPROVED EVENTS

### Acceptance Test #2: Idempotency
Run sync twice → Confirm "0 new events added" on second run

## Files Modified
1. `/admin-tools.html` - Documentation text and JavaScript comments
2. `/o2-sync-complete.py` - Core dedupe logic with URL-first strategy

## Files Unchanged
- `/o2-sync-api.py` - No changes needed (calls o2-sync-complete.py)
- `/o2-scraper-enhanced.py` - No changes needed (scraper logic unchanged)
- `/o2-sync-to-sheet.py` - Deprecated file, not in use

## Output Target
✅ **No change** - Events still write to PRE_APPROVED EVENTS in PI Work Flow spreadsheet
✅ **No change** - PUBLIC_APPROVED is read-only for dedupe checking

## Migration Notes
- No database migration needed
- No data cleanup required
- Change is backward compatible
- Existing events in PRE_APPROVED EVENTS will be deduplicated correctly
