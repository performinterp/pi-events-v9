# Manual Cleanup Instructions

## ✅ Upload Complete!

All 153 rows have been successfully uploaded to **PRE_APPROVED EVENTS** in **PI Work Flow** spreadsheet.

**Timestamp**: 2025-12-07 00:58:13

### Data Breakdown
- **Headers**: 1 row
- **Existing manual events**: 20 rows (transformed to new 14-column format)
- **O2 events**: 132 rows (Strictly Come Dancing filtered out)
- **Total**: 153 rows

---

## 🧹 Required Manual Cleanup

The following temporary sheets need to be deleted manually:

### 1. Delete O2_TEMP from PI Work Flow

**Spreadsheet**: PI Work Flow
**Spreadsheet ID**: `1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU`
**Sheet to delete**: `O2_TEMP`

**Steps**:
1. Open [PI Work Flow spreadsheet](https://docs.google.com/spreadsheets/d/1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU/edit)
2. Scroll to the **O2_TEMP** tab at the bottom
3. Right-click on the tab
4. Select **Delete**
5. Confirm deletion

**Why**: This was a temporary working sheet used to stage O2 events before copying them to PRE_APPROVED EVENTS. All data has been migrated.

---

### 2. Delete PRE-APPROVED EVENTS from Public Events Feed (if exists)

**Spreadsheet**: Public Events Feed
**Sheet to delete**: `PRE-APPROVED EVENTS`

**Steps**:
1. Open the Public Events Feed spreadsheet
2. Find the **PRE-APPROVED EVENTS** tab
3. Right-click on the tab
4. Select **Delete**
5. Confirm deletion

**Why**: This data has been migrated to the PI Work Flow spreadsheet with the new richer 14-column format.

---

## 📊 New PRE_APPROVED EVENTS Structure

The new 14-column format in PI Work Flow includes:

1. EVENT_NAME
2. ARTIST_NAME
3. VENUE_NAME
4. CITY
5. COUNTRY
6. EVENT_DATE
7. EVENT_TIME
8. EVENT_URL
9. IMAGE_URL
10. ACCESS_STATUS
11. CATEGORY
12. SOURCE
13. NOTES
14. ADDED_DATE

---

## ⚠️ Why Manual Deletion?

The Google Sheets MCP server doesn't include a `delete_sheet` function, and the Google Sheets API authentication token has expired. Manual deletion via the Google Sheets interface is the simplest solution.

---

## ✅ Verification

After deletion, verify:
- PRE_APPROVED EVENTS in PI Work Flow has 153 rows (1 header + 152 events)
- O2_TEMP no longer exists in PI Work Flow
- Old PRE-APPROVED EVENTS no longer exists in Public Events Feed
