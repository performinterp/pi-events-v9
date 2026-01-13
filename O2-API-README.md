# O2 Sync API Server

Lightweight Flask API for triggering the O2 scraper pipeline from the admin UI.

## Quick Start

### 1. Install Dependencies

```bash
pip3 install -r requirements-o2-api.txt
```

### 2. Start the API Server

**Option A: Use the startup script (recommended)**

```bash
./start-o2-api.sh
```

**Option B: Run directly**

```bash
python3 o2-sync-api.py
```

The server will start on **http://localhost:5001**

### 3. Open the Admin UI

Open your browser to:
```
http://localhost:8000/admin-tools.html
```

(Make sure your main app server is running on port 8000)

### 4. Click the Sync Button

Click **"🔄 Sync O2 Events"** and watch the magic happen!

---

## API Endpoints

### POST /api/sync-o2-events

Triggers the complete O2 sync pipeline:
1. Runs `o2-scraper-enhanced.py` (scrapes The O2 website)
2. Runs `o2-sync-complete.py` (de-duplicates and syncs to Google Sheets)

**Response:**

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

**Error Response:**

```json
{
  "success": false,
  "error": "Scraper failed: [error message]",
  "step": "scrape",
  "timestamp": "2025-12-05 12:30:45"
}
```

### GET /api/health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "service": "o2-sync-api",
  "timestamp": "2025-12-05 12:30:45"
}
```

### GET /api/status

Check if required scripts exist.

**Response:**

```json
{
  "ready": true,
  "scraper_exists": true,
  "sync_exists": true,
  "working_directory": "/Users/james/Documents/Events App/...",
  "timestamp": "2025-12-05 12:30:45"
}
```

---

## Error Handling

### Common Errors

**1. "Cannot connect to API server"**
- **Cause**: API server is not running
- **Fix**: Start the API server with `./start-o2-api.sh`

**2. "Scraper failed: Script not found"**
- **Cause**: Required Python scripts are missing
- **Fix**: Ensure `o2-scraper-enhanced.py` and `o2-sync-complete.py` are in the same directory

**3. "Script execution timeout (5 minutes)"**
- **Cause**: Scraper is taking too long
- **Fix**: Check your internet connection or O2 website availability

**4. Flask/CORS not found**
- **Cause**: Dependencies not installed
- **Fix**: Run `pip3 install -r requirements-o2-api.txt`

---

## Architecture

```
┌─────────────────────┐
│   Admin UI          │
│  (admin-tools.html) │
└──────────┬──────────┘
           │ HTTP POST
           ▼
┌─────────────────────┐
│   Flask API         │
│  (o2-sync-api.py)   │
│  Port: 5001         │
└──────────┬──────────┘
           │ subprocess
           ▼
┌─────────────────────────────────────┐
│  Python Scripts                     │
│                                     │
│  1. o2-scraper-enhanced.py          │
│     - Scrapes The O2 website        │
│     - Saves to o2-events-all.json   │
│                                     │
│  2. o2-sync-complete.py             │
│     - De-duplicates events          │
│     - Syncs to Google Sheets        │
└─────────────────────────────────────┘
```

---

## Security Notes

- This API runs on `localhost` only (not accessible from external networks)
- CORS is enabled for local development
- No authentication required (intended for internal use only)
- **Do not expose this API to the internet without proper authentication**

---

## Troubleshooting

### Check API Server Status

```bash
curl http://localhost:5001/api/health
```

### Check if Scripts are Ready

```bash
curl http://localhost:5001/api/status
```

### View API Logs

The API prints detailed logs to the console. Check the terminal where you started the server.

### Test the Full Pipeline

```bash
curl -X POST http://localhost:5001/api/sync-o2-events
```

---

## Development

### Run in Debug Mode

The API runs in debug mode by default, which enables:
- Auto-reload on code changes
- Detailed error messages
- Request/response logging

### Modify Port

Edit `o2-sync-api.py` line 202:

```python
app.run(host='0.0.0.0', port=5001, debug=True)
```

Change `5001` to your preferred port.

---

## Production Deployment

For production use, consider:

1. **Use a production WSGI server** (Gunicorn, uWSGI)
2. **Add authentication** (API keys, OAuth)
3. **Enable HTTPS**
4. **Rate limiting**
5. **Logging to files**
6. **Run as a system service**

---

## Support

If you encounter issues:

1. Check the API server logs (terminal output)
2. Check the browser console (F12 → Console tab)
3. Verify all dependencies are installed
4. Ensure required Python scripts exist
5. Test the health endpoint: `http://localhost:5001/api/health`
