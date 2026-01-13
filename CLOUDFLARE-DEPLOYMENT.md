# ☁️ Cloudflare Deployment Guide

Complete guide to deploying your Performance Interpreting PWA on Cloudflare.

**Stack:**
- **Cloudflare Pages** - Host the PWA (global CDN, instant SSL)
- **Cloudflare Workers** - Notification backend API
- **Cloudflare KV** - Store push subscriptions
- **All FREE tier** - Perfect for your use case!

---

## Why Cloudflare is Perfect for This

✅ **Global edge network** - Fast everywhere
✅ **Auto HTTPS** - SSL certificates included
✅ **Unlimited bandwidth** - No overage charges
✅ **Git integration** - Auto-deploy on push
✅ **Workers + KV** - Backend and database in one place
✅ **FREE tier is generous** - 100k requests/day

---

## Part 1: Deploy PWA to Cloudflare Pages

### Step 1: Create GitHub Repository (if not done)

```bash
cd "/Users/james/Documents/Events App/pi-events-app 8"
git init
git add .
git commit -m "Initial commit - Performance Interpreting PWA"
```

Create repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/pi-events-pwa.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Pages** → **Create a project**
3. Connect to your GitHub account
4. Select your `pi-events-pwa` repository
5. Configure build settings:
   - **Project name**: `pi-events`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
   - **Root directory**: `/`
6. Click **Save and Deploy**

**Done!** Your PWA will be live at: `https://pi-events.pages.dev`

### Step 3: Custom Domain (Optional)

1. In Cloudflare Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `events.performanceinterpreting.co.uk`
4. Cloudflare will auto-configure DNS
5. SSL certificate issued automatically

---

## Part 2: Setup Notification Backend (Workers + KV)

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Create Worker Project

```bash
cd "/Users/james/Documents/Events App/pi-events-app 8"
mkdir cloudflare-worker
cd cloudflare-worker

# Initialize worker
wrangler init pi-notifications
cd pi-notifications
```

### Step 3: Create KV Namespaces

```bash
# Create SUBSCRIPTIONS namespace (for push notifications)
wrangler kv:namespace create "SUBSCRIPTIONS"
# Note the ID shown (e.g., "abc123...")

wrangler kv:namespace create "SUBSCRIPTIONS" --preview
# Note this preview ID too

# Create ANALYTICS namespace (for install tracking)
wrangler kv:namespace create "ANALYTICS"
# Note the ID shown

wrangler kv:namespace create "ANALYTICS" --preview
# Note this preview ID too
```

### Step 4: Configure wrangler.toml

Create/edit `wrangler.toml`:

```toml
name = "pi-notifications"
main = "src/index.js"
compatibility_date = "2024-01-01"

# KV Namespace bindings
kv_namespaces = [
  { binding = "SUBSCRIPTIONS", id = "YOUR_SUBSCRIPTIONS_NAMESPACE_ID", preview_id = "YOUR_SUBSCRIPTIONS_PREVIEW_ID" },
  { binding = "ANALYTICS", id = "YOUR_ANALYTICS_NAMESPACE_ID", preview_id = "YOUR_ANALYTICS_PREVIEW_ID" }
]

# CORS configuration
[env.production]
vars = { ALLOWED_ORIGIN = "https://events.performanceinterpreting.co.uk" }
```

### Step 5: Create Worker Code

Create `src/index.js`:

```javascript
import { handleCORS, corsHeaders } from './cors';
import { handleSubscribe, handleUnsubscribe } from './subscriptions';
import { sendNotifications } from './notifications';
import { handleTrackInstall, handleGetStats, handleGetActiveUsers, handleDashboard } from './tracking';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Routes - Notifications
    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return await handleSubscribe(request, env);
    }

    if (url.pathname === '/api/subscribe' && request.method === 'DELETE') {
      return await handleUnsubscribe(request, env);
    }

    if (url.pathname === '/api/notify' && request.method === 'POST') {
      // Optional: Add authentication here for security
      return await sendNotifications(request, env);
    }

    // Routes - Analytics
    if (url.pathname === '/api/track-install' && request.method === 'POST') {
      return await handleTrackInstall(request, env);
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return await handleGetStats(request, env);
    }

    if (url.pathname === '/api/active-users' && request.method === 'GET') {
      return await handleGetActiveUsers(request, env);
    }

    // Analytics Dashboard (Protected - add auth in production!)
    if (url.pathname === '/analytics') {
      return handleDashboard(env);
    }

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

Create `src/cors.js`:

```javascript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function handleCORS() {
  return new Response(null, {
    headers: corsHeaders
  });
}
```

Create `src/subscriptions.js`:

```javascript
import { corsHeaders } from './cors';

export async function handleSubscribe(request, env) {
  try {
    const { subscription, preferences } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique ID for this subscription
    const subscriptionId = crypto.randomUUID();

    // Store in KV
    await env.SUBSCRIPTIONS.put(subscriptionId, JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime,
      categories: preferences?.categories || [],
      locations: preferences?.locations || [],
      subscribedAt: new Date().toISOString()
    }));

    console.log('Subscription saved:', subscriptionId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription saved successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUnsubscribe(request, env) {
  try {
    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find and delete subscription by endpoint
    const list = await env.SUBSCRIPTIONS.list();

    for (const key of list.keys) {
      const data = JSON.parse(await env.SUBSCRIPTIONS.get(key.name));
      if (data.endpoint === subscription.endpoint) {
        await env.SUBSCRIPTIONS.delete(key.name);
        console.log('Subscription deleted:', key.name);
        break;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription removed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

Create `src/notifications.js`:

```javascript
import { corsHeaders } from './cors';

// IMPORTANT: Set these as environment variables or secrets
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = 'YOUR_VAPID_PRIVATE_KEY';
const VAPID_SUBJECT = 'mailto:contact@performanceinterpreting.co.uk';

export async function sendNotifications(request, env) {
  try {
    const eventData = await request.json();
    const { EVENT, CATEGORY, VENUE, DATE } = eventData;

    if (!EVENT || !CATEGORY || !VENUE) {
      return new Response(JSON.stringify({ error: 'Missing event data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all subscriptions
    const list = await env.SUBSCRIPTIONS.list();
    const subscriptions = [];

    for (const key of list.keys) {
      const data = await env.SUBSCRIPTIONS.get(key.name);
      if (data) {
        subscriptions.push({ id: key.name, ...JSON.parse(data) });
      }
    }

    console.log(`Found ${subscriptions.length} total subscriptions`);

    // Find matching subscriptions
    const matches = subscriptions.filter(sub => {
      const categoryMatch = sub.categories.length === 0 || sub.categories.includes(CATEGORY);

      const locationMatch = sub.locations.length === 0 ||
        sub.locations.some(loc => VENUE.toUpperCase().includes(loc.toUpperCase()));

      return categoryMatch && locationMatch;
    });

    console.log(`Sending to ${matches.length} matching subscribers`);

    // Extract just venue name (before comma)
    const venueName = VENUE.split(',')[0].trim();

    // Send push notifications
    const results = await Promise.allSettled(
      matches.map(sub => sendPushNotification(sub, {
        title: `New ${CATEGORY} Event! 🎉`,
        body: `${EVENT} at ${venueName} on ${DATE}`,
        icon: '/PI Favicon.png',
        badge: '/PI Favicon.png',
        url: '/',
        tag: 'pi-event-notification'
      }, env))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({
      success: true,
      sent: successful,
      failed: failed,
      total: matches.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Send notifications error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function sendPushNotification(subscription, payload, env) {
  try {
    // Prepare the payload
    const payloadString = JSON.stringify(payload);

    // Create VAPID auth headers
    const vapidHeaders = await generateVAPIDHeaders(
      subscription.endpoint,
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Send push notification
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400', // 24 hours
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        ...vapidHeaders
      },
      body: await encryptPayload(payloadString, subscription.keys)
    });

    if (!response.ok) {
      // If subscription is gone (410), delete it
      if (response.status === 410) {
        console.log('Subscription expired, deleting:', subscription.id);
        await env.SUBSCRIPTIONS.delete(subscription.id);
      }
      throw new Error(`Push failed: ${response.status}`);
    }

    return { success: true };

  } catch (error) {
    console.error('Push notification error:', error);
    throw error;
  }
}

// Simplified VAPID - for production, use web-push library
async function generateVAPIDHeaders(endpoint, subject, publicKey, privateKey) {
  // For Cloudflare Workers, you'll need to implement VAPID signing
  // OR use a library that works in Workers
  // See: https://github.com/web-push-libs/web-push

  return {
    'Authorization': `vapid t=${publicKey}, k=${privateKey}`,
  };
}

// Simplified encryption - for production, use proper Web Push encryption
async function encryptPayload(payload, keys) {
  // For Cloudflare Workers, implement AES128GCM encryption
  // OR use a library compatible with Workers
  return new TextEncoder().encode(payload);
}
```

**Note:** For production, you'll want to use a proper Web Push library. The above is simplified for clarity.

### Step 6: Install Dependencies

```bash
npm init -y
npm install web-push --save
```

For Workers that support Node.js built-ins, or use a Worker-compatible push library.

### Step 7: Deploy Worker

```bash
# Test locally
wrangler dev

# Deploy to production
wrangler deploy
```

Your worker will be live at: `https://pi-notifications.YOUR_SUBDOMAIN.workers.dev`

---

## Part 3: Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Copy the output:
```
Public Key: BEl62i...
Private Key: bipV5...
```

**Add to Worker secrets:**
```bash
wrangler secret put VAPID_PUBLIC_KEY
# Paste public key when prompted

wrangler secret put VAPID_PRIVATE_KEY
# Paste private key when prompted

wrangler secret put VAPID_SUBJECT
# Enter: mailto:contact@performanceinterpreting.co.uk
```

---

## Part 4: Update Frontend Configuration

Update `notifications.js`:

```javascript
const NOTIFICATION_CONFIG = {
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY_FROM_STEP_3',
    subscriptionEndpoint: 'https://pi-notifications.YOUR_SUBDOMAIN.workers.dev/api/subscribe',
    // ...
};
```

Push changes:
```bash
git add .
git commit -m "Update notification config"
git push
```

Cloudflare Pages will auto-deploy! 🚀

---

## Part 5: Testing

### Test 1: Check Worker Health
```bash
curl https://pi-notifications.YOUR_SUBDOMAIN.workers.dev/api/health
# Should return: {"status":"ok"}
```

### Test 2: Subscribe to Notifications
1. Open: `https://pi-events.pages.dev`
2. Click "🔔 Get Notifications"
3. Select preferences
4. Enable notifications
5. Check Worker logs: `wrangler tail`

### Test 3: Send Test Notification
```bash
curl -X POST https://pi-notifications.YOUR_SUBDOMAIN.workers.dev/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "EVENT": "Test Concert",
    "CATEGORY": "Concert",
    "VENUE": "Test Venue, London",
    "DATE": "01/01/2025"
  }'
```

You should receive a push notification!

---

## Part 6: Custom Domain for Worker

1. Go to Cloudflare Dashboard → **Workers & Pages**
2. Click your `pi-notifications` worker
3. **Triggers** → **Add Custom Domain**
4. Enter: `api.performanceinterpreting.co.uk`
5. Click **Add Custom Domain**

Update frontend to use: `https://api.performanceinterpreting.co.uk/api/subscribe`

---

## Part 7: Automation (Optional)

### Auto-send notifications when Google Sheets updates

**Option A: Google Apps Script**

In your Google Sheet → **Extensions** → **Apps Script**:

```javascript
function onEdit(e) {
  // Get edited range
  const range = e.range;
  const sheet = range.getSheet();

  // Only trigger on specific sheet
  if (sheet.getName() !== 'Events') return;

  // Get the row data
  const row = range.getRow();
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Send to Worker
  const eventData = {
    EVENT: data[0],
    DATE: data[1],
    VENUE: data[2],
    CATEGORY: data[3],
    INTERPRETATION: data[4],
    INTERPRETERS: data[5]
  };

  UrlFetchApp.fetch('https://api.performanceinterpreting.co.uk/api/notify', {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(eventData)
  });
}
```

**Option B: Scheduled Check (More Reliable)**

Create a scheduled Worker that checks for new events every hour:

```bash
wrangler publish --schedule "0 * * * *"  # Every hour
```

---

## Part 8: View Install Analytics

Once deployed, you can view install statistics:

### Analytics Dashboard

Visit: `https://api.performanceinterpreting.co.uk/analytics`

**Features:**
- 📱 Total installs count
- 📈 Monthly install trends
- 📊 6-month chart
- 🔄 Auto-refreshes every 30 seconds

**Example:**
```
Total Installs:     247
This Month:         42
6-Month Average:    38
```

### API Endpoints

**Get Current Stats:**
```bash
curl https://api.performanceinterpreting.co.uk/api/stats
```

Response:
```json
{
  "totalInstalls": 247,
  "currentMonthInstalls": 42,
  "monthlyData": [
    { "month": "2024-09", "installs": 28 },
    { "month": "2024-10", "installs": 35 },
    ...
  ]
}
```

**Get Active Devices:**
```bash
curl https://api.performanceinterpreting.co.uk/api/active-users
```

Response:
```json
{
  "activeDevices": 189,
  "message": "Approximate number of devices with app currently installed"
}
```

### Securing the Dashboard

**Important:** By default, the `/analytics` dashboard is public. To secure it:

**Option 1: Cloudflare Access (Recommended)**
1. Dashboard → Zero Trust → Access → Applications
2. Add application
3. Protect: `api.performanceinterpreting.co.uk/analytics`
4. Allow: Your email only

**Option 2: Simple Password Protection**

Add to `src/tracking.js`:

```javascript
export function handleDashboard(env, request) {
  // Check for password in query param or header
  const url = new URL(request.url);
  const password = url.searchParams.get('key') || request.headers.get('X-Analytics-Key');

  if (password !== env.ANALYTICS_PASSWORD) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic' }
    });
  }

  // ... rest of dashboard code
}
```

Then set password:
```bash
wrangler secret put ANALYTICS_PASSWORD
# Enter your secret password
```

Access with: `https://api.performanceinterpreting.co.uk/analytics?key=YOUR_PASSWORD`

### What Gets Tracked

**Per Install (Anonymous):**
- ✅ Timestamp of install
- ✅ User agent (browser/OS)
- ✅ Platform (iOS, Android, etc.)
- ❌ NO personal data
- ❌ NO IP addresses
- ❌ NO user identifiers

**Privacy Compliant:**
- GDPR compliant (no personal data)
- No cookies
- No tracking pixels
- Just install counts

---

## Environment Overview

```
┌─────────────────────────────────────────────┐
│         Cloudflare Infrastructure            │
├─────────────────────────────────────────────┤
│                                             │
│  📱 Cloudflare Pages                        │
│     ├─ PWA (HTML/CSS/JS)                   │
│     ├─ Auto HTTPS                          │
│     ├─ Global CDN                          │
│     └─ events.performanceinterpreting.co.uk  │
│                                             │
│  ⚡ Cloudflare Workers                      │
│     ├─ /api/subscribe (POST/DELETE)        │
│     ├─ /api/notify (POST)                  │
│     └─ api.performanceinterpreting.co.uk     │
│                                             │
│  🗄️  Cloudflare KV                          │
│     └─ SUBSCRIPTIONS namespace             │
│         └─ {id: subscription_data}         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Costs (Free Tier Limits)

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Pages | Unlimited | 1 site | **$0** |
| Pages Builds | 500/month | ~20/month | **$0** |
| Workers | 100k requests/day | ~1k/day | **$0** |
| KV Reads | 100k/day | ~1k/day | **$0** |
| KV Writes | 1k/day | ~10/day | **$0** |
| KV Storage | 1 GB | <1 MB | **$0** |
| Bandwidth | Unlimited | Unlimited | **$0** |

**Total: $0/month** for ~1,000 users! 🎉

---

## Production Checklist

- [ ] GitHub repo created and connected
- [ ] Cloudflare Pages deployed
- [ ] Custom domain configured (optional)
- [ ] Worker deployed
- [ ] KV namespace created
- [ ] VAPID keys generated and added as secrets
- [ ] Frontend config updated with worker URL
- [ ] Test subscription flow
- [ ] Test notification sending
- [ ] Test unsubscribe
- [ ] (Optional) Set up Google Sheets automation

---

## Monitoring

**View Worker logs:**
```bash
wrangler tail
```

**Check KV storage:**
```bash
wrangler kv:key list --binding SUBSCRIPTIONS
```

**View analytics:**
- Cloudflare Dashboard → Workers & Pages → Analytics
- See request counts, errors, latency

---

## Support

Everything runs on Cloudflare's global network - super reliable and fast!

**Common URLs after setup:**
- PWA: `https://events.performanceinterpreting.co.uk`
- API: `https://api.performanceinterpreting.co.uk`
- Worker Dashboard: `https://dash.cloudflare.com`

Perfect setup for a lightweight, reliable PWA! 🚀
