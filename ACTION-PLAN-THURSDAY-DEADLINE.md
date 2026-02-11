# 🎯 PI Events App - Action Plan for Thursday Deadline

**Goal:** Get app downloadable from App Stores by next Thursday (Dec 11, 2025)

**Current Date:** Tuesday, Dec 3, 2025 (8 days remaining)

---

## ✅ What's DONE (Backend is Watertight!)

### Complete & Working:
- ✅ Staff workflow (monthly tabs + "Yes" column)
- ✅ PUBLIC_APPROVED auto-query (pulls "Yes" events)
- ✅ RAW_DATA IMPORTRANGE (automatic)
- ✅ **Intelligent Apps Script installed** (finds specific ticket URLs!)
- ✅ ENRICHED sheet with confidence scoring
- ✅ PUBLISHED sheet (auto-copies future "Ready" events)
- ✅ CSV export working (15+ events with specific URLs)
- ✅ Email notifications configured (admin@performanceinterpreting.co.uk)
- ✅ Workspace cleaned (only v8 remains, rest archived)

### Backend Data Quality:
✅ Specific ticket URLs (NOT generic):
- Arsenal: `arsenal.com/tickets/women/2025-Dec-06/liverpool`
- O2: `theo2.co.uk/events/detail/jamiroquai-2025`
- Royal Albert Hall: `royalalberthall.com/tickets/events/2025/...`

**Backend is 100% ready for app stores!** 🎉

---

## ⚠️ What Needs YOUR Action TODAY (Tuesday)

### Priority 1: Set Up Hourly Automation (15 mins)

**Why:** Keeps events auto-updating every hour for app users

**Steps:**
1. Open: https://docs.google.com/spreadsheets/d/1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8/edit
2. **Extensions** → **Apps Script**
3. Click **⏰ Triggers** (left sidebar)
4. Click **+ Add Trigger**
5. Settings:
   - Function: `enrichAllPendingEvents`
   - Event source: **Time-driven**
   - Type: **Hour timer**
   - Interval: **Every hour**
6. **Save**

**Guide:** Read `SETUP-HOURLY-TRIGGER.md`

---

### Priority 2: Fix PWA Event Loading (30 mins)

**Current Issue:** app.performanceinterpreting.co.uk shows "No events found"

**Why:** CSV is working, but app isn't loading events (likely cache issue)

**Quick Fix:**
1. Visit: https://app.performanceinterpreting.co.uk/clear-cache.html
2. Clear cache
3. Go to: https://app.performanceinterpreting.co.uk
4. Check if events now appear

**If still broken:**
- Open DevTools (F12) → Console tab
- Look for errors
- Follow: `PWA-DEPLOYMENT-FIX.md`

**OR:**
- Redeploy the PWA from v8 folder
- Cloudflare Pages / Netlify / wherever it's hosted

---

## 📅 Remaining Timeline to Thursday

### TUESDAY (Today) - Your Tasks:
- ⏰ **15 mins:** Set up hourly trigger
- 🔧 **30 mins:** Fix PWA event loading
- ✅ **5 mins:** Test PWA shows correct events
- 📧 **Check:** Did you receive test email from automation?

**End of day:** Backend fully automated, PWA showing events

---

### WEDNESDAY (Tomorrow) - App Store Prep:

**Morning (2-3 hours):**
- Use **PWABuilder.com** to generate Android & iOS packages
- Create app store assets:
  - App icon (1024x1024px)
  - Screenshots (iPhone & Android)
  - App description
  - Privacy policy URL

**Afternoon (2 hours):**
- Set up Google Play Developer account ($25)
- Set up Apple Developer account ($99)
- Upload Android package to Google Play (internal testing)
- Upload iOS package to Apple TestFlight

**Why Wednesday?**
- Google Play: Often instant to 24hr review
- Apple: 1-3+ days review (might not make Thursday, but we try)

---

### THURSDAY (Deadline Day) - Best Case:

**What Marie Can Show:**
- ✅ **Android app LIVE** on Google Play Store (likely)
- ⚠️ **iOS app in review** (pending Apple approval)
- ✅ **PWA working** with visual install guide (guaranteed backup)

**Realistic Outcome for Thursday:**
- Android users: Download from Play Store ✓
- iOS users: Install PWA OR wait for App Store approval (1-2 more days)

---

### FRIDAY-MONDAY - iOS Approval:

Apple typically takes 1-3 days. If rejected:
- Fix issues (usually minor: missing privacy policy, wrong category, etc.)
- Resubmit
- Usually approved within 24hrs after resubmission

---

## 🎯 Critical Path (Must-Do Today):

```
TODAY:
1. [15 mins] Set hourly trigger → Automation running ✓
2. [30 mins] Fix PWA loading → Events visible on app.performanceinterpreting.co.uk ✓
3. [5 mins] Test PWA works → Verify 15+ events showing ✓

TOMORROW:
4. [3 hours] PWABuilder → Generate Android + iOS packages ✓
5. [2 hours] App store setup → Upload packages ✓

THURSDAY:
6. [1 hour] Monitor reviews → Android likely live, iOS pending ✓
```

---

## 📋 PWABuilder Quick Start (For Tomorrow)

**What is PWABuilder:**
Microsoft's free tool to convert your PWA into native app store packages.

**Tomorrow's Process:**

1. **Visit:** https://www.pwabuilder.com
2. **Enter URL:** app.performanceinterpreting.co.uk
3. **Click:** "Start"
4. PWABuilder analyzes your PWA
5. Click **"Package for Stores"**
6. **Android:** Download AAB file
7. **iOS:** Download IPA file (may need Mac for signing)
8. **Upload** to respective stores

**Time:** 1-2 hours (mostly waiting for analysis/download)

**Cost:** $0 (tool is free, only app store fees)

---

## 🛠️ Alternative if PWABuilder Doesn't Work:

**Use Capacitor** (slightly more technical, but more control):

```bash
cd "/Users/james/Documents/Events App/pi-events-app 8"
npm install -g @capacitor/cli
npx cap init "PI Events" "uk.co.performanceinterpreting.events"
npx cap add android
npx cap add ios
# Follow Capacitor docs to build packages
```

**Time:** 4-6 hours (more setup, but professional result)

---

## 📦 What You'll Need for App Stores:

### Both Stores:
- [ ] App name: "PI Events - BSL & ISL Interpreted Events" (or similar)
- [ ] Short description (80 chars): "Find BSL and ISL interpreted events across UK and Ireland"
- [ ] Full description (4000 chars): Talk about accessibility, event discovery, etc.
- [ ] App icon: 1024x1024px PNG (can use existing PI Favicon scaled up)
- [ ] Screenshots: 5-8 screenshots of the app
- [ ] Privacy policy URL: Create simple page on your site
- [ ] Support email: admin@performanceinterpreting.co.uk
- [ ] Website: https://performanceinterpreting.co.uk

### Google Play Only:
- [ ] Feature graphic: 1024x500px banner image
- [ ] Category: "Lifestyle" or "Events"
- [ ] Content rating: Everyone
- [ ] $25 one-time developer fee

### Apple App Store Only:
- [ ] App Store screenshots: Specific sizes for iPhone 13, iPad
- [ ] Apple ID with 2FA enabled
- [ ] $99/year developer fee
- [ ] Mac computer (for final iOS build signing)

---

## 🎨 Quick Asset Creation:

**App Icon:**
- Use existing PI logo
- Add background color (#2563EB blue from brand)
- Export as 1024x1024px PNG
- Tool: Canva (free) or Figma

**Screenshots:**
1. Visit app.performanceinterpreting.co.uk on phone
2. Take screenshots of:
   - Home screen with event list
   - Event filters (category, location)
   - Single event detail
   - Festival checklist modal
   - Know Your Rights modal
3. Use phone's screenshot feature
4. Upload directly to app stores

**Time:** 30 minutes

---

## 🆘 Blockers & Contingencies:

### If PWA Won't Load Events:

**Contingency:** Use a proxy to serve CSV through Cloudflare Worker
- I can build this in 1 hour if needed
- Would require updating app.js CSV URL
- Then redeploy PWA

### If PWABuilder Fails:

**Contingency:** Use Capacitor (4-6 hours, but works)
- More technical but proven solution
- I can guide you through it

### If Apple Rejects:

**Contingency:** Expected on first try
- Common rejections: Missing privacy policy, wrong category
- Fix and resubmit (24hr turnaround)
- Marie shows Android + PWA on Thursday, iOS by Monday

### If You Don't Have a Mac (for iOS):

**Contingency:** Use Ionic Appflow (cloud build service)
- $25/month for one month
- Builds iOS without Mac
- Or use PWABuilder's cloud iOS option

---

## ✅ Success Criteria for Thursday:

**Minimum (Guaranteed):**
- ✅ PWA working at app.performanceinterpreting.co.uk
- ✅ Events auto-updating hourly
- ✅ Visual install guide created

**Target (Likely):**
- ✅ Android app live on Google Play Store
- ⏳ iOS app submitted (pending review)
- ✅ PWA as backup for iOS users

**Stretch (Possible):**
- ✅ Both Android AND iOS live
- ✅ 50+ events in database
- ✅ Zero manual intervention needed

---

## 📞 Support & Next Steps:

**Today (Right Now):**
1. Read: `SETUP-HOURLY-TRIGGER.md`
2. Read: `PWA-DEPLOYMENT-FIX.md`
3. Complete both tasks (45 mins total)
4. Confirm events showing on PWA

**Tomorrow Morning:**
- Message me when ready for app store packaging
- I'll guide you through PWABuilder process
- We'll create assets together

**Wednesday-Thursday:**
- Monitor app store submissions
- Fix any issues
- Launch! 🚀

---

## 🎉 You're Almost There!

**What we built today:**
- ✅ Intelligent link finder (finds specific event URLs)
- ✅ Confidence scoring (HIGH/MEDIUM/LOW)
- ✅ Email notifications (for manual review)
- ✅ Automated enrichment ready (hourly trigger)
- ✅ Clean workspace (v8 only)
- ✅ Complete documentation

**What you need to do:**
- ⏰ 15 mins: Hourly trigger setup
- 🔧 30 mins: PWA fix
- 🚀 Tomorrow: App store packages

**This is totally doable for Thursday!** The hard part (backend automation) is DONE. Tomorrow is just packaging what we have.

Let's get Marie's deadline met! 💪

---

**Questions? Stuck? Message me immediately - we have 8 days but the sooner we fix the PWA, the better!**
