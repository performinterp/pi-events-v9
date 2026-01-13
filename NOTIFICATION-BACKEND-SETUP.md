# 🔔 Push Notifications Backend Setup

## Privacy-First Anonymous Notification System

This system allows users to receive push notifications about new events **without collecting any personal data**. No names, emails, or user accounts required!

---

## How It Works

1. **User subscribes** → Browser generates anonymous push subscription endpoint
2. **Backend stores** → Only `{subscription_endpoint, [categories], [locations]}`
3. **New event added** → Backend matches events with subscriptions and sends push
4. **100% Anonymous** → No tracking, no personal data, GDPR compliant

---

## Backend Requirements

You need a simple serverless backend with:
- **1 POST endpoint** for subscriptions
- **1 DELETE endpoint** for unsubscriptions
- **1 function** to send notifications when new events are added

### Recommended Services (All have free tiers):
- **Cloudflare Workers** (Recommended - global edge, generous free tier)
- **Vercel Edge Functions**
- **AWS Lambda + API Gateway**
- **Google Cloud Functions**

---

## Step 1: Generate VAPID Keys

VAPID keys are needed for Web Push. Generate them once:

```bash
npx web-push generate-vapid-keys
```

You'll get:
```
Public Key: BMlH...
Private Key: Xg9t...
```

**Important**:
- Update `notifications.js` line 7 with your **Public Key**
- Keep your **Private Key** secret (use in backend only)

---

## Step 2: Setup Backend Database

You need to store subscriptions. Use any simple key-value store:

### Option A: Cloudflare Workers KV (Recommended)
```bash
wrangler kv:namespace create "SUBSCRIPTIONS"
```

### Option B: Any Database
Store objects like:
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  },
  "preferences": {
    "categories": ["Concert", "Sports"],
    "locations": ["London", "Manchester"]
  }
}
```

---

## Step 3: Backend Code Example (Cloudflare Workers)

### `subscribe-endpoint.js`
```javascript
// POST /api/subscribe - Save subscription
export async function handleSubscribe(request, env) {
  const { subscription, preferences } = await request.json();

  // Generate unique ID for this subscription
  const subscriptionId = crypto.randomUUID();

  // Store in KV
  await env.SUBSCRIPTIONS.put(subscriptionId, JSON.stringify({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    expirationTime: subscription.expirationTime,
    categories: preferences.categories || [],
    locations: preferences.locations || [],
    subscribedAt: new Date().toISOString()
  }));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// DELETE /api/subscribe - Remove subscription
export async function handleUnsubscribe(request, env) {
  const { subscription } = await request.json();

  // Find and delete by endpoint
  const list = await env.SUBSCRIPTIONS.list();
  for (const key of list.keys) {
    const data = JSON.parse(await env.SUBSCRIPTIONS.get(key.name));
    if (data.endpoint === subscription.endpoint) {
      await env.SUBSCRIPTIONS.delete(key.name);
      break;
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### `send-notifications.js`
```javascript
import webpush from 'web-push';

// Configure web-push with your VAPID keys
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  'YOUR_VAPID_PUBLIC_KEY',
  'YOUR_VAPID_PRIVATE_KEY'
);

export async function sendNotifications(newEvent, env) {
  const { EVENT, CATEGORY, VENUE } = newEvent;

  // Get all subscriptions
  const list = await env.SUBSCRIPTIONS.list();
  const subscriptions = await Promise.all(
    list.keys.map(key => env.SUBSCRIPTIONS.get(key.name, 'json'))
  );

  // Find matching subscriptions
  const matches = subscriptions.filter(sub => {
    const categoryMatch = sub.categories.length === 0 || sub.categories.includes(CATEGORY);
    const locationMatch = sub.locations.length === 0 || sub.locations.some(loc => VENUE.includes(loc));
    return categoryMatch && locationMatch;
  });

  console.log(`Sending to ${matches.length} subscribers`);

  // Send push notifications
  const promises = matches.map(sub => {
    const payload = JSON.stringify({
      title: `New ${CATEGORY} Event!`,
      body: `${EVENT} at ${VENUE}`,
      icon: '/PI Favicon.png',
      badge: '/PI Favicon.png',
      url: '/',
      tag: 'pi-event-notification'
    });

    return webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys
      },
      payload
    ).catch(err => {
      console.error('Failed to send notification:', err);
      // If subscription is invalid, delete it
      if (err.statusCode === 410) {
        // Delete invalid subscription
      }
    });
  });

  await Promise.allSettled(promises);
  return { sent: matches.length };
}
```

---

## Step 4: Trigger Notifications

### Option A: Manual Trigger (Simple)
When you add events to Google Sheets, run:
```bash
curl -X POST https://api.performanceinterpreting.co.uk/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "EVENT": "Coldplay Concert",
    "CATEGORY": "Concert",
    "VENUE": "Wembley Stadium, London",
    "DATE": "15/06/2025"
  }'
```

### Option B: Automated (Advanced)
- Use Google Apps Script to trigger webhook when sheet is updated
- Or: Scheduled task checks for new events every hour

---

## Step 5: Update Frontend Config

In `notifications.js`, update lines 6-10:

```javascript
const NOTIFICATION_CONFIG = {
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY_HERE', // From step 1
    subscriptionEndpoint: 'https://api.performanceinterpreting.co.uk/api/subscribe', // Your backend URL
    // ...
};
```

---

## Testing Notifications

### 1. Test Subscription Flow
1. Open the PWA
2. Click "🔔 Get Notifications"
3. Select categories/locations
4. Click "Enable Notifications"
5. Check browser console for any errors

### 2. Test Sending
```javascript
// Send test notification from backend
await sendNotifications({
  EVENT: 'Test Event',
  CATEGORY: 'Concert',
  VENUE: 'Test Venue, London',
  DATE: '01/01/2025'
}, env);
```

### 3. Test Notification Click
- Send a test notification
- Click it
- Should open the PWA

---

## Privacy & GDPR Compliance

✅ **No personal data collected**
✅ **Anonymous subscriptions** (just browser endpoints)
✅ **User controlled** (can unsubscribe anytime)
✅ **Transparent** (clearly explains what's stored)
✅ **No tracking** (no analytics, no user IDs)

**What's stored:**
- Push subscription endpoint (generated by browser)
- User's selected preferences (categories, locations)

**What's NOT stored:**
- Names, emails, phone numbers
- IP addresses
- Browsing history
- Any identifying information

---

## Cost Estimate

**For 1,000 subscribers receiving 4 notifications/month:**

| Service | Cost |
|---------|------|
| Cloudflare Workers | **FREE** (up to 100k requests/day) |
| Database (KV) | **FREE** (up to 100k reads/day) |
| Push notifications | **FREE** (sent via browser's push service) |

**Total: $0/month** 🎉

---

## Troubleshooting

### "Notifications not supported"
- User's browser doesn't support Web Push
- Must use Chrome, Firefox, Safari, or Edge

### "Notifications blocked"
- User previously denied permission
- Must reset in browser settings

### "Subscription failed"
- Check VAPID keys are correct
- Verify backend endpoint is accessible
- Check browser console for errors

### "No notifications received"
- Verify backend received subscription
- Check notification matching logic
- Test with manual notification send

---

## Production Checklist

- [ ] VAPID keys generated and configured
- [ ] Backend endpoints deployed and tested
- [ ] Frontend config updated with correct URLs
- [ ] Test subscription flow works
- [ ] Test notification sending works
- [ ] Test unsubscribe works
- [ ] Service worker updated (increment version)
- [ ] Database backup strategy in place (optional)

---

## Need Help?

The system is designed to be simple and privacy-first. No complex user management needed!

**Key principles:**
1. Keep it lightweight
2. No user accounts
3. Just push endpoints + preferences
4. GDPR compliant by design
