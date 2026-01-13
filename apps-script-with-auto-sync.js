// ==================== INTELLIGENT EVENT LINK FINDER WITH AUTO-SYNC ====================
// Enhanced Apps Script that:
// 1. Auto-syncs new events from RAW_DATA to ENRICHED
// 2. Finds specific ticket URLs with confidence scoring
// 3. Sends email notifications when manual review needed

// ==================== CONFIGURATION ====================
const CONFIG = {
  notificationEmail: 'admin@performanceinterpreting.co.uk',
  minConfidenceForAuto: 0.7,
  enableEmailNotifications: true
};

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('✨ Sync & Enrich All Events', 'syncAndEnrichAll')
    .addItem('🔄 Update Single Event', 'enrichSelectedEvent')
    .addItem('🔍 Test Link Finder', 'testLinkFinder')
    .addItem('📧 Review Events Needing Manual Links', 'showNeedsReviewReport')
    .addItem('🧹 Clear All Status', 'clearAllStatus')
    .addItem('🗑️ Clear PUBLISHED Tab', 'clearPublishedTab')
    .addItem('🗓️ Remove Past Events from ENRICHED', 'removePastEventsUI')
    .addToUi();
}

// ==================== NEW: SYNC RAW_DATA TO ENRICHED ====================
function syncAndEnrichAll() {
  const synced = syncRawDataToEnriched();
  const enrichResult = enrichAllPendingEvents();

  let message = `✅ Sync & Enrichment complete!\n\n`;
  message += `📥 Synced ${synced.newEvents} new events from RAW_DATA\n`;
  message += `⚡ Enriched ${enrichResult.enrichedCount} events\n`;

  if (enrichResult.needsReview > 0) {
    message += `\n⚠️ ${enrichResult.needsReview} events need manual review for ticket links.`;
  }

  SpreadsheetApp.getUi().alert(message);
}

function syncRawDataToEnriched() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawDataSheet = ss.getSheetByName('RAW_DATA');
  const enrichedSheet = ss.getSheetByName('ENRICHED');

  if (!rawDataSheet || !enrichedSheet) {
    Logger.log('Error: RAW_DATA or ENRICHED sheet not found');
    return { newEvents: 0, error: 'Sheets not found' };
  }

  // Get all data from both sheets
  const rawData = rawDataSheet.getDataRange().getValues();
  const enrichedData = enrichedSheet.getDataRange().getValues();

  // Create a Set of event signatures from ENRICHED (date + event name)
  const enrichedSignatures = new Set();
  for (let i = 1; i < enrichedData.length; i++) {
    if (enrichedData[i][0] && enrichedData[i][1]) {
      const signature = `${enrichedData[i][0]}|${enrichedData[i][1]}`;
      enrichedSignatures.add(signature);
    }
  }

  // Find new events from RAW_DATA that aren't in ENRICHED
  const newEvents = [];
  for (let i = 1; i < rawData.length; i++) {
    const date = rawData[i][0];
    const event = rawData[i][1];
    const venue = rawData[i][2];
    const time = rawData[i][3];
    const interpreters = rawData[i][4];

    // Skip empty rows
    if (!date || !event) continue;

    const signature = `${date}|${event}`;

    // If not in ENRICHED, add it
    if (!enrichedSignatures.has(signature)) {
      newEvents.push([
        date,
        event,
        venue,
        time,
        interpreters,
        '', // INTERPRETATION (empty - will be filled by enrichment)
        '', // CATEGORY (empty - will be filled by enrichment)
        '', // IMAGE URL (empty - will be filled by enrichment)
        '', // TICKET LINK (empty - will be filled by enrichment)
        '', // STATUS (empty - will be filled by enrichment)
        ''  // LINK_CONFIDENCE (empty - will be filled by enrichment)
      ]);
    }
  }

  // Append new events to ENRICHED
  if (newEvents.length > 0) {
    const lastRow = enrichedSheet.getLastRow();
    enrichedSheet.getRange(lastRow + 1, 1, newEvents.length, 11).setValues(newEvents);
    Logger.log(`Synced ${newEvents.length} new events to ENRICHED`);
  } else {
    Logger.log('No new events to sync');
  }

  return { newEvents: newEvents.length };
}

// ==================== MAIN ENRICHMENT FUNCTION (UNCHANGED) ====================
function enrichAllPendingEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enrichedSheet = ss.getSheetByName('ENRICHED');
  const publishedSheet = ss.getSheetByName('PUBLISHED');

  if (!enrichedSheet || !publishedSheet) {
    Logger.log('Error: ENRICHED or PUBLISHED sheet not found');
    return { enrichedCount: 0, needsReview: 0, error: 'Sheets not found' };
  }

  const data = enrichedSheet.getDataRange().getValues();
  let enrichedCount = 0;
  let needsReview = 0;
  const eventsNeedingReview = [];

  // Start from row 2 (skip headers)
  for (let i = 1; i < data.length; i++) {
    const status = data[i][9]; // Column J (STATUS) - index 9

    // Only process rows without a status
    if (!status || status.toString().trim() === '') {
      try {
        const result = enrichRow(enrichedSheet, i + 1, data[i]);
        enrichedCount++;

        if (result.needsReview) {
          needsReview++;
          eventsNeedingReview.push({
            row: i + 1,
            event: data[i][1],
            venue: data[i][2],
            url: result.url,
            confidence: result.confidence
          });
        }

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

  // Send email notification if events need review
  if (CONFIG.enableEmailNotifications && needsReview > 0) {
    sendReviewNeededEmail(eventsNeedingReview);
  }

  Logger.log(`Enrichment complete! Processed ${enrichedCount} events. ${needsReview} need review.`);
  return { enrichedCount: enrichedCount, needsReview: needsReview };
}

// ==================== REST OF THE SCRIPT (UNCHANGED FROM intelligent-links.js) ====================
// Copy all the enrichRow, findEventTicketLink, helper functions, etc. from the original script below this line

// [INSERT REST OF ORIGINAL apps-script-intelligent-links.js HERE]
// I'm keeping this file short for clarity - you'll need to copy the rest from the original

// ==================== PLACEHOLDER: Copy from apps-script-intelligent-links.js ====================
// Starting from line 63 of the original file (enrichRow function) through the end
// This includes:
// - enrichRow()
// - findEventTicketLink()
// - tryVenueSpecificSearch()
// - tryGoogleSearch()
// - testUrlAndScore()
// - All helper functions
// - Email notification functions
// - copyToPublished()
// - parseEventDate()
// - All utility functions

// NOTE: To use this, replace your current Apps Script with this PLUS all the functions
// from apps-script-intelligent-links.js starting from the enrichRow() function
