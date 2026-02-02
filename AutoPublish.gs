// ==================== PI EVENTS - AUTO-PUBLISH + EMAIL DIGEST ====================
// Runs daily on a time-driven trigger. Zero manual intervention.
// Reads from PRE_APPROVED EVENTS + monthly tabs → publishes to PUBLISHED sheet.
// Sends email digest to admin@performanceinterpreting.co.uk.
// ================================================================================

// ==================== CONFIGURATION ====================
const PI_WORKFLOW_ID = '1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU';
const PUBLIC_FEED_ID = '1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8';

const PRE_APPROVED_SHEET = 'PRE_APPROVED EVENTS';
const PUBLISHED_SHEET = 'PUBLISHED';

const DIGEST_EMAIL = 'admin@performanceinterpreting.co.uk';

var DRY_RUN = false; // Set true to test without writing

const PUBLISHED_HEADERS = [
  'DATE', 'EVENT', 'VENUE', 'CITY', 'TIME',
  'INTERPRETERS', 'INTERPRETATION', 'CATEGORY',
  'IMAGE URL', 'EVENT URL', 'STATUS'
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// CATEGORY_KEYWORDS defined in Code.gs (shared namespace)

// ==================== MAIN ENTRY POINT ====================

/**
 * Daily auto-publish trigger target.
 * Reads from sources, deduplicates, validates, publishes, emails digest.
 */
function dailyAutoPublish() {
  const log = { added: [], removed: [], warnings: [], skipped: 0 };

  try {
    // 1. Get existing PUBLISHED data and build dedup keys
    const publishedSS = SpreadsheetApp.openById(PUBLIC_FEED_ID);
    const publishedSheet = publishedSS.getSheetByName(PUBLISHED_SHEET);

    if (!publishedSheet) {
      log.warnings.push('PUBLISHED sheet not found in Public Events Feed');
      sendDigestEmail(log);
      return;
    }

    const existingData = publishedSheet.getDataRange().getValues();
    const existingKeys = buildDedupKeys(existingData);

    // 2. Read events from sources
    const preApprovedEvents = getEventsFromPreApproved();
    const monthlyEvents = getEventsFromMonthlyTabs();

    // 3. Merge (monthly wins over pre-approved for same event)
    const mergedEvents = mergeEvents(preApprovedEvents, monthlyEvents);

    // 4. Filter: new events only (not already in PUBLISHED)
    const newEvents = [];
    for (const evt of mergedEvents) {
      if (existingKeys.has(evt.key)) {
        log.skipped++;
      } else {
        newEvents.push(evt);
      }
    }

    // 5. Remove past events from PUBLISHED
    const removeResult = removePastEvents(publishedSheet, existingData);
    log.removed = removeResult.removed;

    // 6. Append new events
    if (newEvents.length > 0 && !DRY_RUN) {
      appendNewEvents(publishedSheet, newEvents);
    }
    log.added = newEvents.map(e => ({
      date: e.row[0],
      event: e.row[1],
      venue: e.row[2],
      city: e.row[3],
      imageUrl: e.row[8],
      eventUrl: e.row[9],
      source: e.source
    }));

    // 7. Audit ALL published events for data quality
    const freshData = publishedSheet.getDataRange().getValues();
    log.quality = auditPublishedData(freshData);

    Logger.log(`Auto-publish complete: ${newEvents.length} added, ${removeResult.removed.length} removed, ${log.skipped} skipped (dupes)`);

  } catch (error) {
    log.warnings.push('Script error: ' + error.toString());
    Logger.log('Auto-publish error: ' + error.toString());
  }

  // 8. Send digest email
  sendDigestEmail(log);
}

// ==================== READ SOURCES ====================

/**
 * Read events from PRE_APPROVED EVENTS sheet in PI Work Flow
 */
function getEventsFromPreApproved() {
  const events = [];

  try {
    const ss = SpreadsheetApp.openById(PI_WORKFLOW_ID);
    const sheet = ss.getSheetByName(PRE_APPROVED_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return events;

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());

    // Find columns by header name
    const col = {
      date: headers.indexOf('EVENT_DATE'),
      name: headers.indexOf('EVENT_NAME'),
      venue: headers.indexOf('VENUE'),
      time: headers.indexOf('TIME'),
      interpreters: headers.indexOf('INTERPRETERS'),
      city: headers.indexOf('CITY'),
      country: headers.indexOf('COUNTRY'),
      language: headers.indexOf('LANGUAGE'),
      category: headers.indexOf('CATEGORY'),
      imageUrl: headers.indexOf('IMAGE_URL'),
      eventUrl: headers.indexOf('EVENT_URL')
    };

    if (col.date === -1 || col.name === -1 || col.venue === -1) {
      Logger.log('PRE_APPROVED: Missing required columns (EVENT_DATE, EVENT_NAME, VENUE)');
      return events;
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateRaw = (row[col.date] || '').toString().trim();
      const eventName = (row[col.name] || '').toString().trim();
      const venue = (row[col.venue] || '').toString().trim();

      if (!dateRaw || !eventName || !venue) continue;

      // Convert date to DD.MM.YY format
      const dateFormatted = convertToPublishedDateFormat(dateRaw);
      if (!dateFormatted) continue;

      // Skip past events
      if (isDateInPast(dateRaw)) continue;

      const time = col.time >= 0 ? (row[col.time] || '').toString().trim() : '';
      const interpreters = col.interpreters >= 0 ? (row[col.interpreters] || '').toString().trim() : '';
      const city = col.city >= 0 ? (row[col.city] || '').toString().trim() : '';
      const interpretation = col.language >= 0 ? (row[col.language] || '').toString().trim() : 'BSL';
      const category = col.category >= 0 ? (row[col.category] || '').toString().trim() : detectCategory(eventName, venue);
      const imageUrl = col.imageUrl >= 0 ? (row[col.imageUrl] || '').toString().trim() : '';
      const eventUrl = col.eventUrl >= 0 ? (row[col.eventUrl] || '').toString().trim() : '';

      const publishedRow = [
        dateFormatted,     // DATE
        eventName,         // EVENT
        venue,             // VENUE
        city,              // CITY
        time || 'TBC',     // TIME
        interpreters || 'TBC', // INTERPRETERS
        interpretation || 'BSL', // INTERPRETATION
        category || detectCategory(eventName, venue), // CATEGORY
        imageUrl,          // IMAGE URL
        eventUrl,          // EVENT URL
        ''                 // STATUS
      ];

      const key = makeDedupKey(dateRaw, eventName, venue);
      events.push({ key, row: publishedRow, source: 'Pre-Approved' });
    }
  } catch (error) {
    Logger.log('Error reading PRE_APPROVED: ' + error.toString());
  }

  return events;
}

/**
 * Read events from monthly tabs in PI Work Flow
 * Only includes rows where "Public App" column = Yes/TRUE
 */
function getEventsFromMonthlyTabs() {
  const events = [];

  try {
    const ss = SpreadsheetApp.openById(PI_WORKFLOW_ID);
    const sheets = ss.getSheets();
    const currentYear = new Date().getFullYear();

    for (const sheet of sheets) {
      const name = sheet.getName();

      // Only process monthly tabs for current year and next year
      if (!isMonthlyTab(name)) continue;
      const tabYear = parseInt(name.split(' ')[1]);
      if (tabYear < currentYear || tabYear > currentYear + 1) continue;

      if (sheet.getLastRow() < 2) continue;
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => (h || '').toString().trim().toLowerCase());

      // Find columns by name
      const dateIdx = headers.indexOf('date');
      const eventIdx = headers.indexOf('event');
      const venueIdx = headers.indexOf('venue');
      const timeIdx = headers.indexOf('time');
      const interpIdx = headers.indexOf('interpreters');
      const publicAppIdx = headers.indexOf('public app');

      if (dateIdx === -1 || eventIdx === -1 || venueIdx === -1) continue;
      if (publicAppIdx === -1) continue; // No Public App column = skip

      for (let i = 1; i < data.length; i++) {
        const row = data[i];

        // Check "Public App" is truthy
        const publicAppVal = (row[publicAppIdx] || '').toString().trim();
        if (!isTruthyValue(publicAppVal)) continue;

        const dateRaw = (row[dateIdx] || '').toString().trim();
        const eventName = (row[eventIdx] || '').toString().trim();
        const venue = (row[venueIdx] || '').toString().trim();

        if (!dateRaw || !eventName || !venue) continue;

        const dateFormatted = convertToPublishedDateFormat(dateRaw);
        if (!dateFormatted) continue;

        // Skip past events
        if (isDateInPast(dateRaw)) continue;

        const time = timeIdx >= 0 ? (row[timeIdx] || '').toString().trim() : '';
        const interpreters = interpIdx >= 0 ? (row[interpIdx] || '').toString().trim() : '';
        const city = extractCityFromVenue(venue);
        const interpretation = venue.toLowerCase().includes('ireland') ? 'ISL' : 'BSL';
        const category = detectCategory(eventName, venue);

        const publishedRow = [
          dateFormatted,           // DATE
          eventName,               // EVENT
          venue,                   // VENUE
          city,                    // CITY
          time || 'TBC',           // TIME
          interpreters || 'TBC',   // INTERPRETERS
          interpretation,          // INTERPRETATION
          category,                // CATEGORY
          '',                      // IMAGE URL (not available from monthly tabs)
          '',                      // EVENT URL (not available from monthly tabs)
          ''                       // STATUS
        ];

        const key = makeDedupKey(dateRaw, eventName, venue);
        events.push({ key, row: publishedRow, source: 'Monthly (' + name + ')' });
      }
    }
  } catch (error) {
    Logger.log('Error reading monthly tabs: ' + error.toString());
  }

  return events;
}

// ==================== MERGE & DEDUP ====================

/**
 * Build dedup key set from existing PUBLISHED data
 */
function buildDedupKeys(data) {
  const keys = new Set();
  if (!data || data.length < 2) return keys;

  // Find column indices from header row
  const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());
  const dateIdx = headers.indexOf('DATE');
  const eventIdx = headers.indexOf('EVENT');
  const venueIdx = headers.indexOf('VENUE');

  if (dateIdx === -1 || eventIdx === -1 || venueIdx === -1) return keys;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const date = (row[dateIdx] || '').toString().trim();
    const event = (row[eventIdx] || '').toString().trim();
    const venue = (row[venueIdx] || '').toString().trim();
    if (date && event) {
      keys.add(makeDedupKey(date, event, venue));
    }
  }

  return keys;
}

/**
 * Merge pre-approved and monthly events. Monthly wins on conflict.
 */
function mergeEvents(preApproved, monthly) {
  const eventMap = new Map();

  // Add pre-approved first
  for (const evt of preApproved) {
    eventMap.set(evt.key, evt);
  }

  // Monthly overwrites (has better data: real interpreter names, confirmed times)
  for (const evt of monthly) {
    eventMap.set(evt.key, evt);
  }

  return Array.from(eventMap.values());
}

// ==================== PUBLISH & PRUNE ====================

/**
 * Remove past events from PUBLISHED sheet
 */
function removePastEvents(sheet, data) {
  const result = { removed: [] };
  if (!data || data.length < 2) return result;

  const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());
  const dateIdx = headers.indexOf('DATE');
  const eventIdx = headers.indexOf('EVENT');
  const venueIdx = headers.indexOf('VENUE');

  if (dateIdx === -1) return result;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rowsToKeep = [data[0]]; // Keep header
  const removed = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = (row[dateIdx] || '').toString().trim();
    const parsed = parseDDMMYY(dateStr);

    if (parsed && parsed < today) {
      removed.push({
        date: dateStr,
        event: (row[eventIdx] || '').toString().trim(),
        venue: (row[venueIdx] || '').toString().trim()
      });
    } else {
      rowsToKeep.push(row);
    }
  }

  if (removed.length > 0 && !DRY_RUN) {
    // Rewrite sheet without past events
    sheet.clearContents();
    if (rowsToKeep.length > 0) {
      sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
  }

  result.removed = removed;
  return result;
}

/**
 * Append new event rows to PUBLISHED sheet
 */
function appendNewEvents(sheet, newEvents) {
  if (newEvents.length === 0) return;

  const lastRow = sheet.getLastRow();
  const rows = newEvents.map(e => e.row);
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ==================== EMAIL DIGEST ====================

/**
 * Send daily digest email
 */
function sendDigestEmail(log) {
  const today = Utilities.formatDate(new Date(), 'Europe/London', 'dd MMM yyyy');
  const addedCount = log.added.length;
  const removedCount = log.removed.length;
  const warningCount = log.warnings.length;
  const quality = log.quality || {};
  const attentionCount = (quality.missingImage || []).length + (quality.missingLink || []).length;

  // Don't email if nothing happened and no warnings
  if (addedCount === 0 && removedCount === 0 && warningCount === 0 && attentionCount === 0) {
    Logger.log('No changes and no quality issues - skipping email');
    return;
  }

  // Subject line with key numbers
  let subject = `PI Events Digest - ${today}`;
  const parts = [];
  if (addedCount > 0) parts.push(`+${addedCount} new`);
  if (removedCount > 0) parts.push(`-${removedCount} removed`);
  if (attentionCount > 0) parts.push(`${attentionCount} need attention`);
  if (warningCount > 0) parts.push(`${warningCount} warnings`);
  subject += ` | ${parts.join(', ')}`;

  let body = '';

  // ---- QUICK SUMMARY ----
  body += `PI EVENTS AUTO-PUBLISH DIGEST\n`;
  body += `${today}\n`;
  body += `${'='.repeat(55)}\n\n`;

  body += `QUICK SUMMARY\n`;
  body += `-`.repeat(55) + `\n`;
  body += `  Total published events:  ${quality.total || '?'}\n`;
  body += `  Added today:             ${addedCount}\n`;
  body += `  Removed (past):          ${removedCount}\n`;
  body += `  Skipped (duplicates):    ${log.skipped}\n`;
  body += `  Missing images:          ${(quality.missingImage || []).length}\n`;
  body += `  Missing event links:     ${(quality.missingLink || []).length}\n`;
  if (warningCount > 0) {
    body += `  Warnings:                ${warningCount}\n`;
  }
  body += '\n';

  // ---- NEEDS ATTENTION (missing image or link) ----
  const needsAttention = [];
  const addedSet = new Set(log.added.map(e => `${e.date} | ${e.event} | ${e.venue}`));

  // Flag newly added events missing data
  for (const evt of log.added) {
    const issues = [];
    if (!evt.imageUrl) issues.push('NO IMAGE');
    if (!evt.eventUrl) issues.push('NO LINK');
    if (!evt.city) issues.push('NO CITY');
    if (issues.length > 0) {
      needsAttention.push(`  [NEW] ${evt.date} | ${evt.event} | ${evt.venue}\n        -> ${issues.join(', ')}`);
    }
  }

  // Flag existing events missing images or links (limit to 20 to keep email readable)
  const existingMissingImage = (quality.missingImage || []).filter(l => !addedSet.has(l));
  const existingMissingLink = (quality.missingLink || []).filter(l => !addedSet.has(l));

  // Combine into unique events with their issues
  const existingIssues = {};
  for (const label of existingMissingImage) {
    existingIssues[label] = existingIssues[label] || [];
    existingIssues[label].push('NO IMAGE');
  }
  for (const label of existingMissingLink) {
    existingIssues[label] = existingIssues[label] || [];
    existingIssues[label].push('NO LINK');
  }

  const existingLabels = Object.keys(existingIssues);
  // Show events missing BOTH first, then image-only, then link-only
  existingLabels.sort((a, b) => existingIssues[b].length - existingIssues[a].length);

  for (const label of existingLabels.slice(0, 20)) {
    needsAttention.push(`  ${label}\n        -> ${existingIssues[label].join(', ')}`);
  }
  if (existingLabels.length > 20) {
    needsAttention.push(`  ... and ${existingLabels.length - 20} more`);
  }

  if (needsAttention.length > 0) {
    body += `NEEDS ATTENTION (${needsAttention.length})\n`;
    body += `-`.repeat(55) + `\n`;
    body += needsAttention.join('\n') + '\n\n';
  }

  // ---- NEW EVENTS PUBLISHED ----
  if (addedCount > 0) {
    body += `NEW EVENTS PUBLISHED (${addedCount})\n`;
    body += `-`.repeat(55) + `\n`;
    for (const evt of log.added) {
      const flags = [];
      if (evt.imageUrl) flags.push('img:yes');
      else flags.push('img:NO');
      if (evt.eventUrl) flags.push('link:yes');
      else flags.push('link:NO');
      body += `  ${evt.date} | ${evt.event}\n`;
      body += `    ${evt.venue}${evt.city ? ', ' + evt.city : ''} | ${flags.join(' ')} | via ${evt.source}\n`;
    }
    body += '\n';
  }

  // ---- PAST EVENTS REMOVED ----
  if (removedCount > 0) {
    body += `PAST EVENTS REMOVED (${removedCount})\n`;
    body += `-`.repeat(55) + `\n`;
    for (const evt of log.removed) {
      body += `  ${evt.date} | ${evt.event} | ${evt.venue}\n`;
    }
    body += '\n';
  }

  // ---- DATA QUALITY REPORT ----
  if (quality.total) {
    body += `DATA QUALITY REPORT (all ${quality.total} published events)\n`;
    body += `-`.repeat(55) + `\n`;
    const imgPct = Math.round(((quality.total - (quality.missingImage || []).length) / quality.total) * 100);
    const linkPct = Math.round(((quality.total - (quality.missingLink || []).length) / quality.total) * 100);
    const cityPct = Math.round(((quality.total - (quality.missingCity || []).length) / quality.total) * 100);
    const catPct = Math.round(((quality.total - (quality.missingCategory || []).length) / quality.total) * 100);
    const interpPct = Math.round(((quality.total - (quality.missingInterpreters || []).length) / quality.total) * 100);

    body += `  Images:       ${imgPct}% complete (${(quality.missingImage || []).length} missing)\n`;
    body += `  Event links:  ${linkPct}% complete (${(quality.missingLink || []).length} missing)\n`;
    body += `  Cities:       ${cityPct}% complete (${(quality.missingCity || []).length} missing)\n`;
    body += `  Categories:   ${catPct}% complete (${(quality.missingCategory || []).length} missing)\n`;
    body += `  Interpreters: ${interpPct}% complete (${(quality.missingInterpreters || []).length} missing/TBC)\n`;
    body += '\n';
  }

  // ---- WARNINGS ----
  if (warningCount > 0) {
    body += `WARNINGS (${warningCount})\n`;
    body += `-`.repeat(55) + `\n`;
    for (const w of log.warnings) {
      body += `  ! ${w}\n`;
    }
    body += '\n';
  }

  // ---- FOOTER ----
  body += `${'='.repeat(55)}\n`;
  body += `Review sheet: https://docs.google.com/spreadsheets/d/${PUBLIC_FEED_ID}/edit\n`;
  body += `Live app: https://app.performanceinterpreting.co.uk\n`;
  body += `Auto-published by PI Events System\n`;

  if (DRY_RUN) {
    body = '[DRY RUN - no changes made]\n\n' + body;
    subject = '[DRY RUN] ' + subject;
  }

  try {
    GmailApp.sendEmail(DIGEST_EMAIL, subject, body);
    Logger.log('Digest email sent to ' + DIGEST_EMAIL);
  } catch (error) {
    Logger.log('Failed to send email: ' + error.toString());
  }
}

// ==================== DATA QUALITY AUDIT ====================

/**
 * Audit all published events for missing data.
 * Returns quality report object.
 */
function auditPublishedData(data) {
  const report = {
    total: 0,
    missingImage: [],
    missingLink: [],
    missingCity: [],
    missingCategory: [],
    missingInterpreters: []
  };

  if (!data || data.length < 2) return report;

  const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());
  const col = {
    date: headers.indexOf('DATE'),
    event: headers.indexOf('EVENT'),
    venue: headers.indexOf('VENUE'),
    city: headers.indexOf('CITY'),
    interpreters: headers.indexOf('INTERPRETERS'),
    category: headers.indexOf('CATEGORY'),
    imageUrl: headers.indexOf('IMAGE URL'),
    eventUrl: headers.indexOf('EVENT URL')
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const date = (row[col.date] || '').toString().trim();
    const event = (row[col.event] || '').toString().trim();
    const venue = (row[col.venue] || '').toString().trim();

    if (!date && !event) continue; // skip blank rows
    report.total++;

    const label = `${date} | ${event} | ${venue}`;

    if (col.imageUrl < 0 || !(row[col.imageUrl] || '').toString().trim()) {
      report.missingImage.push(label);
    }
    if (col.eventUrl < 0 || !(row[col.eventUrl] || '').toString().trim()) {
      report.missingLink.push(label);
    }
    if (col.city < 0 || !(row[col.city] || '').toString().trim()) {
      report.missingCity.push(label);
    }
    if (col.category < 0 || !(row[col.category] || '').toString().trim()) {
      report.missingCategory.push(label);
    }
    const interp = col.interpreters >= 0 ? (row[col.interpreters] || '').toString().trim() : '';
    if (!interp || interp === 'TBC') {
      report.missingInterpreters.push(label);
    }
  }

  return report;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create normalized dedup key from date + event name + venue
 */
function makeDedupKey(dateStr, eventName, venue) {
  const dateNorm = normalizeDateForKey(dateStr);
  const eventNorm = normalizeForKey(eventName);
  const venueNorm = normalizeForKey(venue);
  return `${dateNorm}|${eventNorm}|${venueNorm}`;
}

/**
 * Normalize string for dedup: lowercase, strip non-alphanumeric
 */
function normalizeForKey(str) {
  return (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize any date format to YYYYMMDD for dedup comparison
 */
function normalizeDateForKey(dateStr) {
  const str = (dateStr || '').toString().trim();

  // Handle Date objects from Sheets
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  // DD.MM.YY or DD.MM.YYYY
  const dotParts = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotParts) {
    const d = dotParts[1].padStart(2, '0');
    const m = dotParts[2].padStart(2, '0');
    let y = dotParts[3];
    if (y.length === 2) y = '20' + y;
    return `${y}${m}${d}`;
  }

  // YYYY-MM-DD
  const isoParts = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoParts) {
    return `${isoParts[1]}${isoParts[2].padStart(2, '0')}${isoParts[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY
  const slashParts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashParts) {
    const d = slashParts[1].padStart(2, '0');
    const m = slashParts[2].padStart(2, '0');
    let y = slashParts[3];
    if (y.length === 2) y = '20' + y;
    return `${y}${m}${d}`;
  }

  return str; // Fallback: use as-is
}

/**
 * Convert any date format to DD.MM.YY (PUBLISHED format)
 */
function convertToPublishedDateFormat(dateStr) {
  const str = (dateStr || '').toString().trim();

  // Handle Date objects from Sheets
  if (dateStr instanceof Date) {
    const d = String(dateStr.getDate()).padStart(2, '0');
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const y = String(dateStr.getFullYear()).slice(-2);
    return `${d}.${m}.${y}`;
  }

  // Already DD.MM.YY
  if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(str)) return str;

  // DD.MM.YYYY → DD.MM.YY
  const dotFull = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotFull) {
    return `${dotFull[1].padStart(2, '0')}.${dotFull[2].padStart(2, '0')}.${dotFull[3].slice(-2)}`;
  }

  // YYYY-MM-DD → DD.MM.YY
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}.${iso[2].padStart(2, '0')}.${iso[1].slice(-2)}`;
  }

  // DD/MM/YYYY → DD.MM.YY
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let y = slash[3];
    if (y.length === 4) y = y.slice(-2);
    return `${slash[1].padStart(2, '0')}.${slash[2].padStart(2, '0')}.${y}`;
  }

  return null; // Unparseable
}

/**
 * Parse DD.MM.YY date string to Date object
 */
function parseDDMMYY(dateStr) {
  if (!dateStr) return null;
  const str = (dateStr || '').toString().trim();

  // Handle Date objects
  if (dateStr instanceof Date) return dateStr;

  const parts = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!parts) return null;

  const day = parseInt(parts[1]);
  const month = parseInt(parts[2]) - 1;
  let year = parseInt(parts[3]);
  if (year < 100) year += 2000;

  return new Date(year, month, day);
}

/**
 * Check if a date string represents a past date
 */
function isDateInPast(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Handle Date objects
  if (dateStr instanceof Date) return dateStr < today;

  const str = (dateStr || '').toString().trim();

  // Try DD.MM.YY
  const parsed = parseDDMMYY(str);
  if (parsed) return parsed < today;

  // Try YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return d < today;
  }

  return false; // Can't parse = don't skip
}

/**
 * Check if sheet name matches monthly tab pattern: "MonthName YYYY"
 */
function isMonthlyTab(name) {
  const pattern = new RegExp('^(' + MONTH_NAMES.join('|') + ') \\d{4}$', 'i');
  return pattern.test(name);
}

/**
 * Check if value is truthy (Yes, TRUE, checked, etc.)
 */
function isTruthyValue(val) {
  if (val === true) return true; // Checkbox
  const str = (val || '').toString().trim().toLowerCase();
  return ['yes', 'true', '1', 'x', 'y'].includes(str);
}

// detectCategory() defined in Code.gs (shared namespace)

/**
 * Extract city from venue string (text after last comma)
 */
function extractCityFromVenue(venue) {
  if (!venue) return '';
  const parts = venue.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return '';
}

// ==================== DRY RUN ====================
// Note: onOpen() is in Code.gs. Add Auto-Publish menu there if needed.

function dryRunAutoPublish() {
  DRY_RUN = true;
  dailyAutoPublishDryRun_();
  DRY_RUN = false;
}

function dailyAutoPublishDryRun_() {
  const log = { added: [], removed: [], warnings: ['[DRY RUN MODE - no changes written]'], skipped: 0 };

  try {
    const publishedSS = SpreadsheetApp.openById(PUBLIC_FEED_ID);
    const publishedSheet = publishedSS.getSheetByName(PUBLISHED_SHEET);
    if (!publishedSheet) {
      log.warnings.push('PUBLISHED sheet not found');
      sendDigestEmail(log);
      return;
    }

    const existingData = publishedSheet.getDataRange().getValues();
    const existingKeys = buildDedupKeys(existingData);

    const preApprovedEvents = getEventsFromPreApproved();
    const monthlyEvents = getEventsFromMonthlyTabs();
    const mergedEvents = mergeEvents(preApprovedEvents, monthlyEvents);

    for (const evt of mergedEvents) {
      if (existingKeys.has(evt.key)) {
        log.skipped++;
      } else {
        log.added.push({
          date: evt.row[0],
          event: evt.row[1],
          venue: evt.row[2],
          city: evt.row[3],
          imageUrl: evt.row[8],
          eventUrl: evt.row[9],
          source: evt.source
        });
      }
    }

    // Count past events (without removing)
    const headers = existingData[0].map(h => (h || '').toString().trim().toUpperCase());
    const dateIdx = headers.indexOf('DATE');
    const eventIdx = headers.indexOf('EVENT');
    const venueIdx = headers.indexOf('VENUE');
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (let i = 1; i < existingData.length; i++) {
      const dateStr = (existingData[i][dateIdx] || '').toString().trim();
      const parsed = parseDDMMYY(dateStr);
      if (parsed && parsed < todayDate) {
        log.removed.push({
          date: dateStr,
          event: (existingData[i][eventIdx] || '').toString().trim(),
          venue: (existingData[i][venueIdx] || '').toString().trim()
        });
      }
    }

    // Audit data quality
    log.quality = auditPublishedData(existingData);

    Logger.log(`Dry run: Would add ${log.added.length}, remove ${log.removed.length}, skip ${log.skipped}`);
  } catch (error) {
    log.warnings.push('Error: ' + error.toString());
  }

  // Use the same enhanced email (DRY_RUN flag handled inside)
  sendDigestEmail(log);
}
