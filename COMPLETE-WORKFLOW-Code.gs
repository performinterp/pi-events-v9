// ==================== PI EVENTS APP - COMPLETE MULTI-STAGE WORKFLOW ====================
// Proper workflow: PUBLIC_APPROVED → RAW_DATA → ENRICHED → CURATED → PUBLISHED
// This script handles all stages with preservation of manual edits

// ==================== CONFIGURATION ====================
const SOURCE_SPREADSHEET_ID = '1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU'; // PI Work Flow

const CATEGORY_KEYWORDS = {
  'Concert': ['concert', 'gig', 'live music', 'band', 'singer', 'orchestra', 'symphony', 'musical', 'tour'],
  'Sports': ['football', 'stadium', 'match', 'ko -', 'arena', 'vs ', 'premier league', 'champions league'],
  'Theatre': ['theatre', 'play', 'musical', 'show', 'performance', 'drama'],
  'Comedy': ['comedy', 'stand-up', 'comedian'],
  'Family': ['family', 'kids', 'children', 'disney', 'circus', 'ice', 'pantomime'],
  'Festival': ['festival', 'pride', 'fringe'],
  'Cultural': ['cultural', 'heritage', 'traditional', 'celebration']
};

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('🔄 Run Full Automation', 'runFullAutomationUI')
    .addSeparator()
    .addItem('📥 Step 1: Import to RAW_DATA', 'importToRawUI')
    .addItem('⚡ Step 2: Enrich RAW → ENRICHED', 'enrichRawToEnrichedUI')
    .addItem('📋 Step 3: Move to CURATED', 'moveEnrichedToCuratedUI')
    .addItem('📤 Step 4: Publish Ready Events', 'publishReadyEventsUI')
    .addSeparator()
    .addItem('🗑️ Remove Duplicate Events', 'removeDuplicates')
    .addItem('🗓️ Remove Old Events from CURATED', 'removeOldEventsUI')
    .addItem('🔧 Add Dropdowns to CURATED Status', 'addCuratedDropdowns')
    .addItem('🔍 Test Link Finder', 'testLinkFinder')
    .addItem('📊 Review Events Needing Manual Links', 'showNeedsReviewReport')
    .addItem('🧹 Clear All Status', 'clearAllStatus')
    .addItem('🗑️ Clear PUBLISHED Tab', 'clearPublishedTab')
    .addSeparator()
    .addItem('📅 Group Multi-Date Events', 'groupMultiDateEventsUI')
    .addSeparator()
    .addItem('⚙️ Setup CONFIG Sheet', 'setupConfigSheet')
    .addItem('📖 Add Venue to Booking Guides', 'addVenueToConfigUI')
    .addItem('🔄 Refresh Booking Guide Data', 'refreshBookingGuidesUI')
    .addToUi();
}

// ==================== FULL AUTOMATION ====================
function runFullAutomationUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔄 Run Full Automation',
    'This will run all stages:\n\n' +
    '1. Import from PUBLIC_APPROVED → RAW_DATA\n' +
    '2. Enrich RAW_DATA → ENRICHED (links, categories)\n' +
    '3. Move ENRICHED → CURATED (preserve existing)\n' +
    '4. Add booking guide info\n' +
    '5. Remove duplicates\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  try {
    // Step 1: Import to RAW
    const importResult = importToRaw();

    // Step 2: Enrich RAW → ENRICHED
    const enrichResult = enrichRawToEnriched();

    // Step 3: Move to CURATED
    const curatedResult = moveEnrichedToCurated();

    // Step 4: Add booking guides
    addBookingGuidesToCurated();

    // Step 5: Add dropdowns and remove dupes
    addCuratedDropdowns();
    removeDuplicates();

    ui.alert(
      '✅ Full Automation Complete!',
      `Step 1: ${importResult.imported} events imported to RAW_DATA (${importResult.skipped} already existed)\n` +
      `Step 2: ${enrichResult.enriched} events enriched to ENRICHED\n` +
      `Step 3: ${curatedResult.moved} events moved to CURATED (${curatedResult.skipped} already existed)\n\n` +
      'Check CURATED tab to review new events!',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Automation failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

// ==================== STEP 1: IMPORT PUBLIC_APPROVED → RAW_DATA ====================
function importToRawUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📥 Import to RAW_DATA',
    'Import approved events from PI Work Flow PUBLIC_APPROVED tab to RAW_DATA.\n\n' +
    'This preserves existing events in RAW_DATA.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = importToRaw();
    ui.alert(
      '✅ Import Complete!',
      `${result.imported} new events imported to RAW_DATA\n` +
      `${result.skipped} events already existed (preserved)`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Import failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function importToRaw() {
  const targetSs = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = targetSs.getSheetByName('RAW_DATA') || targetSs.insertSheet('RAW_DATA');

  // Ensure headers exist
  if (rawSheet.getLastRow() === 0) {
    const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS'];
    rawSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    rawSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    rawSheet.setFrozenRows(1);
  }

  const sourceSs = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const publicApprovedSheet = sourceSs.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    throw new Error('PUBLIC_APPROVED sheet not found in PI Work Flow');
  }

  // Get existing events in RAW_DATA
  const existingEvents = new Set();
  if (rawSheet.getLastRow() > 1) {
    const existing = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 3).getValues();
    existing.forEach(row => {
      existingEvents.add(`${row[0]}_${row[1]}_${row[2]}`); // date_event_venue
    });
  }

  // Get data from PUBLIC_APPROVED
  const sourceData = publicApprovedSheet.getDataRange().getValues();
  const newEvents = [];
  let skippedCount = 0;

  for (let i = 1; i < sourceData.length; i++) {
    const date = sourceData[i][0];
    const event = sourceData[i][1];
    const venue = sourceData[i][2];
    const time = sourceData[i][3];
    const interpreters = sourceData[i][4];

    if (!date || !event) continue;

    // Check if already exists
    const eventKey = `${date}_${event}_${venue}`;
    if (existingEvents.has(eventKey)) {
      skippedCount++;
      continue;
    }

    newEvents.push([date, event, venue, time, interpreters]);
  }

  // Append new events
  if (newEvents.length > 0) {
    rawSheet.getRange(rawSheet.getLastRow() + 1, 1, newEvents.length, 5).setValues(newEvents);
  }

  return { imported: newEvents.length, skipped: skippedCount };
}

// ==================== STEP 2: ENRICH RAW_DATA → ENRICHED ====================
function enrichRawToEnrichedUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '⚡ Enrich Events',
    'Move events from RAW_DATA to ENRICHED and add:\n\n' +
    '• Ticket links (automatic search)\n' +
    '• Categories (auto-detect)\n' +
    '• Image URLs (auto-search)\n' +
    '• Interpretation type (BSL & ISL)\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = enrichRawToEnriched();
    ui.alert(
      '✅ Enrichment Complete!',
      `${result.enriched} events enriched and moved to ENRICHED\n` +
      `${result.skipped} events already existed (preserved)`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Enrichment failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function enrichRawToEnriched() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('RAW_DATA');
  const enrichedSheet = ss.getSheetByName('ENRICHED') || ss.insertSheet('ENRICHED');

  if (!rawSheet) {
    throw new Error('RAW_DATA sheet not found');
  }

  // Ensure headers exist in ENRICHED
  if (enrichedSheet.getLastRow() === 0) {
    const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS', 'INTERPRETATION', 'CATEGORY', 'IMAGE URL', 'TICKET LINK', 'STATUS', 'LINK_CONFIDENCE'];
    enrichedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    enrichedSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    enrichedSheet.setFrozenRows(1);
  }

  // Get existing events in ENRICHED
  const existingEvents = new Set();
  if (enrichedSheet.getLastRow() > 1) {
    const existing = enrichedSheet.getRange(2, 1, enrichedSheet.getLastRow() - 1, 3).getValues();
    existing.forEach(row => {
      existingEvents.add(`${row[0]}_${row[1]}_${row[2]}`);
    });
  }

  // Get events from RAW_DATA
  const rawData = rawSheet.getDataRange().getValues();
  const newEvents = [];
  let skippedCount = 0;

  for (let i = 1; i < rawData.length; i++) {
    const date = rawData[i][0];
    const event = rawData[i][1];
    const venue = rawData[i][2];
    const time = rawData[i][3];
    const interpreters = rawData[i][4];

    if (!date || !event) continue;

    const eventKey = `${date}_${event}_${venue}`;
    if (existingEvents.has(eventKey)) {
      skippedCount++;
      continue;
    }

    // Detect interpretation type
    const interpretation = venue && venue.toLowerCase().includes('ireland') ? 'ISL' : 'BSL';

    // Detect category
    const category = detectCategory(event, venue);

    // Find ticket link
    const linkResult = findTicketLink(event, venue);

    // Try to find image
    const imageUrl = ''; // Could add image search here

    // Set initial status based on link confidence
    let status = 'Review Links';
    if (linkResult.confidence === 'HIGH') {
      status = 'Ready';
    } else if (linkResult.confidence === 'NONE') {
      status = 'Waiting';
    }

    newEvents.push([
      date,
      event,
      venue,
      time,
      interpreters,
      interpretation,
      category,
      imageUrl,
      linkResult.link,
      status,
      linkResult.confidenceLabel
    ]);
  }

  // Append enriched events
  if (newEvents.length > 0) {
    enrichedSheet.getRange(enrichedSheet.getLastRow() + 1, 1, newEvents.length, 11).setValues(newEvents);
  }

  return { enriched: newEvents.length, skipped: skippedCount };
}

// ==================== STEP 3: MOVE ENRICHED → CURATED ====================
function moveEnrichedToCuratedUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📋 Move to CURATED',
    'Move events from ENRICHED to CURATED.\n\n' +
    'Preserves existing events and manual edits in CURATED.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = moveEnrichedToCurated();
    ui.alert(
      '✅ Move Complete!',
      `${result.moved} events moved to CURATED\n` +
      `${result.skipped} events already existed (preserved)`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Move failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function moveEnrichedToCurated() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enrichedSheet = ss.getSheetByName('ENRICHED');
  const curatedSheet = ss.getSheetByName('CURATED') || ss.insertSheet('CURATED');

  if (!enrichedSheet) {
    throw new Error('ENRICHED sheet not found');
  }

  // Ensure headers exist in CURATED (with booking guide columns)
  if (curatedSheet.getLastRow() === 0) {
    const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS', 'INTERPRETATION', 'CATEGORY', 'IMAGE URL', 'TICKET LINK', 'STATUS', 'LINK_CONFIDENCE', 'HAS_BOOKING_GUIDE', 'BOOKING_GUIDE_URL', 'BOOKING_NOTE'];
    curatedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    curatedSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    curatedSheet.setFrozenRows(1);
  }

  // Get existing events in CURATED
  const existingEvents = new Set();
  if (curatedSheet.getLastRow() > 1) {
    const existing = curatedSheet.getRange(2, 1, curatedSheet.getLastRow() - 1, 3).getValues();
    existing.forEach(row => {
      existingEvents.add(`${row[0]}_${row[1]}_${row[2]}`);
    });
  }

  // Get events from ENRICHED
  const enrichedData = enrichedSheet.getDataRange().getValues();
  const newEvents = [];
  let skippedCount = 0;

  for (let i = 1; i < enrichedData.length; i++) {
    const date = enrichedData[i][0];
    const event = enrichedData[i][1];
    const venue = enrichedData[i][2];

    if (!date || !event) continue;

    const eventKey = `${date}_${event}_${venue}`;
    if (existingEvents.has(eventKey)) {
      skippedCount++;
      continue;
    }

    // Copy all enriched data and add empty booking guide columns
    const row = enrichedData[i].slice(0, 11); // Get first 11 columns from ENRICHED
    row.push('FALSE', '', 'Contact venue directly about BSL availability'); // Add booking guide columns

    newEvents.push(row);
  }

  // Append to CURATED
  if (newEvents.length > 0) {
    curatedSheet.getRange(curatedSheet.getLastRow() + 1, 1, newEvents.length, 14).setValues(newEvents);
  }

  return { moved: newEvents.length, skipped: skippedCount };
}

// ==================== ADD BOOKING GUIDES TO CURATED ====================
function addBookingGuidesToCurated() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const bookingGuides = loadBookingGuidesFromConfig();
  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];

  const hasGuideCol = headers.indexOf('HAS_BOOKING_GUIDE') + 1;
  const guideUrlCol = headers.indexOf('BOOKING_GUIDE_URL') + 1;
  const bookingNoteCol = headers.indexOf('BOOKING_NOTE') + 1;

  if (!hasGuideCol || !guideUrlCol || !bookingNoteCol) return;

  const data = curatedSheet.getRange(2, 1, curatedSheet.getLastRow() - 1, curatedSheet.getLastColumn()).getValues();

  for (let i = 0; i < data.length; i++) {
    const venue = data[i][2]; // Column C - VENUE
    const event = data[i][1]; // Column B - EVENT

    // Skip if already has booking guide info
    if (data[i][hasGuideCol - 1] === 'TRUE' || data[i][hasGuideCol - 1] === 'FALSE') continue;

    const guideInfo = findBookingGuideFromConfig(venue, event, bookingGuides);
    const rowNum = i + 2;

    curatedSheet.getRange(rowNum, hasGuideCol).setValue(guideInfo.hasGuide ? 'TRUE' : 'FALSE');
    curatedSheet.getRange(rowNum, guideUrlCol).setValue(guideInfo.guideUrl);
    curatedSheet.getRange(rowNum, bookingNoteCol).setValue(guideInfo.bookingNote);
  }
}

// ==================== BOOKING GUIDE HELPERS ====================
function loadBookingGuidesFromConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  const guides = {};

  if (!configSheet) return guides;

  const data = configSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;

    const venueName = data[i][0];
    guides[venueName.toLowerCase()] = {
      hasGuide: data[i][1] === 'TRUE' || data[i][1] === true,
      guideUrl: data[i][2] || '',
      venueSlug: data[i][3] || '',
      bookingNote: data[i][4] || 'Contact venue directly about BSL availability'
    };
  }

  return guides;
}

function findBookingGuideFromConfig(venue, event, bookingGuides) {
  if (!venue) {
    return {
      hasGuide: false,
      guideUrl: '',
      bookingNote: 'Contact venue directly about BSL availability'
    };
  }

  const venueLower = venue.toLowerCase();

  for (const [configVenue, guide] of Object.entries(bookingGuides)) {
    if (venueLower.includes(configVenue) || configVenue.includes(venueLower)) {
      return {
        hasGuide: guide.hasGuide,
        guideUrl: guide.guideUrl,
        bookingNote: guide.bookingNote
      };
    }
  }

  return {
    hasGuide: false,
    guideUrl: '',
    bookingNote: 'Contact venue directly about BSL availability'
  };
}

// ==================== REFRESH BOOKING GUIDES ====================
function refreshBookingGuidesUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔄 Refresh Booking Guide Data',
    'This will update ALL events in CURATED with the latest booking guide information from CONFIG.\n\n' +
    'Use this after:\n' +
    '• Updating booking notes in CONFIG\n' +
    '• Adding new venues to CONFIG\n' +
    '• Changing venue guide URLs\n\n' +
    'This ONLY updates booking guide columns, preserves everything else.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = refreshBookingGuides();
    ui.alert(
      '✅ Booking Guides Refreshed!',
      `Updated ${result.updated} events\n` +
      `${result.withGuides} events have booking guides\n` +
      `${result.updated - result.withGuides} events need direct venue contact`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Failed to refresh: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function refreshBookingGuides() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet) {
    throw new Error('CURATED sheet not found');
  }

  const bookingGuides = loadBookingGuidesFromConfig();
  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];

  const hasGuideCol = headers.indexOf('HAS_BOOKING_GUIDE') + 1;
  const guideUrlCol = headers.indexOf('BOOKING_GUIDE_URL') + 1;
  const bookingNoteCol = headers.indexOf('BOOKING_NOTE') + 1;

  if (!hasGuideCol || !guideUrlCol || !bookingNoteCol) {
    throw new Error('Booking guide columns not found');
  }

  const lastRow = curatedSheet.getLastRow();
  if (lastRow <= 1) {
    return { updated: 0, withGuides: 0 };
  }

  const data = curatedSheet.getRange(2, 1, lastRow - 1, curatedSheet.getLastColumn()).getValues();
  let updatedCount = 0;
  let withGuideCount = 0;

  for (let i = 0; i < data.length; i++) {
    const venue = data[i][2];
    const event = data[i][1];

    if (!venue && !event) continue;

    const guideInfo = findBookingGuideFromConfig(venue, event, bookingGuides);
    const rowNum = i + 2;

    curatedSheet.getRange(rowNum, hasGuideCol).setValue(guideInfo.hasGuide ? 'TRUE' : 'FALSE');
    curatedSheet.getRange(rowNum, guideUrlCol).setValue(guideInfo.guideUrl);
    curatedSheet.getRange(rowNum, bookingNoteCol).setValue(guideInfo.bookingNote);

    if (guideInfo.hasGuide) {
      withGuideCount++;
    }

    updatedCount++;
  }

  return {
    updated: updatedCount,
    withGuides: withGuideCount
  };
}

// ==================== CATEGORY DETECTION ====================
function detectCategory(event, venue) {
  const searchText = `${event} ${venue}`.toLowerCase();
  const categories = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        categories.push(category);
        break;
      }
    }
  }

  return categories.length > 0 ? categories.join(', ') : 'Other';
}

// ==================== TICKET LINK FINDER ====================
function findTicketLink(event, venue) {
  if (!venue) {
    return { link: '', confidence: 'NONE', confidenceLabel: '' };
  }

  const eventLower = event.toLowerCase();
  const venueLower = venue.toLowerCase();

  // Arsenal matches
  if (venueLower.includes('emirates') && eventLower.includes('arsenal')) {
    const opponent = event.match(/vs?\s+([^,]+)/i);
    if (opponent) {
      const opponentSlug = opponent[1].trim().toLowerCase().replace(/\s+/g, '-');
      const dateMatch = event.match(/\d{2}\.\d{2}\.\d{2}/);
      if (dateMatch) {
        const dateParts = dateMatch[0].split('.');
        const year = '20' + dateParts[2];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[parseInt(dateParts[1]) - 1];
        const day = dateParts[0];
        return {
          link: `https://www.arsenal.com/tickets/arsenal/${year}-${month}-${day}/${opponentSlug}`,
          confidence: 'HIGH',
          confidenceLabel: '✅ HIGH - Arsenal Official'
        };
      }
    }
  }

  // The O2
  if (venueLower.includes('o2') || venueLower.includes('the o2')) {
    return {
      link: 'https://www.theo2.co.uk/events',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // Royal Albert Hall
  if (venueLower.includes('royal albert')) {
    return {
      link: 'https://www.royalalberthall.com/tickets',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // Wembley Stadium
  if (venueLower.includes('wembley')) {
    return {
      link: 'https://www.wembleystadium.com/events',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // Generic venue search
  const venueForSearch = venue.replace(/[,]/g, ' ').replace(/\s+/g, '%20');
  return {
    link: `https://www.google.com/search?q=${venueForSearch}%20events%20tickets`,
    confidence: 'LOW',
    confidenceLabel: '⚠️ LOW - Venue Homepage'
  };
}

// ==================== TEST LINK FINDER ====================
function testLinkFinder() {
  const ui = SpreadsheetApp.getUi();

  const eventInput = ui.prompt(
    'Test Link Finder',
    'Enter event name:',
    ui.ButtonSet.OK_CANCEL
  );

  if (eventInput.getSelectedButton() !== ui.Button.OK) return;

  const venueInput = ui.prompt(
    'Test Link Finder',
    'Enter venue name:',
    ui.ButtonSet.OK_CANCEL
  );

  if (venueInput.getSelectedButton() !== ui.Button.OK) return;

  const result = findTicketLink(eventInput.getResponseText(), venueInput.getResponseText());

  ui.alert(
    '🔍 Link Finder Result',
    `Event: ${eventInput.getResponseText()}\n` +
    `Venue: ${venueInput.getResponseText()}\n\n` +
    `Link: ${result.link}\n` +
    `Confidence: ${result.confidenceLabel}`,
    ui.ButtonSet.OK
  );
}

// ==================== PUBLISH READY EVENTS ====================
function publishReadyEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📤 Publish Ready Events',
    'Move events with status "Ready" from CURATED to PUBLISHED.\n\n' +
    'Only events marked as "Ready" will be published.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = publishReadyEvents();
    ui.alert(
      '✅ Publishing Complete!',
      `${result.published} events published\n` +
      `${result.alreadyPublished} events were already in PUBLISHED`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Publishing failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function publishReadyEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');
  const publishedSheet = ss.getSheetByName('PUBLISHED') || ss.insertSheet('PUBLISHED');

  if (!curatedSheet) {
    throw new Error('CURATED sheet not found');
  }

  // Ensure headers in PUBLISHED
  if (publishedSheet.getLastRow() === 0) {
    const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
    publishedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    publishedSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    publishedSheet.setFrozenRows(1);
  }

  // Get existing published events
  const existingPublished = new Set();
  if (publishedSheet.getLastRow() > 1) {
    const existing = publishedSheet.getRange(2, 1, publishedSheet.getLastRow() - 1, 3).getValues();
    existing.forEach(row => {
      existingPublished.add(`${row[0]}_${row[1]}_${row[2]}`);
    });
  }

  // Find STATUS column
  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS');

  if (statusCol === -1) {
    throw new Error('STATUS column not found in CURATED');
  }

  const data = curatedSheet.getRange(2, 1, curatedSheet.getLastRow() - 1, curatedSheet.getLastColumn()).getValues();
  const readyEvents = [];
  let alreadyPublishedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const status = data[i][statusCol];

    if (status === 'Ready') {
      const eventKey = `${data[i][0]}_${data[i][1]}_${data[i][2]}`;

      if (existingPublished.has(eventKey)) {
        alreadyPublishedCount++;
        continue;
      }

      readyEvents.push(data[i]);
    }
  }

  // Append to PUBLISHED
  if (readyEvents.length > 0) {
    publishedSheet.getRange(publishedSheet.getLastRow() + 1, 1, readyEvents.length, readyEvents[0].length).setValues(readyEvents);
  }

  return { published: readyEvents.length, alreadyPublished: alreadyPublishedCount };
}

// ==================== UTILITY FUNCTIONS ====================
function removeDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const data = curatedSheet.getDataRange().getValues();
  const seen = new Set();
  const uniqueRows = [data[0]]; // Keep header

  for (let i = 1; i < data.length; i++) {
    const key = `${data[i][0]}_${data[i][1]}_${data[i][2]}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(data[i]);
    }
  }

  if (uniqueRows.length < data.length) {
    curatedSheet.clear();
    curatedSheet.getRange(1, 1, uniqueRows.length, uniqueRows[0].length).setValues(uniqueRows);

    // Reformat header
    curatedSheet.getRange(1, 1, 1, uniqueRows[0].length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
  }
}

function addCuratedDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS') + 1;

  if (statusCol > 0 && curatedSheet.getLastRow() > 1) {
    const statusRange = curatedSheet.getRange(2, statusCol, curatedSheet.getLastRow() - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Review Links', 'Ready', 'Waiting'], true)
      .setAllowInvalid(false)
      .build();
    statusRange.setDataValidation(rule);
  }
}

function removeOldEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗓️ Remove Past Events',
    'Remove events with dates in the past from CURATED.\n\n' +
    'This helps keep your event list current.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = removeOldEvents();
    ui.alert(
      '✅ Cleanup Complete!',
      `${result.removed} past events removed from CURATED`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Cleanup failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function removeOldEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) {
    return { removed: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data = curatedSheet.getDataRange().getValues();
  const futureRows = [data[0]]; // Keep header
  let removedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0];
    const eventDate = parseDateString(dateStr);

    if (eventDate && eventDate >= today) {
      futureRows.push(data[i]);
    } else {
      removedCount++;
    }
  }

  if (removedCount > 0) {
    curatedSheet.clear();
    curatedSheet.getRange(1, 1, futureRows.length, futureRows[0].length).setValues(futureRows);

    // Reformat header
    curatedSheet.getRange(1, 1, 1, futureRows[0].length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
  }

  return { removed: removedCount };
}

function parseDateString(dateStr) {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();
  const parts = str.split('.');

  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);

    if (year < 100) {
      year += 2000;
    }

    return new Date(year, month, day);
  }

  return null;
}

function clearAllStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS') + 1;

  if (statusCol > 0 && curatedSheet.getLastRow() > 1) {
    curatedSheet.getRange(2, statusCol, curatedSheet.getLastRow() - 1, 1).clearContent();
  }

  SpreadsheetApp.getUi().alert('✅ All status values cleared from CURATED');
}

function clearPublishedTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publishedSheet = ss.getSheetByName('PUBLISHED');

  if (!publishedSheet) {
    SpreadsheetApp.getUi().alert('PUBLISHED sheet not found');
    return;
  }

  const headers = publishedSheet.getRange(1, 1, 1, publishedSheet.getLastColumn()).getValues()[0];
  publishedSheet.clear();
  publishedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  publishedSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  SpreadsheetApp.getUi().alert('✅ PUBLISHED tab cleared (headers preserved)');
}

function showNeedsReviewReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) {
    SpreadsheetApp.getUi().alert('No events in CURATED');
    return;
  }

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS');
  const linkConfCol = headers.indexOf('LINK_CONFIDENCE');

  if (statusCol === -1) {
    SpreadsheetApp.getUi().alert('STATUS column not found');
    return;
  }

  const data = curatedSheet.getRange(2, 1, curatedSheet.getLastRow() - 1, curatedSheet.getLastColumn()).getValues();
  let needsReview = 0;
  let waiting = 0;
  let reviewLinks = 0;

  for (let i = 0; i < data.length; i++) {
    const status = data[i][statusCol];

    if (status === 'Waiting') {
      waiting++;
      needsReview++;
    } else if (status === 'Review Links') {
      reviewLinks++;
      needsReview++;
    }
  }

  SpreadsheetApp.getUi().alert(
    '📊 Events Needing Review',
    `Total needing review: ${needsReview}\n\n` +
    `• Waiting (no link): ${waiting}\n` +
    `• Review Links (low confidence): ${reviewLinks}\n\n` +
    'Filter CURATED by status to review these events.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ==================== CONFIG SHEET SETUP ====================
function setupConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');

  if (configSheet) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'CONFIG Sheet Exists',
      'CONFIG sheet already exists. Replace it with default venues?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) return;

    ss.deleteSheet(configSheet);
  }

  configSheet = ss.insertSheet('CONFIG');

  const headers = ['VENUE_NAME', 'HAS_GUIDE', 'GUIDE_URL', 'VENUE_SLUG', 'BOOKING_NOTE'];
  configSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = configSheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');
  configSheet.setFrozenRows(1);

  const defaultVenues = [
    ['The O2, London', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#the-o2-london', 'the-o2-london', 'Purchase tickets first, then contact venue for BSL'],
    ['Royal Albert Hall, London', 'FALSE', '', 'royal-albert-hall-london', 'Contact venue directly about BSL availability'],
    ['Wembley Stadium', 'TRUE', 'https://app.performanceinterpreting.co.uk/booking-guide#wembley-stadium', 'wembley-stadium', 'Contact venue before purchasing tickets'],
    ['Emirates Stadium', 'FALSE', '', 'emirates-stadium', 'Contact venue directly about BSL availability']
  ];

  configSheet.getRange(2, 1, defaultVenues.length, 5).setValues(defaultVenues);

  configSheet.setColumnWidth(1, 250);
  configSheet.setColumnWidth(3, 400);
  configSheet.setColumnWidth(5, 350);

  SpreadsheetApp.getUi().alert(
    '✅ CONFIG Sheet Created!',
    `Created CONFIG sheet with ${defaultVenues.length} default venues.\n\n` +
    'You can now add more venues directly in the CONFIG sheet!',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

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

  let guideUrl = '';
  let bookingNote = 'Contact venue directly about BSL availability';

  if (hasGuide === ui.Button.YES) {
    const note = ui.prompt(
      'Booking Note',
      'Enter booking note (e.g., "Contact venue before purchasing"):',
      ui.ButtonSet.OK_CANCEL
    );

    if (note.getSelectedButton() === ui.Button.OK) {
      bookingNote = note.getResponseText();
    }

    guideUrl = `https://app.performanceinterpreting.co.uk/booking-guide#${venueSlug}`;
  }

  const newRow = [
    venue,
    hasGuide === ui.Button.YES ? 'TRUE' : 'FALSE',
    guideUrl,
    venueSlug,
    bookingNote
  ];

  configSheet.appendRow(newRow);

  ui.alert(
    '✅ Venue Added!',
    `Added: ${venue}\n\n` +
    `Has Guide: ${hasGuide === ui.Button.YES ? 'Yes' : 'No'}\n` +
    `Note: ${bookingNote}\n\n` +
    'Run "🔄 Refresh Booking Guide Data" to update existing events.',
    ui.ButtonSet.OK
  );
}

// ==================== GROUP MULTI-DATE EVENTS ====================
function groupMultiDateEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📅 Group Multi-Date Events',
    'Group events with the same name and venue across multiple dates.\n\n' +
    'This consolidates tour stops and multi-show events.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = groupMultiDateEvents();
    ui.alert(
      '✅ Grouping Complete!',
      `${result.grouped} events grouped\n` +
      `${result.remaining} unique events remaining in CURATED`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Grouping failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function groupMultiDateEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) {
    return { grouped: 0, remaining: 0 };
  }

  const data = curatedSheet.getDataRange().getValues();
  const headers = data[0];
  const events = data.slice(1);

  // Group by event name + venue
  const groups = {};

  for (let i = 0; i < events.length; i++) {
    const event = events[i][1]; // EVENT column
    const venue = events[i][2]; // VENUE column

    if (!event || !venue) continue;

    const key = `${event.trim()}_${venue.trim()}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(events[i]);
  }

  // Create grouped rows
  const groupedRows = [headers];
  let groupedCount = 0;

  for (const [key, eventGroup] of Object.entries(groups)) {
    if (eventGroup.length === 1) {
      // Single event, keep as is
      groupedRows.push(eventGroup[0]);
    } else {
      // Multiple dates, group them
      groupedCount += eventGroup.length - 1;

      // Sort by date
      eventGroup.sort((a, b) => {
        const dateA = parseDateString(a[0]);
        const dateB = parseDateString(b[0]);
        if (!dateA || !dateB) return 0;
        return dateA - dateB;
      });

      // Use first event as base
      const groupedRow = [...eventGroup[0]];

      // Add multi-date indicator to event name
      groupedRow[1] = `${groupedRow[1]} (${eventGroup.length} dates)`;

      groupedRows.push(groupedRow);
    }
  }

  // Write back to sheet
  curatedSheet.clear();
  curatedSheet.getRange(1, 1, groupedRows.length, groupedRows[0].length).setValues(groupedRows);

  // Reformat header
  curatedSheet.getRange(1, 1, 1, groupedRows[0].length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  return { grouped: groupedCount, remaining: groupedRows.length - 1 };
}
