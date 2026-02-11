// ==================== PI EVENTS APP - SIMPLIFIED WORKFLOW ====================
// Clean 3-stage pipeline: PUBLIC_APPROVED → CURATED → PUBLISHED
// Enrichment happens directly in CURATED (no RAW/ENRICHED middleman)

// ==================== CONFIGURATION ====================
const SOURCE_SPREADSHEET_ID = '1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU'; // PI Work Flow

const CATEGORY_KEYWORDS = {
  'Concert': ['concert', 'gig', 'live music', 'band', 'singer', 'orchestra', 'symphony', 'musical', 'tour', 'jingle bell', 'stereophonics', 'jamiroquai', 'mumford'],
  'Sports': ['football', 'stadium', 'match', 'ko -', 'ko-', 'arena', 'vs ', 'v ', 'premier league', 'champions league', 'arsenal', 'gladiators'],
  'Theatre': ['theatre', 'play', 'musical', 'show', 'performance', 'drama', 'top hat', 'moulin rouge', 'amadeus'],
  'Comedy': ['comedy', 'stand-up', 'comedian'],
  'Family': ['family', 'kids', 'children', 'disney', 'circus', 'ice', 'pantomime'],
  'Festival': ['festival', 'pride', 'fringe', 'hoopla', 'download'],
  'Cultural': ['cultural', 'heritage', 'traditional', 'celebration', 'patrick']
};

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('🔄 Run Full Automation', 'runFullAutomationUI')
    .addSeparator()
    .addItem('📥 Import & Enrich to CURATED', 'importAndEnrichUI')
    .addItem('📤 Publish Ready Events', 'publishReadyEventsUI')
    .addSeparator()
    .addItem('🗑️ Remove Duplicate Events', 'removeDuplicates')
    .addItem('🗓️ Remove Old Events from CURATED', 'removeOldEventsUI')
    .addItem('🔧 Add Dropdowns to CURATED Status', 'addCuratedDropdowns')
    .addItem('🎨 Color Code Status Cells', 'colorCodeStatusCellsUI')
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
    'This will:\n\n' +
    '1. Import from PUBLIC_APPROVED → CURATED\n' +
    '2. Enrich with links, categories, booking guides\n' +
    '3. Preserve existing events and manual edits\n' +
    '4. Add status dropdowns\n' +
    '5. Remove duplicates\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    // First, clear old validation rules that might conflict
    clearOldValidation();

    const result = importAndEnrich();
    addCuratedDropdowns();
    removeDuplicates();

    ui.alert(
      '✅ Automation Complete!',
      `${result.imported} new events imported to CURATED\n` +
      `${result.skipped} events already existed (preserved)\n\n` +
      `Status breakdown:\n` +
      `• Ready: ${result.ready} events\n` +
      `• Review Links: ${result.reviewLinks} events\n` +
      `• Waiting: ${result.waiting} events\n\n` +
      'Check CURATED to review new events!',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Automation failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

// ==================== IMPORT & ENRICH: PUBLIC_APPROVED → CURATED ====================
function importAndEnrichUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📥 Import & Enrich Events',
    'Import from PUBLIC_APPROVED and enrich with:\n\n' +
    '• Interpretation type (BSL & ISL)\n' +
    '• Categories (auto-detected)\n' +
    '• Ticket links (auto-found)\n' +
    '• Image URLs\n' +
    '• Booking guide info (from CONFIG)\n\n' +
    'Preserves existing events and edits.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = importAndEnrich();
    ui.alert(
      '✅ Import Complete!',
      `${result.imported} new events imported\n` +
      `${result.skipped} events already existed (preserved)`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Import failed: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function importAndEnrich() {
  const targetSs = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = targetSs.getSheetByName('CURATED') || targetSs.insertSheet('CURATED');

  // Ensure headers exist in CURATED
  if (curatedSheet.getLastRow() === 0) {
    const headers = [
      'DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS',
      'INTERPRETATION', 'CATEGORY', 'IMAGE URL', 'TICKET LINK', 'STATUS',
      'LINK_CONFIDENCE', 'HAS_BOOKING_GUIDE', 'BOOKING_GUIDE_URL', 'BOOKING_NOTE'
    ];
    curatedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    curatedSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    curatedSheet.setFrozenRows(1);
  }

  // Load booking guides from CONFIG
  const bookingGuides = loadBookingGuidesFromConfig();

  // Get source data from PI Work Flow
  const sourceSs = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const publicApprovedSheet = sourceSs.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    throw new Error('PUBLIC_APPROVED sheet not found in PI Work Flow');
  }

  // Get existing events in CURATED
  const existingEvents = new Set();
  if (curatedSheet.getLastRow() > 1) {
    const existing = curatedSheet.getRange(2, 1, curatedSheet.getLastRow() - 1, 3).getValues();
    existing.forEach(row => {
      existingEvents.add(`${row[0]}_${row[1]}_${row[2]}`); // date_event_venue
    });
  }

  // Get source headers to find CATEGORY column
  const sourceHeaders = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  const sourceCategoryCol = sourceHeaders.indexOf('CATEGORY');

  // Get events from PUBLIC_APPROVED
  const sourceData = publicApprovedSheet.getDataRange().getValues();
  const newEvents = [];
  let skippedCount = 0;
  let readyCount = 0;
  let reviewLinksCount = 0;
  let waitingCount = 0;

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

    // ENRICH: Detect interpretation type
    const interpretation = venue && venue.toLowerCase().includes('ireland') ? 'ISL' : 'BSL';

    // ENRICH: Get category from PUBLIC_APPROVED or auto-detect as fallback
    let category = 'Other';
    if (sourceCategoryCol !== -1 && sourceData[i][sourceCategoryCol]) {
      // Use category from PUBLIC_APPROVED
      category = sourceData[i][sourceCategoryCol];
    } else {
      // Fallback: auto-detect if not set in PUBLIC_APPROVED
      category = detectCategory(event, venue);
    }

    // ENRICH: Find ticket link
    const linkResult = findTicketLink(event, venue, date);

    // ENRICH: Try to find image (optional - can enhance later)
    const imageUrl = findImageUrl(event, venue);

    // ENRICH: Get booking guide info from CONFIG
    const guideInfo = findBookingGuideFromConfig(venue, event, bookingGuides);

    // Set status based on link confidence
    let status = 'Review Links';
    if (linkResult.confidence === 'HIGH') {
      status = 'Ready';
      readyCount++;
    } else if (linkResult.confidence === 'NONE') {
      status = 'Waiting';
      waitingCount++;
    } else {
      reviewLinksCount++;
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
      linkResult.confidenceLabel,
      guideInfo.hasGuide ? 'TRUE' : 'FALSE',
      guideInfo.guideUrl,
      guideInfo.bookingNote
    ]);
  }

  // Append new events to CURATED
  if (newEvents.length > 0) {
    curatedSheet.getRange(curatedSheet.getLastRow() + 1, 1, newEvents.length, 14).setValues(newEvents);
  }

  return {
    imported: newEvents.length,
    skipped: skippedCount,
    ready: readyCount,
    reviewLinks: reviewLinksCount,
    waiting: waitingCount
  };
}

// ==================== ENRICHMENT: CATEGORY DETECTION ====================
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

// ==================== ENRICHMENT: TICKET LINK FINDER ====================
function findTicketLink(event, venue, date) {
  if (!venue) {
    return { link: '', confidence: 'NONE', confidenceLabel: '' };
  }

  const eventLower = event.toLowerCase();
  const venueLower = venue.toLowerCase();

  // Arsenal matches
  if (venueLower.includes('emirates') && eventLower.includes('arsenal')) {
    const opponent = event.match(/vs?\s+([^,\(]+)/i);
    if (opponent && date) {
      const opponentName = opponent[1].trim();
      const opponentSlug = opponentName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Parse date
      const dateStr = date.toString().trim();
      const dateParts = dateStr.split('.');

      if (dateParts.length === 3) {
        let day = dateParts[0];
        let month = dateParts[1];
        let year = dateParts[2];

        // Handle 2-digit year
        if (year.length === 2) {
          year = '20' + year;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[parseInt(month) - 1];

        return {
          link: `https://www.arsenal.com/tickets/arsenal/${year}-${monthName}-${day}/${opponentSlug}`,
          confidence: 'HIGH',
          confidenceLabel: '✅ HIGH - Arsenal Official'
        };
      }
    }
  }

  // The O2
  if (venueLower.includes('o2') && venueLower.includes('london')) {
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

  // Birmingham Arena (Utilita Arena)
  if (venueLower.includes('birmingham arena') || venueLower.includes('utilita arena birmingham')) {
    return {
      link: 'https://www.utilitaarenabham.co.uk/whats-on',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // O2 Academy Brixton
  if (venueLower.includes('brixton') || venueLower.includes('o2 academy brixton')) {
    return {
      link: 'https://www.academymusicgroup.com/o2academybrixton/',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // Southbank Centre
  if (venueLower.includes('southbank')) {
    return {
      link: 'https://www.southbankcentre.co.uk/whats-on',
      confidence: 'LOW',
      confidenceLabel: '⚠️ LOW - Venue Homepage'
    };
  }

  // Circus Starr
  if (eventLower.includes('circus starr')) {
    return {
      link: 'https://www.circus-starr.org.uk/apply-for-tickets/',
      confidence: 'MEDIUM',
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

// ==================== ENRICHMENT: IMAGE URL FINDER ====================
function findImageUrl(event, venue) {
  // For now, return empty - can enhance with image search API later
  // Or add manual image URLs in CONFIG sheet per venue
  return '';
}

// ==================== ENRICHMENT: BOOKING GUIDE FROM CONFIG ====================
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

  // Try exact and partial matches
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
    'Update ALL events in CURATED with latest booking guide info from CONFIG.\n\n' +
    'Use after:\n' +
    '• Updating booking notes\n' +
    '• Adding new venues\n' +
    '• Changing guide URLs\n\n' +
    'Only updates booking guide columns, preserves everything else.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = refreshBookingGuides();
    ui.alert(
      '✅ Booking Guides Refreshed!',
      `Updated ${result.updated} events\n` +
      `${result.withGuides} have booking guides\n` +
      `${result.updated - result.withGuides} need direct venue contact`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Refresh failed: ' + error.toString(), ui.ButtonSet.OK);
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

// ==================== PUBLISH READY EVENTS ====================
function publishReadyEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📤 Publish Ready Events',
    'Move events with status "Ready" from CURATED to PUBLISHED.\n\n' +
    'Only events marked "Ready" will go live.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = publishReadyEvents();
    ui.alert(
      '✅ Publishing Complete!',
      `${result.published} events published\n` +
      `${result.alreadyPublished} already in PUBLISHED`,
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
    publishedSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
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
    throw new Error('STATUS column not found');
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

    // Color code the status cells
    colorCodeStatusCells();
  }
}

function colorCodeStatusCellsUI() {
  colorCodeStatusCells();
  SpreadsheetApp.getUi().alert('✅ Status cells color coded!\n\n🟢 Ready\n🟡 Pending\n🔴 Review Links / Waiting');
}

function colorCodeStatusCells() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS') + 1;

  if (statusCol <= 0) return;

  const data = curatedSheet.getRange(2, statusCol, curatedSheet.getLastRow() - 1, 1).getValues();

  // Color each status cell based on value
  for (let i = 0; i < data.length; i++) {
    const rowNum = i + 2;
    const status = data[i][0];
    const cell = curatedSheet.getRange(rowNum, statusCol);

    if (status === 'Ready') {
      // Green background, black text
      cell.setBackground('#00FF00').setFontColor('#000000');
    } else if (status === 'Review Links' || status === 'Waiting') {
      // Red background, white text
      cell.setBackground('#FF0000').setFontColor('#FFFFFF');
    } else if (status === 'Pending') {
      // Yellow background, black text
      cell.setBackground('#FFFF00').setFontColor('#000000');
    } else {
      // Default: white background
      cell.setBackground('#FFFFFF').setFontColor('#000000');
    }
  }
}

function removeOldEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗓️ Remove Past Events',
    'Remove events with past dates from CURATED.\n\n' +
    'Keeps your event list current.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = removeOldEvents();
    ui.alert(
      '✅ Cleanup Complete!',
      `${result.removed} past events removed`,
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

  SpreadsheetApp.getUi().alert('✅ All status values cleared');
}

function clearOldValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet || curatedSheet.getLastRow() <= 1) return;

  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('STATUS') + 1;

  if (statusCol > 0 && curatedSheet.getLastRow() > 1) {
    // Clear all validation rules from STATUS column
    const statusRange = curatedSheet.getRange(2, statusCol, curatedSheet.getLastRow() - 1, 1);
    statusRange.clearDataValidations();
  }
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

  SpreadsheetApp.getUi().alert('✅ PUBLISHED tab cleared');
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
    `Total: ${needsReview}\n\n` +
    `• Waiting (no link): ${waiting}\n` +
    `• Review Links (low confidence): ${reviewLinks}\n\n` +
    'Filter CURATED by status to review.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function testLinkFinder() {
  const ui = SpreadsheetApp.getUi();

  const eventInput = ui.prompt('Test Link Finder', 'Enter event name:', ui.ButtonSet.OK_CANCEL);
  if (eventInput.getSelectedButton() !== ui.Button.OK) return;

  const venueInput = ui.prompt('Test Link Finder', 'Enter venue name:', ui.ButtonSet.OK_CANCEL);
  if (venueInput.getSelectedButton() !== ui.Button.OK) return;

  const dateInput = ui.prompt('Test Link Finder', 'Enter date (DD.MM.YY):', ui.ButtonSet.OK_CANCEL);
  if (dateInput.getSelectedButton() !== ui.Button.OK) return;

  const result = findTicketLink(
    eventInput.getResponseText(),
    venueInput.getResponseText(),
    dateInput.getResponseText()
  );

  ui.alert(
    '🔍 Link Finder Result',
    `Event: ${eventInput.getResponseText()}\n` +
    `Venue: ${venueInput.getResponseText()}\n\n` +
    `Link: ${result.link}\n` +
    `Confidence: ${result.confidenceLabel}`,
    ui.ButtonSet.OK
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
      'CONFIG already exists. Replace with default venues?',
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
    `Created with ${defaultVenues.length} default venues.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function addVenueToConfigUI() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    const response = ui.alert(
      '⚠️ CONFIG Missing',
      'CONFIG not found. Create it?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      setupConfigSheet();
      configSheet = ss.getSheetByName('CONFIG');
    } else {
      return;
    }
  }

  const venueName = ui.prompt('Add Venue', 'Enter venue name:', ui.ButtonSet.OK_CANCEL);
  if (venueName.getSelectedButton() !== ui.Button.OK) return;

  const venue = venueName.getResponseText();
  const venueSlug = venue.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

  const hasGuide = ui.alert('Booking Guide?', 'Has booking guide page?', ui.ButtonSet.YES_NO);

  let guideUrl = '';
  let bookingNote = 'Contact venue directly about BSL availability';

  if (hasGuide === ui.Button.YES) {
    const note = ui.prompt('Booking Note', 'Enter note:', ui.ButtonSet.OK_CANCEL);
    if (note.getSelectedButton() === ui.Button.OK) {
      bookingNote = note.getResponseText();
    }
    guideUrl = `https://app.performanceinterpreting.co.uk/booking-guide#${venueSlug}`;
  }

  configSheet.appendRow([
    venue,
    hasGuide === ui.Button.YES ? 'TRUE' : 'FALSE',
    guideUrl,
    venueSlug,
    bookingNote
  ]);

  ui.alert(
    '✅ Venue Added!',
    `Added: ${venue}\n\n` +
    'Run "🔄 Refresh Booking Guide Data" to update events.',
    ui.ButtonSet.OK
  );
}

// ==================== GROUP MULTI-DATE EVENTS ====================
function groupMultiDateEventsUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📅 Group Multi-Date Events',
    'Group events with same name and venue across dates.\n\n' +
    'Consolidates tours and multi-show events.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const result = groupMultiDateEvents();
    ui.alert(
      '✅ Grouping Complete!',
      `${result.grouped} events grouped\n` +
      `${result.remaining} unique events in CURATED`,
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

  // Group by event + venue
  const groups = {};

  for (let i = 0; i < events.length; i++) {
    const event = events[i][1];
    const venue = events[i][2];

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
      groupedRows.push(eventGroup[0]);
    } else {
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

      // Build date range string (first date - last date)
      const firstDate = eventGroup[0][0];
      const lastDate = eventGroup[eventGroup.length - 1][0];

      // Collect all unique times
      const times = eventGroup.map(e => e[3]).filter((t, i, arr) => arr.indexOf(t) === i);
      const timeStr = times.length <= 3 ? times.join(', ') : `${eventGroup.length} shows`;

      // Update row
      groupedRow[0] = `${firstDate} - ${lastDate}`;
      groupedRow[3] = timeStr;

      groupedRows.push(groupedRow);
    }
  }

  // Write back
  curatedSheet.clear();
  curatedSheet.getRange(1, 1, groupedRows.length, groupedRows[0].length).setValues(groupedRows);

  // Reformat header
  curatedSheet.getRange(1, 1, 1, groupedRows[0].length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  return { grouped: groupedCount, remaining: groupedRows.length - 1 };
}
