// ==================== FIXED EVENT ENRICHMENT SCRIPT ====================
// Column indexes corrected: Arrays are 0-indexed!
// ENRICHED columns: A=DATE, B=EVENT, C=VENUE, D=TIME, E=INTERPRETERS, F=INTERPRETATION, G=CATEGORY, H=IMAGE URL, I=TICKET_LINK, J=STATUS

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('✨ Enrich All Pending Events', 'enrichAllPendingEventsUI')
    .addItem('🔄 Update Single Event', 'enrichSelectedEvent')
    .addItem('🧹 Clear All Status', 'clearAllStatus')
    .addItem('🗑️ Clear PUBLISHED Tab', 'clearPublishedTab')
    .addItem('🗓️ Remove Past Events from ENRICHED', 'removePastEventsUI')
    .addToUi();
}

// ==================== UI WRAPPER (for manual runs) ====================
function enrichAllPendingEventsUI() {
  const result = enrichAllPendingEvents();
  SpreadsheetApp.getUi().alert(`✅ Enrichment complete!\n\nProcessed ${result.enrichedCount} events.\nCheck the PUBLISHED tab.`);
}

// ==================== MAIN ENRICHMENT FUNCTION (trigger-safe) ====================
function enrichAllPendingEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enrichedSheet = ss.getSheetByName('ENRICHED');
  const publishedSheet = ss.getSheetByName('PUBLISHED');

  if (!enrichedSheet || !publishedSheet) {
    Logger.log('Error: ENRICHED or PUBLISHED sheet not found');
    return { enrichedCount: 0, error: 'Sheets not found' };
  }

  const data = enrichedSheet.getDataRange().getValues();
  let enrichedCount = 0;

  // Start from row 2 (skip headers)
  for (let i = 1; i < data.length; i++) {
    const status = data[i][9]; // Column J (STATUS) - index 9

    // Only process rows without a status
    if (!status || status.toString().trim() === '') {
      try {
        enrichRow(enrichedSheet, i + 1, data[i]);
        enrichedCount++;
        SpreadsheetApp.flush();
        Utilities.sleep(2000); // Rate limiting
      } catch (error) {
        Logger.log(`Error processing row ${i + 1}: ${error}`);
        enrichedSheet.getRange(i + 1, 10).setValue('Error'); // Column J
      }
    }
  }

  // Copy to PUBLISHED
  copyToPublished(enrichedSheet, publishedSheet);

  Logger.log(`Enrichment complete! Processed ${enrichedCount} events.`);
  return { enrichedCount: enrichedCount };
}

// ==================== ENRICH SINGLE ROW ====================
function enrichRow(sheet, rowNum, rowData) {
  // CORRECT INDEXING (0-based arrays):
  // rowData[0] = DATE (column A)
  // rowData[1] = EVENT (column B)
  // rowData[2] = VENUE (column C)
  // rowData[3] = TIME (column D)
  // rowData[4] = INTERPRETERS (column E)

  const date = rowData[0];
  const event = rowData[1];
  const venue = rowData[2];
  const time = rowData[3];
  const interpreters = rowData[4];

  Logger.log(`Processing: ${event} at ${venue}`);

  // Detect interpretation type (BSL & ISL)
  const interpretation = detectInterpretation(venue);
  sheet.getRange(rowNum, 6).setValue(interpretation); // Column F

  // Categorize event (but preserve manual edits)
  const existingCategory = rowData[6]; // Column G (index 6)
  // Only update if empty or generic "Festival"
  if (!existingCategory || existingCategory === '' || existingCategory === 'Festival') {
    const category = categorizeEvent(event, venue);
    sheet.getRange(rowNum, 7).setValue(category); // Column G
  }
  // Otherwise keep the existing (manually edited) category

  // Find ticket URL (for now, just venue homepage)
  const ticketUrl = getVenueFallback(venue);
  sheet.getRange(rowNum, 9).setValue(ticketUrl); // Column I

  // Leave image URL alone (don't clear it)
  // sheet.getRange(rowNum, 8).setValue(''); // Column H

  // Mark as ready
  sheet.getRange(rowNum, 10).setValue('Ready'); // Column J
}

// ==================== COPY TO PUBLISHED WITH DATE FILTER ====================
function copyToPublished(enrichedSheet, publishedSheet) {
  // Clear existing data in PUBLISHED (keep headers)
  const publishedLastRow = publishedSheet.getLastRow();
  if (publishedLastRow > 1) {
    publishedSheet.getRange(2, 1, publishedLastRow - 1, publishedSheet.getLastColumn()).clearContent();
  }

  const enrichedData = enrichedSheet.getDataRange().getValues();
  const publishedData = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for comparison

  // Start from row 2 (skip headers)
  for (let i = 1; i < enrichedData.length; i++) {
    // Only copy rows marked as "Ready"
    if (enrichedData[i][9] === 'Ready') { // Column J (STATUS) - index 9

      // Parse the date (DD.MM.YY format)
      const eventDate = parseEventDate(enrichedData[i][0]);

      // Only include if date is today or in the future
      if (eventDate && eventDate >= today) {
        publishedData.push([
          enrichedData[i][0],  // DATE (column A) - index 0
          enrichedData[i][1],  // EVENT (column B) - index 1
          enrichedData[i][2],  // VENUE (column C) - index 2
          enrichedData[i][3],  // TIME (column D) - index 3
          enrichedData[i][4],  // INTERPRETERS (column E) - index 4
          enrichedData[i][5],  // INTERPRETATION (column F) - index 5
          enrichedData[i][6],  // CATEGORY (column G) - index 6
          enrichedData[i][7],  // IMAGE URL (column H) - index 7
          enrichedData[i][8]   // TICKET_LINK (column I) - index 8
        ]);
      }
    }
  }

  // Sort by date chronologically before writing
  publishedData.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  // Write to PUBLISHED tab
  if (publishedData.length > 0) {
    publishedSheet.getRange(2, 1, publishedData.length, 9).setValues(publishedData);
  }
}

// ==================== PARSE DATE FROM DD.MM.YY FORMAT ====================
function parseEventDate(dateStr) {
  if (!dateStr) return null;

  try {
    const dateString = dateStr.toString().trim();

    // Handle DD.MM.YY format (e.g., "01.11.25")
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      let year = parseInt(parts[2]);

      // Convert 2-digit year to 4-digit (25 -> 2025, 26 -> 2026)
      if (year < 100) {
        year += 2000;
      }

      const parsedDate = new Date(year, month, day);
      parsedDate.setHours(0, 0, 0, 0);

      return parsedDate;
    }

    // If it's already a Date object, return it
    if (dateStr instanceof Date) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return d;
    }

  } catch (error) {
    Logger.log(`Error parsing date: ${dateStr} - ${error}`);
  }

  return null;
}

// ==================== HELPER FUNCTIONS ====================

function detectInterpretation(venue) {
  const venueLower = venue.toLowerCase();
  const irishVenues = ['dublin', 'cork', 'galway', '3arena', 'bord gais', 'ireland', 'aviva'];

  for (const irish of irishVenues) {
    if (venueLower.includes(irish)) return 'ISL';
  }

  return 'BSL';
}

function categorizeEvent(event, venue) {
  const eventLower = event.toLowerCase();
  const venueLower = venue.toLowerCase();

  // Check for Arsenal or Netball (always Sports)
  if (eventLower.includes('arsenal') || eventLower.includes('netball')) return 'Sports';

  // Check for Gladiators (Sports, Family)
  if (eventLower.includes('gladiators')) return 'Sports, Family';

  // Check for Circus events (Family)
  if (eventLower.includes('circus')) return 'Family';

  // Check venue first
  if (venueLower.includes('theatre')) return 'Theatre';
  if (venueLower.includes('stadium')) return 'Sports';
  if (venueLower.includes('southbank')) return 'Literature';

  // Check event name
  if (eventLower.includes('comedy')) return 'Comedy';
  if (eventLower.includes('disney')) return 'Family';
  if (eventLower.includes('football') || eventLower.includes('rugby')) return 'Sports';
  if (eventLower.includes('festival')) return 'Festival';
  if (eventLower.includes('conference')) return 'Conference';
  if (eventLower.includes('talk') || eventLower.includes('conversation') || eventLower.includes('reading')) return 'Literature';
  if (eventLower.includes('book') || eventLower.includes('author')) return 'Literature';

  // Default
  return 'Concert';
}

function getVenueFallback(venue) {
  const venueLower = venue.toLowerCase();

  // Major venues
  if (venueLower.includes('royal albert')) return 'https://www.royalalberthall.com/whats-on/';
  if (venueLower.includes('o2') && (venueLower.includes('london') || venueLower.includes('arena'))) return 'https://www.theo2.co.uk/events';
  if (venueLower.includes('southbank')) return 'https://www.southbankcentre.co.uk/whats-on';
  if (venueLower.includes('wembley')) return 'https://www.wembleystadium.com/events';

  // Regional arenas
  if (venueLower.includes('liverpool') || venueLower.includes('m&s bank')) return 'https://www.mandsbankarena.com/whats-on';
  if (venueLower.includes('ao arena') || venueLower.includes('manchester arena')) return 'https://www.ao-arena.com/events';
  if (venueLower.includes('birmingham') && venueLower.includes('arena')) return 'https://www.utilitaarenabham.co.uk/whats-on';
  if (venueLower.includes('motorpoint') || venueLower.includes('nottingham')) return 'https://www.motorpointarenanottingham.com/whats-on';
  if (venueLower.includes('glasgow') || venueLower.includes('hydro')) return 'https://www.sec.co.uk/events/calendar';
  if (venueLower.includes('leeds') || venueLower.includes('first direct')) return 'https://www.firstdirectarena.com/whats-on';

  // O2 Academies
  if (venueLower.includes('o2 academy')) {
    if (venueLower.includes('brixton')) return 'https://www.academymusicgroup.com/o2academybrixton/';
    if (venueLower.includes('glasgow')) return 'https://www.academymusicgroup.com/o2academyglasgow/';
    if (venueLower.includes('islington')) return 'https://www.academymusicgroup.com/o2academyislington/';
    return 'https://www.academymusicgroup.com/';
  }

  // Other venues
  if (venueLower.includes('eventim apollo')) return 'https://www.eventimapollo.com/events';
  if (venueLower.includes('copper') || venueLower.includes('box')) return 'https://www.theo2.co.uk/events';

  // Generic search as fallback
  return `https://www.google.com/search?q=${encodeURIComponent(venue + ' events tickets')}`;
}

// ==================== UTILITY FUNCTIONS ====================

function enrichSelectedEvent() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ENRICHED');
  const row = sheet.getActiveRange().getRow();

  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Please select an event row (not the header)');
    return;
  }

  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  enrichRow(sheet, row, rowData);

  const publishedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PUBLISHED');
  copyToPublished(sheet, publishedSheet);

  SpreadsheetApp.getUi().alert('✅ Event enriched!');
}

function clearAllStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ENRICHED');
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 10, lastRow - 1, 1).clearContent(); // Clear column J (STATUS)
    SpreadsheetApp.getUi().alert('✅ Status cleared! You can now re-run enrichment.');
  }
}

function clearPublishedTab() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PUBLISHED');
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    SpreadsheetApp.getUi().alert('✅ PUBLISHED tab cleared!');
  }
}

// ==================== REMOVE PAST EVENTS FROM ENRICHED ====================
function removePastEventsUI() {
  const result = removePastEvents();
  SpreadsheetApp.getUi().alert(`✅ Cleanup complete!\n\nRemoved ${result.removedCount} past events from ENRICHED.`);
}

function removePastEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enrichedSheet = ss.getSheetByName('ENRICHED');

  if (!enrichedSheet) {
    Logger.log('Error: ENRICHED sheet not found');
    return { removedCount: 0, error: 'Sheet not found' };
  }

  const data = enrichedSheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureEvents = [];
  let removedCount = 0;

  // Start from row 2 (skip headers)
  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0]; // Column A (DATE)

    if (dateStr) {
      const eventDate = parseEventDate(dateStr);

      // Only keep future events
      if (eventDate && eventDate >= today) {
        futureEvents.push(data[i]);
      } else if (eventDate && eventDate < today) {
        removedCount++;
      }
    }
  }

  // Sort future events chronologically
  futureEvents.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  // Clear all data except headers
  const lastRow = enrichedSheet.getLastRow();
  if (lastRow > 1) {
    enrichedSheet.getRange(2, 1, lastRow - 1, enrichedSheet.getLastColumn()).clearContent();
  }

  // Write sorted future events back
  if (futureEvents.length > 0) {
    enrichedSheet.getRange(2, 1, futureEvents.length, futureEvents[0].length).setValues(futureEvents);
  }

  Logger.log(`Removed ${removedCount} past events from ENRICHED and sorted remaining events chronologically`);
  return { removedCount: removedCount };
}
