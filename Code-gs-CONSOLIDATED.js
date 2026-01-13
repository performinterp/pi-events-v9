// ==================== PI EVENTS APP - CONSOLIDATED CODE.GS ====================
// Copy this entire file content into your Code.gs in Google Apps Script

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
  // Venues with full booking guides
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
  // Strictly Come Dancing (special case - tour event)
  'Strictly Come Dancing Live Tour 2025': {
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#strictly-come-dancing',
    venueSlug: 'strictly-come-dancing',
    bookingNote: 'Booking process varies by venue - check guide'
  }
};

// ==================== BOOKING GUIDE UI FUNCTIONS ====================
function addBookingGuideColumnsUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: CURATED sheet not found');
    return;
  }

  // Check if columns already exist
  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];

  let hasGuideCol = headers.indexOf('HAS_BOOKING_GUIDE') + 1;
  let guideUrlCol = headers.indexOf('BOOKING_GUIDE_URL') + 1;
  let bookingNoteCol = headers.indexOf('BOOKING_NOTE') + 1;

  // Add headers if they don't exist
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

  // Get all data
  const lastRow = curatedSheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data found in CURATED sheet');
    return;
  }

  const data = curatedSheet.getRange(2, 1, lastRow - 1, curatedSheet.getLastColumn()).getValues();
  let updatedCount = 0;
  let withGuideCount = 0;

  // Process each row
  for (let i = 0; i < data.length; i++) {
    const venue = data[i][2]; // Column C - VENUE
    const event = data[i][1]; // Column B - EVENT

    if (!venue && !event) continue; // Skip completely empty rows

    // Check if venue has a booking guide
    const guideInfo = findBookingGuide(venue, event);

    const rowNum = i + 2; // +2 because we started from row 2

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

  // Get headers
  const curatedHeaders = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const publishedHeaders = publishedSheet.getRange(1, 1, 1, publishedSheet.getLastColumn()).getValues()[0];

  // Find column indices in CURATED
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

  // Check if PUBLISHED has these columns
  let pubHasGuideCol = publishedHeaders.indexOf('HAS_BOOKING_GUIDE') + 1;
  let pubGuideUrlCol = publishedHeaders.indexOf('BOOKING_GUIDE_URL') + 1;
  let pubBookingNoteCol = publishedHeaders.indexOf('BOOKING_NOTE') + 1;

  // Add headers to PUBLISHED if they don't exist
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

  // Get all CURATED data
  const curatedLastRow = curatedSheet.getLastRow();
  if (curatedLastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data found in CURATED sheet');
    return;
  }

  const curatedData = curatedSheet.getRange(1, 1, curatedLastRow, curatedSheet.getLastColumn()).getValues();
  let copiedCount = 0;

  // Clear PUBLISHED data (keep headers)
  if (publishedSheet.getLastRow() > 1) {
    publishedSheet.getRange(2, 1, publishedSheet.getLastRow() - 1, publishedSheet.getLastColumn()).clearContent();
  }

  const publishedRows = [];

  // Process each row (skip header)
  for (let i = 1; i < curatedData.length; i++) {
    const status = curatedData[i][9]; // Column J - STATUS

    if (status === 'Ready') {
      const row = [
        curatedData[i][0],  // DATE
        curatedData[i][1],  // EVENT
        curatedData[i][2],  // VENUE
        curatedData[i][3],  // TIME
        curatedData[i][4],  // INTERPRETERS
        curatedData[i][5],  // INTERPRETATION
        curatedData[i][6],  // CATEGORY
        curatedData[i][7],  // IMAGE URL
        curatedData[i][8],  // TICKET_LINK
        curatedData[i][hasGuideCol - 1],    // HAS_BOOKING_GUIDE
        curatedData[i][guideUrlCol - 1],    // BOOKING_GUIDE_URL
        curatedData[i][bookingNoteCol - 1]  // BOOKING_NOTE
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

// ==================== HELPER: FIND BOOKING GUIDE ====================
function findBookingGuide(venue, event) {
  // Handle null/undefined
  if (!venue && !event) return null;

  // Normalize venue name for comparison
  const venueNormalized = venue ? venue.toString().trim() : '';

  // Check for exact match first
  if (VENUE_BOOKING_GUIDES[venueNormalized]) {
    return VENUE_BOOKING_GUIDES[venueNormalized];
  }

  // Check for partial matches (e.g., "The O2" matches "The O2, London")
  for (const [key, value] of Object.entries(VENUE_BOOKING_GUIDES)) {
    if (venueNormalized.includes(key) || key.includes(venueNormalized)) {
      return value;
    }
  }

  // Check if event itself is a special case (like Strictly Come Dancing)
  if (event && event.toString().toLowerCase().includes('strictly come dancing')) {
    return VENUE_BOOKING_GUIDES['Strictly Come Dancing Live Tour 2025'];
  }

  return null;
}

// ==================== PASTE YOUR EXISTING CODE.GS FUNCTIONS BELOW THIS LINE ====================
// (Keep all your existing functions like runFullAutomationUI, publishReadyEventsUI, etc.)
