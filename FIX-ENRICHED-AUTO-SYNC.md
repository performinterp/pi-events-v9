# 🔧 Fix: ENRICHED Sheet Not Syncing with RAW_DATA

## Problem Found:

**RAW_DATA has ~85+ events, but ENRICHED only has 53 events.**

**Why:** ENRICHED doesn't automatically pull from RAW_DATA - someone was manually copying events over, and 32 events got missed!

---

## Solution: Auto-Sync ENRICHED from RAW_DATA

We need to change ENRICHED to automatically import ALL events from RAW_DATA.

### Option 1: Formula in Column A (Simplest)

**Steps:**

1. Open: https://docs.google.com/spreadsheets/d/1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8/edit

2. Go to **ENRICHED** tab

3. **⚠️ BACKUP FIRST:**
   - Select all current data (A1:K55)
   - Copy and paste into a new sheet called "ENRICHED_BACKUP"

4. **Clear ENRICHED data:**
   - Select rows 2-999 (NOT the header row 1)
   - Right-click → Delete rows OR clear content

5. **Add formula in cell A2:**
   ```
   =ARRAYFORMULA(IF(LEN(RAW_DATA!A2:A), RAW_DATA!A2:E, ))
   ```

6. This will auto-populate columns A-E (DATE, EVENT, VENUE, TIME, INTERPRETERS) from RAW_DATA

7. **Keep columns F-K empty** - the Apps Script will fill these:
   - F = INTERPRETATION
   - G = CATEGORY
   - H = IMAGE URL
   - I = TICKET LINK
   - J = STATUS
   - K = LINK_CONFIDENCE

---

### Option 2: Apps Script Auto-Copy (Current Method Enhanced)

Instead of changing ENRICHED to a formula, modify the Apps Script to:
1. Check RAW_DATA for new events
2. Auto-copy them to ENRICHED if not already there
3. Then enrich them

**This requires updating the Apps Script** - I can write this if you prefer.

---

## ⚠️ Issue with Manual Wembley Events

You mentioned:
> "There's a load of Wembley events placed down in PUBLIC_APPROVED that need to be on the events app"

**Problem:** Those events aren't in the monthly tabs, so they WON'T flow through the normal workflow.

**Solutions:**

### Solution A: Add to Monthly Tabs (Recommended)
- Add these Wembley events to the appropriate monthly tabs (July, August, September 2026)
- Mark them "Yes" in column I
- They'll flow through automatically

### Solution B: Manual Entry in ENRICHED
- Keep them at the bottom of PUBLIC_APPROVED
- Manually copy them to ENRICHED
- Run enrichment
- They'll appear on the app

### Solution C: Direct Entry in ENRICHED (Fastest for Now)
- Directly type/paste the Wembley events into ENRICHED
- Fill in: Date, Event, Venue, Time, Interpreters
- Leave other columns blank
- Run enrichment
- Done!

---

## Recommended Immediate Action:

**For the Wembley events (fastest):**

1. Scroll down in PUBLIC_APPROVED to find the Wembley events
2. Copy them (Date, Event, Venue, Time, Interpreters)
3. Go to ENRICHED tab
4. Paste at the bottom (row 55+)
5. Run: **🎭 Event Automation** → **✨ Enrich All Pending Events**
6. They'll get enriched and added to PUBLISHED

**For the missing 32 events from RAW_DATA:**

1. Compare RAW_DATA to ENRICHED
2. Copy missing events to ENRICHED
3. Run enrichment

**OR use Option 1 above to auto-sync** (better long-term solution)

---

## Which Do You Prefer?

**Quick fix (5 mins):** Manually copy missing events + Wembley events to ENRICHED, run enrichment

**Permanent fix (15 mins):** Set up ENRICHED to auto-pull from RAW_DATA with formula

Let me know which approach you want and I'll guide you through it!
