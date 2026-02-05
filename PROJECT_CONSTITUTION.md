# PI Events App — Project Constitution

**Status:** AUTHORITATIVE
**Last Updated:** 4 February 2026

---

## State History

| State | Description | Status |
|-------|-------------|--------|
| State 1 | Concept & first prototype | COMPLETED |
| State 2 | Prototype proving value with real data | COMPLETED |
| **State 3** | **Production hardening & data quality** | **CURRENT** |

---

## 1. Primary Purpose (Non-Negotiable)

Automate the publication of accessible, interpreter-supported events so Deaf and Hard-of-Hearing users can discover events without PI staff performing any manual copy-paste or rewriting.

- AI assistance is allowed.
- Manual intervention in the publishing output is not.

---

## 2. What Has Been Achieved (States 1–2)

These are shipped, working, and not to be re-built:

- Public PWA at `events.performanceinterpreting.co.uk`
- Auto-publish pipeline: Scrapers → PRE_APPROVED → CURATED → PUBLISHED → Frontend
- Daily GitHub Actions (O2, Wembley scrapers at 6 AM UTC)
- Apps Script auto-publish with email digest
- Three user flows: Browse, Search, Request interpretation
- Access-first modal system (email templates, VRS, official site links)
- Category filtering, region filtering, 3 display modes
- Know Your Rights, rights ticker, festival checklist
- Service worker with offline support
- Image enrichment (artist match + venue og:image scraping)
- 200+ published events, 11 venue email lookups

**Do not rebuild or refactor any of the above unless fixing a bug.**

---

## 3. Current State: State 3 — Production Hardening & Data Quality

The core pipeline works. The app serves real users. The focus now shifts to **reliability, data quality, and user experience** — making what exists work better, not building new features.

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Auto-publish rate | ≥80% | Maintain ≥80% |
| Data completeness (images) | 90% | ≥95% |
| Data completeness (event links) | 86% | ≥95% |
| Duplicate events in PUBLISHED | Present | Zero |
| WCAG accessibility compliance | Partial | All modals keyboard/screen-reader accessible |

### Exit Condition (must be satisfied to advance to State 4)

- Zero duplicate events in PUBLISHED sheet (automated dedup working)
- ≥95% data completeness across images, links, and cities
- All modals pass basic WCAG 2.1 AA (focus trap, keyboard nav, aria labels)
- Form validation on request flow
- 14 consecutive days with zero manual fixes needed to published data

---

## 4. Scope Boundaries — State 3

### Allowed

- Pipeline quality improvements (deduplication, category detection, data enrichment)
- Bug fixes to existing features
- Accessibility improvements (WCAG compliance on existing UI)
- Form validation on existing flows
- Push notification delivery (Cloudflare Workers — documented, ready to deploy)
- Sheet hygiene (removing stale/migrated sheets)
- Date parsing edge case fixes
- Digest improvements (flagging duplicates, better quality reporting)

### Explicitly Forbidden

- New user flows or pages
- New data sources or scrapers (beyond O2 + Wembley + monthly tabs)
- PI OS integration
- User accounts, auth, or personalisation
- Analytics dashboards
- Redesigns or UI overhauls
- Refactors for architectural elegance
- Any work that doesn't improve quality, reliability, or accessibility of what exists

**If it doesn't make the existing app more reliable, more accessible, or more complete — it is out of scope.**

---

## 5. Anti-Drift Enforcement

The following phrases are forbidden and indicate drift:

- "Eventually we could…"
- "Later we might…"
- "Down the line…"
- "Once this is refactored…"
- "While we're at it, let's also…"
- "It would be nice to add…"

**If drift is detected:**
1. Stop
2. Check: does this improve data quality, accessibility, or reliability?
3. If no, drop it
4. Proceed only with deployable work

---

## 6. Deployable Step Enforcement

Every session must result in:
1. One concrete deployable artefact (script fix, UI improvement, pipeline change)
2. One explicit next deployable step

**If this is not achieved, the work is considered a failure.**

---

## 7. Canonical Data Source

**Sheet:** Public Events Feed (`1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8`)

**Published Columns:**
`DATE`, `EVENT`, `VENUE`, `CITY`, `TIME`, `INTERPRETERS`, `INTERPRETATION`, `CATEGORY`, `IMAGE URL`, `EVENT URL`, `STATUS`

**Valid Categories:**
Concert, Sports, Festival, Comedy, Theatre, Cultural, Family, Literature, Dance, Talks & Discussions, Other

**Publishable criteria:** Row has non-empty date, event name, and venue.

---

## 8. Pipeline Architecture (Reference)

```
Scrapers (O2, Wembley)          Monthly Tabs (PI Work Flow)
         ↓                                ↓
   PRE_APPROVED EVENTS          "Public App" = Yes
         ↓                                ↓
         └──────── merge_events.py ────────┘
                         ↓
              AutoPublish.gs (daily trigger)
                         ↓
              PUBLISHED sheet (deduped, enriched)
                         ↓
              Frontend fetches CSV (15-min cache)
```

---

## 9. Verification Protocol

To verify the system works:
1. Edit a row in the PUBLISHED sheet
2. Wait up to 15 minutes (cache TTL)
3. Observe the change on the live app

**No manual intervention permitted in the publish flow.**
