// ==================== BOOKING GUIDE ENRICHER ====================
// Adds venue-specific BSL booking guide links to CURATED events
// Automatically detects which venues have booking guides available

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

// ==================== MAIN FUNCTION ====================
function addBookingGuideColumns() {
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
  const data = curatedSheet.getDataRange().getValues();
  let updatedCount = 0;
  let withGuideCount = 0;

  // Process each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const venue = data[i][2]; // Column C - VENUE
    const event = data[i][1]; // Column B - EVENT

    if (!venue) continue;

    // Check if venue has a booking guide
    const guideInfo = findBookingGuide(venue, event);

    if (guideInfo) {
      curatedSheet.getRange(i + 1, hasGuideCol).setValue('TRUE');
      curatedSheet.getRange(i + 1, guideUrlCol).setValue(guideInfo.guideUrl);
      curatedSheet.getRange(i + 1, bookingNoteCol).setValue(guideInfo.bookingNote);
      withGuideCount++;
    } else {
      curatedSheet.getRange(i + 1, hasGuideCol).setValue('FALSE');
      curatedSheet.getRange(i + 1, guideUrlCol).setValue('');
      curatedSheet.getRange(i + 1, bookingNoteCol).setValue('Contact venue directly about BSL availability');
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

// ==================== HELPER: FIND BOOKING GUIDE ====================
function findBookingGuide(venue, event) {
  // Normalize venue name for comparison
  const venueNormalized = venue.toString().trim();

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

// ==================== COPY TO PUBLISHED ====================
function updatePublishedWithBookingGuides() {
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
  const curatedData = curatedSheet.getDataRange().getValues();
  let copiedCount = 0;

  // Copy Ready events to PUBLISHED with booking guide info
  publishedSheet.getRange(2, 1, publishedSheet.getLastRow() - 1, publishedSheet.getLastColumn()).clearContent();

  const publishedRows = [];
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

// ==================== ADD MORE VENUES ====================
function addVenueToBookingGuides() {
  const ui = SpreadsheetApp.getUi();

  const venueName = ui.prompt(
    'Add Venue to Booking Guides',
    'Enter venue name exactly as it appears in your data:',
    ui.ButtonSet.OK_CANCEL
  );

  if (venueName.getSelectedButton() !== ui.Button.OK) return;

  const venue = venueName.getResponseText();
  const venueSlug = venue.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

  const note = ui.prompt(
    'Booking Note',
    'Enter booking note (e.g., "Contact venue before purchasing"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (note.getSelectedButton() !== ui.Button.OK) return;

  const bookingNote = note.getResponseText();

  ui.alert(
    'Venue Details',
    `Add this to the VENUE_BOOKING_GUIDES object:\n\n` +
    `'${venue}': {\n` +
    `  hasGuide: true,\n` +
    `  guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#${venueSlug}',\n` +
    `  venueSlug: '${venueSlug}',\n` +
    `  bookingNote: '${bookingNote}'\n` +
    `},\n\n` +
    `Don't forget to add the venue section to your booking guide page!`,
    ui.ButtonSet.OK
  );
}
