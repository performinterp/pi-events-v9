// ==================== PI EVENTS APP - COMPLETE CODE.GS ====================
// Copy this ENTIRE file into your Code.gs in Apps Script

// ==================== CONFIGURATION ====================
const SOURCE_SPREADSHEET_ID = '1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8';

const CATEGORY_KEYWORDS = {
  'Music': ['concert', 'gig', 'festival', 'tour', 'live music', 'band', 'singer', 'orchestra', 'symphony'],
  'Comedy': ['comedy', 'stand-up', 'comedian'],
  'Theatre': ['theatre', 'play', 'musical', 'opera', 'ballet', 'dance'],
  'Sports': ['match', 'game', 'vs', 'v ', 'football', 'rugby', 'cricket', 'boxing', 'f1', 'formula 1'],
  'Family': ['family', 'kids', 'children', 'pantomime', 'panto', 'circus'],
  'Tour': ['tour', 'live tour']
};

const TICKET_LINK_PATTERNS = [
  { domain: 'ticketmaster.co.uk', name: 'Ticketmaster' },
  { domain: 'axs.com', name: 'AXS' },
  { domain: 'seetickets.com', name: 'See Tickets' },
  { domain: 'eventim.co.uk', name: 'Eventim' },
  { domain: 'theo2.co.uk', name: 'The O2' },
  { domain: 'aegpresents.co.uk', name: 'AEG Presents' },
  { domain: 'gigsandtours.com', name: 'Gigs and Tours' }
];

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

// ==================== MAIN AUTOMATION ====================
function runFullAutomationUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔄 Run Full Automation',
    'This will:\n\n' +
    '1. Import approved events from PI Work Flow\n' +
    '2. Find ticket links automatically\n' +
    '3. Detect categories\n' +
    '4. Add status dropdowns\n' +
    '5. Remove duplicates\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  try {
    importApprovedEvents();
    addCuratedDropdowns();
    removeDuplicates();
    ui.alert('✅ Automation Complete!', 'Check the CURATED tab to review events.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Error', 'Automation failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function importApprovedEvents() {
  const targetSs = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = targetSs.getSheetByName('CURATED') || targetSs.insertSheet('CURATED');

  const sourceSs = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);

  const monthlyTabs = [
    'October 2025', 'November 2025', 'December 2025',
    'January 2026', 'February 2026', 'March 2026',
    'April 2026', 'May 2026', 'June 2026',
    'July 2026', 'August 2026', 'September 2026'
  ];

  const approvedEvents = [];

  monthlyTabs.forEach(tabName => {
    const sheet = sourceSs.getSheetByName(tabName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const markedYes = data[i][8];
      if (markedYes !== 'Yes' && markedYes !== 'yes' && markedYes !== 'YES') continue;

      const date = data[i][0];
      const event = data[i][1];
      const venue = data[i][2];
      const time = data[i][3];
      const interpreters = data[i][4];
      const interpretation = data[i][5];

      if (!event || !venue) continue;

      const category = detectCategory(event, venue);
      const ticketLink = findTicketLink(event, venue);
      const imageUrl = findImageUrl(event);

      approvedEvents.push([
        date, event, venue, time, interpreters, interpretation,
        category, imageUrl, ticketLink, 'Pending'
      ]);
    }
  });

  if (approvedEvents.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ No approved events found');
    return;
  }

  if (curatedSheet.getLastRow() === 0) {
    curatedSheet.appendRow([
      'DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS',
      'INTERPRETATION', 'CATEGORY', 'IMAGE_URL', 'TICKET_LINK', 'STATUS'
    ]);
  }

  curatedSheet.getRange(curatedSheet.getLastRow() + 1, 1, approvedEvents.length, 10)
    .setValues(approvedEvents);
}

function detectCategory(event, venue) {
  const text = `${event} ${venue}`.toLowerCase();
  const categories = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category);
    }
  }

  return categories.length > 0 ? categories.join(', ') : 'Other';
}

function findTicketLink(event, venue) {
  const searchQuery = `${event} ${venue} tickets`;

  try {
    const results = UrlFetchApp.fetch(
      `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      { muteHttpExceptions: true }
    ).getContentText();

    for (const pattern of TICKET_LINK_PATTERNS) {
      const regex = new RegExp(`https?://[^"\\s]*${pattern.domain}[^"\\s]*`, 'i');
      const match = results.match(regex);
      if (match) {
        return match[0].split('"')[0];
      }
    }
  } catch (error) {
    Logger.log('Link search failed: ' + error);
  }

  return 'NEEDS_REVIEW';
}

function findImageUrl(event) {
  return '';
}

// ==================== PUBLISH READY EVENTS ====================
function publishReadyEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📤 Publish Ready Events',
    'Copy all events marked "Ready" to PUBLISHED tab?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');
  const publishedSheet = ss.getSheetByName('PUBLISHED') || ss.insertSheet('PUBLISHED');

  if (!curatedSheet) {
    ui.alert('❌ Error: CURATED sheet not found');
    return;
  }

  const data = curatedSheet.getDataRange().getValues();
  const headers = data[0];
  const readyEvents = data.filter((row, index) => index > 0 && row[9] === 'Ready');

  publishedSheet.clear();
  publishedSheet.appendRow(headers);

  if (readyEvents.length > 0) {
    publishedSheet.getRange(2, 1, readyEvents.length, headers.length)
      .setValues(readyEvents);
  }

  ui.alert('✅ Success', `Published ${readyEvents.length} ready events`, ui.ButtonSet.OK);
}

// ==================== DUPLICATE REMOVAL ====================
function removeDuplicatesUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🧼 Remove Duplicates',
    'Remove duplicate events from CURATED?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const removed = removeDuplicates();
  ui.alert('✅ Success', `Removed ${removed} duplicate events`, ui.ButtonSet.OK);
}

function removeDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CURATED');
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  const seen = new Set();
  const uniqueRows = [data[0]];
  let removedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const key = `${data[i][0]}_${data[i][1]}_${data[i][2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(data[i]);
    } else {
      removedCount++;
    }
  }

  sheet.clear();
  sheet.getRange(1, 1, uniqueRows.length, uniqueRows[0].length).setValues(uniqueRows);

  return removedCount;
}

// ==================== REMOVE OLD EVENTS ====================
function removeOldEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗑️ Remove Old Events',
    'Remove events older than today from CURATED?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const removed = removeOldEvents();
  ui.alert('✅ Success', `Removed ${removed} old events`, ui.ButtonSet.OK);
}

function removeOldEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CURATED');
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureRows = [data[0]];
  let removedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0];
    if (!dateStr) continue;

    const eventDate = parseDate(dateStr);
    if (eventDate >= today) {
      futureRows.push(data[i]);
    } else {
      removedCount++;
    }
  }

  sheet.clear();
  sheet.getRange(1, 1, futureRows.length, futureRows[0].length).setValues(futureRows);

  return removedCount;
}

function parseDate(dateStr) {
  const parts = dateStr.toString().split('.');
  if (parts.length !== 3) return new Date(dateStr);

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);

  return new Date(year, month, day);
}

// ==================== DROPDOWNS ====================
function addCuratedDropdownsUI() {
  const ui = SpreadsheetApp.getUi();
  addCuratedDropdowns();
  ui.alert('✅ Success', 'Dropdowns added to STATUS column', ui.ButtonSet.OK);
}

function addCuratedDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CURATED');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const statusColumn = 10;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Ready', 'Needs Review'], true)
    .build();

  sheet.getRange(2, statusColumn, lastRow - 1, 1).setDataValidation(rule);
}

// ==================== UTILITY FUNCTIONS ====================
function testLinkFinder() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔍 Test Link Finder',
    'Enter event name and venue (e.g., "Coldplay Wembley Stadium"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const parts = response.getResponseText().split(' ');
  const event = parts.slice(0, -2).join(' ');
  const venue = parts.slice(-2).join(' ');

  const link = findTicketLink(event, venue);
  ui.alert('🔗 Result', `Found link: ${link}`, ui.ButtonSet.OK);
}

function showNeedsReviewReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CURATED');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ CURATED sheet not found');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const needsReview = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === 'NEEDS_REVIEW') {
      needsReview.push(`${data[i][1]} at ${data[i][2]}`);
    }
  }

  if (needsReview.length === 0) {
    SpreadsheetApp.getUi().alert('✅ All events have ticket links!');
  } else {
    SpreadsheetApp.getUi().alert(
      '📧 Events Needing Manual Links',
      needsReview.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function clearAllStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CURATED');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  sheet.getRange(2, 10, lastRow - 1, 1).setValue('Pending');
  SpreadsheetApp.getUi().alert('✅ All status reset to Pending');
}

function clearPublishedTab() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗑️ Clear PUBLISHED Tab',
    'This will delete all data in PUBLISHED. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PUBLISHED');
  if (sheet) {
    sheet.clear();
    ui.alert('✅ PUBLISHED tab cleared');
  }
}

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

// ==================== MULTI-DATE EVENT GROUPER ====================
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

      const startDate = formatDateShort(rows[tourDates[0]][0]);
      const endDate = formatDateShort(rows[tourDates[tourDates.length - 1]][0]);
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

function formatDateShort(dateStr) {
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
