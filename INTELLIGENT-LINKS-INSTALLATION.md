# 🎯 Intelligent Link Finder - Installation Guide

This guide will help you install the enhanced Apps Script that automatically finds specific event ticket URLs with confidence scoring and email notifications.

---

## ✨ What This Script Does

### Intelligent Features:

1. **Smart URL Detection:**
   - Tries venue-specific URL patterns first (Arsenal, O2, Southbank, etc.)
   - Verifies URLs actually exist (checks for 404 errors)
   - Falls back gracefully to venue homepage if specific page not found

2. **Confidence Scoring:**
   - ✅ **HIGH** (70-100%): Specific event page found and verified
   - 🔍 **MEDIUM** (40-70%): Found via search but unverified
   - ⚠️ **LOW** (0-40%): Fallback to venue homepage

3. **Automatic Notifications:**
   - Emails you when events have LOW/MEDIUM confidence
   - Lists all events needing manual review
   - HTML formatted for easy reading

4. **Status Tracking:**
   - "Ready" = High confidence, good to publish
   - "Review Links" = Needs your manual check
   - New "LINK_CONFIDENCE" column shows the score

---

## 📋 Installation Steps

### Step 1: Open Your Google Sheet

1. Open the **Public Events Feed** spreadsheet:
   https://docs.google.com/spreadsheets/d/1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8/edit

2. Go to **Extensions** → **Apps Script**

### Step 2: Replace the Script

1. You'll see the existing script in the editor
2. **Select ALL the code** (Cmd+A / Ctrl+A)
3. **Delete it**
4. **Copy the entire contents** of `apps-script-intelligent-links.js`
5. **Paste** into the Apps Script editor
6. Click **💾 Save** (or Cmd+S / Ctrl+S)
7. Name the project: **"PI Events Intelligent Enrichment"**

### Step 3: Update Your Email Address

1. At the top of the script, find this line:
   ```javascript
   notificationEmail: 'james@performanceinterpreting.co.uk',
   ```

2. Change it to YOUR email address if different

3. Save again (Cmd+S / Ctrl+S)

### Step 4: Add the LINK_CONFIDENCE Column

1. Go back to your **ENRICHED** sheet
2. The current columns are: A-J (DATE through STATUS)
3. **Click on column K** (the empty column after STATUS)
4. Right-click the column header → **Insert 1 column left** (if needed)
5. In cell **K1**, type: `LINK_CONFIDENCE`
6. This column will automatically populate with confidence scores

### Step 5: Authorize the Script

1. In Apps Script editor, click **▶️ Run** button
2. Select function: `enrichAllPendingEvents`
3. Click **Run**
4. You'll see a popup: **"Authorization required"**
5. Click **Review Permissions**
6. Choose your Google account
7. Click **Advanced** → **Go to PI Events Intelligent Enrichment (unsafe)**
   - (Don't worry - this is YOUR script, it's safe!)
8. Click **Allow**

The script now has permission to:
- Read/write your spreadsheet
- Fetch URLs from the internet
- Send emails on your behalf

### Step 6: Test It!

1. Go back to your spreadsheet
2. You should now see a new menu: **🎭 Event Automation**
3. Click: **🎭 Event Automation** → **🧪 Test Link Finder**
4. You'll see test results for sample events
5. Check if URLs look correct

---

## 🚀 How to Use

### Normal Workflow:

1. Staff marks events with "Yes" in monthly tabs
2. Events automatically appear in ENRICHED sheet via IMPORTRANGE
3. **You run:** 🎭 Event Automation → **✨ Enrich All Pending Events**
4. Script processes all events without STATUS
5. Adds:
   - Interpretation (BSL/ISL)
   - Category
   - **Specific ticket URL** (with confidence check)
   - Confidence score in LINK_CONFIDENCE column
   - STATUS: "Ready" or "Review Links"
6. Copies to PUBLISHED (only future events marked Ready or Review Links)
7. **You receive email** if any events need manual review

### Check Events Needing Review:

Use menu: **🎭 Event Automation** → **📧 Review Events Needing Manual Links**

This shows you all events with LOW/MEDIUM confidence that need your attention.

### Manual Override:

If you need to manually fix a link:
1. Find the event in ENRICHED sheet
2. Edit the TICKET_LINK column (column I)
3. Change STATUS to "Ready" (column J)
4. Run: **🎭 Event Automation** → **🔄 Update Single Event** (with that row selected)
5. Or just re-run **✨ Enrich All Pending Events**

---

## 🎯 Venue-Specific Patterns

The script knows these venues and builds specific URLs:

### High Confidence Venues:

- **Arsenal (Emirates Stadium)**
  - Women's: `arsenal.com/tickets/women/2025-Nov-08/chelsea-women`
  - Men's: `arsenal.com/tickets/arsenal/2025-Nov-23/tottenham-hotspur`

- **The O2 Arena, London**
  - Format: `theo2.co.uk/events/detail/radiohead`

- **Southbank Centre**
  - Format: `southbankcentre.co.uk/whats-on/event-name`

- **Royal Albert Hall**
  - Format: `royalalberthall.com/tickets/events/2025-Dec-07/my-christmas-orchestral-adventure`

- **O2 Academy (all locations)**
  - Format: `academymusicgroup.com/o2academybrixton/events/event-name`

- **Eventim Apollo**
  - Format: `eventimapollo.com/events/event-name`

### Fallback Venues (Medium/Low Confidence):

- AO Arena Manchester
- Utilita Arena Birmingham
- First Direct Arena Leeds
- OVO Hydro Glasgow
- And more...

If a venue isn't recognized, it defaults to a Google search link.

---

## 📧 Email Notifications

### What You'll Receive:

When events need review, you get an HTML email like this:

```
Subject: ⚠️ 3 PI Events Need Link Review

🔍 PI Events - Manual Link Review Needed

3 event(s) need manual review for ticket links:

Event                     | Venue              | Current URL                  | Confidence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gladiators Live Tour     | Liverpool Arena    | mandsbankarena.com/whats-on | ⚠️ LOW
James Marriott           | Liverpool Uni      | google.com/search?q=...     | ⚠️ LOW
Baxter Dury              | Eventim Apollo     | eventimapollo.com/events/... | 🔍 MEDIUM

Action needed: Review these events and manually update TICKET_LINK column if needed.
```

### Turn Off Notifications:

If you don't want emails, change this line in the script:
```javascript
enableEmailNotifications: false
```

---

## 🔧 Troubleshooting

### "Script timeout" error:

If you have many events (50+), the script might timeout. Solution:
1. Run enrichment in batches
2. Or increase the sleep time: `Utilities.sleep(3000);` (line with rate limiting)

### URLs coming back as 404:

This is normal! The script detects this and marks confidence as LOW. You'll get notified to fix manually.

### Events not appearing in PUBLISHED:

Check:
1. STATUS column = "Ready" or "Review Links"
2. Date is in the future (not past)
3. ENRICHED sheet has the event

### Not receiving emails:

Check:
1. `CONFIG.enableEmailNotifications` is `true`
2. Your email address is correct in CONFIG
3. Check spam folder
4. Make sure you authorized the script for email permissions

---

## 🎨 Confidence Column Colors (Optional Enhancement)

Want to color-code the confidence column? Add this:

1. Select the entire **LINK_CONFIDENCE** column (K:K)
2. **Format** → **Conditional formatting**
3. Add rules:
   - Text contains "HIGH" → Green background
   - Text contains "MEDIUM" → Yellow background
   - Text contains "LOW" → Red background

---

## 📊 Understanding the Workflow

```
Staff marks "Yes" in monthly tab
         ↓
PUBLIC_APPROVED (automatic QUERY)
         ↓
RAW_DATA (automatic IMPORTRANGE)
         ↓
[YOU RUN: ✨ Enrich All Pending Events]
         ↓
ENRICHED sheet gets:
  - Interpretation ✓
  - Category ✓
  - Smart URL with confidence ✓
  - Image URL (future enhancement)
  - STATUS: Ready or Review Links
  - LINK_CONFIDENCE: HIGH/MEDIUM/LOW
         ↓
[Script emails you if LOW/MEDIUM confidence]
         ↓
[You manually fix low-confidence URLs]
         ↓
PUBLISHED (automatic copy, future events only)
         ↓
CSV export (gid=57149695)
         ↓
PWA app fetches and displays
```

---

## 🚀 Next Steps

1. ✅ Install the script (follow steps above)
2. ✅ Test with existing events in ENRICHED
3. ✅ Check your email for notifications
4. ✅ Manually review any LOW confidence events
5. ✅ Run enrichment regularly (or set up a time-based trigger)

---

## 🔄 Setting Up Automatic Triggers (Optional)

Want the script to run automatically?

1. In Apps Script editor, click **⏰ Triggers** (clock icon on left)
2. Click **+ Add Trigger**
3. Settings:
   - Function: `enrichAllPendingEvents`
   - Event source: **Time-driven**
   - Type: **Hour timer**
   - Interval: **Every hour** (or your preference)
4. Click **Save**

Now events get enriched automatically every hour!

**Warning:** This will send you hourly emails if events need review. Consider:
- Running it less frequently (daily at 9am)
- Or keeping it manual until you're comfortable

---

## 📞 Support

If something isn't working:
1. Check the **Execution log** in Apps Script (View → Logs)
2. Look for error messages
3. Check that ENRICHED sheet column structure matches (A-K)
4. Make sure IMPORTRANGE is working (RAW_DATA populated)

---

## 🎉 You're Done!

Your event enrichment is now intelligent and will save you tons of time finding specific ticket links!

**Test it out:** Run enrichment on a few events and see the confidence scores appear!
