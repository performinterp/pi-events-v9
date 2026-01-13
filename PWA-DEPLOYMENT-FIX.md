# 🔧 Fix PWA Event Loading Issue

Your PWA at **app.performanceinterpreting.co.uk** shows "No events found" even though the CSV feed has events.

---

## 🔍 Diagnosis

✅ **CSV Feed is Working:**
- URL: https://docs.google.com/spreadsheets/d/e/2PACX-1vTVxv88y3c-1VMujoz2bupvSCnUkoC-r0W-QogbkhivAAvY-EBff7-vp76b7NxYeSQMK43rOb7PI830/pub?gid=57149695&single=true&output=csv
- Contains 15+ events with correct data
- URLs are specific and correct

✅ **Deployed app.js has correct CSV URL:**
- Config points to the right spreadsheet

❌ **Events not loading in browser**

---

## 🎯 Likely Causes & Solutions

### Issue 1: Browser Cache (Most Likely)

The app caches events for 15 minutes. Old cache might have "no events".

**Solution:**
1. Visit: https://app.performanceinterpreting.co.uk
2. Open browser DevTools (F12 or Right-click → Inspect)
3. Go to **Application** tab → **Clear storage**
4. Check all boxes, click **Clear site data**
5. Refresh the page (Cmd+R / Ctrl+R)

Or use the built-in cache clearer:
- Visit: https://app.performanceinterpreting.co.uk/clear-cache.html

### Issue 2: CORS Policy Blocking CSV

Google Sheets CSV might be blocked by browser CORS policy.

**Check:**
1. Open: https://app.performanceinterpreting.co.uk
2. Open DevTools (F12)
3. Go to **Console** tab
4. Look for red errors like:
   ```
   Access to fetch at 'https://docs.google.com/...' has been blocked by CORS policy
   ```

**Solution if CORS blocked:**
Need to proxy the CSV through Cloudflare Worker (I can build this)

### Issue 3: Old Deployment

The deployed files might be from before events were added to sheets.

**Solution:**
Redeploy the PWA (see below)

---

## 🚀 Quick Fix: Redeploy PWA

### Option A: Cloudflare Pages (Recommended)

**If using Cloudflare Pages:**

1. Go to: https://dash.cloudflare.com
2. Click **Pages**
3. Find your **app.performanceinterpreting.co.uk** project
4. Click **View build**
5. Click **Retry deployment**

Or trigger new deployment:
```bash
cd "/Users/james/Documents/Events App/pi-events-app 8"
git add .
git commit -m "Update app with latest events"
git push
```

This will auto-trigger Cloudflare Pages to redeploy.

### Option B: Manual Upload

**If manually uploaded:**

1. FTP/Upload all files from `/Users/james/Documents/Events App/pi-events-app 8/` to your hosting
2. Make sure to upload:
   - index.html
   - app.js
   - styles.css
   - service-worker.js
   - manifest.json
   - All image files

---

## 🔧 Testing After Fix

1. Visit: https://app.performanceinterpreting.co.uk/clear-cache.html
2. Clear the cache
3. Go back to: https://app.performanceinterpreting.co.uk
4. You should see events like:
   - Arsenal vs Brentford (03.12.25)
   - Arsenal vs Liverpool Womens (06.12.25)
   - MCOA - My Christmas Orchestra Adventure (07.12.25)
   - Etc.

---

## 📊 Verify CSV is Accessible

Test the CSV directly in your browser:

1. Visit: https://docs.google.com/spreadsheets/d/e/2PACX-1vTVxv88y3c-1VMujoz2bupvSCnUkoC-r0W-QogbkhivAAvY-EBff7-vp76b7NxYeSQMK43rOb7PI830/pub?gid=57149695&single=true&output=csv

2. You should see CSV data like:
   ```
   DATE,EVENT,VENUE,TIME,INTERPRETERS,INTERPRETATION,CATEGORY,IMAGE URL,TICKET LINK
   03.12.25,Arsenal vs Brenford,Emirates Stadium...
   ```

3. If you get a redirect or permission error, the spreadsheet might not be published properly.

---

## 🔐 Check Spreadsheet Publishing

Make sure PUBLISHED sheet is actually published:

1. Open: https://docs.google.com/spreadsheets/d/1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8/edit
2. Go to **PUBLISHED** tab
3. Click **File** → **Share** → **Publish to web**
4. Make sure:
   - **Published:** Yes
   - **Sheet:** PUBLISHED
   - **Format:** CSV
   - **Link:** Should match your app's CSV URL

If not published:
1. Click **Publish**
2. Choose: **PUBLISHED** sheet
3. Format: **Comma-separated values (.csv)**
4. Copy the URL
5. Update `app.js` if URL is different

---

## 🎯 Next Steps

1. ✅ Clear browser cache
2. ✅ Check DevTools console for errors
3. ✅ Verify CSV loads in browser directly
4. ✅ Redeploy PWA if needed
5. ✅ Test events appear

Once working:
- ✅ Events will auto-update every hour (from automated enrichment)
- ✅ App refreshes every 15 minutes
- ✅ Ready for app store packaging!

---

## 🆘 If Still Not Working

Send me:
1. Screenshot of browser DevTools Console (F12 → Console tab)
2. Confirmation CSV URL loads when visited directly
3. Which hosting platform you're using (Cloudflare Pages? Netlify? Other?)

I'll help debug further!
