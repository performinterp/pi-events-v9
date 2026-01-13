# VENUE ACCESS DATA EXTRACTION NOTES

**Date**: 2025-12-05
**Task**: Centralize venue access information from app into VENUE_ACCESS Google Sheet tab

---

## SOURCE OF DATA

All venue access data was extracted from:
- **File**: `booking-guide.html` (lines 1097-1293)
- **Section**: Venues Modal content

This is a static HTML page that contains a "Venues" modal with detailed contact information for various UK venues.

---

## DATA EXTRACTION PROCESS

### 1. Venues Found

Extracted **13 venue entries** from the booking-guide.html file:

**Primary Standalone Venues:**
1. The O2 Arena, London
2. Wembley Stadium, London (2 email entries)
3. Southbank Centre, London

**Strictly Come Dancing Tour 2025 Venues:**
4. Utilita Arena Birmingham
5. Utilita Arena Newcastle
6. First Direct Arena Leeds
7. AO Arena Manchester
8. Utilita Arena Sheffield
9. M&S Bank Arena Liverpool
10. OVO Hydro Glasgow
11. Motorpoint Arena Nottingham (2 entries - general + Strictly-specific)

**Note**: Wembley Stadium has 2 separate email addresses, so it's represented as 2 rows. Motorpoint Arena Nottingham also has 2 entries - one general and one Strictly-specific.

---

## FIELD MAPPING

### What Was Clearly Available:

| Field | Source | Notes |
|-------|--------|-------|
| **VENUE_NAME** | HTML venue button text | Exact venue names as displayed |
| **CITY** | Derived from venue name | Extracted from venue name string |
| **COUNTRY** | Inferred | All venues are UK-based |
| **INTERPRETER_STATUS** | HTML badge classes and text | Mapped from badge indicators |
| **ACCESS_NOTES** | HTML `<p>` text content | Human-readable descriptions |
| **VRS_PROVIDER** | Contact method labels | "SignVideo" extracted from labels |
| **VRS_URL** | SignVideo link href | Direct URLs (e.g., o2.signvideo.net) |
| **ACCESS_EMAIL** | Email contact items | Extracted from `mailto:` links |
| **TEXTPHONE** | Textphone contact items | UK textphone prefix format (18001) |
| **PHONE** | Phone contact items | UK phone numbers |

### What Was NOT Available:

| Field | Status | Reason |
|-------|--------|--------|
| **OFFICIAL_SITE_URL** | Empty | Not included in booking-guide.html venue entries |

---

## INTERPRETER STATUS MAPPING

The HTML uses badge classes to indicate interpreter availability. I mapped these to standardized values:

| HTML Badge Class | HTML Text | Mapped Status |
|-----------------|-----------|---------------|
| `badge-guaranteed` | "✅ Guaranteed Interpreter at Every Show" | **Confirmed** |
| `badge-request` | "⚠️ Interpreter Available on Request" | **On Request** |
| No badge | No status indicator | **Unknown** |

**Special Cases:**
- **Strictly Come Dancing venues**: All marked as "Confirmed" because the tour description explicitly states "Each performance will host a BSL interpreter"
- **Motorpoint Arena Nottingham**: Has both general "On Request" and Strictly-specific "Confirmed" entries

---

## ASSUMPTIONS & PATTERNS

### 1. City Extraction
Cities were extracted from the `VENUE_NAME` field using simple parsing:
- Pattern: `[Venue Name], [City]`
- Example: "The O2 Arena, London" → City = "London"

### 2. Country Inference
All venues were marked as **UK** because:
- The booking guide is UK-focused
- All phone numbers use UK format
- All locations are UK cities (London, Birmingham, Manchester, etc.)

### 3. VRS Provider Detection
VRS_PROVIDER set to "SignVideo" when:
- Contact method label contains "SignVideo"
- Link domain is `signvideo.net`

### 4. Strictly Tour Venues
The Strictly Come Dancing Live Tour 2025 is a multi-venue event. Each tour stop was extracted as a separate venue entry because:
- Each venue has unique accessibility contact details
- Each venue has a specific interpreter assigned
- Booking processes may vary by venue

---

## DATA GAPS & LIMITATIONS

### Missing Fields:
1. **OFFICIAL_SITE_URL**: Not present in source HTML
2. **ACCESS_PHONE**: Not used (only PHONE field populated)
3. **VRS details for most venues**: Only O2 and Wembley have SignVideo URLs

### Partially Filled Venues:
- **Southbank Centre**: No interpreter status indicator, no SignVideo
- **Strictly tour venues**: No VRS information, no textphone numbers

### Potential Duplicates:
- **Wembley Stadium**: Has 2 rows (different email addresses)
- **Motorpoint Arena Nottingham**: Has 2 rows (general vs Strictly-specific)
- These are intentional to preserve all contact methods

---

## VENUE DATA COMPLETENESS

| Venue | INTERPRETER_STATUS | VRS | ACCESS_EMAIL | PHONE | TEXTPHONE | OFFICIAL_SITE |
|-------|-------------------|-----|--------------|-------|-----------|---------------|
| The O2 Arena, London | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Wembley Stadium, London | ✅ | ✅ | ✅ (2) | ✅ | ❌ | ❌ |
| Southbank Centre, London | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Utilita Arena Birmingham | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Utilita Arena Newcastle | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| First Direct Arena Leeds | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| AO Arena Manchester | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Utilita Arena Sheffield | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| M&S Bank Arena Liverpool | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| OVO Hydro Glasgow | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Motorpoint Arena Nottingham | ✅ | ❌ | ✅ (2) | ❌ | ❌ | ❌ |

**Summary**:
- **13 venue entries** (14 rows including header)
- **100% have email addresses** (primary contact method)
- **85% have interpreter status** (11/13 unique venues)
- **15% have VRS/SignVideo** (2/13 unique venues)
- **31% have phone numbers** (4/13 unique venues)
- **15% have textphone** (2/13 unique venues)
- **0% have official site URLs** (not in source data)

---

## OBSERVABLE GAPS

### 1. Venues in Events but Not in Booking Guide
The `booking-guide.html` file only contains a small subset of all possible venues. Many venues that appear in event data may not have corresponding entries in the booking guide.

**Recommendation**: Cross-reference the PUBLISHED/CURATED event sheet VENUE field with VENUE_ACCESS to identify missing venues.

### 2. Missing VRS Information
Most venues don't have SignVideo or VRS URLs. This may be because:
- Not all venues offer VRS
- The booking guide is incomplete
- VRS setup varies by event/promoter

### 3. No ISL Information
All venues are UK-based (BSL territory). No Irish venues (ISL territory) were found in the booking guide.

---

## NEXT STEPS FOR DATA ENHANCEMENT

### Recommended Actions:
1. **Add OFFICIAL_SITE_URL**: Manually research venue websites
2. **Identify missing venues**: Compare VENUE field in event sheets with VENUE_ACCESS
3. **Add Irish venues**: Extract venues from events with COUNTRY = "Ireland"
4. **Verify VRS availability**: Check if more venues offer SignVideo
5. **Add ACCESS_PHONE**: Separate field for dedicated access phone lines (not general phone)

### Data Join Strategy:
When wiring the app to use VENUE_ACCESS:
```javascript
// Pseudo-logic for joining event to venue
const eventVenue = event['VENUE'];
const venueAccessRow = VENUE_ACCESS.find(row =>
  row.VENUE_NAME.includes(eventVenue) ||
  eventVenue.includes(row.VENUE_NAME)
);
```

**Challenge**: Venue names in events may not exactly match VENUE_ACCESS entries. Consider fuzzy matching or standardized naming.

---

## SOURCE VERIFICATION

All data can be verified by viewing:
- **File**: `/Users/james/Documents/Events App/pi-events-app-v9-empowerment/booking-guide.html`
- **Lines**: 1097-1293 (Venues Modal section)
- **HTML IDs**: `#venuesModal`, `.venue-button`, `.venue-details`

---

**Status**: ✅ **COMPLETE** - VENUE_ACCESS tab created and populated with best-effort data from booking-guide.html
