# O2 Events Scraper - Technical Documentation

## Overview

Automated pipeline that scrapes The O2 Arena events, de-duplicates against existing sheets, and syncs new events to the PRE-APPROVED EVENTS tab with "Interpreter Available On Request" status.

## Pipeline Components

### 1. Scraper (`o2-scraper-enhanced.py`)

**URL Scraped:**
- https://www.theo2.co.uk/events

**Scraping Strategy:**
- Uses Playwright (headless Chromium) for JavaScript-rendered content
- Handles cookie consent dialogs automatically
- Clicks "Load More" button up to 50 times to load all events
- Extracts from both JSON-LD structured data and HTML event cards

**Fields Extracted:**
| Field | Source | Notes |
|-------|--------|-------|
| EVENT_NAME | JSON-LD / HTML | Event title |
| ARTIST_NAME | JSON-LD performer | Often empty for O2 events |
| VENUE_NAME | Normalized | "The O2 Arena, London" or "indigo at The O2, London" |
| CITY | Hardcoded | "London" |
| COUNTRY | Hardcoded | "UK" |
| EVENT_DATE | JSON-LD / HTML / Fallback | YYYY-MM-DD format, 100% coverage |
| EVENT_TIME | JSON-LD / HTML | HH:MM format (may be empty) |
| EVENT_URL | JSON-LD / HTML | Full https://www.theo2.co.uk/events/detail/... URL |
| IMAGE_URL | JSON-LD / HTML | Event poster image |
| ACCESS_STATUS | Hardcoded | "Request Interpreter" |
| CATEGORY | Inferred | Concert, Theatre, Sports, Comedy, Family |
| SOURCE | Hardcoded | "O2 Auto Import" |
| NOTES | Hardcoded | "PI has agreement with The O2 – interpreters on request, not automatically booked." |
| ADDED_DATE | Generated | Timestamp of scrape |

**Date Extraction (3-tier fallback):**
1. **JSON-LD structured data** (5 events) - ISO datetime format
2. **HTML event cards** (129 events) - Parsed from nested `<span>` elements
3. **Individual page fetch** (1 event) - For stubborn missing dates

**Result:** 135/135 events with dates (100% coverage)

### 2. De-duplication (`o2-sync-complete.py`)

**Sheets Checked:**
- `CURATED` - Main events sheet with BSL confirmed events
- `PRE-APPROVED EVENTS` - Auto-imported events awaiting review

**Matching Logic:**

Creates normalized event keys using:
```python
key = f"{name.lower()}|{normalized_date}|{normalized_venue}"
```

**Date Normalization:**
- Converts "06.12.25" → "2025-12-06"
- Converts "06/12/25" → "2025-12-06"
- Already normalized: "2025-12-06" → "2025-12-06"

**Venue Normalization:**
- Removes ", London" suffix
- Normalizes "The O2 Arena" / "O2 Arena" → "the o2"
- Normalizes "indigo at The O2" → "indigo at the o2"

**Additional Check:**
- Also compares by EVENT_URL if present

**Output:**
- New events (not in CURATED or PRE-APPROVED EVENTS)
- Skip counts for each sheet
- Handles multiple runs safely (idempotent)

### 3. Sheets Sync

**Target Sheet:**
- Spreadsheet ID: `1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8`
- Sheet name: `PRE-APPROVED EVENTS`

**Column Mapping:**
```
A: EVENT_NAME
B: ARTIST_NAME
C: VENUE_NAME
D: CITY
E: COUNTRY
F: EVENT_DATE
G: EVENT_TIME
H: EVENT_URL
I: IMAGE_URL
J: ACCESS_STATUS
K: CATEGORY
L: SOURCE
M: NOTES
N: ADDED_DATE
```

**Write Strategy:**
- Appends only (never overwrites existing rows)
- Uses batch updates for efficiency
- Row 1: Headers
- Rows 2+: Event data

## O2 Partnership Agreement

**Access Status:** "Request Interpreter"

**Important Notes:**
- PI has a special agreement with The O2
- Interpreters are **NOT** automatically booked
- BSL must be requested on a per-event basis
- These events are marked as PRE-APPROVED, not CONFIRMED
- Never auto-promote to CURATED without explicit confirmation

## HTML Structure Notes

**Event Cards CSS Selector:**
```css
.m-event-item
```

**Date Structure:**
```html
<div class="date divider-date">
  <span class="m-date__singleDate">  <!-- or m-date__rangeFirst for ranges -->
    <span class="m-date__day">9</span>
    <span class="m-date__month">Dec</span>
    <span class="m-date__year">2025</span>  <!-- May be in m-date__rangeLast for ranges -->
  </span>
</div>
```

**JSON-LD Location:**
```html
<script type="application/ld+json">
{
  "@type": "MusicEvent",
  "name": "Event Name",
  "startDate": "2025-12-09T19:00:00Z",
  "location": { "name": "The O2 Arena" },
  "url": "/events/detail/event-slug"
}
</script>
```

## Limitations and Assumptions

### Limitations:
1. **Date Ranges:** Takes first date only (e.g., "9 Dec - 14 Dec" → "9 Dec")
2. **Artist Names:** Often empty for O2 events (not always in structured data)
3. **Event Times:** Not always available (some events don't list specific times)
4. **Scraping Frequency:** Not automated - must be triggered manually via UI button
5. **Access Verification:** Does not verify actual BSL availability, relies on O2 agreement

### Assumptions:
1. All O2 events qualify for "on request" interpreter access
2. Venue names normalize to "The O2 Arena, London" or "indigo at The O2, London"
3. Events at other O2 venues (e.g., O2 Academy Brixton) are excluded
4. The O2 agreement remains valid and unchanged

## Edge Cases Handled

1. **Missing Dates:** Fallback to individual page fetch
2. **Date Ranges:** Extract first date from range
3. **2-Digit Years:** Assume 20XX (e.g., "25" → "2025")
4. **Duplicate Runs:** De-dupe prevents duplicate insertions
5. **Cookie Consent:** Automated dismissal before scraping
6. **Dynamic Content:** "Load More" automation to get all events

## Initial Import Statistics

**First Run (2025-12-05):**
- Total events scraped: 135
- Date coverage: 135/135 (100%)
- Already in CURATED: 2 (Jamiroquai, Stereophonics)
- New events added: 133
- Rows written: A2:N134

**Date Sources:**
- JSON-LD: 5 events
- HTML: 129 events
- Fallback (individual pages): 1 event

## Future Maintenance

### Regular Tasks:
- Run scraper monthly to catch new O2 events
- Review PRE-APPROVED EVENTS periodically
- Promote confirmed events to CURATED manually

### Updates Needed If:
- O2 website structure changes (update CSS selectors)
- O2 agreement changes (update ACCESS_STATUS text)
- New O2 venues added (update venue normalization)

## Files

| File | Purpose |
|------|---------|
| `o2-scraper-enhanced.py` | Main scraper with Playwright |
| `o2-sync-complete.py` | De-dupe and sync orchestration |
| `o2-events-all.json` | Scraped events output (135 events) |
| `O2-SCRAPER-NOTES.md` | This documentation |

## API Integration

### Sync API Server (`o2-sync-api.py`)

**Endpoint:** `POST http://localhost:5001/api/sync-o2-events`

**Purpose:** Executes complete pipeline via HTTP API call from admin UI

**Request:** No body required (POST with empty body)

**Response Schema:**
```json
{
  "success": true,
  "scraped": 135,
  "newEvents": 133,
  "alreadyCurated": 2,
  "alreadyPreApproved": 0,
  "range": "A2:N134",
  "added": 133,
  "skipped": 2,
  "timestamp": "2025-12-05 12:30:45"
}
```

**Error Response Schema:**
```json
{
  "success": false,
  "error": "Scraper failed: [error message]",
  "step": "scrape|sync",
  "timestamp": "2025-12-05 12:30:45"
}
```

**Starting the API Server:**
```bash
./start-o2-api.sh
# or
python3 o2-sync-api.py
```

**Admin UI Location:**
- URL: `http://localhost:8000/admin-tools.html`
- Button: "🔄 Sync O2 Events"
- States: Syncing... | Success | Error

**Dependencies:**
- Flask 3.0.0
- Flask-CORS 4.0.0
- Install: `pip3 install -r requirements-o2-api.txt`

**Error Handling:**
- Script not found: Returns 500 with error details
- Timeout (5 min): Returns 500 with timeout message
- Scraper fails: Captures stderr, returns error at 'scrape' step
- Sync fails: Captures stderr, returns error at 'sync' step
- API server down: UI shows "Cannot connect to API server" message

---

## Quick Reference Commands

**Option 1: Use Admin UI (Recommended)**
1. Start API server: `./start-o2-api.sh`
2. Open browser: `http://localhost:8000/admin-tools.html`
3. Click: "🔄 Sync O2 Events"

**Option 2: Run Full Pipeline Manually**
```bash
# 1. Scrape O2 events
python3 o2-scraper-enhanced.py

# 2. Sync to sheets (with de-dupe)
python3 o2-sync-complete.py

# Output: o2-events-all.json (scraped data)
```

**Option 3: Trigger via API**
```bash
curl -X POST http://localhost:5001/api/sync-o2-events
```
