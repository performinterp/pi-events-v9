# 🚀 O2 Sync Setup Guide

Complete setup instructions for the O2 Events auto-sync system.

---

## 📋 Prerequisites

1. **Python 3** installed
2. **pip3** installed
3. **Google Sheets credentials** configured (for o2-sync-complete.py)
4. **Internet connection** (to scrape O2 website and access Google Sheets)

---

## ⚡ Quick Start (3 Steps)

### Step 1: Install API Dependencies

```bash
cd "/Users/james/Documents/Events App/pi-events-app-v9-empowerment"
pip3 install -r requirements-o2-api.txt
```

### Step 2: Start the API Server

```bash
./start-o2-api.sh
```

You should see:
```
================================================
O2 Events Sync API Server
================================================
Working directory: /Users/james/Documents/Events App/...
Starting server on http://localhost:5001
================================================
```

**Leave this terminal window open** - the API server needs to keep running.

### Step 3: Open Admin UI and Click Sync

1. Open a new browser tab
2. Navigate to: **http://localhost:8000/admin-tools.html**
3. Click the button: **🔄 Sync O2 Events**
4. Watch the progress messages appear
5. Success! 🎉

---

## 🔍 What Happens When You Click Sync?

```
┌─────────────────────────┐
│   Admin UI              │
│  Click "Sync O2 Events" │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Flask API             │
│  http://localhost:5001  │
│  /api/sync-o2-events    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  1. o2-scraper-enhanced.py          │
│     - Scrapes The O2 website        │
│     - Saves 135 events to JSON      │
│     - 100% date coverage            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  2. o2-sync-complete.py             │
│     - Loads CURATED sheet           │
│     - Loads PRE-APPROVED sheet      │
│     - De-duplicates events          │
│     - Writes new events to sheet    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│   Success Message       │
│  "✅ 135 scraped,       │
│   133 added"            │
└─────────────────────────┘
```

---

## 📊 Expected Results

**First Run:**
- **135 events scraped** from The O2
- **2 already in CURATED** (Jamiroquai, Stereophonics)
- **133 new events added** to PRE-APPROVED EVENTS
- **Range**: A2:N134

**Subsequent Runs:**
- **Only new events** added (de-dupe prevents duplicates)
- **Safe to run monthly** to catch new O2 announcements

---

## 🛠️ Troubleshooting

### Issue 1: "Cannot connect to API server"

**Cause**: API server not running

**Fix**:
```bash
./start-o2-api.sh
```

Check terminal for:
```
* Running on http://localhost:5001
```

---

### Issue 2: "Module 'flask' not found"

**Cause**: Dependencies not installed

**Fix**:
```bash
pip3 install -r requirements-o2-api.txt
```

Or manually:
```bash
pip3 install flask flask-cors
```

---

### Issue 3: Scraper takes a long time

**Normal behavior**:
- Scraper loads ~135 events from O2 website
- Uses Playwright (headless browser)
- Clicks "Load More" up to 50 times
- **Expected duration**: 30-90 seconds

**If it times out (5 minutes)**:
- Check your internet connection
- Check if The O2 website is accessible
- Check terminal logs for errors

---

### Issue 4: "Script not found"

**Cause**: API server can't find Python scripts

**Fix**: Ensure you're in the correct directory
```bash
cd "/Users/james/Documents/Events App/pi-events-app-v9-empowerment"
ls o2-scraper-enhanced.py o2-sync-complete.py
```

Both files should exist.

---

### Issue 5: Google Sheets authentication fails

**Cause**: Credentials not configured

**Fix**:
1. Ensure `token.pickle` exists in the project directory
2. If not, run the scraper manually once to trigger OAuth:
   ```bash
   python3 o2-scraper-enhanced.py
   ```
3. Follow the authentication prompts

---

## 📁 File Structure

```
pi-events-app-v9-empowerment/
│
├── o2-scraper-enhanced.py         # Main scraper
├── o2-sync-complete.py            # De-dupe and sync
├── o2-sync-api.py                 # Flask API server ⭐
├── start-o2-api.sh                # Startup script ⭐
├── requirements-o2-api.txt        # API dependencies ⭐
├── admin-tools.html               # Admin UI ⭐
│
├── O2-SCRAPER-NOTES.md            # Technical docs
├── O2-API-README.md               # API docs ⭐
├── O2-SETUP-GUIDE.md              # This file ⭐
├── IMPLEMENTATION-STATUS.md       # Status tracker
│
├── o2-events-all.json             # Scraped data (generated)
└── token.pickle                   # Google auth (generated)

⭐ = New files for API integration
```

---

## 🔐 Security Notes

- API runs on **localhost only** (not accessible from internet)
- No authentication required (internal use only)
- **Do not expose API to public internet**
- CORS enabled for local development only

---

## 📈 Monitoring

### Check API Health

```bash
curl http://localhost:5001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "o2-sync-api",
  "timestamp": "2025-12-05 12:30:45"
}
```

### Check Script Status

```bash
curl http://localhost:5001/api/status
```

Expected response:
```json
{
  "ready": true,
  "scraper_exists": true,
  "sync_exists": true,
  "working_directory": "/Users/james/Documents/Events App/...",
  "timestamp": "2025-12-05 12:30:45"
}
```

### Trigger Sync via Command Line

```bash
curl -X POST http://localhost:5001/api/sync-o2-events
```

---

## 🔄 Regular Usage

**Recommended Schedule**: Monthly

**Steps**:
1. Start API server (if not already running)
2. Open admin UI
3. Click "Sync O2 Events"
4. Review PRE-APPROVED EVENTS tab in Google Sheets
5. Manually promote confirmed events to CURATED

---

## 📞 Support

If you encounter issues not covered in this guide:

1. **Check API server logs** (terminal where `start-o2-api.sh` is running)
2. **Check browser console** (F12 → Console tab)
3. **Review documentation**:
   - `O2-SCRAPER-NOTES.md` - Technical details
   - `O2-API-README.md` - API reference
   - `IMPLEMENTATION-STATUS.md` - Implementation status

---

## ✅ Success Checklist

After setup, you should be able to:

- [ ] Start API server without errors
- [ ] Access admin UI at http://localhost:8000/admin-tools.html
- [ ] Click "Sync O2 Events" button
- [ ] See "Syncing O2 events..." during execution
- [ ] See success message with event counts
- [ ] View new events in PRE-APPROVED EVENTS sheet
- [ ] Re-run sync without creating duplicates

---

**Status**: ✅ Setup complete! System ready for production use.
