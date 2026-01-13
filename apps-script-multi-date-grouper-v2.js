// ==================== PI EVENTS APP - MULTI-DATE EVENT GROUPER ====================
// Install in PUBLIC EVENTS FEED spreadsheet
// Groups multi-date events: "13 Dec + 1 more date" for same event at same venue
// Special: Circus Starr Winter Tour → ONE card showing "20 locations across UK"

// ==================== MENU ====================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎯 Event Automation')
    .addItem('📅 Group Multi-Date Events', 'groupMultiDateEvents')
    .addToUi();
}

// ==================== CONFIGURATION ====================
const CONFIG = {
  SOURCE_SHEET: 'CURATED',
  TARGET_SHEET: 'PUBLISHED',

  // Special tour handling
  TOUR_EVENTS: {
    'Circus Starr Winter Tour': {
      displayName: 'Circus Starr Winter Tour',
      venue: '20 locations across UK',
      category: 'Family, Tour',
      showLocationCount: true
    }
  }
};

// ==================== MAIN FUNCTION ====================
function groupMultiDateEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get CURATED data
  const curatedSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!curatedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error', 'CURATED sheet not found!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const data = curatedSheet.getDataRange().getValues();
  const headers = data[0];

  // Group events
  const groupedEvents = processEventGrouping(data.slice(1));

  // Create or update PUBLISHED sheet
  let publishedSheet = ss.getSheetByName(CONFIG.TARGET_SHEET);
  if (!publishedSheet) {
    publishedSheet = ss.insertSheet(CONFIG.TARGET_SHEET);
  } else {
    publishedSheet.clear();
  }

  // Write headers and grouped data
  publishedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (groupedEvents.length > 0) {
    publishedSheet.getRange(2, 1, groupedEvents.length, headers.length).setValues(groupedEvents);
  }

  // Format the sheet
  formatPublishedSheet(publishedSheet);

  // Show summary
  showGroupingSummary(data.slice(1).length, groupedEvents.length);
}

// ==================== EVENT GROUPING LOGIC ====================
function processEventGrouping(rows) {
  const grouped = [];
  const processed = new Set();

  for (let i = 0; i < rows.length; i++) {
    if (processed.has(i)) continue;

    const row = rows[i];
    const date = row[0];
    const event = row[1];
    const venue = row[2];

    // Check if this is a tour event
    if (CONFIG.TOUR_EVENTS[event]) {
      // Find all dates for this tour
      const tourDates = [];
      for (let j = i; j < rows.length; j++) {
        if (rows[j][1] === event) {
          tourDates.push(j);
          processed.add(j);
        }
      }

      // Create single tour card
      const tourConfig = CONFIG.TOUR_EVENTS[event];
      const tourRow = [...row];

      // Keep first date for proper badge display
      tourRow[0] = rows[tourDates[0]][0];

      // Add date range to event name
      const startDate = formatDate(rows[tourDates[0]][0]);
      const endDate = formatDate(rows[tourDates[tourDates.length - 1]][0]);
      tourRow[1] = `${tourConfig.displayName} (${startDate} - ${endDate})`;

      tourRow[2] = tourConfig.venue;
      tourRow[3] = `${tourDates.length} dates across UK`;
      tourRow[6] = tourConfig.category;

      grouped.push(tourRow);
      continue;
    }

    // Check for multi-date events (MUST be same event AND same venue)
    const sameDateEvents = [i];
    for (let j = i + 1; j < rows.length; j++) {
      if (processed.has(j)) continue;

      const compareEvent = rows[j][1];
      const compareVenue = rows[j][2];

      // Match ONLY if same event name AND same venue
      const eventMatch = normalizeText(event) === normalizeText(compareEvent);
      const venueMatch = normalizeVenue(venue) === normalizeVenue(compareVenue);

      if (eventMatch && venueMatch) {
        sameDateEvents.push(j);
        processed.add(j);
      }
    }

    processed.add(i);

    // If multiple dates found, create grouped entry
    if (sameDateEvents.length > 1) {
      const groupedRow = [...row];
      const additionalDates = sameDateEvents.length - 1;

      // Keep the first date as-is (for proper badge display)
      // Add badge to event name instead
      groupedRow[1] = `${groupedRow[1]} (${sameDateEvents.length} dates)`;

      grouped.push(groupedRow);
    } else {
      // Single date event, add as-is
      grouped.push(row);
    }
  }

  return grouped;
}

// ==================== HELPER FUNCTIONS ====================
function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVenue(venue) {
  if (!venue) return '';
  // Normalize venue names for comparison
  let normalized = venue.toString().toLowerCase().trim();

  // Remove common variations
  normalized = normalized.replace(/\bthe\b/g, '');
  normalized = normalized.replace(/\barena\b/g, '');
  normalized = normalized.replace(/\bstadium\b/g, '');
  normalized = normalized.replace(/,?\s*london$/i, '');
  normalized = normalized.replace(/,?\s*uk$/i, '');

  return normalized.replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr) {
  if (!dateStr) return '';

  // Parse DD.MM.YY or DD.MM.YYYY format
  const parts = dateStr.toString().split('.');
  if (parts.length !== 3) return dateStr;

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);

  const date = new Date(year, month, day);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month]}`;
}

function formatDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return '';

  // Parse dates
  const parts1 = startDateStr.toString().split('.');
  const parts2 = endDateStr.toString().split('.');

  if (parts1.length !== 3 || parts2.length !== 3) return startDateStr;

  const startDay = parseInt(parts1[0]);
  const startMonth = parseInt(parts1[1]) - 1;
  const startYear = parts1[2].length === 2 ? 2000 + parseInt(parts1[2]) : parseInt(parts1[2]);

  const endDay = parseInt(parts2[0]);
  const endMonth = parseInt(parts2[1]) - 1;
  const endYear = parts2[2].length === 2 ? 2000 + parseInt(parts2[2]) : parseInt(parts2[2]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // If same date, return single date
  if (startDay === endDay && startMonth === endMonth && startYear === endYear) {
    return `${startDay} ${months[startMonth]}`;
  }

  // If same month and year
  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${months[startMonth]} ${startYear}`;
  }

  // Different months
  return `${startDay} ${months[startMonth]} - ${endDay} ${months[endMonth]} ${startYear}`;
}

function formatPublishedSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= sheet.getLastColumn(); i++) {
    sheet.autoResizeColumn(i);
  }
}

function showGroupingSummary(originalCount, groupedCount) {
  const ui = SpreadsheetApp.getUi();

  const reduced = originalCount - groupedCount;
  const message = `✅ Multi-date grouping complete!\n\n` +
                  `Original events: ${originalCount}\n` +
                  `Grouped events: ${groupedCount}\n` +
                  `Reduction: ${reduced} duplicate entries removed\n\n` +
                  `Check the "${CONFIG.TARGET_SHEET}" tab to see the results!`;

  ui.alert('✅ Grouping Complete', message, ui.ButtonSet.OK);
}
