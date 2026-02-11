// ==================== INTELLIGENT EVENT LINK FINDER ====================
// Enhanced Apps Script with AI-powered link extraction and confidence scoring
// Sends email notifications when manual review needed

// ==================== CONFIGURATION ====================
const CONFIG = {
  notificationEmail: 'admin@performanceinterpreting.co.uk', // Your email
  minConfidenceForAuto: 0.7, // 90% confidence required for auto-approval
  enableEmailNotifications: true
};

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Event Automation')
    .addItem('🔄 Sync & Enrich All Events', 'syncAndEnrichAllUI')
    .addItem('✨ Enrich Pending Events Only', 'enrichAllPendingEventsUI')
    .addItem('🔍 Test Link Finder', 'testLinkFinder')
    .addItem('📧 Review Events Needing Manual Links', 'showNeedsReviewReport')
    .addItem('🧹 Clear All Status', 'clearAllStatus')
    .addItem('🗑️ Clear PUBLISHED Tab', 'clearPublishedTab')
    .addItem('🗓️ Remove Past Events from ENRICHED', 'removePastEventsUI')
    .addToUi();
}

// ==================== AUTO-SYNC: RAW_DATA → ENRICHED ====================
function syncAndEnrichAllUI() {
  const synced = syncRawDataToEnriched();
  const enrichResult = enrichAllPendingEvents();
  const cleanup = removePastEvents(); // Auto-cleanup past events

  let message = `✅ Sync & Enrichment complete!\n\n`;
  message += `📥 Synced ${synced.newEvents} new events from RAW_DATA\n`;
  message += `⚡ Enriched ${enrichResult.enrichedCount} events\n`;
  message += `🧹 Removed ${cleanup.removedCount} past events from ENRICHED\n`;

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

  // Create array of enriched events with normalized data for fuzzy matching
  const enrichedEvents = [];
  for (let i = 1; i < enrichedData.length; i++) {
    if (enrichedData[i][0] && enrichedData[i][1]) {
      enrichedEvents.push({
        date: normalizeDate(enrichedData[i][0]),
        event: normalizeText(enrichedData[i][1]),
        venue: normalizeText(enrichedData[i][2])
      });
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

    // Check if this event already exists using fuzzy matching
    const isDuplicate = enrichedEvents.some(existing => {
      return existing.date === normalizeDate(date) &&
             existing.event === normalizeText(event) &&
             isSimilarVenue(existing.venue, normalizeText(venue));
    });

    // If not in ENRICHED, add it
    if (!isDuplicate) {
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
    } else {
      Logger.log(`Skipping duplicate: ${event} at ${venue} on ${date}`);
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

// ==================== FUZZY MATCHING HELPERS ====================

function normalizeDate(dateStr) {
  // Normalize dates to DD.MM.YY format for comparison
  if (!dateStr) return '';

  const str = dateStr.toString().trim();

  // Convert "DD.MM.YYYY" to "DD.MM.YY"
  const parts = str.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];

    // Convert 4-digit year to 2-digit
    if (year.length === 4) {
      year = year.substring(2);
    }

    return `${day}.${month}.${year}`;
  }

  return str;
}

function normalizeText(text) {
  // Normalize text for comparison: lowercase, remove extra spaces, remove punctuation
  if (!text) return '';

  return text.toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');   // Normalize spaces
}

function isSimilarVenue(venue1, venue2) {
  // Check if two venue names are similar (catches typos)
  if (venue1 === venue2) return true;

  // Calculate similarity using Levenshtein distance ratio
  const distance = levenshteinDistance(venue1, venue2);
  const maxLength = Math.max(venue1.length, venue2.length);
  const similarity = 1 - (distance / maxLength);

  // If 85% similar or more, consider them the same venue
  return similarity >= 0.85;
}

function levenshteinDistance(str1, str2) {
  // Calculate edit distance between two strings
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ==================== MAIN ENRICHMENT FUNCTION ====================
function enrichAllPendingEventsUI() {
  const result = enrichAllPendingEvents();

  let message = `✅ Enrichment complete!\n\nProcessed ${result.enrichedCount} events.`;

  if (result.needsReview > 0) {
    message += `\n\n⚠️ ${result.needsReview} events need manual review for ticket links.`;
    message += `\n\nCheck the "🔍 LINK_CONFIDENCE" column or use the menu: Review Events Needing Manual Links`;
  }

  SpreadsheetApp.getUi().alert(message);
}

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

// ==================== ENRICH SINGLE ROW WITH INTELLIGENT LINK FINDING ====================
function enrichRow(sheet, rowNum, rowData) {
  const date = rowData[0];
  const event = rowData[1];
  const venue = rowData[2];
  const time = rowData[3];
  const interpreters = rowData[4];

  Logger.log(`Processing: ${event} at ${venue}`);

  // Detect interpretation type (BSL & ISL)
  const interpretation = detectInterpretation(venue);
  sheet.getRange(rowNum, 6).setValue(interpretation); // Column F

  // Categorize event
  const existingCategory = rowData[6];
  if (!existingCategory || existingCategory === '' || existingCategory === 'Festival') {
    const category = categorizeEvent(event, venue);
    sheet.getRange(rowNum, 7).setValue(category); // Column G
  }

  // 🎯 INTELLIGENT LINK FINDING
  const linkResult = findEventTicketLink(event, venue, date);

  // Set ticket URL (Column I)
  sheet.getRange(rowNum, 9).setValue(linkResult.url);

  // Add confidence score in a new column (Column K - after STATUS)
  sheet.getRange(rowNum, 11).setValue(linkResult.confidenceLabel);

  // Try to find event image
  const imageUrl = findEventImage(event, venue);
  if (imageUrl) {
    sheet.getRange(rowNum, 8).setValue(imageUrl); // Column H
  }

  // Mark status based on confidence
  if (linkResult.confidence >= CONFIG.minConfidenceForAuto) {
    sheet.getRange(rowNum, 10).setValue('Ready'); // Column J
  } else {
    sheet.getRange(rowNum, 10).setValue('Review Links'); // Needs manual check
  }

  return {
    needsReview: linkResult.confidence < CONFIG.minConfidenceForAuto,
    url: linkResult.url,
    confidence: linkResult.confidence
  };
}

// ==================== INTELLIGENT TICKET LINK FINDER ====================
function findEventTicketLink(eventName, venueName, eventDate) {
  Logger.log(`Finding ticket link for: ${eventName} at ${venueName}`);

  // Step 1: Try venue-specific patterns first (fastest, most reliable)
  const venueSpecific = tryVenueSpecificSearch(eventName, venueName, eventDate);
  if (venueSpecific.confidence > 0.8) {
    return venueSpecific;
  }

  // Step 2: Try Google search for official event page
  const googleSearch = tryGoogleSearch(eventName, venueName);
  if (googleSearch.confidence > 0.6) {
    return googleSearch;
  }

  // Step 3: Fallback to venue homepage
  const fallback = getVenueFallback(venueName);
  return {
    url: fallback,
    confidence: 0.3,
    confidenceLabel: '⚠️ LOW - Venue Homepage',
    source: 'fallback'
  };
}

// ==================== VENUE-SPECIFIC PATTERNS ====================
function tryVenueSpecificSearch(eventName, venueName, eventDate) {
  const venueLower = venueName.toLowerCase();
  const eventLower = eventName.toLowerCase();

  // Arsenal specific
  if (venueLower.includes('arsenal') || venueLower.includes('emirates')) {
    const opponent = extractOpponent(eventName);
    const dateStr = formatDateForUrl(eventDate);

    if (opponent) {
      // Women's matches
      if (eventLower.includes('women') || eventLower.includes('w vs') || eventLower.includes('womens')) {
        const url = `https://www.arsenal.com/tickets/women/${dateStr}/${opponent}`;
        return testUrlAndScore(url, 'Arsenal Women\'s', 0.9);
      }
      // Men's matches
      else {
        const url = `https://www.arsenal.com/tickets/arsenal/${dateStr}/${opponent}`;
        return testUrlAndScore(url, 'Arsenal', 0.9);
      }
    }
  }

  // The O2 Arena
  if (venueLower.includes('o2') && venueLower.includes('arena')) {
    const slug = createUrlSlug(eventName);
    const url = `https://www.theo2.co.uk/events/detail/${slug}`;
    return testUrlAndScore(url, 'The O2', 0.85);
  }

  // Southbank Centre
  if (venueLower.includes('southbank')) {
    const slug = createUrlSlug(eventName);
    const url = `https://www.southbankcentre.co.uk/whats-on/${slug}`;
    return testUrlAndScore(url, 'Southbank', 0.85);
  }

  // Royal Albert Hall
  if (venueLower.includes('royal albert')) {
    const slug = createUrlSlug(eventName);
    const url = `https://www.royalalberthall.com/tickets/events/${dateStr}/${slug}`;
    return testUrlAndScore(url, 'Royal Albert Hall', 0.85);
  }

  // O2 Academies
  if (venueLower.includes('o2 academy')) {
    const location = extractO2AcademyLocation(venueName);
    const slug = createUrlSlug(eventName);
    const url = `https://www.academymusicgroup.com/o2academy${location}/events/${slug}`;
    return testUrlAndScore(url, 'O2 Academy', 0.8);
  }

  // Eventim Apollo
  if (venueLower.includes('eventim apollo') || venueLower.includes('apollo')) {
    const slug = createUrlSlug(eventName);
    const url = `https://www.eventimapollo.com/events/${slug}`;
    return testUrlAndScore(url, 'Eventim Apollo', 0.8);
  }

  // Return low confidence if no pattern matched
  return {
    url: '',
    confidence: 0,
    confidenceLabel: 'No venue pattern',
    source: 'none'
  };
}

// ==================== GOOGLE SEARCH METHOD ====================
function tryGoogleSearch(eventName, venueName) {
  try {
    // Build search query
    const searchQuery = encodeURIComponent(`${eventName} ${venueName} tickets official`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

    // Fetch search results (Note: Google may block, this is best-effort)
    const response = UrlFetchApp.fetch(searchUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventBot/1.0)'
      }
    });

    if (response.getResponseCode() === 200) {
      const html = response.getContentText();

      // Extract URLs from search results (very basic parsing)
      const urls = extractUrlsFromHtml(html, venueName);

      if (urls.length > 0) {
        // Return first matching official URL
        return {
          url: urls[0],
          confidence: 0.7,
          confidenceLabel: '🔍 MEDIUM - Google Search',
          source: 'google'
        };
      }
    }
  } catch (error) {
    Logger.log(`Google search failed: ${error}`);
  }

  return {
    url: '',
    confidence: 0,
    confidenceLabel: 'Search failed',
    source: 'none'
  };
}

// ==================== HELPER: TEST URL AND SCORE ====================
function testUrlAndScore(url, venueName, baseConfidence) {
  try {
    // Try to fetch the URL (with timeout)
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventBot/1.0)'
      }
    });

    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      return {
        url: url,
        confidence: baseConfidence,
        confidenceLabel: `✅ HIGH - ${venueName} Official`,
        source: 'venue-pattern'
      };
    } else if (statusCode === 404) {
      Logger.log(`URL 404: ${url}`);
      return {
        url: url,
        confidence: 0.4,
        confidenceLabel: `⚠️ LOW - URL Not Found (404)`,
        source: 'venue-pattern-404'
      };
    } else {
      Logger.log(`URL returned ${statusCode}: ${url}`);
      return {
        url: url,
        confidence: 0.5,
        confidenceLabel: `⚠️ MEDIUM - Unverified`,
        source: 'venue-pattern-unverified'
      };
    }
  } catch (error) {
    Logger.log(`Error testing URL ${url}: ${error}`);
    // Return URL anyway but with lower confidence
    return {
      url: url,
      confidence: 0.5,
      confidenceLabel: `⚠️ MEDIUM - Could Not Verify`,
      source: 'venue-pattern-error'
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

function extractOpponent(eventName) {
  // Extract opponent from "Arsenal vs Chelsea" or "Arsenal W vs Liverpool W"
  const vsMatch = eventName.match(/vs?\s+([A-Za-z\s]+)/i);
  if (vsMatch) {
    return vsMatch[1].trim().toLowerCase().replace(/\s+/g, '-').replace(/\s*w(omen)?s?\s*/gi, '');
  }
  return null;
}

function formatDateForUrl(dateStr) {
  // Convert "03.12.25" to "2025-Dec-03"
  if (!dateStr) return '';

  const parts = dateStr.toString().split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthNum = parseInt(parts[1]);
    const year = `20${parts[2]}`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const monthName = months[monthNum - 1];

    return `${year}-${monthName}-${day}`;
  }

  return '';
}

function createUrlSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/-+/g, '-')       // Multiple hyphens to single
    .replace(/^-|-$/g, '');    // Trim hyphens
}

function extractO2AcademyLocation(venueName) {
  const lower = venueName.toLowerCase();
  if (lower.includes('brixton')) return 'brixton';
  if (lower.includes('glasgow')) return 'glasgow';
  if (lower.includes('islington')) return 'islington';
  if (lower.includes('birmingham')) return 'birmingham';
  if (lower.includes('leeds')) return 'leeds';
  if (lower.includes('liverpool')) return 'liverpool';
  return 'london';
}

function extractUrlsFromHtml(html, venueName) {
  // Very basic URL extraction - looks for ticketing URLs
  const urls = [];
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  const matches = html.match(urlPattern) || [];

  // Filter for relevant ticketing domains
  const ticketDomains = [
    'ticketmaster', 'seetickets', 'axs', 'gigantic', 'eventim',
    'theo2.co.uk', 'royalalberthall.com', 'southbankcentre.co.uk',
    'arsenal.com', 'academymusicgroup.com'
  ];

  for (const url of matches) {
    for (const domain of ticketDomains) {
      if (url.includes(domain)) {
        urls.push(url);
        break;
      }
    }
  }

  return urls;
}

function findEventImage(eventName, venueName) {
  // Placeholder for image finding - could be enhanced with image search API
  // For now, return empty and let manual entry handle it
  return '';
}

// ==================== ORIGINAL HELPER FUNCTIONS (UNCHANGED) ====================

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

  if (eventLower.includes('arsenal') || eventLower.includes('netball')) return 'Sports';
  if (eventLower.includes('gladiators')) return 'Sports, Family';
  if (eventLower.includes('circus')) return 'Family';
  if (venueLower.includes('theatre')) return 'Theatre';
  if (venueLower.includes('stadium')) return 'Sports';
  if (venueLower.includes('southbank')) return 'Literature';
  if (eventLower.includes('comedy')) return 'Comedy';
  if (eventLower.includes('disney')) return 'Family';
  if (eventLower.includes('football') || eventLower.includes('rugby')) return 'Sports';
  if (eventLower.includes('festival')) return 'Festival';
  if (eventLower.includes('conference')) return 'Conference';
  if (eventLower.includes('talk') || eventLower.includes('conversation') || eventLower.includes('reading')) return 'Literature';
  if (eventLower.includes('book') || eventLower.includes('author')) return 'Literature';

  return 'Concert';
}

function getVenueFallback(venue) {
  const venueLower = venue.toLowerCase();

  if (venueLower.includes('royal albert')) return 'https://www.royalalberthall.com/whats-on/';
  if (venueLower.includes('o2') && (venueLower.includes('london') || venueLower.includes('arena'))) return 'https://www.theo2.co.uk/events';
  if (venueLower.includes('southbank')) return 'https://www.southbankcentre.co.uk/whats-on';
  if (venueLower.includes('wembley')) return 'https://www.wembleystadium.com/events';
  if (venueLower.includes('liverpool') || venueLower.includes('m&s bank')) return 'https://www.mandsbankarena.com/whats-on';
  if (venueLower.includes('ao arena') || venueLower.includes('manchester arena')) return 'https://www.ao-arena.com/events';
  if (venueLower.includes('birmingham') && venueLower.includes('arena')) return 'https://www.utilitaarenabham.co.uk/whats-on';
  if (venueLower.includes('motorpoint') || venueLower.includes('nottingham')) return 'https://www.motorpointarenanottingham.com/whats-on';
  if (venueLower.includes('glasgow') || venueLower.includes('hydro')) return 'https://www.sec.co.uk/events/calendar';
  if (venueLower.includes('leeds') || venueLower.includes('first direct')) return 'https://www.firstdirectarena.com/whats-on';

  if (venueLower.includes('o2 academy')) {
    if (venueLower.includes('brixton')) return 'https://www.academymusicgroup.com/o2academybrixton/';
    if (venueLower.includes('glasgow')) return 'https://www.academymusicgroup.com/o2academyglasgow/';
    if (venueLower.includes('islington')) return 'https://www.academymusicgroup.com/o2academyislington/';
    return 'https://www.academymusicgroup.com/';
  }

  if (venueLower.includes('eventim apollo')) return 'https://www.eventimapollo.com/events';
  if (venueLower.includes('copper') || venueLower.includes('box')) return 'https://www.theo2.co.uk/events';

  return `https://www.google.com/search?q=${encodeURIComponent(venue + ' events tickets')}`;
}

// ==================== EMAIL NOTIFICATION SYSTEM ====================

function sendReviewNeededEmail(eventsNeedingReview) {
  if (eventsNeedingReview.length === 0) return;

  let emailBody = '<h2>🔍 PI Events - Manual Link Review Needed</h2>';
  emailBody += `<p>${eventsNeedingReview.length} event(s) need manual review for ticket links:</p>`;
  emailBody += '<table border="1" cellpadding="10" style="border-collapse: collapse;">';
  emailBody += '<tr><th>Event</th><th>Venue</th><th>Current URL</th><th>Confidence</th></tr>';

  for (const event of eventsNeedingReview) {
    emailBody += `<tr>`;
    emailBody += `<td><strong>${event.event}</strong></td>`;
    emailBody += `<td>${event.venue}</td>`;
    emailBody += `<td><a href="${event.url}">${event.url}</a></td>`;
    emailBody += `<td>${event.confidence}</td>`;
    emailBody += `</tr>`;
  }

  emailBody += '</table>';
  emailBody += '<br><p><strong>Action needed:</strong> Please review these events in the ENRICHED sheet and manually update the TICKET_LINK column if needed.</p>';
  emailBody += '<p><em>This is an automated message from your PI Events automation.</em></p>';

  try {
    MailApp.sendEmail({
      to: CONFIG.notificationEmail,
      subject: `⚠️ ${eventsNeedingReview.length} PI Events Need Link Review`,
      htmlBody: emailBody
    });
    Logger.log(`Sent review notification email for ${eventsNeedingReview.length} events`);
  } catch (error) {
    Logger.log(`Failed to send email: ${error}`);
  }
}

function showNeedsReviewReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enrichedSheet = ss.getSheetByName('ENRICHED');
  const data = enrichedSheet.getDataRange().getValues();

  let needsReviewCount = 0;
  let message = '📋 Events Needing Manual Link Review:\n\n';

  for (let i = 1; i < data.length; i++) {
    const status = data[i][9]; // STATUS column
    const confidence = data[i][10]; // LINK_CONFIDENCE column

    if (status === 'Review Links' || (confidence && confidence.includes('LOW'))) {
      needsReviewCount++;
      message += `Row ${i + 1}: ${data[i][1]} at ${data[i][2]}\n`;
      message += `  → ${data[i][8]}\n`;
      message += `  → Confidence: ${confidence || 'Unknown'}\n\n`;
    }
  }

  if (needsReviewCount === 0) {
    message = '✅ All events have confident ticket links! No manual review needed.';
  } else {
    message += `\nTotal: ${needsReviewCount} event(s) need review.`;
  }

  SpreadsheetApp.getUi().alert(message);
}

// ==================== TEST FUNCTION ====================

function testLinkFinder() {
  const testCases = [
    { event: 'Arsenal vs Chelsea Womens', venue: 'Emirates Stadium, London', date: '08.11.25' },
    { event: 'Radiohead', venue: 'The O2 Arena, London', date: '22.11.25' },
    { event: 'Gladiators Live Tour', venue: 'The O2 Arena, London', date: '08.11.25' }
  ];

  let results = '🧪 Link Finder Test Results:\n\n';

  for (const test of testCases) {
    const result = findEventTicketLink(test.event, test.venue, test.date);
    results += `Event: ${test.event}\n`;
    results += `Venue: ${test.venue}\n`;
    results += `URL: ${result.url}\n`;
    results += `Confidence: ${result.confidenceLabel}\n\n`;
  }

  SpreadsheetApp.getUi().alert(results);
}

// ==================== COPY TO PUBLISHED (UNCHANGED) ====================

function copyToPublished(enrichedSheet, publishedSheet) {
  const publishedLastRow = publishedSheet.getLastRow();
  if (publishedLastRow > 1) {
    publishedSheet.getRange(2, 1, publishedLastRow - 1, publishedSheet.getLastColumn()).clearContent();
  }

  const enrichedData = enrichedSheet.getDataRange().getValues();
  const publishedData = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < enrichedData.length; i++) {
    if (enrichedData[i][9] === 'Ready' || enrichedData[i][9] === 'Review Links') {
      const eventDate = parseEventDate(enrichedData[i][0]);

      if (eventDate && eventDate >= today) {
        publishedData.push([
          enrichedData[i][0],  // DATE
          enrichedData[i][1],  // EVENT
          enrichedData[i][2],  // VENUE
          enrichedData[i][3],  // TIME
          enrichedData[i][4],  // INTERPRETERS
          enrichedData[i][5],  // INTERPRETATION
          enrichedData[i][6],  // CATEGORY
          enrichedData[i][7],  // IMAGE URL
          enrichedData[i][8]   // TICKET_LINK
        ]);
      }
    }
  }

  publishedData.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  if (publishedData.length > 0) {
    publishedSheet.getRange(2, 1, publishedData.length, 9).setValues(publishedData);
  }
}

function parseEventDate(dateStr) {
  if (!dateStr) return null;

  try {
    const dateString = dateStr.toString().trim();
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);

      if (year < 100) {
        year += 2000;
      }

      const parsedDate = new Date(year, month, day);
      parsedDate.setHours(0, 0, 0, 0);

      return parsedDate;
    }

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

// ==================== OTHER UTILITY FUNCTIONS (UNCHANGED) ====================

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
    sheet.getRange(2, 10, lastRow - 1, 1).clearContent();
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

  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0];

    if (dateStr) {
      const eventDate = parseEventDate(dateStr);

      if (eventDate && eventDate >= today) {
        futureEvents.push(data[i]);
      } else if (eventDate && eventDate < today) {
        removedCount++;
      }
    }
  }

  futureEvents.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  const lastRow = enrichedSheet.getLastRow();
  if (lastRow > 1) {
    enrichedSheet.getRange(2, 1, lastRow - 1, enrichedSheet.getLastColumn()).clearContent();
  }

  if (futureEvents.length > 0) {
    enrichedSheet.getRange(2, 1, futureEvents.length, futureEvents[0].length).setValues(futureEvents);
  }

  Logger.log(`Removed ${removedCount} past events from ENRICHED and sorted remaining events chronologically`);
  return { removedCount: removedCount };
}
