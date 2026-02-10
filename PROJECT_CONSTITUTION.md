# PI Events App — Project Constitution

**Status:** AUTHORITATIVE
**Last Updated:** 5 February 2026

---

## State History

| State | Description | Status |
|-------|-------------|--------|
| State 1 | Concept & first prototype | COMPLETED |
| State 2 | Prototype proving value with real data | COMPLETED |
| State 3 | Production hardening & data quality | COMPLETED |
| **State 4** | **PI OS integration & public release prep** | **CURRENT** |

---

## 1. Primary Purpose (Non-Negotiable)

Automate the publication of accessible, interpreter-supported events so Deaf and Hard-of-Hearing users can discover events without PI staff performing any manual copy-paste or rewriting.

- AI assistance is allowed.
- Manual intervention in the publishing output is not.

---

## 2. What Has Been Achieved (States 1–3)

These are shipped, working, and not to be re-built:

### Core Platform
- Public PWA at `app.performanceinterpreting.co.uk`
- Auto-publish pipeline: Scrapers → PRE_APPROVED → PUBLISHED → Frontend
- Daily GitHub Actions (O2, Wembley scrapers at 6 AM UTC)
- Apps Script auto-publish with email digest
- Three user flows: Browse, Search, Request interpretation
- Access-first modal system (email templates, VRS, official site links)
- Category filtering, region filtering, 3 display modes
- Know Your Rights, rights ticker, festival checklist
- Service worker with offline support
- Image enrichment (artist match + venue og:image scraping)
- 200+ published events, 11 venue email lookups

### State 3 Achievements (Production Hardening)
- Zero duplicate events (exact + date-varying dedup)
- ≥95% data completeness (images, links, cities)
- WCAG 2.1 AA keyboard accessibility on category cards
- Form validation on Request BSL flow
- aria-live regions for dynamic content
- Proper heading hierarchy
- Fuzzy search "Did you mean?" improvements
- API key authentication for write operations
- Secrets moved to Script Properties

**Do not rebuild or refactor any of the above unless fixing a bug.**

---

## 3. Current State: State 4 — PI OS Integration & Public Release Prep

The standalone app is production-ready. The focus now shifts to **integration with PI OS** and **preparing for public release**, including legal/contractual considerations.

### Goals

1. **PI OS Integration** — Events data available to PI OS for interpreter assignment workflows
2. **Legal/Contractual Review** — Address data handling, scraping terms, interpreter consent
3. **Public Release** — Marketing-ready, any remaining polish

### Success Metrics

| Metric | Target |
|--------|--------|
| PI OS can query events data | Working API or shared data source |
| Interpreter names display with consent | Contracts updated or opt-out mechanism |
| O2 partnership documented | Written agreement on file |
| Image hosting | Self-hosted or explicit permission |
| Public launch | App announced to PI's audience |

### Exit Condition (to advance to State 5 / Maintenance)

- PI OS integration live and working
- Legal review complete (Marie sign-off)
- Public announcement made
- 30 days stable operation post-launch

---

## 4. Scope Boundaries — State 4

### Allowed

- PI OS integration (API, shared database, or webhook)
- Data contract/schema definition between Events App and PI OS
- Legal/contractual work (interpreter consent, venue agreements, image rights)
- Image re-hosting to PI-owned storage (if required)
- Bug fixes and minor UX polish
- Documentation for handoff/maintenance

### Deferred to State 5+

- Push notifications (Cloudflare Workers) — 3 months post-release
- Native app on app stores (iOS/Android) — community feedback Feb 2026
- New scrapers or data sources
- User accounts or personalisation
- Analytics dashboards
- Major redesigns

### Explicitly Forbidden

- Scope creep beyond integration and release prep
- Refactors for architectural elegance
- Features that delay public release

---

## 5. Legal & Contractual Checklist (Marie's Attention Required)

### Web Scraping
- [ ] **O2 Partnership** — Get written confirmation that PI may scrape and display O2 event data. Current status: verbal/informal agreement.
- [ ] **Other Venues** — Review ToS for Wembley and any future scraped venues.

### Image Rights
- [ ] **Hotlinking** — Currently using og:image URLs from venue sites. Options:
  - Get written permission to hotlink
  - Re-host images on PI infrastructure (Cloudflare R2)
  - Use placeholder images where permission unavailable

### Interpreter Data (GDPR)
- [ ] **Public Display of Names** — Interpreter names appear on published events. Ensure:
  - PI contracts with interpreters include consent to public listing
  - Or: add opt-out mechanism for interpreters who don't want to be listed
  - Or: display "Interpreter booked" without names

### Data Retention
- [ ] **Past Events** — Currently auto-deleted from PUBLISHED sheet. Confirm this meets GDPR data minimisation requirements.

---

## 6. PI OS Integration Approach

### Option A: Shared Google Sheet (Simplest)
- PI OS reads from the same PUBLISHED sheet
- No new infrastructure
- Risk: tight coupling, sheet rate limits

### Option B: API Endpoint
- Events App exposes a JSON API (Apps Script Web App or Cloudflare Worker)
- PI OS queries the API
- Cleaner separation, but more to build

### Option C: Database Sync
- Events data synced to PI OS's Supabase
- Full integration, events become first-class PI OS entities
- Most complex, but most powerful

**Decision needed: which approach fits PI OS architecture?**

---

## 7. Anti-Drift Enforcement

The following phrases indicate drift:

- "Eventually we could…"
- "Later we might…"
- "Down the line…"
- "While we're at it, let's also…"
- "It would be nice to add…"

**If drift is detected:** Stop. Does this help PI OS integration or public release? If no, drop it.

---

## 8. Canonical Data Source

**Sheet:** Public Events Feed (`1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8`)

**Published Columns:**
`DATE`, `EVENT`, `VENUE`, `CITY`, `TIME`, `INTERPRETERS`, `INTERPRETATION`, `CATEGORY`, `IMAGE URL`, `EVENT URL`, `STATUS`

**Valid Categories:**
Concert, Sports, Festival, Comedy, Theatre, Cultural, Family, Literature, Dance, Talks & Discussions, Other

---

## 9. Pipeline Architecture (Reference)

```
Scrapers (O2, Wembley)          Monthly Tabs (PI Work Flow)
         ↓                                ↓
   PRE_APPROVED EVENTS          "Public App" = Yes
         ↓                                ↓
         └──────── AutoPublish.gs ────────┘
                         ↓
              PUBLISHED sheet (deduped, enriched)
                         ↓
              Frontend fetches CSV (15-min cache)
                         ↓
              [NEW] PI OS queries events (TBD)
```
