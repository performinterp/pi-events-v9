# O2 Sync Pipeline - Pruning Feature Documentation

## Overview
The O2 sync pipeline now includes automatic pruning of outdated O2 events to keep the spreadsheet clean and current.

## Feature Summary

**Purpose:** Automatically remove outdated O2 events from PRE_APPROVED EVENTS and mark them in PUBLIC_APPROVED.

**Trigger:** Runs automatically after each sync operation.

**Timezone:** All datetime comparisons use `Europe/London` timezone.

**Grace Period:** 6 hours past event start time before pruning.

---

## O2 Event Detection

Events are identified as "O2-sourced" using this priority order:

### Priority 1: SOURCE Column
```
If SOURCE = "O2" → Treat as O2-sourced
```

### Priority 2: EVENT_URL Column
```
If EVENT_URL contains "theo2.co.uk" → Treat as O2-sourced
```

### Priority 3: VENUE_ID Column
```
If VENUE_ID starts with "o2-" → Treat as O2-sourced
```

**Example:**
- `SOURCE = "O2"` ✅ O2-sourced
- `EVENT_URL = "https://www.theo2.co.uk/events/stereophonics"` ✅ O2-sourced
- `VENUE_ID = "o2-arena-london"` ✅ O2-sourced
- None of the above → ❌ Not O2-sourced (will not be pruned)

---

## Outdated Event Detection

### Definition
An event is "outdated" if:
```
Event start datetime < (Current time in Europe/London - 6 hours)
```

### Time Parsing Rules

**If EVENT_TIME exists:**
- Parse time from various formats: `"19:30"`, `"14:30 / 19:30"`, `"KO - 20:00"`
- Take first time if multiple times listed
- Extract HH:MM format

**If EVENT_TIME is missing:**
- Conservative default: Assume `23:59` on EVENT_DATE
- This prevents premature pruning of events on the same day

**Examples:**

| EVENT_DATE | EVENT_TIME | Parsed DateTime | Now | Outdated? |
|------------|------------|-----------------|-----|-----------|
| 2025-12-16 | 19:30 | 2025-12-16 19:30 GMT | 2025-12-17 02:00 GMT | ✅ Yes (>6h) |
| 2025-12-16 | 19:30 | 2025-12-16 19:30 GMT | 2025-12-17 00:00 GMT | ❌ No (<6h) |
| 2025-12-16 | (missing) | 2025-12-16 23:59 GMT | 2025-12-17 06:00 GMT | ✅ Yes (>6h) |
| 2025-12-16 | (missing) | 2025-12-16 23:59 GMT | 2025-12-17 02:00 GMT | ❌ No (<6h) |

---

## Pruning Behavior

### PRE_APPROVED EVENTS (Archival)

**Action:** Remove outdated O2 events and move to ARCHIVED_EVENTS sheet.

**Process:**
1. Identify O2-sourced + outdated events
2. Remove from PRE_APPROVED EVENTS
3. Add to ARCHIVED_EVENTS with:
   - All original columns
   - `ARCHIVED_REASON = "OUTDATED_O2_EVENT"`
   - `ARCHIVED_AT = <timestamp in Europe/London>`

**ARCHIVED_EVENTS Sheet:**
- Created automatically if it doesn't exist
- Headers: All PRE_APPROVED columns + `ARCHIVED_REASON` + `ARCHIVED_AT`
- Never deleted - permanent archive

**Example:**
```
Before Prune:
PRE_APPROVED EVENTS:
- Stereophonics | 2025-12-01 | 19:30 | The O2 | SOURCE=O2

After Prune (if now > 2025-12-02 01:30):
PRE_APPROVED EVENTS:
  (row removed)

ARCHIVED_EVENTS:
- Stereophonics | 2025-12-01 | 19:30 | The O2 | SOURCE=O2 | OUTDATED_O2_EVENT | 2025-12-16 10:30:00
```

---

### PUBLIC_APPROVED (PAST Marking)

**Action:** Mark outdated O2 events as PAST (no deletion).

**Why no deletion?**
- PUBLIC_APPROVED contains staff-curated live records
- Never safe to automatically delete user-edited data
- UI can filter by PAST column

**Process:**
1. Identify O2-sourced + outdated events
2. Add/update `PAST` column
3. Set `PAST = "TRUE"` for outdated events
4. Keep all data intact

**PAST Column:**
- Added automatically if it doesn't exist
- Appended to end of sheet
- Boolean values: "TRUE" or "" (empty)

**Example:**
```
Before Prune:
PUBLIC_APPROVED:
- Stereophonics | 2025-12-01 | 19:30 | The O2 | PAST=(empty)

After Prune (if now > 2025-12-02 01:30):
PUBLIC_APPROVED:
- Stereophonics | 2025-12-01 | 19:30 | The O2 | PAST=TRUE
```

---

## Idempotency Guarantee

**Running sync multiple times will NOT:**
- Re-archive already archived events (they're removed from PRE_APPROVED)
- Re-mark already marked PAST events (PAST already = TRUE)
- Prune future events (only past events pruned)

**Test:**
```
Run 1: Archive 5 outdated events
Run 2 (immediately): Archive 0 events (same 5 already gone)
Run 3 (immediately): Archive 0 events (same 5 already gone)
```

---

## Output Statistics

The sync response now includes pruning counts:

```json
{
  "success": true,
  "scraped": 100,
  "newEvents": 95,
  "alreadyPublicApproved": 2,
  "alreadyPreApproved": 3,
  "pruneCount": 7,
  "pastCount": 2,
  "timestamp": "2025-12-16 10:30:45"
}
```

**Metrics:**
- `pruneCount` - Number of events archived from PRE_APPROVED EVENTS
- `pastCount` - Number of events marked PAST in PUBLIC_APPROVED

---

## Console Output Example

```
🔄 O2 EVENTS → GOOGLE SHEETS COMPLETE SYNC + PRUNE
======================================================================

✅ Loaded 100 scraped events
✅ Loaded PUBLIC_APPROVED sheet data
✅ Loaded PRE_APPROVED EVENTS sheet data

🔍 De-duplicating events (URL-first strategy)...
   PUBLIC_APPROVED: 5 URL keys, 10 name|date|venue keys
   PRE_APPROVED EVENTS: 20 URL keys, 50 name|date|venue keys
   ⏭️  Skipping (URL in PUBLIC_APPROVED): Stereophonics

🗑️  Pruning outdated O2 events from PRE_APPROVED:
   Found 7 outdated O2 events to archive
   1. The Script
   2. Mumford & Sons
   3. Capital's Jingle Bell Ball
   ... and 4 more

📌 Marking outdated O2 events in PUBLIC_APPROVED as PAST:
   Marked 2 events as PAST

======================================================================
📊 SYNC SUMMARY
======================================================================
   Scraped: 100 events
   New events to add: 95
   Duplicates skipped: 5
     - In PUBLIC_APPROVED: 2
     - In PRE_APPROVED: 3
   Outdated events archived from PRE_APPROVED: 7
   PUBLIC_APPROVED events marked PAST: 2

💾 Output saved to sync-output.json
   Ready to write to Google Sheets
   Spreadsheet ID: 1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU
   Sheets to update: PRE_APPROVED EVENTS, PUBLIC_APPROVED, ARCHIVED_EVENTS
```

---

## Acceptance Tests

### Test 1: Archive from PRE_APPROVED
**Setup:**
1. Add O2 event with past date to PRE_APPROVED EVENTS
   - EVENT_NAME: "Test Concert"
   - EVENT_DATE: "2025-12-01"
   - EVENT_TIME: "19:30"
   - SOURCE: "O2"

**Run:** Click "Sync O2 Events"

**Expected:**
- Event removed from PRE_APPROVED EVENTS
- Event appears in ARCHIVED_EVENTS with ARCHIVED_REASON and ARCHIVED_AT

### Test 2: Mark PAST in PUBLIC_APPROVED
**Setup:**
1. Find O2 event with past date in PUBLIC_APPROVED
   - Example: Stereophonics at The O2 on 18.12.25

**Run:** Click "Sync O2 Events" (assuming now > 19.12.25 01:30)

**Expected:**
- Event still in PUBLIC_APPROVED (not deleted)
- PAST column added (if missing)
- Event has PAST = "TRUE"

### Test 3: Idempotency
**Run:** Click "Sync O2 Events" twice in a row

**Expected:**
- First run: X events archived
- Second run: 0 events archived (same events already gone)

---

## Safety Features

1. **Conservative time parsing:** Missing EVENT_TIME defaults to 23:59
2. **6-hour grace period:** Events aren't pruned until 6 hours after start
3. **No PUBLIC_APPROVED deletion:** Only marks as PAST
4. **Clear detection criteria:** SOURCE → URL → VENUE_ID priority
5. **Permanent archive:** ARCHIVED_EVENTS never deleted
6. **Idempotent:** Safe to run multiple times

---

## Files Modified

1. `o2-sync-complete.py` - Core pruning logic
2. `o2-sync-api.py` - API response with prune stats
3. `admin-tools.html` - UI display of prune counts
4. `O2-PRUNE-FEATURE.md` - This documentation

---

## Dependencies

**New Python package required:**
```bash
pip install pytz
```

Used for Europe/London timezone handling in datetime comparisons.
