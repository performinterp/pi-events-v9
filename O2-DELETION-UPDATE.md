# O2 Sync Pipeline - Deletion Implementation Update

## Overview
The O2 sync pipeline has been updated to **delete** outdated events instead of archiving them, per the requirement that monthly operational tabs are the system of record.

**Date:** 2025-12-16
**Status:** ✅ Implementation Complete - Ready for Testing

---

## Changes from Previous Version

### Before (Archival Approach)
- PRE_APPROVED EVENTS: Archived outdated O2 events to ARCHIVED_EVENTS sheet
- PUBLIC_APPROVED: Marked outdated O2 events with PAST = TRUE

### After (Deletion Approach)
- PRE_APPROVED EVENTS: **Deletes** outdated O2-sourced events only
- PUBLIC_APPROVED: **Deletes ALL** outdated events (regardless of source)
- No archiving - events are removed outright

---

## Critical Business Logic

### PRE_APPROVED EVENTS
**Deletion Rule:** Only delete O2-sourced outdated events

**Why this rule?**
- PRE_APPROVED EVENTS is an automation/staging sheet
- Non-O2 events may come from other sources (manual entry, other scrapers)
- Only delete events we created via O2 scraper

**Detection Priority:**
1. SOURCE = "O2" ✅
2. EVENT_URL contains "theo2.co.uk" ✅
3. VENUE_ID starts with "o2-" ✅

### PUBLIC_APPROVED
**Deletion Rule:** Delete ALL outdated events (any source)

**Why this rule?**
- PUBLIC_APPROVED is the customer-facing event feed
- All past events should be removed regardless of source
- Keeps the feed current and relevant

### Monthly Operational Tabs
**Rule:** NEVER MODIFIED

**Why?**
- Monthly tabs (December 2025, January 2026, etc.) are operational records
- They represent the historical system of record
- Only PRE_APPROVED and PUBLIC_APPROVED are safe to delete from

---

## Files Modified

### 1. `o2-sync-complete.py`

**Updated Functions:**

#### `prune_pre_approved_events()` (lines 446-484)
```python
def prune_pre_approved_events(
    pre_approved_data: List[List[str]]
) -> Tuple[List[List[str]], int]:
    """
    Delete outdated O2-sourced events from PRE_APPROVED EVENTS
    Only removes O2-sourced events, leaves other events untouched
    Returns: (cleaned_data, count_deleted)
    """
```

**Key Changes:**
- Returns `(cleaned_data, deleted_count)` instead of `(cleaned_data, archived_rows, count)`
- Deletes rows directly instead of copying to archive
- Only deletes O2-sourced events (`is_o2_sourced_event() and is_event_outdated()`)

#### `prune_public_approved_events()` (lines 487-530)
**NEW function** (replaces `mark_public_approved_past()`)

```python
def prune_public_approved_events(
    public_approved_data: List[List[str]]
) -> Tuple[List[List[str]], int]:
    """
    Delete ALL outdated events from PUBLIC_APPROVED (regardless of source)
    PUBLIC_APPROVED is a customer-facing feed - safe to delete past events
    Returns: (cleaned_data, count_deleted)
    """
```

**Key Changes:**
- Deletes ALL outdated events (not just O2)
- No PAST column marking
- Returns `(cleaned_data, deleted_count)`

#### `main()` (lines 564-651)

**Updated orchestration:**
```python
# STEP 2: Delete outdated O2 events from PRE_APPROVED EVENTS
cleaned_pre_approved, deleted_pre_count = prune_pre_approved_events(pre_approved_data)

# STEP 3: Delete ALL outdated events from PUBLIC_APPROVED
cleaned_public_approved, deleted_pub_count = prune_public_approved_events(public_approved_data)
```

**Output JSON changes:**
```python
output = {
    'new_events': new_events,
    'rows': rows,
    'stats': {
        **dedupe_stats,
        'deleted_pre_count': deleted_pre_count,  # ← Changed from prune_count
        'deleted_pub_count': deleted_pub_count   # ← Changed from past_count
    },
    'cleaned_pre_approved': cleaned_pre_approved,
    'cleaned_public_approved': cleaned_public_approved  # ← Changed from updated_public_approved
}
# Removed: 'archived_data' field
```

**Console output:**
```
📊 SYNC SUMMARY
======================================================================
   Scraped: 100 events
   New events to add: 95
   Duplicates skipped: 5
     - In PUBLIC_APPROVED: 2
     - In PRE_APPROVED: 3
   Outdated O2 events deleted from PRE_APPROVED: 7    # ← Changed from "archived"
   Outdated events deleted from PUBLIC_APPROVED: 2    # ← Changed from "marked PAST"
```

---

### 2. `o2-sync-api.py`

**Updated `parse_sync_output()` function (lines 77-137):**

**Changed stats dictionary:**
```python
stats = {
    'total_scraped': 0,
    'already_public_approved': 0,
    'already_pre_approved': 0,
    'new_events_added': 0,
    'deleted_pre_count': 0,    # ← Changed from prune_count
    'deleted_pub_count': 0,    # ← Changed from past_count
    'range_written': ''
}
# Removed: archived_data field
```

**Updated parsing logic:**
```python
elif 'deleted from pre_approved:' in line_lower or 'o2 events deleted from pre_approved:' in line_lower:
    stats['deleted_pre_count'] = int(numbers[0])

elif 'deleted from public_approved:' in line_lower or 'events deleted from public_approved:' in line_lower:
    stats['deleted_pub_count'] = int(numbers[0])
```

**API Response (lines 201-230):**
```json
{
  "success": true,
  "scraped": 100,
  "newEvents": 95,
  "alreadyPublicApproved": 2,
  "alreadyPreApproved": 3,
  "deletedPreCount": 7,      // ← Changed from pruneCount
  "deletedPubCount": 2,      // ← Changed from pastCount
  "range": "A2:N96",
  "added": 95,
  "skipped": 5,
  "timestamp": "2025-12-16 10:30:45"
}
```

---

### 3. `admin-tools.html`

**Updated Button Description (line 204):**
```html
Scrape The O2 upcoming events, add new ones to PRE-APPROVED EVENTS,
and delete outdated events (>6h past).
```
*Changed from: "and prune outdated O2 events"*

**Updated Documentation Panel (lines 229-239):**
```html
<li>Deletion: Removes outdated O2 events (>6h past) from PRE_APPROVED EVENTS</li>
<li>Deletion: Removes ALL outdated events (>6h past) from PUBLIC_APPROVED</li>
<li>Note: Monthly operational tabs are NEVER modified</li>
```
*Changed from: "Pruning" and "Archival" bullets*

**Updated JavaScript (lines 274-310):**

**Extract deletion counts:**
```javascript
const {
    scraped = 0,
    newEvents = 0,
    alreadyPublicApproved = 0,
    alreadyPreApproved = 0,
    deletedPreCount = 0,    // ← Changed from pruneCount
    deletedPubCount = 0,    // ← Changed from pastCount
    range = '',
    timestamp = ''
} = result;
```

**Success message:**
```javascript
let successMsg = `✅ O2 sync complete: ${scraped} scraped, ${newEvents} added to PRE_APPROVED`;
if (totalSkipped > 0) {
    successMsg += `, ${totalSkipped} duplicates skipped`;
}
if (totalDeleted > 0) {
    successMsg += `, ${totalDeleted} outdated deleted`;
    if (deletedPreCount > 0 && deletedPubCount > 0) {
        successMsg += ` (${deletedPreCount} from PRE, ${deletedPubCount} from PUBLIC)`;
    }
}
```

**Example outputs:**
- `✅ O2 sync complete: 100 scraped, 95 added to PRE_APPROVED, 5 duplicates skipped, 7 outdated deleted (5 from PRE, 2 from PUBLIC)`
- `Last sync: 2025-12-16 10:30:45 - 95 new, 7 deleted`

---

## Testing Plan

### Test 1: PRE_APPROVED - O2 Event Deletion
**Setup:**
1. Add a past-dated O2 event to PRE_APPROVED EVENTS manually
   - EVENT_NAME: "Test O2 Concert"
   - EVENT_DATE: "2025-12-01"
   - EVENT_TIME: "19:30"
   - SOURCE: "O2"

**Run:** Click "Sync O2 Events" button

**Expected:**
- ✅ Event is deleted from PRE_APPROVED EVENTS
- ✅ Console shows: "Outdated O2 events deleted from PRE_APPROVED: 1"
- ✅ UI shows: "1 outdated deleted"

---

### Test 2: PRE_APPROVED - Non-O2 Event Preserved
**Setup:**
1. Add a past-dated non-O2 event to PRE_APPROVED EVENTS manually
   - EVENT_NAME: "Test Non-O2 Event"
   - EVENT_DATE: "2025-12-01"
   - EVENT_TIME: "19:30"
   - SOURCE: "Manual" (or any non-O2 source)

**Run:** Click "Sync O2 Events" button

**Expected:**
- ✅ Event is NOT deleted (still in PRE_APPROVED EVENTS)
- ✅ Console shows: "Outdated O2 events deleted from PRE_APPROVED: 0"
- ❌ Event should remain because it's not O2-sourced

---

### Test 3: PUBLIC_APPROVED - All Outdated Events Deleted
**Setup:**
1. Find or add past-dated events in PUBLIC_APPROVED (any source)
   - Could be O2 events or non-O2 events
   - Ensure EVENT_DATE is >6 hours in the past

**Run:** Click "Sync O2 Events" button

**Expected:**
- ✅ ALL past-dated events are deleted from PUBLIC_APPROVED
- ✅ Console shows: "Outdated events deleted from PUBLIC_APPROVED: X"
- ✅ UI shows deletion count

---

### Test 4: Idempotency
**Run:** Click "Sync O2 Events" twice in a row

**Expected:**
- First run: X events deleted
- Second run: 0 events deleted (same events already gone)
- No errors

---

### Test 5: Future Events Preserved
**Setup:**
1. Add future O2 event to PRE_APPROVED EVENTS
   - EVENT_DATE: Tomorrow or later
   - SOURCE: "O2"

**Run:** Click "Sync O2 Events" button

**Expected:**
- ✅ Event is NOT deleted (still in PRE_APPROVED EVENTS)
- ✅ Future events are never pruned

---

## Safety Features

1. ✅ **Conservative time parsing** - Missing EVENT_TIME defaults to 23:59
2. ✅ **6-hour grace period** - Events aren't deleted until 6 hours after start
3. ✅ **Selective PRE_APPROVED deletion** - Only O2-sourced events deleted
4. ✅ **Complete PUBLIC_APPROVED deletion** - All outdated events removed
5. ✅ **Clear detection criteria** - SOURCE → URL → VENUE_ID priority
6. ✅ **Idempotent** - Safe to run multiple times
7. ✅ **Monthly tabs untouched** - Operational records never modified

---

## Migration Notes

### No Data Migration Required
- No existing data needs to be migrated
- ARCHIVED_EVENTS sheet (if it exists) can be kept or deleted - it's no longer used
- Next sync will start using deletion approach immediately

### PAST Column
- The PAST column in PUBLIC_APPROVED (if it exists) is no longer used
- It will not be updated or removed by the sync
- Can be manually removed if desired

---

## Dependencies

**Existing (no changes):**
```bash
pip install pytz
```

**All existing dependencies remain the same.**

---

## Rollback Plan

If deletion approach needs to be reverted to archival:

1. Restore `o2-sync-complete.py` from git history (before this update)
2. Restore `o2-sync-api.py` from git history
3. Restore `admin-tools.html` from git history
4. Archived events would need to be manually restored from ARCHIVED_EVENTS sheet (if kept)

---

## Status

**Implementation:** ✅ Complete
**Documentation:** ✅ Complete
**Testing:** ⏳ Ready for acceptance tests
**Deployment:** ⏳ Ready for production use

---

## Next Steps

1. **Test all scenarios** listed above
2. **Verify deletion behavior** matches requirements
3. **Run in production** and monitor first sync
4. **Update O2-PRUNE-FEATURE.md** if needed (currently describes archival approach)
5. **Consider creating backup** of sheets before first deletion-based sync

---

## Questions or Issues?

Contact: James
Date: 2025-12-16
