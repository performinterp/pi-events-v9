# PI Events App — Project Constitution

**Status:** AUTHORITATIVE
**Current State:** State 2 — Prototype proving value with real data

---

## 1. Primary Purpose (Non-Negotiable)

Automate the publication of accessible, interpreter-supported events so Deaf and Hard-of-Hearing users can discover events without PI staff performing any manual copy-paste or rewriting.

- AI assistance is allowed.
- Manual intervention in the publishing output is not.

---

## 2. Business Pain (Starting Point)

Manual event publishing:
- Consumes staff time
- Introduces inconsistency and delay
- Creates cognitive overhead
- Does not scale

**If work does not reduce this pain immediately, it is out of scope.**

---

## 3. Success Metric (Mandatory)

**Primary metric:** Percentage of events auto-published with zero manual intervention.

| Measure | Value |
|---------|-------|
| Baseline | ~0% |
| Target | ≥80% |
| Timeline | First production deployment |

**Any work that does not advance this metric is invalid.**

---

## 4. Project State Discipline

The project must be in exactly one state at all times.

**Current State:** State 2 — Prototype proving value with real data

**Exit Condition (must be satisfied to advance):**

A public PI Events page that:
- Auto-updates from one real Google Sheet
- Uses Apps Script as the data source
- Requires zero manual copy-paste
- Runs successfully for 7 consecutive days

**Until this exit condition is met, no other work is permitted.**

---

## 5. First Irreversible Win (Your Only Goal)

Ship a public PI Events page that renders live event data automatically from one Google Sheet via Apps Script.

This page must be:
- Publicly accessible via URL
- Automatically updated
- Verifiable in seconds by editing the sheet

**If a human touches the output, it failed.**

---

## 6. Hard Scope Boundaries (Do Not Exceed)

### Allowed
- One canonical Google Sheet as the public feed
- One Apps Script endpoint outputting clean JSON
- One public static page (HTML/JS is sufficient)
- Minimal required fields (e.g. title, date, venue, access note)
- A visible "Last updated" timestamp

### Explicitly Forbidden
- Multiple ingestion sources
- Status badges
- Filters
- Language toggles
- Venue enrichment
- Auth or admin UIs
- PI OS / booking / email logic
- Refactors for "later"
- Future-proofing
- Architectural elegance that delays deployment

**If it does not advance sheet → script → public page, it is out.**

---

## 7. Anti-Drift Enforcement

The following phrases are forbidden and indicate drift:
- "Eventually we could…"
- "Later we might…"
- "Down the line…"
- "Once this is refactored…"

**If drift is detected:**
1. Stop
2. Re-anchor to what ships now
3. Proceed only with deployable work

---

## 8. Deployable Step Enforcement

Every session must result in:
1. One concrete deployable artefact (live page, running script, or both)
2. One explicit next deployable step

**If this is not achieved, the work is considered a failure.**

---

## 9. Canonical Data Source

**Sheet:** PUBLIC_EVENTS_FEED (or designated canonical sheet)

**Required Columns:**
- `title` — Event name
- `date` — Event date
- `venue` — Location
- `access_note` — Interpreter/accessibility information

**Publishable criteria:** Row has non-empty title, date, and venue.

---

## 10. Verification Protocol

To verify the system works:
1. Edit a row in the canonical Google Sheet
2. Refresh the public page
3. Observe the automatic update within seconds

**No manual intervention permitted in this flow.**
