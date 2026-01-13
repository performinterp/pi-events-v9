// ==================== PI EVENTS APP - COMPLETE CODE.GS ====================
// Copy this ENTIRE file into your Code.gs in Apps Script
// This replaces everything currently in Code.gs

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('🔄 Run Full Automation', 'runFullAutomationUI')
    .addSeparator()
    .addItem('📤 Publish Ready Events', 'publishReadyEventsUI')
    .addSeparator()
    .addItem('🧼 Remove Duplicate Events', 'removeDuplicatesUI')
    .addItem('🗑️ Remove Old Events from CURATED', 'removeOldEventsUI')
    .addItem('🔧 Add Dropdowns to CURATED Status', 'addCuratedDropdownsUI')
    .addItem('🔍 Test Link Finder', 'testLinkFinder')
    .addItem('📧 Review Events Needing Manual Links', 'showNeedsReviewReport')
    .addItem('🧹 Clear All Status', 'clearAllStatus')
    .addItem('🗑️ Clear PUBLISHED Tab', 'clearPublishedTab')
    .addSeparator()
    .addItem('📅 Group Multi-Date Events', 'groupMultiDateEvents')
    .addSeparator()
    .addItem('📖 Add Booking Guide Columns', 'addBookingGuideColumnsUI')
    .addItem('📤 Update Published with Guides', 'updatePublishedWithBookingGuidesUI')
    .addToUi();
}

// ==================== VENUE BOOKING GUIDE MAPPING ====================
const VENUE_BOOKING_GUIDES = {
  'The O2, London': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#the-o2-london',
    venueSlug: 'the-o2-london',
    bookingNote: 'Purchase tickets first, then contact venue for BSL'
  },
  'The O2 Arena, London': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#the-o2-london',
    venueSlug: 'the-o2-london',
    bookingNote: 'Purchase tickets first, then contact venue for BSL'
  },
  'Wembley Stadium': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#wembley-stadium',
    venueSlug: 'wembley-stadium',
    bookingNote: 'Contact venue before purchasing tickets'
  },
  'Wembley Stadium, London': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#wembley-stadium',
    venueSlug: 'wembley-stadium',
    bookingNote: 'Contact venue before purchasing tickets'
  },
  'Southbank Centre': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#southbank-centre',
    venueSlug: 'southbank-centre',
    bookingNote: 'Contact venue before purchasing tickets'
  },
  'Southbank Centre, London': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#southbank-centre',
    venueSlug: 'southbank-centre',
    bookingNote: 'Contact venue before purchasing tickets'
  },
  'Motorpoint Arena Nottingham': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#motorpoint-arena-nottingham',
    venueSlug: 'motorpoint-arena-nottingham',
    bookingNote: 'Purchase tickets first, then contact venue for BSL'
  },
  'Strictly Come Dancing Live Tour 2025': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#strictly-come-dancing',
    venueSlug: 'strictly-come-dancing',
    bookingNote: 'Booking process varies by venue - check guide'
  }
};

// ==================== BOOKING GUIDE FUNCTIONS ====================
function addBookingGuideColumnsUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: CURATED sheet not found');
    return;
  }

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];

  let hasGuideCol = headers.indexOf('HAS_BOOKING_GUIDE') + 1;
  let guideUrlCol = headers.indexOf('BOOKING_GUIDE_URL') + 1;
  let bookingNoteCol = headers.indexOf('BOOKING_NOTE') + 1;

  if (!hasGuideCol) {
    hasGuideCol = curatedSheet.getLastColumn() + 1;
    curatedSheet.getRange(1, hasGuideCol).setValue('HAS_BOOKING_GUIDE');
  }
  if (!guideUrlCol) {
    guideUrlCol = curatedSheet.getLastColumn() + 1;
    curatedSheet.getRange(1, guideUrlCol).setValue('BOOKING_GUIDE_URL');
  }
  if (!bookingNoteCol) {
    bookingNoteCol = curatedSheet.getLastColumn() + 1;
    curatedSheet.getRange(1, bookingNoteCol).setValue('BOOKING_NOTE');
  }

  const lastRow = curatedSheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data found in CURATED sheet');
    return;
  }

  const data = curatedSheet.getRange(2, 1, lastRow - 1, curatedSheet.getLastColumn()).getValues();
  let updatedCount = 0;
  let withGuideCount = 0;

  for (let i = 0; i < data.length; i++) {
    const venue = data[i][2];
    const event = data[i][1];

    if (!venue && !event) continue;

    const guideInfo = findBookingGuide(venue, event);
    const rowNum = i + 2;

    if (guideInfo) {
      curatedSheet.getRange(rowNum, hasGuideCol).setValue('TRUE');
      curatedSheet.getRange(rowNum, guideUrlCol).setValue(guideInfo.guideUrl);
      curatedSheet.getRange(rowNum, bookingNoteCol).setValue(guideInfo.bookingNote);
      withGuideCount++;
    } else {
      curatedSheet.getRange(rowNum, hasGuideCol).setValue('FALSE');
      curatedSheet.getRange(rowNum, guideUrlCol).setValue('');
      curatedSheet.getRange(rowNum, bookingNoteCol).setValue('Contact venue directly about BSL availability');
    }

    updatedCount++;
  }

  SpreadsheetApp.getUi().alert(
    `✅ Booking guide columns added!\n\n` +
    `📊 Updated ${updatedCount} events\n` +
    `📖 ${withGuideCount} events have booking guides\n` +
    `ℹ️  ${updatedCount - withGuideCount} events need direct venue contact`
  );
}

function updatePublishedWithBookingGuidesUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');
  const publishedSheet = ss.getSheetByName('PUBLISHED');

  if (!curatedSheet || !publishedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: CURATED or PUBLISHED sheet not found');
    return;
  }

  const curatedHeaders = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const publishedHeaders = publishedSheet.getRange(1, 1, 1, publishedSheet.getLastColumn()).getValues()[0];

  const hasGuideCol = curatedHeaders.indexOf('HAS_BOOKING_GUIDE') + 1;
  const guideUrlCol = curatedHeaders.indexOf('BOOKING_GUIDE_URL') + 1;
  const bookingNoteCol = curatedHeaders.indexOf('BOOKING_NOTE') + 1;

  if (!hasGuideCol || !guideUrlCol || !bookingNoteCol) {
    SpreadsheetApp.getUi().alert(
      '⚠️ Warning: Booking guide columns not found in CURATED.\n\n' +
      'Run "Add Booking Guide Columns" first.'
    );
    return;
  }

  let pubHasGuideCol = publishedHeaders.indexOf('HAS_BOOKING_GUIDE') + 1;
  let pubGuideUrlCol = publishedHeaders.indexOf('BOOKING_GUIDE_URL') + 1;
  let pubBookingNoteCol = publishedHeaders.indexOf('BOOKING_NOTE') + 1;

  if (!pubHasGuideCol) {
    pubHasGuideCol = publishedSheet.getLastColumn() + 1;
    publishedSheet.getRange(1, pubHasGuideCol).setValue('HAS_BOOKING_GUIDE');
  }
  if (!pubGuideUrlCol) {
    pubGuideUrlCol = publishedSheet.getLastColumn() + 1;
    publishedSheet.getRange(1, pubGuideUrlCol).setValue('BOOKING_GUIDE_URL');
  }
  if (!pubBookingNoteCol) {
    pubBookingNoteCol = publishedSheet.getLastColumn() + 1;
    publishedSheet.getRange(1, pubBookingNoteCol).setValue('BOOKING_NOTE');
  }

  const curatedLastRow = curatedSheet.getLastRow();
  if (curatedLastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data found in CURATED sheet');
    return;
  }

  const curatedData = curatedSheet.getRange(1, 1, curatedLastRow, curatedSheet.getLastColumn()).getValues();
  let copiedCount = 0;

  if (publishedSheet.getLastRow() > 1) {
    publishedSheet.getRange(2, 1, publishedSheet.getLastRow() - 1, publishedSheet.getLastColumn()).clearContent();
  }

  const publishedRows = [];

  for (let i = 1; i < curatedData.length; i++) {
    const status = curatedData[i][9];

    if (status === 'Ready') {
      const row = [
        curatedData[i][0],
        curatedData[i][1],
        curatedData[i][2],
        curatedData[i][3],
        curatedData[i][4],
        curatedData[i][5],
        curatedData[i][6],
        curatedData[i][7],
        curatedData[i][8],
        curatedData[i][hasGuideCol - 1],
        curatedData[i][guideUrlCol - 1],
        curatedData[i][bookingNoteCol - 1]
      ];
      publishedRows.push(row);
      copiedCount++;
    }
  }

  if (publishedRows.length > 0) {
    publishedSheet.getRange(2, 1, publishedRows.length, publishedRows[0].length).setValues(publishedRows);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Published updated with booking guides!\n\n` +
    `📤 ${copiedCount} Ready events published`
  );
}

function findBookingGuide(venue, event) {
  if (!venue && !event) return null;

  const venueNormalized = venue ? venue.toString().trim() : '';

  if (VENUE_BOOKING_GUIDES[venueNormalized]) {
    return VENUE_BOOKING_GUIDES[venueNormalized];
  }

  for (const [key, value] of Object.entries(VENUE_BOOKING_GUIDES)) {
    if (venueNormalized.includes(key) || key.includes(venueNormalized)) {
      return value;
    }
  }

  if (event && event.toString().toLowerCase().includes('strictly come dancing')) {
    return VENUE_BOOKING_GUIDES['Strictly Come Dancing Live Tour 2025'];
  }

  return null;
}

// ==================== YOUR EXISTING AUTOMATION FUNCTIONS ====================
// I need to see your full Code.gs to include these
// For now, add placeholder functions - replace these with your actual functions

function runFullAutomationUI() {
  SpreadsheetApp.getUi().alert('Please paste your existing runFullAutomationUI function here');
}

function publishReadyEventsUI() {
  SpreadsheetApp.getUi().alert('Please paste your existing publishReadyEventsUI function here');
}

function removeDuplicatesUI() {
  SpreadsheetApp.getUi().alert('Please paste your existing removeDuplicatesUI function here');
}

function removeOldEventsUI() {
  SpreadsheetApp.getUi().alert('Please paste your existing removeOldEventsUI function here');
}

function addCuratedDropdownsUI() {
  SpreadsheetApp.getUi().alert('Please paste your existing addCuratedDropdownsUI function here');
}

function testLinkFinder() {
  SpreadsheetApp.getUi().alert('Please paste your existing testLinkFinder function here');
}

function showNeedsReviewReport() {
  SpreadsheetApp.getUi().alert('Please paste your existing showNeedsReviewReport function here');
}

function clearAllStatus() {
  SpreadsheetApp.getUi().alert('Please paste your existing clearAllStatus function here');
}

function clearPublishedTab() {
  SpreadsheetApp.getUi().alert('Please paste your existing clearPublishedTab function here');
}

// ==================== MULTI-DATE EVENT GROUPER ====================
// Copy from apps-script-multi-date-grouper-v2.js

const CONFIG = {
  SOURCE_SHEET: 'CURATED',
  TARGET_SHEET: 'PUBLISHED',
  TOUR_EVENTS: {
    'Circus Starr Winter Tour': {
      displayName: 'Circus Starr Winter Tour',
      venue: '20 locations across UK',
      category: 'Family, Tour',
      showLocationCount: true
    }
  }
};

function groupMultiDateEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const curatedSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!curatedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error', 'CURATED sheet not found!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const data = curatedSheet.getDataRange().getValues();
  const headers = data[0];

  const groupedEvents = processEventGrouping(data.slice(1));

  let publishedSheet = ss.getSheetByName(CONFIG.TARGET_SHEET);
  if (!publishedSheet) {
    publishedSheet = ss.insertSheet(CONFIG.TARGET_SHEET);
  } else {
    publishedSheet.clear();
  }

  publishedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (groupedEvents.length > 0) {
    publishedSheet.getRange(2, 1, groupedEvents.length, headers.length).setValues(groupedEvents);
  }

  formatPublishedSheet(publishedSheet);
  showGroupingSummary(data.slice(1).length, groupedEvents.length);
}

function processEventGrouping(rows) {
  const grouped = [];
  const processed = new Set();

  for (let i = 0; i < rows.length; i++) {
    if (processed.has(i)) continue;

    const row = rows[i];
    const date = row[0];
    const event = row[1];
    const venue = row[2];

    if (CONFIG.TOUR_EVENTS[event]) {
      const tourDates = [];
      for (let j = i; j < rows.length; j++) {
        if (rows[j][1] === event) {
          tourDates.push(j);
          processed.add(j);
        }
      }

      const tourConfig = CONFIG.TOUR_EVENTS[event];
      const tourRow = [...row];

      tourRow[0] = rows[tourDates[0]][0];

      const startDate = formatDate(rows[tourDates[0]][0]);
      const endDate = formatDate(rows[tourDates[tourDates.length - 1]][0]);
      tourRow[1] = `${tourConfig.displayName} (${startDate} - ${endDate})`;

      tourRow[2] = tourConfig.venue;
      tourRow[3] = `${tourDates.length} dates across UK`;
      tourRow[6] = tourConfig.category;

      grouped.push(tourRow);
      continue;
    }

    const sameDateEvents = [i];
    for (let j = i + 1; j < rows.length; j++) {
      if (processed.has(j)) continue;

      const compareEvent = rows[j][1];
      const compareVenue = rows[j][2];

      const eventMatch = normalizeText(event) === normalizeText(compareEvent);
      const venueMatch = normalizeVenue(venue) === normalizeVenue(compareVenue);

      if (eventMatch && venueMatch) {
        sameDateEvents.push(j);
        processed.add(j);
      }
    }

    processed.add(i);

    if (sameDateEvents.length > 1) {
      const groupedRow = [...row];
      groupedRow[1] = `${groupedRow[1]} (${sameDateEvents.length} dates)`;
      grouped.push(groupedRow);
    } else {
      grouped.push(row);
    }
  }

  return grouped;
}

function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVenue(venue) {
  if (!venue) return '';
  let normalized = venue.toString().toLowerCase().trim();

  normalized = normalized.replace(/\bthe\b/g, '');
  normalized = normalized.replace(/\barena\b/g, '');
  normalized = normalized.replace(/\bstadium\b/g, '');
  normalized = normalized.replace(/,?\s*london$/i, '');
  normalized = normalized.replace(/,?\s*uk$/i, '');

  return normalized.replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr) {
  if (!dateStr) return '';

  const parts = dateStr.toString().split('.');
  if (parts.length !== 3) return dateStr;

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month]}`;
}

function formatPublishedSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  sheet.setFrozenRows(1);

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
