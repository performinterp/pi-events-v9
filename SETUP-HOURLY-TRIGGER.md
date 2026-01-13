# ⏰ Setup Hourly Automatic Enrichment

This guide will set up automatic event enrichment every hour.

---

## 📋 Steps to Enable Hourly Automation

### Step 1: Open Apps Script Triggers

1. Open your **Public Events Feed** spreadsheet:
   https://docs.google.com/spreadsheets/d/1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8/edit

2. Go to **Extensions** → **Apps Script**

3. In the Apps Script editor, click the **⏰ Triggers** icon on the left sidebar
   - (It looks like a clock)

### Step 2: Create New Trigger

1. Click **+ Add Trigger** (bottom right)

2. Configure the trigger:

   **Choose which function to run:**
   - Select: `enrichAllPendingEvents`

   **Choose which deployment should run:**
   - Select: `Head`

   **Select event source:**
   - Select: `Time-driven`

   **Select type of time based trigger:**
   - Select: `Hour timer`

   **Select hour interval:**
   - Select: `Every hour`

   **Failure notification settings:**
   - Select: `Notify me immediately` (so you know if something breaks)

3. Click **Save**

4. You may need to authorize again - click **Allow**

### Step 3: Confirm Trigger is Active

You should now see your trigger in the list:

```
Function: enrichAllPendingEvents
Event: Time-driven, Every hour
```

---

## ✅ What This Does

Every hour, the script will:

1. ✅ Check ENRICHED sheet for events without STATUS
2. ✅ Add interpretation (BSL/ISL)
3. ✅ Add category
4. ✅ Find specific ticket URLs with confidence scoring
5. ✅ Mark as "Ready" or "Review Links"
6. ✅ Copy to PUBLISHED (only future events)
7. ✅ Email you (admin@performanceinterpreting.co.uk) if any events need manual review

---

## 📧 Email Notifications

You'll receive an email when:
- ⚠️ Events have LOW or MEDIUM confidence ticket links
- ❌ The script encounters an error

**Email will look like:**

```
Subject: ⚠️ 2 PI Events Need Link Review

🔍 PI Events - Manual Link Review Needed

2 event(s) need manual review for ticket links:

Event                 | Venue             | Current URL              | Confidence
James Marriott        | Liverpool Uni     | google.com/search?q=...  | ⚠️ LOW
Unknown Artist Show   | Small Venue       | smallvenue.com/events    | 🔍 MEDIUM
```

---

## 🔧 Managing the Trigger

### View Execution History:

1. In Apps Script editor, click **⏰ Triggers** (left sidebar)
2. Your trigger shows when it last ran and next run time
3. Click **Executions** (left sidebar) to see detailed logs

### Pause the Trigger:

1. Go to **⏰ Triggers**
2. Click the **⋮** (three dots) next to your trigger
3. Select **Delete trigger**
4. (You can always recreate it later)

### Change Frequency:

Want to run less often?
1. Delete the existing trigger
2. Create a new one with different settings:
   - **Day timer** → **Every day at 9am** (once daily)
   - **Week timer** → **Every Monday 9am** (once weekly)

---

## 🎯 Recommended Settings

**For Production (Now → Thursday):**
- Run: **Every hour**
- Why: Ensures events are always up-to-date for app store launch
- Notifications: **Enabled**

**After App Launch (Ongoing):**
- Consider changing to: **Every day at 9am**
- Why: Less frequent emails, still keeps events current
- Notifications: **Keep enabled** to catch issues

---

## 🐛 Troubleshooting

### "Script timeout" Error in Emails:

If you get timeout errors:
1. You have too many events to process in one run
2. Solution: Manually run enrichment in batches
3. Or increase the sleep time in the script (currently 2 seconds)

### Not Receiving Emails:

Check:
1. Spam folder
2. Email address is correct: `admin@performanceinterpreting.co.uk`
3. Script has email permissions (re-authorize if needed)

### Trigger Not Running:

1. Check **Executions** log for errors
2. Make sure trigger is still listed in **⏰ Triggers**
3. Try running manually: **🎭 Event Automation** → **✨ Enrich All Pending Events**

---

## 📊 Monitoring

Good practice:
- Check your email once a day for notifications
- Review **ENRICHED** sheet weekly for any stuck events
- Run **📧 Review Events Needing Manual Links** from menu to see summary

---

## ✅ You're All Set!

Your automation will now:
- ✅ Run every hour automatically
- ✅ Process new events as staff marks them "Yes"
- ✅ Email you when manual attention needed
- ✅ Keep PUBLISHED sheet always current
- ✅ Keep your PWA app always up-to-date

No more manual work unless you get an email! 🎉
