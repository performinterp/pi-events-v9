// ==================== PI EVENTS APP - IMPROVED CODE.GS WITH CONFIG SHEET ====================
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
    .addItem('⚙️ Setup CONFIG Sheet', 'setupConfigSheet')
    .addItem('📖 Add Venue to Booking Guides', 'addVenueToConfigUI')
    .addToUi();
}

// ==================== CONFIG SHEET SETUP ====================
function setupConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');

  if (configSheet) {
    const response = SpreadsheetApp.getUi().alert(
      '⚠️ CONFIG Sheet Exists',
      'CONFIG sheet already exists. Overwrite with default venues?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );

    if (response !== SpreadsheetApp.getUi().Button.YES) return;
    configSheet.clear();
  } else {
    configSheet = ss.insertSheet('CONFIG');
  }

  // Add headers
  const headers = ['VENUE_NAME', 'HAS_GUIDE', 'GUIDE_URL', 'VENUE_SLUG', 'BOOKING_NOTE'];
  configSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Add default venues
  const defaultVenues = [
    ['The O2, London', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#the-o2-london', 'the-o2-london', 'Purchase tickets first, then contact venue for BSL'],
    ['The O2 Arena, London', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#the-o2-london', 'the-o2-london', 'Purchase tickets first, then contact venue for BSL'],
    ['Wembley Stadium', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#wembley-stadium', 'wembley-stadium', 'Contact venue before purchasing tickets'],
    ['Wembley Stadium, London', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#wembley-stadium', 'wembley-stadium', 'Contact venue before purchasing tickets'],
    ['Southbank Centre', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#southbank-centre', 'southbank-centre', 'Contact venue before purchasing tickets'],
    ['Southbank Centre, London', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#southbank-centre', 'southbank-centre', 'Contact venue before purchasing tickets'],
    ['Motorpoint Arena Nottingham', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#motorpoint-arena-nottingham', 'motorpoint-arena-nottingham', 'Purchase tickets first, then contact venue for BSL'],
    ['Strictly Come Dancing Live Tour 2025', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#strictly-come-dancing', 'strictly-come-dancing', 'Booking process varies by venue - check guide']
  ];

  configSheet.getRange(2, 1, defaultVenues.length, headers.length).setValues(defaultVenues);

  // Format the sheet
  const headerRange = configSheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  configSheet.setFrozenRows(1);
  for (let i = 1; i <= headers.length; i++) {
    configSheet.autoResizeColumn(i);
  }

  SpreadsheetApp.getUi().alert(
    '✅ CONFIG Sheet Created!',
    `Created CONFIG sheet with ${defaultVenues.length} default venues.\n\n` +
    'You can now add more venues directly in the CONFIG sheet!',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ==================== ADD VENUE TO CONFIG ====================
function addVenueToConfigUI() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    const response = ui.alert(
      '⚠️ CONFIG Sheet Missing',
      'CONFIG sheet not found. Create it now?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      setupConfigSheet();
      configSheet = ss.getSheetByName('CONFIG');
    } else {
      return;
    }
  }

  const venueName = ui.prompt(
    'Add Venue to Booking Guides',
    'Enter venue name exactly as it appears in your data:',
    ui.ButtonSet.OK_CANCEL
  );

  if (venueName.getSelectedButton() !== ui.Button.OK) return;

  const venue = venueName.getResponseText();
  const venueSlug = venue.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

  const hasGuide = ui.alert(
    'Booking Guide Available?',
    'Does this venue have a booking guide page?',
    ui.ButtonSet.YES_NO
  );

  if (hasGuide === ui.Button.YES) {
    const note = ui.prompt(
      'Booking Note',
      'Enter booking note (e.g., "Contact venue before purchasing"):',
      ui.ButtonSet.OK_CANCEL
    );

    if (note.getSelectedButton() !== ui.Button.OK) return;

    const bookingNote = note.getResponseText();
    const guideUrl = `https://app.performanceinterpreting.co.uk/booking-guide#${venueSlug}`;

    // Add to CONFIG sheet
    const newRow = [venue, 'TRUE', guideUrl, venueSlug, bookingNote];
    configSheet.appendRow(newRow);

    ui.alert(
      '✅ Venue Added!',
      `Added "${venue}" to CONFIG sheet.\n\n` +
      `Guide URL: ${guideUrl}\n\n` +
      `Don't forget to add the venue section to your booking guide page!`,
      ui.ButtonSet.OK
    );
  } else {
    // Venue without guide
    const newRow = [venue, 'FALSE', '', '', 'Contact venue directly about BSL availability'];
    configSheet.appendRow(newRow);

    ui.alert(
      '✅ Venue Added!',
      `Added "${venue}" to CONFIG sheet (no booking guide).`,
      ui.ButtonSet.OK
    );
  }
}

// ==================== LOAD BOOKING GUIDES FROM CONFIG ====================
function loadBookingGuidesFromConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    Logger.log('CONFIG sheet not found - using empty booking guides');
    return {};
  }

  const data = configSheet.getDataRange().getValues();
  const bookingGuides = {};

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const [venueName, hasGuide, guideUrl, venueSlug, bookingNote] = data[i];

    if (!venueName) continue;

    bookingGuides[venueName] = {
      hasGuide: hasGuide === 'TRUE' || hasGuide === true,
      guideUrl: guideUrl || '',
      venueSlug: venueSlug || '',
      bookingNote: bookingNote || 'Contact venue directly about BSL availability'
    };
  }

  return bookingGuides;
}

// ==================== MAIN AUTOMATION ====================
function runFullAutomationUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔄 Run Full Automation',
    'This will:\n\n' +
    '1. Import approved events from PI Work Flow\n' +
    '2. Find ticket links automatically\n' +
    '3. Detect categories\n' +
    '4. Add booking guide information\n' +
    '5. Add status dropdowns\n' +
    '6. Remove duplicates\n\n' +
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

  // Load booking guides from CONFIG sheet
  const bookingGuides = loadBookingGuidesFromConfig();

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

      // Get booking guide info from CONFIG
      const guideInfo = findBookingGuideFromConfig(venue, event, bookingGuides);

      approvedEvents.push([
        date,
        event,
        venue,
        time,
        interpreters,
        interpretation,
        category,
        imageUrl,
        ticketLink,
        'Pending',
        guideInfo.hasGuide ? 'TRUE' : 'FALSE',
        guideInfo.guideUrl,
        guideInfo.bookingNote
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
      'INTERPRETATION', 'CATEGORY', 'IMAGE_URL', 'TICKET_LINK', 'STATUS',
      'HAS_BOOKING_GUIDE', 'BOOKING_GUIDE_URL', 'BOOKING_NOTE'
    ]);
  }

  curatedSheet.getRange(curatedSheet.getLastRow() + 1, 1, approvedEvents.length, 13)
    .setValues(approvedEvents);
}

function findBookingGuideFromConfig(venue, event, bookingGuides) {
  if (!venue && !event) {
    return {
      hasGuide: false,
      guideUrl: '',
      bookingNote: 'Contact venue directly about BSL availability'
    };
  }

  const venueNormalized = venue ? venue.toString().trim() : '';

  // Check for exact match first
  if (bookingGuides[venueNormalized]) {
    return bookingGuides[venueNormalized];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(bookingGuides)) {
    if (venueNormalized.includes(key) || key.includes(venueNormalized)) {
      return value;
    }
  }

  // Check if event itself is a special case (like Strictly Come Dancing)
  if (event && event.toString().toLowerCase().includes('strictly come dancing')) {
    const strictlyGuide = bookingGuides['Strictly Come Dancing Live Tour 2025'];
    if (strictlyGuide) return strictlyGuide;
  }

  return {
    hasGuide: false,
    guideUrl: '',
    bookingNote: 'Contact venue directly about BSL availability'
  };
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
    'Copy all events marked "Ready" to PUBLISHED tab?\n\n' +
    'This will include booking guide information.',
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

  // Format published sheet
  const headerRange = publishedSheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');
  publishedSheet.setFrozenRows(1);

  ui.alert('✅ Success', `Published ${readyEvents.length} ready events with booking guide info`, ui.ButtonSet.OK);
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
