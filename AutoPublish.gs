// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Automation')
    .addItem('▶ Run Auto-Publish', 'dailyAutoPublish')
    .addItem('🧪 Dry Run', 'dryRunAutoPublish')
    .addSeparator()
    .addItem('🔍 Dedup Check (exact)', 'deduplicatePublished')
    .addItem('🔍 Dedup Check (date-varying)', 'deduplicateDateVarying')
    .addToUi();
}

// Run once to install the onOpen menu trigger for the Public Events Feed
function installOpenTrigger() {
  // Remove any existing onOpen triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'onOpen') ScriptApp.deleteTrigger(t);
  });
  // Create installable onOpen trigger for the Public Events Feed
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(PUBLIC_FEED_ID)
    .onOpen()
    .create();
  Logger.log('Installable onOpen trigger created for Public Events Feed');
}

// ==================== PI EVENTS - AUTO-PUBLISH + EMAIL DIGEST ====================
// Runs daily on a time-driven trigger. Zero manual intervention.
// Reads from PRE_APPROVED EVENTS + monthly tabs → publishes to PUBLISHED sheet.
// Sends email digest to admin@performanceinterpreting.co.uk.
// ================================================================================

// ==================== CONFIGURATION ====================
// PI_WORKFLOW_ID, PUBLIC_FEED_ID, PRE_APPROVED_SHEET, PUBLISHED_SHEET,
// CANCELLED_SHEET, MONTH_NAMES, PUBLISHED_HEADERS are declared in Code.gs
// (Apps Script shares namespace across all .gs files)

// AutoPublish-specific defaults (no var/const/let to avoid V8 redeclaration errors)
// DIGEST_EMAIL: prefer Script Properties, fall back to default
if (typeof DIGEST_EMAIL === 'undefined') {
  DIGEST_EMAIL = PropertiesService.getScriptProperties().getProperty('DIGEST_EMAIL') || 'admin@performanceinterpreting.co.uk';
}
if (typeof DRY_RUN === 'undefined') DRY_RUN = false;

// ==================== MAIN ENTRY POINT ====================

/**
 * Daily auto-publish trigger target.
 * Reads from sources, deduplicates, validates, publishes, emails digest.
 * Uses LockService to prevent concurrent execution.
 */
function dailyAutoPublish() {
  const log = { added: [], removed: [], warnings: [], skipped: 0 };

  // Prevent concurrent execution (e.g., trigger fires while previous run still in progress)
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // Wait up to 30 seconds for lock

  if (!hasLock) {
    Logger.log('AutoPublish: Another instance is already running, skipping this run');
    return;
  }

  try {
    // 1. Get existing PUBLISHED data and build dedup keys
    const publishedSS = SpreadsheetApp.openById(PUBLIC_FEED_ID);
    const publishedSheet = publishedSS.getSheetByName(PUBLISHED_SHEET);

    if (!publishedSheet) {
      log.warnings.push('PUBLISHED sheet not found in Public Events Feed');
      sendDigestEmail(log);
      return;
    }

    var existingData = publishedSheet.getDataRange().getValues();
    const dedupResult = buildDedupKeys(existingData);
    const existingKeys = dedupResult.keys;
    const piOsKeys = dedupResult.piOsKeys;

    // 1b. Load cancelled events blocklist
    const cancelledKeys = getCancelledKeys(publishedSS);

    // 1c. Correct typos in source sheets (PI Workflow) before reading
    if (!DRY_RUN) {
      var sourceTyposCorrected = correctSourceTypos();
      if (sourceTyposCorrected > 0) {
        log.warnings.push('Corrected ' + sourceTyposCorrected + ' typo(s) in source sheets');
      }
    }

    // 2. Read events from sources
    const preApprovedEvents = getEventsFromPreApproved();
    const monthlyEvents = getEventsFromMonthlyTabs();

    // 3. Merge (monthly wins over pre-approved for same event)
    // PI_OS events are protected - scrapers/manual cannot overwrite them
    const mergedEvents = mergeEvents(preApprovedEvents, monthlyEvents, piOsKeys);

    // 4. Filter: new events only (not already in PUBLISHED, not cancelled)
    const newEvents = [];
    log.cancelledSkipped = 0;
    log.piOsProtected = 0;
    for (const evt of mergedEvents) {
      if (cancelledKeys.has(evt.key)) {
        log.cancelledSkipped++;
      } else if (piOsKeys.has(evt.key)) {
        // PI_OS events are protected - don't add duplicate from scraper/manual
        log.piOsProtected++;
      } else if (existingKeys.has(evt.key)) {
        log.skipped++;
      } else {
        newEvents.push(evt);
      }
    }

    // 4b. Remove any cancelled events still in PUBLISHED
    const cancelRemoved = removeCancelledEvents(publishedSheet, existingData, cancelledKeys);
    if (cancelRemoved.length > 0) {
      log.warnings.push('Removed ' + cancelRemoved.length + ' cancelled event(s) from PUBLISHED: ' + cancelRemoved.join(', '));
    }

    // 4c. Correct venue/city typos in existing PUBLISHED data
    if (!DRY_RUN) {
      const typosCorrected = correctPublishedTypos(publishedSheet);
      if (typosCorrected > 0) {
        log.warnings.push('Corrected venue/city typos in ' + typosCorrected + ' existing row(s)');
        existingData = publishedSheet.getDataRange().getValues();
        // Rebuild dedup keys after corrections
        const refreshed = buildDedupKeys(existingData);
        existingKeys.clear();
        for (const k of refreshed.keys) existingKeys.add(k);
      }
    }

    // 5. Deduplicate existing PUBLISHED rows (fuzzy match, keep best data)
    const exactDedupResult = deduplicatePublished(publishedSheet);
    if (exactDedupResult.removed > 0) {
      log.warnings.push('Dedup: merged ' + exactDedupResult.removed + ' duplicate row(s): ' + exactDedupResult.merged.join('; '));
      existingData = publishedSheet.getDataRange().getValues();
    }

    // 6. Remove past events from PUBLISHED
    const removeResult = removePastEvents(publishedSheet, existingData);
    log.removed = removeResult.removed;

    // 7. Append new events
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
      source: e.source,
      categoryAssumed: e.categoryAssumed
    }));

    // 7b. Date-varying dedup: same event+venue with consecutive dates (1 day apart)
    // Runs AFTER append so it catches duplicates between existing and newly-added rows
    const dateVaryResult = deduplicateDateVarying(publishedSheet);
    if (dateVaryResult.removed > 0) {
      log.warnings.push('Date-varying dedup: merged ' + dateVaryResult.removed + ' row(s): ' + dateVaryResult.merged.join('; '));
    }

    // Track events with assumed categories, but exclude ones already manually
    // corrected in PUBLISHED (so the digest doesn't keep flagging fixed items)
    const publishedCategories = {};
    const freshPublished = publishedSheet.getDataRange().getValues();
    const pubHeaders = freshPublished[0].map(h => (h || '').toString().trim().toUpperCase());
    const pubDateIdx = pubHeaders.indexOf('DATE');
    const pubEventIdx = pubHeaders.indexOf('EVENT');
    const pubVenueIdx = pubHeaders.indexOf('VENUE');
    const pubCatIdx = pubHeaders.indexOf('CATEGORY');
    if (pubDateIdx >= 0 && pubEventIdx >= 0 && pubCatIdx >= 0) {
      for (let p = 1; p < freshPublished.length; p++) {
        var pKey = makeDedupKey(freshPublished[p][pubDateIdx], freshPublished[p][pubEventIdx],
          pubVenueIdx >= 0 ? freshPublished[p][pubVenueIdx] : '');
        publishedCategories[pKey] = (freshPublished[p][pubCatIdx] || '').toString().trim();
      }
    }
    log.assumedCategories = mergedEvents
      .filter(e => {
        if (!e.categoryAssumed) return false;
        // If PUBLISHED already has a non-default category for this event, don't flag it
        var existingCat = publishedCategories[e.key];
        if (existingCat && existingCat !== 'Concert' && existingCat !== e.row[7]) return false;
        return true;
      })
      .map(e => ({ date: e.row[0], event: e.row[1], venue: e.row[2], category: e.row[7] }));

    // 8. Enrich missing images via artist name matching
    const enrichResult = enrichMissingImages(publishedSheet);
    log.enriched = enrichResult;

    // 8b. Enrich missing event links via venue homepage lookup
    const linkEnrichResult = enrichMissingEventLinks(publishedSheet);
    log.linksEnriched = linkEnrichResult;

    // 8c. Festival event page discovery (finds both image + link from official event pages)
    const festivalResult = enrichViaFestivalDiscovery(publishedSheet);
    log.festivalEnriched = festivalResult;

    // 9. Audit ALL published events for data quality
    const freshData = publishedSheet.getDataRange().getValues();
    log.quality = auditPublishedData(freshData);

    Logger.log(`Auto-publish complete: ${newEvents.length} added, ${removeResult.removed.length} removed, ${log.skipped} skipped (dupes)`);

  } catch (error) {
    log.warnings.push('Script error: ' + error.toString());
    Logger.log('Auto-publish error: ' + error.toString());
  } finally {
    // Always release the lock
    lock.releaseLock();
  }

  // 10. Send digest email
  sendDigestEmail(log);
}

// ==================== BSL GUARANTEED VENUES ====================

/**
 * Venues that provide BSL interpretation at every event as standard.
 * If INTERPRETERS is empty for these venues, auto-fill it.
 */
var BSL_GUARANTEED_VENUES = ['wembley stadium'];

function resolveInterpreters(interpreters, venue) {
  if (interpreters && interpreters.trim() !== '' && interpreters.trim().toUpperCase() !== 'TBC') {
    return interpreters.trim();
  }
  var venueLower = (venue || '').toLowerCase();
  for (var i = 0; i < BSL_GUARANTEED_VENUES.length; i++) {
    if (venueLower.indexOf(BSL_GUARANTEED_VENUES[i]) !== -1) {
      return 'BSL Interpreter (Venue Standard)';
    }
  }
  return interpreters || 'TBC';
}

// ==================== VENUE TYPO CORRECTIONS ====================

VENUE_TYPO_CORRECTIONS = typeof VENUE_TYPO_CORRECTIONS !== 'undefined' ? VENUE_TYPO_CORRECTIONS : [
  { pattern: /\bStandford\s+Bridge\b/gi, replacement: 'Stamford Bridge' },
  { pattern: /\bStaduim\b/gi, replacement: 'Stadium' },
  { pattern: /\bStadiem\b/gi, replacement: 'Stadium' },
  { pattern: /\bLiecester\b/gi, replacement: 'Leicester' },
  { pattern: /\bManachest?er\b/gi, replacement: 'Manchester' },
  { pattern: /\bBirmnigham\b/gi, replacement: 'Birmingham' },
  { pattern: /\bNottignham\b/gi, replacement: 'Nottingham' },
  { pattern: /\bEdinbugrh\b/gi, replacement: 'Edinburgh' },
  { pattern: /\bShefeild\b/gi, replacement: 'Sheffield' },
  { pattern: /\bReding\b/g, replacement: 'Reading' },
  { pattern: /\bUtlilita\b/gi, replacement: 'Utilita' },
  { pattern: /\bCaste\b/g, replacement: 'Castle' },
];

// Also correct city names in the CITY column
CITY_TYPO_CORRECTIONS = typeof CITY_TYPO_CORRECTIONS !== 'undefined' ? CITY_TYPO_CORRECTIONS : [
  { pattern: /^Reding$/i, replacement: 'Reading' },
  { pattern: /^Lodnon$/i, replacement: 'London' },
  { pattern: /^Mnchester$/i, replacement: 'Manchester' },
];

// ==================== EVENT NAME TYPO CORRECTIONS ====================
EVENT_TYPO_CORRECTIONS = typeof EVENT_TYPO_CORRECTIONS !== 'undefined' ? EVENT_TYPO_CORRECTIONS : [
  { pattern: /\bSummetime\b/gi, replacement: 'Summertime' },
  { pattern: /\bCapataldi\b/gi, replacement: 'Capaldi' },
  { pattern: /\bCapitol\s+Summetime\b/gi, replacement: 'Capital Summertime' },
];

function correctEventTypos(eventName) {
  if (!eventName) return '';
  var e = eventName;
  for (var i = 0; i < EVENT_TYPO_CORRECTIONS.length; i++) {
    e = e.replace(EVENT_TYPO_CORRECTIONS[i].pattern, EVENT_TYPO_CORRECTIONS[i].replacement);
  }
  return e;
}

function correctVenueTypos(venue) {
  if (!venue) return '';
  var v = venue;
  for (var i = 0; i < VENUE_TYPO_CORRECTIONS.length; i++) {
    v = v.replace(VENUE_TYPO_CORRECTIONS[i].pattern, VENUE_TYPO_CORRECTIONS[i].replacement);
  }
  return v;
}

function correctCityTypos(city) {
  if (!city) return '';
  var c = city.trim();
  for (var i = 0; i < CITY_TYPO_CORRECTIONS.length; i++) {
    c = c.replace(CITY_TYPO_CORRECTIONS[i].pattern, CITY_TYPO_CORRECTIONS[i].replacement);
  }
  return c;
}

/**
 * Correct venue and city typos in existing PUBLISHED data.
 * Returns count of rows corrected.
 */
function correctPublishedTypos(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var venueCol = headers.indexOf('VENUE');
  var cityCol = headers.indexOf('CITY');
  var eventCol = headers.indexOf('EVENT');
  if (venueCol < 0) return 0;

  var corrected = 0;
  for (var i = 1; i < data.length; i++) {
    var venue = (data[i][venueCol] || '').toString().trim();
    var fixedVenue = correctVenueTypos(venue);
    var changed = false;

    if (fixedVenue !== venue) {
      sheet.getRange(i + 1, venueCol + 1).setValue(fixedVenue);
      changed = true;
    }

    if (cityCol >= 0) {
      var city = (data[i][cityCol] || '').toString().trim();
      var fixedCity = correctCityTypos(city);
      // Also fill empty cities using venue lookup
      if (!fixedCity && fixedVenue) {
        fixedCity = extractCityFromVenue(fixedVenue);
      }
      if (fixedCity && fixedCity !== city) {
        sheet.getRange(i + 1, cityCol + 1).setValue(fixedCity);
        changed = true;
      }
    }

    // Correct event name typos
    if (eventCol >= 0) {
      var eventName = (data[i][eventCol] || '').toString().trim();
      var fixedEvent = correctEventTypos(eventName);
      if (fixedEvent !== eventName) {
        sheet.getRange(i + 1, eventCol + 1).setValue(fixedEvent);
        changed = true;
      }
    }

    if (changed) corrected++;
  }
  return corrected;
}

/**
 * Correct typos in PI Workflow source sheets (PRE_APPROVED + monthly tabs).
 * Fixes event names, venues, and cities at the root so dedup keys match.
 */
function correctSourceTypos() {
  try {
    var ss = SpreadsheetApp.openById(PI_WORKFLOW_ID);
    var corrected = 0;

    // Fix PRE_APPROVED EVENTS sheet
    var preApproved = ss.getSheetByName(PRE_APPROVED_SHEET);
    if (preApproved && preApproved.getLastRow() >= 2) {
      corrected += correctSheetTypos_(preApproved, { event: 'EVENT_NAME', venue: 'VENUE', city: 'CITY' });
    }

    // Fix monthly tabs
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (isMonthlyTab(sheets[i].getName()) && sheets[i].getLastRow() >= 2) {
        corrected += correctSheetTypos_(sheets[i], { event: 'EVENT', venue: 'VENUE', city: null });
      }
    }

    if (corrected > 0) Logger.log('Source typos corrected: ' + corrected + ' cell(s)');
    return corrected;
  } catch (e) {
    Logger.log('Error correcting source typos: ' + e.toString());
    return 0;
  }
}

/**
 * Apply all typo corrections to a sheet. Header names are case-insensitive.
 * @param {Sheet} sheet - The sheet to correct
 * @param {Object} colNames - { event, venue, city } header name mappings (null to skip)
 */
function correctSheetTypos_(sheet, colNames) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var eventCol = colNames.event ? headers.indexOf(colNames.event.toUpperCase()) : -1;
  var venueCol = colNames.venue ? headers.indexOf(colNames.venue.toUpperCase()) : -1;
  var cityCol = colNames.city ? headers.indexOf(colNames.city.toUpperCase()) : -1;

  var corrected = 0;
  for (var i = 1; i < data.length; i++) {
    if (eventCol >= 0) {
      var eventName = (data[i][eventCol] || '').toString().trim();
      var fixedEvent = correctEventTypos(eventName);
      if (fixedEvent !== eventName) {
        sheet.getRange(i + 1, eventCol + 1).setValue(fixedEvent);
        corrected++;
      }
    }
    if (venueCol >= 0) {
      var venue = (data[i][venueCol] || '').toString().trim();
      var fixedVenue = correctVenueTypos(venue);
      if (fixedVenue !== venue) {
        sheet.getRange(i + 1, venueCol + 1).setValue(fixedVenue);
        corrected++;
      }
    }
    if (cityCol >= 0) {
      var city = (data[i][cityCol] || '').toString().trim();
      var fixedCity = correctCityTypos(city);
      if (fixedCity && fixedCity !== city) {
        sheet.getRange(i + 1, cityCol + 1).setValue(fixedCity);
        corrected++;
      }
    }
  }
  return corrected;
}

// ==================== VENUE → CITY LOOKUP ====================
// For venues without a comma-separated city (e.g. "Stamford Bridge", "Emirates Stadium")

VENUE_CITY_LOOKUP = typeof VENUE_CITY_LOOKUP !== 'undefined' ? VENUE_CITY_LOOKUP : {
  'stamfordbridge': 'London',
  'emiratesstadium': 'London',
  'londonstadium': 'London',
  'wembleystadium': 'London',
  'ovowembley': 'London',
  'o2main': 'London',
  'indigoo2': 'London',
  'eventimapollo': 'London',
  'allypal': 'London',
  'southbank': 'London',
  'bppulse': 'Birmingham',
  'anfield': 'Liverpool',
  'aomanc': 'Manchester',
  'o2apollomanc': 'Manchester',
  'utilitasheff': 'Sheffield',
  'motorpointnott': 'Nottingham',
  'ovohydro': 'Glasgow',
  'msbankliverpool': 'Liverpool',
  'bournemouth': 'Bournemouth',
  '3arenadublin': 'Dublin',
};

// ==================== VENUE → EVENT LINK MAP ====================
// Fallback links for events without an EVENT URL — points to venue's events/fixtures page

VENUE_EVENT_LINK_MAP = typeof VENUE_EVENT_LINK_MAP !== 'undefined' ? VENUE_EVENT_LINK_MAP : [
  { matcher: /\b(the\s*)?o2\b/i, exclude: /indigo|apollo|forum|kentish|academy|brixton/i, url: 'https://www.theo2.co.uk/events' },
  { matcher: /indigo.*o2|o2.*indigo/i, url: 'https://www.theo2.co.uk/venues/indigo-at-the-o2' },
  { matcher: /royal\s*albert\s*hall/i, url: 'https://www.royalalberthall.com/tickets' },
  { matcher: /wembley/i, exclude: /ovo|arena/i, url: 'https://www.wembleystadium.com/events' },
  { matcher: /ovo.*wembley|wembley.*ovo/i, url: 'https://www.ovoarena.com/events' },
  { matcher: /southbank|rfh|qeh|royal\s*festival/i, url: 'https://www.southbankcentre.co.uk/whats-on' },
  { matcher: /alexandra\s*palace/i, url: 'https://www.alexandrapalace.com/whats-on' },
  { matcher: /eventim\s*apollo|hammersmith.*apollo/i, url: 'https://www.eventimapollo.com/events' },
  { matcher: /ao\s*arena|manchester\s*arena/i, url: 'https://www.ao-arena.com/whats-on' },
  { matcher: /stamford\s*bridge/i, url: 'https://www.chelseafc.com/en/matches' },
  { matcher: /emirates\s*stadium/i, url: 'https://www.arsenal.com/fixtures' },
  { matcher: /london\s*stadium/i, url: 'https://www.whufc.com/fixtures' },
  { matcher: /motorpoint.*nottingham|nottingham.*(motorpoint|arena)/i, url: 'https://www.motorpointarenanottingham.com/whats-on' },
  { matcher: /utilita.*sheffield|sheffield.*(utilita|arena)/i, url: 'https://www.utilitaarenasheffield.co.uk/whats-on' },
  { matcher: /3\s*arena.*dublin|dublin.*3\s*arena/i, url: 'https://3arena.ie/events' },
  { matcher: /bp\s*pulse/i, url: 'https://bppulselive.co.uk/events' },
  { matcher: /bournemouth/i, url: 'https://www.bic.co.uk/events' },
  { matcher: /first\s*direct\s*arena|leeds.*(first\s*direct|arena)/i, url: 'https://www.firstdirectarena.com/whats-on' },
  { matcher: /o2.*academy.*brixton|brixton.*o2.*academy/i, url: 'https://academymusicgroup.com/o2academybrixton/events' },
  { matcher: /o2.*victoria.*manchester|manchester.*o2.*victoria/i, url: 'https://academymusicgroup.com/o2victoriawarehouse/events' },
];

// ==================== VENUE DEFAULT IMAGES ====================
// Fallback images for events at specific venues (hosted on R2)
// Used when no event-specific image is found by the scraper

VENUE_DEFAULT_IMAGES = typeof VENUE_DEFAULT_IMAGES !== 'undefined' ? VENUE_DEFAULT_IMAGES : [
  { matcher: /stamford\s*bridge/i, url: 'https://media.performanceinterpreting.co.uk/venues/stamford-bridge.jpg' },
  { matcher: /london\s*stadium/i, url: 'https://media.performanceinterpreting.co.uk/venues/london-stadium.jpg' },
  { matcher: /emirates\s*stadium/i, url: 'https://media.performanceinterpreting.co.uk/venues/emirates-stadium.png' },
  { matcher: /tottenham.*stadium|spurs.*stadium/i, url: 'https://media.performanceinterpreting.co.uk/venues/tottenham-stadium.webp' },
  { matcher: /craven\s*cottage|fulham/i, url: 'https://media.performanceinterpreting.co.uk/venues/craven-cottage.jpg' },
  { matcher: /wembley\s*stadium/i, url: 'https://media.performanceinterpreting.co.uk/defaults/default-sport.png' },
];

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
      const eventName = correctEventTypos((row[col.name] || '').toString().trim());
      const venue = correctVenueTypos((row[col.venue] || '').toString().trim());

      if (!dateRaw || !eventName || !venue) continue;

      // Convert date to DD.MM.YY format
      const dateFormatted = convertToPublishedDateFormat(dateRaw);
      if (!dateFormatted) continue;

      // Skip past events
      if (isDateInPast(dateRaw)) continue;

      const time = col.time >= 0 ? (row[col.time] || '').toString().trim() : '';
      const interpreters = col.interpreters >= 0 ? (row[col.interpreters] || '').toString().trim() : '';
      const rawCity = col.city >= 0 ? (row[col.city] || '').toString().trim() : '';
      const city = correctCityTypos(rawCity || extractCityFromVenue(venue));
      const interpretation = col.language >= 0 ? (row[col.language] || '').toString().trim() : 'BSL';
      const explicitCategory = col.category >= 0 ? (row[col.category] || '').toString().trim() : '';
      var categoryAssumed = false;
      var category;
      if (explicitCategory) {
        category = normalizeCategory(explicitCategory);
      } else {
        var catResult = detectCategoryWithDefault(eventName, venue);
        category = catResult.category;
        categoryAssumed = catResult.assumed;
      }
      const imageUrl = col.imageUrl >= 0 ? (row[col.imageUrl] || '').toString().trim() : '';
      const eventUrl = col.eventUrl >= 0 ? (row[col.eventUrl] || '').toString().trim() : '';

      const publishedRow = [
        dateFormatted,     // DATE
        eventName,         // EVENT
        venue,             // VENUE
        city,              // CITY
        time || 'TBC',     // TIME
        resolveInterpreters(interpreters, venue), // INTERPRETERS
        interpretation || 'BSL', // INTERPRETATION
        category,          // CATEGORY
        imageUrl,          // IMAGE URL
        eventUrl,          // EVENT URL
        '',                // STATUS
        'PRE_APPROVED'     // SOURCE (from PRE_APPROVED EVENTS sheet - may be scraper or manual)
      ];

      const key = makeDedupKey(dateRaw, eventName, venue);
      events.push({ key, row: publishedRow, source: 'Pre-Approved', categoryAssumed: categoryAssumed });
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
        const eventName = correctEventTypos((row[eventIdx] || '').toString().trim());
        const venue = correctVenueTypos((row[venueIdx] || '').toString().trim());

        if (!dateRaw || !eventName || !venue) continue;

        const dateFormatted = convertToPublishedDateFormat(dateRaw);
        if (!dateFormatted) continue;

        // Skip past events
        if (isDateInPast(dateRaw)) continue;

        const time = timeIdx >= 0 ? (row[timeIdx] || '').toString().trim() : '';
        const interpreters = interpIdx >= 0 ? (row[interpIdx] || '').toString().trim() : '';
        const city = correctCityTypos(extractCityFromVenue(venue));
        const interpretation = venue.toLowerCase().includes('ireland') ? 'ISL' : 'BSL';
        const catResult = detectCategoryWithDefault(eventName, venue);

        const publishedRow = [
          dateFormatted,           // DATE
          eventName,               // EVENT
          venue,                   // VENUE
          city,                    // CITY
          time || 'TBC',           // TIME
          resolveInterpreters(interpreters, venue), // INTERPRETERS
          interpretation,          // INTERPRETATION
          catResult.category,      // CATEGORY
          '',                      // IMAGE URL (not available from monthly tabs)
          '',                      // EVENT URL (not available from monthly tabs)
          '',                      // STATUS
          'MANUAL'                 // SOURCE (PI Work Flow monthly tabs)
        ];

        const key = makeDedupKey(dateRaw, eventName, venue);
        events.push({ key, row: publishedRow, source: 'Monthly (' + name + ')', categoryAssumed: catResult.assumed });
      }
    }
  } catch (error) {
    Logger.log('Error reading monthly tabs: ' + error.toString());
  }

  return events;
}

// ==================== MERGE & DEDUP ====================

/**
 * Build dedup key set from existing PUBLISHED data.
 * Returns { keys: Set, piOsKeys: Set } where piOsKeys contains events from PI_OS
 * that should never be overwritten by scrapers.
 */
function buildDedupKeys(data) {
  const keys = new Set();
  const piOsKeys = new Set();
  if (!data || data.length < 2) return { keys, piOsKeys };

  // Find column indices from header row
  const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());
  const dateIdx = headers.indexOf('DATE');
  const eventIdx = headers.indexOf('EVENT');
  const venueIdx = headers.indexOf('VENUE');
  const sourceIdx = headers.indexOf('SOURCE');

  if (dateIdx === -1 || eventIdx === -1 || venueIdx === -1) return { keys, piOsKeys };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const date = (row[dateIdx] || '').toString().trim();
    const event = (row[eventIdx] || '').toString().trim();
    const venue = (row[venueIdx] || '').toString().trim();
    const source = sourceIdx >= 0 ? (row[sourceIdx] || '').toString().trim().toUpperCase() : '';

    if (date && event) {
      const key = makeDedupKey(date, event, venue);
      keys.add(key);

      // Track PI_OS events separately - these take priority over everything
      if (source === 'PI_OS') {
        piOsKeys.add(key);
      }
    }
  }

  return { keys, piOsKeys };
}

/**
 * Merge pre-approved and monthly events. Monthly wins on conflict.
 * Events in piOsKeys are excluded - they're already in PUBLISHED from PI OS
 * and should not be duplicated or overwritten.
 */
function mergeEvents(preApproved, monthly, piOsKeys) {
  const eventMap = new Map();
  piOsKeys = piOsKeys || new Set();

  // Add pre-approved first (skip if already in PI OS)
  for (const evt of preApproved) {
    if (!piOsKeys.has(evt.key)) {
      eventMap.set(evt.key, evt);
    }
  }

  // Monthly overwrites pre-approved (has better data: real interpreter names, confirmed times)
  // But never overwrites PI OS events
  for (const evt of monthly) {
    if (!piOsKeys.has(evt.key)) {
      eventMap.set(evt.key, evt);
    }
  }

  return Array.from(eventMap.values());
}

// ==================== DEDUPLICATE PUBLISHED ====================

/**
 * Scan PUBLISHED sheet for duplicate events using fuzzy matching.
 * When duplicates are found, merge into the best row:
 *   - Prefer row with real interpreter names (not "TBC" or "Request Interpreter")
 *   - Prefer row with image URL
 *   - Prefer row with event URL
 *   - Prefer row with city
 *   - Prefer row with non-default category (not "Concert" if the other has something specific)
 * Removes duplicate rows, keeps the merged winner.
 */
function deduplicatePublished(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 3) return { removed: 0, merged: [] }; // need header + at least 2 rows

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var col = {
    date: headers.indexOf('DATE'),
    event: headers.indexOf('EVENT'),
    venue: headers.indexOf('VENUE'),
    city: headers.indexOf('CITY'),
    time: headers.indexOf('TIME'),
    interpreters: headers.indexOf('INTERPRETERS'),
    interpretation: headers.indexOf('INTERPRETATION'),
    category: headers.indexOf('CATEGORY'),
    imageUrl: headers.indexOf('IMAGE URL'),
    eventUrl: headers.indexOf('EVENT URL'),
    status: headers.indexOf('STATUS'),
    source: headers.indexOf('SOURCE')
  };

  if (col.date < 0 || col.event < 0 || col.venue < 0) return { removed: 0, merged: [] };

  // Group rows by dedup key
  var groups = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dateStr = (row[col.date] || '').toString().trim();
    var eventName = (row[col.event] || '').toString().trim();
    var venue = (row[col.venue] || '').toString().trim();
    if (!dateStr || !eventName) continue;

    var key = makeDedupKey(dateStr, eventName, venue);
    if (!groups[key]) groups[key] = [];
    groups[key].push({ index: i, row: row });
  }

  // Find groups with more than one row
  var mergedDescriptions = [];
  var indicesToRemove = {};

  for (var key in groups) {
    var group = groups[key];
    if (group.length < 2) continue;

    // Skip festival venues where each date is a separate event
    var sampleVenue = (group[0].row[col.venue] || '').toString().trim();
    var isExempt = false;
    for (var fe = 0; fe < FESTIVAL_DEDUP_EXEMPT.length; fe++) {
      if (FESTIVAL_DEDUP_EXEMPT[fe].test(sampleVenue)) { isExempt = true; break; }
    }
    if (isExempt) continue;

    // Score each row: higher = better data
    // PI_OS events get highest priority (staff-entered data is most accurate)
    for (var g = 0; g < group.length; g++) {
      var r = group[g].row;
      var score = 0;

      // SOURCE priority: PI_OS > MANUAL > SCRAPER
      var source = col.source >= 0 ? (r[col.source] || '').toString().trim().toUpperCase() : '';
      if (source === 'PI_OS') score += 100; // PI OS always wins
      else if (source === 'MANUAL') score += 50; // Manual entry from PI Work Flow
      // SCRAPER gets no bonus

      var interp = col.interpreters >= 0 ? (r[col.interpreters] || '').toString().trim() : '';
      if (interp && interp !== 'TBC' && interp !== 'Request Interpreter') score += 10;
      if (col.imageUrl >= 0 && (r[col.imageUrl] || '').toString().trim()) score += 5;
      if (col.eventUrl >= 0 && (r[col.eventUrl] || '').toString().trim()) score += 5;
      if (col.city >= 0 && (r[col.city] || '').toString().trim()) score += 3;
      if (col.time >= 0) {
        var time = (r[col.time] || '').toString().trim();
        if (time && time !== 'TBC') score += 2;
      }
      if (col.category >= 0) {
        var cat = (r[col.category] || '').toString().trim();
        if (cat && cat !== 'Concert') score += 1; // specific category is better than default
      }
      group[g].score = score;
    }

    // Sort: highest score first
    group.sort(function(a, b) { return b.score - a.score; });

    // Winner is first; merge missing fields from losers into winner
    var winner = group[0];
    for (var g = 1; g < group.length; g++) {
      var loser = group[g];
      // Fill in any blanks in winner from loser
      for (var c = 0; c < winner.row.length; c++) {
        var winVal = (winner.row[c] || '').toString().trim();
        var loseVal = (loser.row[c] || '').toString().trim();
        if ((!winVal || winVal === 'TBC' || winVal === 'Request Interpreter') && loseVal && loseVal !== 'TBC' && loseVal !== 'Request Interpreter') {
          winner.row[c] = loser.row[c];
        }
      }
      indicesToRemove[loser.index] = true;
    }

    // Write merged winner back
    if (!DRY_RUN) {
      sheet.getRange(winner.index + 1, 1, 1, winner.row.length).setValues([winner.row]);
    }

    var eventLabel = (winner.row[col.event] || '').toString().trim();
    mergedDescriptions.push(eventLabel + ' (' + group.length + ' rows → 1)');
  }

  // Remove loser rows (bottom-up to preserve indices)
  if (!DRY_RUN && Object.keys(indicesToRemove).length > 0) {
    var sortedIndices = Object.keys(indicesToRemove).map(Number).sort(function(a, b) { return b - a; });
    for (var d = 0; d < sortedIndices.length; d++) {
      sheet.deleteRow(sortedIndices[d] + 1); // +1 for 1-based sheet rows
    }
  }

  return { removed: Object.keys(indicesToRemove).length, merged: mergedDescriptions };
}

/**
 * Second dedup pass: catch same event at same venue with different dates.
 * Handles cases where the O2 scraper returns updated dates between runs,
 * creating near-duplicate rows (e.g., RAYE on 26.02 vs 27.02).
 *
 * Only merges groups of exactly 2 entries with dates within 7 days.
 * Groups of 3+ entries are assumed to be legitimate multi-show events
 * (like Strictly Come Dancing with 3 nights at the same venue).
 */
// Venues where each date is a separately-ticketed event (festivals, residencies).
// Date-varying dedup should NOT merge events at these venues.
FESTIVAL_DEDUP_EXEMPT = typeof FESTIVAL_DEDUP_EXEMPT !== 'undefined' ? FESTIVAL_DEDUP_EXEMPT : [
  /hyde\s*park/i,         // BST Hyde Park — each headliner date is a separate event
  /knebworth/i,           // Multi-day festival events
  /edinburgh\s*castle/i,  // Summer concert series — different acts each night
];

function deduplicateDateVarying(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 3) return { removed: 0, merged: [] };

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var col = {
    date: headers.indexOf('DATE'),
    event: headers.indexOf('EVENT'),
    venue: headers.indexOf('VENUE'),
    city: headers.indexOf('CITY'),
    time: headers.indexOf('TIME'),
    interpreters: headers.indexOf('INTERPRETERS'),
    category: headers.indexOf('CATEGORY'),
    imageUrl: headers.indexOf('IMAGE URL'),
    eventUrl: headers.indexOf('EVENT URL'),
    source: headers.indexOf('SOURCE')
  };

  if (col.date < 0 || col.event < 0 || col.venue < 0) return { removed: 0, merged: [] };

  // Group by event+venue key (ignoring date)
  var groups = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var eventName = (row[col.event] || '').toString().trim();
    var venue = (row[col.venue] || '').toString().trim();
    if (!eventName) continue;
    var key = normalizeEventForDedup(eventName) + '|' + normalizeVenueFamily(venue);
    if (!groups[key]) groups[key] = [];
    groups[key].push({ index: i, row: row });
  }

  var mergedDescriptions = [];
  var indicesToRemove = {};

  for (var key in groups) {
    var group = groups[key];
    if (group.length < 2) continue;

    // Skip festival venues where each date is a separate event
    var sampleVenue = (group[0].row[col.venue] || '').toString().trim();
    var isExempt = false;
    for (var fe = 0; fe < FESTIVAL_DEDUP_EXEMPT.length; fe++) {
      if (FESTIVAL_DEDUP_EXEMPT[fe].test(sampleVenue)) { isExempt = true; break; }
    }
    if (isExempt) continue;

    // Parse dates for all entries
    var allParsed = true;
    for (var g = 0; g < group.length; g++) {
      group[g].parsedDate = parseDateForDedup_(group[g].row[col.date]);
      if (!group[g].parsedDate) { allParsed = false; break; }
    }
    if (!allParsed) continue;

    // Sort by date ascending to check consecutiveness
    group.sort(function(a, b) { return a.parsedDate - b.parsedDate; });

    // Only merge if ALL dates are consecutive (exactly 1 day apart each pair)
    // Non-consecutive dates = separate shows, keep as separate cards
    var allConsecutive = true;
    for (var g = 1; g < group.length; g++) {
      var diffDays = Math.round((group[g].parsedDate - group[g - 1].parsedDate) / (1000 * 60 * 60 * 24));
      if (diffDays !== 1) { allConsecutive = false; break; }
    }
    if (!allConsecutive) continue;

    // Score each row by data quality (same logic as exact dedup)
    // PI_OS events get highest priority (staff-entered data is most accurate)
    for (var g = 0; g < group.length; g++) {
      var r = group[g].row;
      var score = 0;

      // SOURCE priority: PI_OS > MANUAL > SCRAPER
      var source = col.source >= 0 ? (r[col.source] || '').toString().trim().toUpperCase() : '';
      if (source === 'PI_OS') score += 100; // PI OS always wins
      else if (source === 'MANUAL') score += 50; // Manual entry from PI Work Flow

      var interp = col.interpreters >= 0 ? (r[col.interpreters] || '').toString().trim() : '';
      if (interp && interp !== 'TBC' && interp !== 'Request Interpreter') score += 10;
      if (col.imageUrl >= 0 && (r[col.imageUrl] || '').toString().trim()) score += 5;
      if (col.eventUrl >= 0 && (r[col.eventUrl] || '').toString().trim()) score += 5;
      if (col.city >= 0 && (r[col.city] || '').toString().trim()) score += 3;
      if (col.time >= 0) {
        var time = (r[col.time] || '').toString().trim();
        if (time && time !== 'TBC' && !/^\d+\/\d+\/\d+$/.test(time)) score += 2; // exclude malformed date-as-time
      }
      if (col.category >= 0) {
        var cat = (r[col.category] || '').toString().trim();
        if (cat && cat !== 'Concert') score += 1;
      }
      group[g].score = score;
    }

    // Sort by score descending — winner is highest scored
    group.sort(function(a, b) { return b.score - a.score; });
    var winner = group[0];

    // Fill blanks in winner from all losers
    for (var l = 1; l < group.length; l++) {
      for (var c = 0; c < winner.row.length; c++) {
        var winVal = (winner.row[c] || '').toString().trim();
        var loseVal = (group[l].row[c] || '').toString().trim();
        if ((!winVal || winVal === 'TBC' || winVal === 'Request Interpreter') && loseVal && loseVal !== 'TBC' && loseVal !== 'Request Interpreter') {
          winner.row[c] = group[l].row[c];
        }
      }
      indicesToRemove[group[l].index] = true;
    }

    if (!DRY_RUN) {
      sheet.getRange(winner.index + 1, 1, 1, winner.row.length).setValues([winner.row]);
    }

    var eventLabel = (winner.row[col.event] || '').toString().trim();
    var dates = group.map(function(g) { return (g.row[col.date] || '').toString().trim(); });
    mergedDescriptions.push(eventLabel + ' (dates ' + dates.join(' & ') + ')');
  }

  // Remove loser rows bottom-up
  if (!DRY_RUN && Object.keys(indicesToRemove).length > 0) {
    var sortedIndices = Object.keys(indicesToRemove).map(Number).sort(function(a, b) { return b - a; });
    for (var d = 0; d < sortedIndices.length; d++) {
      sheet.deleteRow(sortedIndices[d] + 1);
    }
  }

  return { removed: Object.keys(indicesToRemove).length, merged: mergedDescriptions };
}

/**
 * Parse date value for dedup comparison. Returns Date object or null.
 */
function parseDateForDedup_(dateVal) {
  if (dateVal instanceof Date) return dateVal;
  var str = (dateVal || '').toString().trim();
  var parts = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (parts) {
    var year = parseInt(parts[3]);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(parts[2]) - 1, parseInt(parts[1]));
  }
  return null;
}

// ==================== CANCELLATION CHECK ====================

/**
 * Read CANCELLED sheet and build a set of dedup keys for blocked events.
 * CANCELLED sheet has columns: DATE, EVENT, VENUE, REASON
 */
function getCancelledKeys(spreadsheet) {
  var keys = new Set();
  try {
    var sheet = spreadsheet.getSheetByName(CANCELLED_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return keys;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
    var dateIdx = headers.indexOf('DATE');
    var eventIdx = headers.indexOf('EVENT');
    var venueIdx = headers.indexOf('VENUE');

    if (dateIdx < 0 || eventIdx < 0 || venueIdx < 0) return keys;

    for (var i = 1; i < data.length; i++) {
      var date = (data[i][dateIdx] || '').toString().trim();
      var event = (data[i][eventIdx] || '').toString().trim();
      var venue = (data[i][venueIdx] || '').toString().trim();
      if (!date || !event) continue;
      keys.add(makeDedupKey(date, event, venue));
    }
  } catch (e) {
    Logger.log('Error reading CANCELLED sheet: ' + e.toString());
  }
  return keys;
}

/**
 * Remove any cancelled events that are still in PUBLISHED.
 * Uses bottom-up row deletion to avoid data loss if script crashes mid-operation.
 * Returns array of removed event names.
 */
function removeCancelledEvents(sheet, data, cancelledKeys) {
  if (!data || data.length < 2 || cancelledKeys.size === 0) return [];

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var dateIdx = headers.indexOf('DATE');
  var eventIdx = headers.indexOf('EVENT');
  var venueIdx = headers.indexOf('VENUE');

  if (dateIdx < 0 || eventIdx < 0 || venueIdx < 0) return [];

  var removed = [];
  var rowsToRemove = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var date = (row[dateIdx] || '').toString().trim();
    var event = (row[eventIdx] || '').toString().trim();
    var venue = (row[venueIdx] || '').toString().trim();
    var key = makeDedupKey(date, event, venue);

    if (cancelledKeys.has(key)) {
      removed.push(event);
      rowsToRemove.push(i + 1); // 1-based sheet row
    }
  }

  if (rowsToRemove.length > 0 && !DRY_RUN) {
    // Delete rows bottom-up to preserve indices
    for (var d = rowsToRemove.length - 1; d >= 0; d--) {
      sheet.deleteRow(rowsToRemove[d]);
    }
  }

  return removed;
}

// ==================== PUBLISH & PRUNE ====================

/**
 * Remove past events from PUBLISHED sheet.
 * Uses bottom-up row deletion to avoid data loss if script crashes mid-operation.
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

  const rowsToRemove = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = (row[dateIdx] || '').toString().trim();
    const parsed = parseDDMMYY(dateStr);

    if (parsed && parsed < today) {
      result.removed.push({
        date: dateStr,
        event: (row[eventIdx] || '').toString().trim(),
        venue: (row[venueIdx] || '').toString().trim()
      });
      rowsToRemove.push(i + 1); // 1-based sheet row
    }
  }

  if (rowsToRemove.length > 0 && !DRY_RUN) {
    // Delete rows bottom-up to preserve indices
    for (let d = rowsToRemove.length - 1; d >= 0; d--) {
      sheet.deleteRow(rowsToRemove[d]);
    }
  }

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
  const enrichResult = log.enriched || { enriched: 0, totalMissing: 0, filled: [] };
  const linkResult = log.linksEnriched || { enriched: 0, totalMissing: 0, filled: [] };
  const festivalResult = log.festivalEnriched || { enriched: 0, filled: [] };
  body += `  Total published events:  ${quality.total || '?'}\n`;
  body += `  Added today:             ${addedCount}\n`;
  if (enrichResult.enriched > 0) {
    body += `  Images auto-filled:      ${enrichResult.enriched} (via artist matching)\n`;
  }
  if (linkResult.enriched > 0) {
    body += `  Links auto-filled:       ${linkResult.enriched} (via venue lookup)\n`;
  }
  if (festivalResult.enriched > 0) {
    body += `  Festival pages found:    ${festivalResult.enriched} (via event page discovery)\n`;
  }
  body += `  Removed (past):          ${removedCount}\n`;
  body += `  Skipped (duplicates):    ${log.skipped}\n`;
  if (log.cancelledSkipped > 0) {
    body += `  Blocked (cancelled):     ${log.cancelledSkipped}\n`;
  }
  body += `  Missing images:          ${(quality.missingImage || []).length}\n`;
  body += `  Missing event links:     ${(quality.missingLink || []).length}\n`;
  const assumedCount = (log.assumedCategories || []).length;
  if (assumedCount > 0) {
    body += `  Assumed categories:      ${assumedCount} (check below)\n`;
  }
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

  // ---- IMAGES AUTO-FILLED ----
  if (enrichResult.filled.length > 0) {
    body += `IMAGES AUTO-FILLED (${enrichResult.enriched} via artist matching)\n`;
    body += `-`.repeat(55) + `\n`;
    for (const name of enrichResult.filled) {
      body += `  + ${name}\n`;
    }
    if (enrichResult.totalMissing > enrichResult.enriched) {
      body += `  (${enrichResult.totalMissing - enrichResult.enriched} events still missing images - no artist match found)\n`;
    }
    body += '\n';
  }

  // ---- FESTIVAL PAGES DISCOVERED ----
  if (festivalResult.filled.length > 0) {
    body += `FESTIVAL PAGES DISCOVERED (${festivalResult.enriched} via event page discovery)\n`;
    body += `-`.repeat(55) + `\n`;
    for (const name of festivalResult.filled) {
      body += `  + ${name}\n`;
    }
    body += '\n';
  }

  // ---- ASSUMED CATEGORIES ----
  const assumed = log.assumedCategories || [];
  if (assumed.length > 0) {
    body += `ASSUMED CATEGORIES (${assumed.length} — please check)\n`;
    body += `-`.repeat(55) + `\n`;
    body += `  These events had no category set and were defaulted to Concert.\n`;
    body += `  If incorrect, update the CATEGORY column in PUBLISHED.\n\n`;
    for (const evt of assumed) {
      body += `  ${evt.date} | ${evt.event}\n`;
      body += `    ${evt.venue} → ${evt.category}\n`;
    }
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
    MailApp.sendEmail(DIGEST_EMAIL, subject, body);
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

// ==================== IMAGE ENRICHMENT ====================

// Venue configs for og:image scraping (slug-based URL construction)
// Venue scrape configs (only define if not already in Code.gs)
// ==================== FESTIVAL EVENT PAGE DISCOVERY ====================
// Festivals with known URL patterns. Each config generates date-aware URLs
// to find both the event link AND og:image in a single fetch.

FESTIVAL_CONFIGS = typeof FESTIVAL_CONFIGS !== 'undefined' ? FESTIVAL_CONFIGS : [
  {
    name: 'BST Hyde Park',
    venueMatcher: /hyde\s*park/i,
    eventMatcher: /^BST:/i,
    baseUrl: 'https://www.bst-hydepark.com/events/',
    // BST URLs: /events/garth-brooks-sat-27-june/
    slugGenerator: function(eventName, dateStr) {
      var artist = eventName.replace(/^BST:\s*/i, '')
        .replace(/\s*[&+]\s*Support(ing)?\s*Acts?\s*(tbc)?/gi, '')
        .trim();
      var slug = artist.toLowerCase()
        .replace(/[''`]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      var date = parseDateForDedup_(dateStr);
      if (!date) return [];
      var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      var months = ['january', 'february', 'march', 'april', 'may', 'june',
                    'july', 'august', 'september', 'october', 'november', 'december'];
      var dayName = days[date.getDay()];
      var dateNum = date.getDate();
      var monthName = months[date.getMonth()];
      // Try multiple slug patterns: with day, without day, with year
      return [
        slug + '-' + dayName + '-' + dateNum + '-' + monthName,
        slug + '-' + dateNum + '-' + monthName,
        slug + '-' + dayName + '-' + dateNum + '-' + monthName + '-' + date.getFullYear()
      ];
    }
  },
  {
    name: 'Edinburgh Castle',
    venueMatcher: /edinburgh\s*castle/i,
    eventMatcher: null,
    baseUrl: 'https://www.edinburghcastle.scot/whats-on/',
    slugGenerator: function(eventName, dateStr) {
      var name = eventName.replace(/\s*\blive\b$/gi, '').trim();
      var slug = slugify_(name);
      return [slug, slug + '-' + new Date().getFullYear()];
    }
  },
  {
    name: 'Heritage Live',
    venueMatcher: /kenwood|sandringham|audley\s*end|englefield/i,
    eventMatcher: null,
    baseUrl: 'https://www.heritagelive.net/whats-on/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug, slug + '-' + new Date().getFullYear()];
    }
  },
  {
    name: 'Hampton Court Palace Festival',
    venueMatcher: /hampton\s*court/i,
    eventMatcher: null,
    baseUrl: 'https://www.hamptoncourtpalacefestival.com/artists/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug];
    }
  },
  {
    name: 'Kew the Music',
    venueMatcher: /kew\s*(gardens|the\s*music)/i,
    eventMatcher: null,
    baseUrl: 'https://www.kewthemusic.org/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug];
    }
  },
  {
    name: 'The O2 Arena',
    venueMatcher: /\b(the\s*)?o2\s*(arena)?\b/i,
    eventMatcher: null,
    // Exclude sub-venues (indigo, Eventim Apollo, etc.)
    venueExclude: /indigo|apollo|forum|kentish|academy|brixton/i,
    baseUrl: 'https://www.theo2.co.uk/events/detail/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug, slug + '-' + new Date().getFullYear()];
    }
  },
  {
    name: 'OVO Arena Wembley',
    venueMatcher: /ovo.*wembley|wembley.*ovo/i,
    eventMatcher: null,
    baseUrl: 'https://www.ovoarena.co.uk/events/detail/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug, slug + '-2'];
    }
  },
  {
    name: 'AO Arena Manchester',
    venueMatcher: /ao\s*arena|manchester\s*arena/i,
    eventMatcher: null,
    baseUrl: 'https://www.ao-arena.com/events/detail/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug, slug + '-' + new Date().getFullYear()];
    }
  },
  {
    name: 'Eventim Apollo',
    venueMatcher: /eventim\s*apollo|hammersmith.*apollo/i,
    eventMatcher: null,
    baseUrl: 'https://www.eventimapollo.com/events/',
    slugGenerator: function(eventName, dateStr) {
      var slug = slugify_(stripEventSuffixes_(eventName));
      return [slug];
    }
  },
  {
    name: 'Royal Albert Hall',
    venueMatcher: /royal\s*albert\s*hall/i,
    eventMatcher: null,
    baseUrl: 'https://www.royalalberthall.com/tickets/events/',
    slugGenerator: function(eventName, dateStr) {
      var year = new Date().getFullYear();
      var slug = slugify_(stripEventSuffixes_(eventName));
      // RAH uses /tickets/events/{year}/{slug}
      return [year + '/' + slug];
    }
  }
];

/**
 * Shared slug helper: lowercase, strip special chars, hyphenate.
 */
function slugify_(name) {
  return (name || '').toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Strip common event name suffixes before slugification.
 */
function stripEventSuffixes_(eventName) {
  return (eventName || '').toString().trim()
    .replace(/^BST:\s*/i, '')
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s*[&+]\s*Support(ing)?\s*Acts?\s*(tbc)?/gi, '')
    .replace(/\s*concerts?$/gi, '')
    .replace(/\s*\blive\b$/gi, '')
    .replace(/\s*\btour\b$/gi, '')
    .replace(/\s*\bshow\b$/gi, '')
    .replace(/\s*\b(20\d{2})\b/g, '')
    .trim();
}

/**
 * Discover event page + image for festival events.
 * Tries each FESTIVAL_CONFIG's URL pattern against events missing image or link.
 * Sets BOTH image URL and event link when a valid page is found.
 * Returns { enriched, filled[] }
 */
function enrichViaFestivalDiscovery(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { enriched: 0, filled: [] };

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var dateCol = headers.indexOf('DATE');
  var eventCol = headers.indexOf('EVENT');
  var venueCol = headers.indexOf('VENUE');
  var imgCol = headers.indexOf('IMAGE URL');
  var linkCol = headers.indexOf('EVENT URL');

  if (eventCol < 0 || venueCol < 0) return { enriched: 0, filled: [] };

  var enriched = 0;
  var filled = [];
  var scrapeCache = CacheService.getScriptCache();

  for (var i = 1; i < data.length; i++) {
    var img = imgCol >= 0 ? (data[i][imgCol] || '').toString().trim() : '';
    var link = linkCol >= 0 ? (data[i][linkCol] || '').toString().trim() : '';
    // Skip if both image and link are already set
    if (img && link) continue;

    var eventName = (data[i][eventCol] || '').toString().trim();
    var venue = (data[i][venueCol] || '').toString().trim();
    var dateStr = dateCol >= 0 ? (data[i][dateCol] || '').toString().trim() : '';
    if (!eventName || !venue) continue;

    // Find matching festival config
    var config = null;
    for (var c = 0; c < FESTIVAL_CONFIGS.length; c++) {
      var fc = FESTIVAL_CONFIGS[c];
      if (!fc.venueMatcher.test(venue)) continue;
      if (fc.venueExclude && fc.venueExclude.test(venue)) continue;
      if (fc.eventMatcher && !fc.eventMatcher.test(eventName)) continue;
      config = fc;
      break;
    }
    if (!config) continue;

    // Check cache to avoid re-fetching known failures
    var cacheKey = 'fest_' + normalizeForImageMatch(eventName + venue + dateStr);
    if (cacheKey.length > 250) cacheKey = cacheKey.substring(0, 250);
    if (scrapeCache.get(cacheKey)) continue;

    // Generate slugs and try each
    var slugs = config.slugGenerator(eventName, dateStr);
    var found = false;

    for (var s = 0; s < slugs.length && !found; s++) {
      var url = config.baseUrl + slugs[s] + '/';
      try {
        var response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PIEventsBot/1.0)' }
        });

        if (response.getResponseCode() === 200) {
          var html = response.getContentText();
          var ogImage = extractOgImage_(html);

          if (!DRY_RUN) {
            // Set event link if missing
            if (!link && linkCol >= 0) {
              sheet.getRange(i + 1, linkCol + 1).setValue(url);
            }
            // Set image if missing and we found an og:image
            if (!img && imgCol >= 0 && ogImage) {
              sheet.getRange(i + 1, imgCol + 1).setValue(ogImage);
            }
          }

          var parts = [];
          if (!link) parts.push('link');
          if (!img && ogImage) parts.push('image');
          if (parts.length > 0) {
            filled.push(eventName + ' [' + config.name + ': ' + parts.join('+') + ']');
            enriched++;
          }
          found = true;
        }
        Utilities.sleep(500); // Rate limit
      } catch (e) {
        // Fetch failed — try next slug
      }
    }

    if (!found) {
      // Cache the miss for 7 days
      scrapeCache.put(cacheKey, 'miss', 604800);
    }
  }

  return { enriched: enriched, filled: filled };
}

VENUE_SCRAPE_CONFIGS = typeof VENUE_SCRAPE_CONFIGS !== 'undefined' ? VENUE_SCRAPE_CONFIGS : [
  { matcher: /motorpoint.*nottingham|nottingham.*(motorpoint|arena)/i, baseUrl: 'https://www.motorpointarenanottingham.com/whats-on/' },
  { matcher: /southbank|south\s*bank|rfh|qeh|purcell|royal\s*festival/i, baseUrl: 'https://www.southbankcentre.co.uk/whats-on/', trailingSlash: true },
  { matcher: /alexandra\s*palace/i, baseUrl: 'https://www.alexandrapalace.com/whats-on/' },
  { matcher: /eventim\s*apollo|hammersmith.*apollo/i, baseUrl: 'https://www.eventimapollo.com/events/' },
  { matcher: /ovo\s*(arena)?.*wembley|wembley.*ovo/i, baseUrl: 'https://www.ovoarena.com/events/' },
  { matcher: /bournemouth/i, baseUrl: 'https://www.bic.co.uk/events/' },
  { matcher: /utilita.*sheffield|sheffield.*(utilita|arena)/i, baseUrl: 'https://www.utilitaarenasheffield.co.uk/whats-on/' },
  { matcher: /ao\s*arena|manchester\s*arena/i, baseUrl: 'https://www.ao-arena.com/whats-on/' },
  { matcher: /bp\s*pulse/i, baseUrl: 'https://bppulselive.co.uk/events/' },
  { matcher: /o2.*apollo.*manchester|manchester.*o2.*apollo/i, baseUrl: 'https://academymusicgroup.com/o2apollomanchester/events/' },
  { matcher: /o2.*forum.*kentish|kentish.*o2.*forum/i, baseUrl: 'https://academymusicgroup.com/o2forumkentishtown/events/' },
  { matcher: /3\s*arena.*dublin|dublin.*3\s*arena/i, baseUrl: 'https://3arena.ie/events/' },
  { matcher: /stamford\s*bridge|chelsea\s*(fc|football)/i, baseUrl: 'https://www.chelseafc.com/en/matches/' },
  { matcher: /emirates\s*stadium|arsenal\s*(fc|football)/i, baseUrl: 'https://www.arsenal.com/fixtures/' },
  { matcher: /london\s*stadium|west\s*ham/i, baseUrl: 'https://www.whufc.com/fixtures/' },
  { matcher: /anfield|liverpool\s*(fc|football)/i, baseUrl: 'https://www.liverpoolfc.com/matches/' },
  { matcher: /first\s*direct\s*arena|leeds.*arena/i, baseUrl: 'https://www.firstdirectarena.com/whats-on/' },
  { matcher: /o2.*academy.*brixton|brixton.*academy/i, baseUrl: 'https://academymusicgroup.com/o2academybrixton/events/' },
  { matcher: /o2.*victoria.*manchester|manchester.*o2.*victoria/i, baseUrl: 'https://academymusicgroup.com/o2victoriawarehouse/events/' },
  { matcher: /royal\s*albert\s*hall/i, baseUrl: 'https://www.royalalberthall.com/tickets/events/' },
];

/**
 * Enrich missing images using two tiers:
 *   Tier 1: Same-venue artist matching (fast, reliable, no API calls)
 *   Tier 2: Venue website og:image scraping (UrlFetchApp, rate-limited)
 */
function enrichMissingImages(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { enriched: 0, totalMissing: 0, filled: [] };

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var eventCol = headers.indexOf('EVENT');
  var venueCol = headers.indexOf('VENUE');
  var imgCol = headers.indexOf('IMAGE URL');

  if (eventCol < 0 || imgCol < 0) return { enriched: 0, totalMissing: 0, filled: [] };

  // Build image bank keyed on artist+venue family for same-venue matching
  var imageBankByVenue = {};  // "artistKey|venueFam" → imgUrl
  for (var i = 1; i < data.length; i++) {
    var img = (data[i][imgCol] || '').toString().trim();
    if (!img) continue;
    var event = (data[i][eventCol] || '').toString().trim();
    var venue = venueCol >= 0 ? (data[i][venueCol] || '').toString().trim() : '';
    var artistKeys = extractArtistKeys(event);
    var venueFam = normalizeVenueFamily(venue);
    for (var k = 0; k < artistKeys.length; k++) {
      var fullKey = artistKeys[k] + '|' + venueFam;
      if (!imageBankByVenue[fullKey]) imageBankByVenue[fullKey] = img;
    }
  }

  var enriched = 0;
  var totalMissing = 0;
  var filled = [];
  var needsScraping = [];

  // Tier 1: Same-venue artist match
  for (var i = 1; i < data.length; i++) {
    var img = (data[i][imgCol] || '').toString().trim();
    if (img) continue;

    var event = (data[i][eventCol] || '').toString().trim();
    var venue = venueCol >= 0 ? (data[i][venueCol] || '').toString().trim() : '';
    if (!event) continue;
    totalMissing++;

    var artistKeys = extractArtistKeys(event);
    var venueFam = normalizeVenueFamily(venue);
    var matched = null;

    for (var k = 0; k < artistKeys.length; k++) {
      var fullKey = artistKeys[k] + '|' + venueFam;
      if (imageBankByVenue[fullKey]) {
        matched = imageBankByVenue[fullKey];
        break;
      }
    }

    if (matched) {
      if (!DRY_RUN) sheet.getRange(i + 1, imgCol + 1).setValue(matched);
      filled.push(event + ' [venue match]');
      enriched++;
    } else {
      // Tier 1b: Venue default image (stadium photos for football grounds, etc.)
      var venueDefault = null;
      for (var vd = 0; vd < VENUE_DEFAULT_IMAGES.length; vd++) {
        if (VENUE_DEFAULT_IMAGES[vd].matcher.test(venue)) {
          venueDefault = VENUE_DEFAULT_IMAGES[vd].url;
          break;
        }
      }
      if (venueDefault) {
        if (!DRY_RUN) sheet.getRange(i + 1, imgCol + 1).setValue(venueDefault);
        filled.push(event + ' [venue default]');
        enriched++;
      } else {
        needsScraping.push({ row: i, event: event, venue: venue });
      }
    }
  }

  // Tier 2: Venue website scraping (max 15 per run to avoid timeout)
  // Use CacheService to skip events that already failed scraping (7-day TTL)
  var scrapeCache = CacheService.getScriptCache();
  var scrapeCount = 0;
  for (var s = 0; s < needsScraping.length && scrapeCount < 15; s++) {
    var item = needsScraping[s];
    var cacheKey = 'scrape_fail_' + normalizeForImageMatch(item.event + item.venue);
    if (cacheKey.length > 250) cacheKey = cacheKey.substring(0, 250); // CacheService key limit

    // Skip if we already tried and failed recently
    if (scrapeCache.get(cacheKey)) continue;

    var scraped = scrapeImageFromVenue_(item.event, item.venue);
    if (scraped) {
      if (!DRY_RUN) sheet.getRange(item.row + 1, imgCol + 1).setValue(scraped);
      filled.push(item.event + ' [scraped]');
      enriched++;
    } else {
      // Cache the failure for 7 days (604800 seconds) to avoid retrying daily
      scrapeCache.put(cacheKey, 'miss', 604800);
    }
    scrapeCount++;
  }

  return { enriched: enriched, totalMissing: totalMissing, filled: filled };
}

/**
 * Enrich missing EVENT URLs with venue homepage/fixtures page.
 * Not the exact event page, but gives users a starting point.
 */
function enrichMissingEventLinks(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { enriched: 0, totalMissing: 0 };

  var headers = data[0].map(function(h) { return (h || '').toString().trim().toUpperCase(); });
  var venueCol = headers.indexOf('VENUE');
  var linkCol = headers.indexOf('EVENT URL');
  var eventCol = headers.indexOf('EVENT');

  if (venueCol < 0 || linkCol < 0) return { enriched: 0, totalMissing: 0 };

  var enriched = 0;
  var totalMissing = 0;
  var filled = [];

  for (var i = 1; i < data.length; i++) {
    var link = (data[i][linkCol] || '').toString().trim();
    if (link) continue;

    var venue = (data[i][venueCol] || '').toString().trim();
    var event = eventCol >= 0 ? (data[i][eventCol] || '').toString().trim() : '';
    if (!venue) continue;
    totalMissing++;

    // Match against venue link map
    var matchedUrl = null;
    for (var m = 0; m < VENUE_EVENT_LINK_MAP.length; m++) {
      var config = VENUE_EVENT_LINK_MAP[m];
      if (config.matcher.test(venue)) {
        if (config.exclude && config.exclude.test(venue)) continue;
        matchedUrl = config.url;
        break;
      }
    }

    if (matchedUrl) {
      if (!DRY_RUN) sheet.getRange(i + 1, linkCol + 1).setValue(matchedUrl);
      filled.push(event || venue);
      enriched++;
    }
  }

  return { enriched: enriched, totalMissing: totalMissing, filled: filled };
}

/**
 * Normalize venue name to a family identifier so different spellings
 * of the same venue match (e.g., "The O2 London" ≡ "The O2 Arena, London")
 */
function normalizeVenueFamily(venue) {
  var v = (venue || '').toLowerCase();
  if (/\b(the\s*)?o2\b/i.test(v) && !/indigo|apollo|victoria|forum|kentish|academy|ritz/i.test(v)) return 'o2main';
  if (/indigo.*o2|o2.*indigo/i.test(v)) return 'indigoo2';
  if (/wembley\s*(stadium)?/i.test(v) && !/arena|ovo|sse/i.test(v)) return 'wembleystadium';
  if (/ovo.*arena.*wembley|wembley.*ovo/i.test(v)) return 'ovowembley';
  if (/motorpoint.*nottingham|nottingham.*(motorpoint|arena)/i.test(v)) return 'motorpointnott';
  if (/southbank|rfh|qeh|purcell|royal\s*festival/i.test(v)) return 'southbank';
  if (/alexandra\s*palace/i.test(v)) return 'allypal';
  if (/eventim\s*apollo|hammersmith.*(apollo|eventim)/i.test(v)) return 'eventimapollo';
  if (/utilita.*sheffield|sheffield.*(utilita|arena)/i.test(v)) return 'utilitasheff';
  if (/ao\s*arena|manchester\s*arena/i.test(v)) return 'aomanc';
  if (/ovo\s*hydro|glasgow.*hydro/i.test(v)) return 'ovohydro';
  if (/bp\s*pulse/i.test(v)) return 'bppulse';
  if (/m&?s\s*bank|liverpool.*arena/i.test(v)) return 'msbankliverpool';
  if (/bournemouth/i.test(v)) return 'bournemouth';
  if (/o2.*apollo.*manchester|manchester.*o2.*apollo/i.test(v)) return 'o2apollomanc';
  if (/3\s*arena.*dublin|dublin.*3\s*arena/i.test(v)) return '3arenadublin';
  if (/stamford\s*bridge/i.test(v)) return 'stamfordbridge';
  if (/emirates\s*stadium/i.test(v) && !/o2|wembley/i.test(v)) return 'emiratesstadium';
  if (/london\s*stadium/i.test(v)) return 'londonstadium';
  if (/anfield/i.test(v)) return 'anfield';
  if (/first\s*direct\s*arena/i.test(v)) return 'firstdirectleeds';
  if (/o2.*academy.*brixton|brixton.*academy/i.test(v)) return 'o2brixton';
  if (/o2.*victoria.*manchester|manchester.*o2.*victoria/i.test(v)) return 'o2vicmanc';
  if (/royal\s*albert\s*hall/i.test(v)) return 'rah';
  // Fallback: strip common words
  return v.replace(/\b(the|arena|stadium|centre|center|at)\b/g, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Try to scrape an event image from the venue's website.
 * Constructs slug-based URLs and fetches og:image.
 */
function scrapeImageFromVenue_(eventName, venue) {
  var config = null;
  for (var c = 0; c < VENUE_SCRAPE_CONFIGS.length; c++) {
    if (VENUE_SCRAPE_CONFIGS[c].matcher.test(venue)) {
      config = VENUE_SCRAPE_CONFIGS[c];
      break;
    }
  }
  if (!config) return null;

  var slugs = generateEventSlugs_(eventName);
  for (var s = 0; s < slugs.length; s++) {
    var url = config.baseUrl + slugs[s];
    if (config.trailingSlash) url += '/';

    try {
      var response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PIEventsBot/1.0)' }
      });

      if (response.getResponseCode() === 200) {
        var html = response.getContentText();
        var image = extractOgImage_(html);
        if (image) return image;
      }
      Utilities.sleep(500);
    } catch (e) {
      // Fetch failed - try next slug
    }
  }
  return null;
}

/**
 * Generate URL slug variations from an event name.
 * "James Arthur concert" → ["james-arthur-concert", "james-arthur", "james-arthur-2026"]
 */
function generateEventSlugs_(eventName) {
  var name = (eventName || '').toString().trim()
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s*[&+]\s*Support\s*Acts?\s*(tbc)?/gi, '')
    .replace(/\s*concerts?$/gi, '')
    .replace(/\s*\blive\b$/gi, '')
    .replace(/\s*\btour\b$/gi, '')
    .replace(/\s*\bshow\b$/gi, '')
    .trim();

  var base = name.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  var year = new Date().getFullYear();
  var slugs = [base, base + '-' + year];

  // Try shorter (artist name only, first 2-3 words)
  var words = base.split('-');
  if (words.length > 2) {
    slugs.push(words.slice(0, 2).join('-'));
    slugs.push(words.slice(0, 3).join('-'));
  }

  return slugs;
}

/**
 * Extract event image from HTML using multiple strategies:
 * 1. og:image / twitter:image meta tags
 * 2. JSON-LD structured data (used by AEG venues: O2, OVO, AO Arena, etc.)
 */
function extractOgImage_(html) {
  // Strategy 1: og:image / twitter:image meta tags
  var patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (var p = 0; p < patterns.length; p++) {
    var m = html.match(patterns[p]);
    if (m && m[1] && m[1].indexOf('logo') < 0 && m[1].indexOf('icon') < 0 && m[1].indexOf('favicon') < 0) {
      return m[1];
    }
  }

  // Strategy 2: JSON-LD structured data (common on AEG venue sites)
  var ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatches) {
    for (var l = 0; l < ldMatches.length; l++) {
      var jsonContent = ldMatches[l].replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        var ld = JSON.parse(jsonContent);
        var items = Array.isArray(ld) ? ld : [ld];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.image) {
            var img = Array.isArray(item.image) ? item.image[0] : item.image;
            var imgUrl = (typeof img === 'string') ? img : (img.url || '');
            if (imgUrl && imgUrl.indexOf('logo') < 0 && imgUrl.indexOf('icon') < 0) {
              return imgUrl;
            }
          }
        }
      } catch (e) {
        // Invalid JSON — skip this LD block
      }
    }
  }

  return null;
}

/**
 * Extract normalized artist name keys from an event name.
 * Returns multiple variants for fuzzy matching.
 */
function extractArtistKeys(eventName) {
  var name = (eventName || '').toString().trim();
  var keys = [];
  var seen = {};

  function addKey(s) {
    var k = normalizeForImageMatch(s);
    if (k && k.length >= 3 && !seen[k]) {
      seen[k] = true;
      keys.push(k);
    }
  }

  addKey(name);

  var stripped = name
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s*[&+]\s*Support\s*Acts?\s*(tbc)?/gi, '')
    .replace(/\s*concerts?$/gi, '')
    .replace(/\s*\blive\b$/gi, '')
    .replace(/\s*\btour\b$/gi, '')
    .replace(/\s*\bshow\b$/gi, '')
    .replace(/\s*\b\d{4}\b$/g, '')
    .trim();
  addKey(stripped);

  var ampParts = stripped.split(/\s*&\s*/);
  if (ampParts.length > 1) {
    addKey(ampParts[0].replace(/\s*concerts?$/gi, '').trim());
  }

  var noType = stripped.replace(/\s*concerts?$/gi, '').replace(/\s*\blive\b$/gi, '').trim();
  addKey(noType);

  var colonSplit = noType.split(/\s*[:\-–—]\s*/);
  if (colonSplit.length > 1 && colonSplit[0].trim().length >= 3) {
    addKey(colonSplit[0].trim());
  }

  return keys;
}

/**
 * Normalize string for image matching: lowercase, strip non-alphanumeric
 */
function normalizeForImageMatch(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create normalized dedup key from date + event name + venue.
 * Uses fuzzy matching: venue family normalization + artist name extraction
 * so "National Television Awards 2026 | The O2 Arena, London" matches
 * "National TV Awards | The O2, London".
 */
function makeDedupKey(dateStr, eventName, venue) {
  const dateNorm = normalizeDateForKey(dateStr);
  const venueNorm = normalizeVenueFamily(venue);
  const eventNorm = normalizeEventForDedup(eventName);
  return `${dateNorm}|${eventNorm}|${venueNorm}`;
}

/**
 * Normalize event name for dedup: strip suffixes, year, "concert", "& Support Acts", etc.
 * Produces a stable key that matches across scraper and manual entry variations.
 */
function normalizeEventForDedup(eventName) {
  var name = (eventName || '').toString().trim();

  // Strip parenthetical/bracketed content
  name = name.replace(/\s*[\(\[].*?[\)\]]/g, '');

  // Strip common suffixes
  name = name.replace(/\s*[&+]\s*Support\s*Acts?\s*(tbc)?/gi, '');
  name = name.replace(/\s*concerts?$/gi, '');
  name = name.replace(/\s*\blive\b$/gi, '');
  name = name.replace(/\s*\btour\b$/gi, '');
  name = name.replace(/\s*\bshow\b$/gi, '');
  name = name.replace(/\s*\b(20\d{2})\b/g, ''); // Strip year (2024-2099)

  // Normalize "Television" ↔ "TV"
  name = name.replace(/\btelevision\b/gi, 'tv');

  // Lowercase + strip non-alphanumeric
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
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

// Category detection keywords (mapped to current valid categories)
CATEGORY_KEYWORDS = typeof CATEGORY_KEYWORDS !== 'undefined' ? CATEGORY_KEYWORDS : {
  'Concert': ['concert', 'gig', 'live music', 'band', 'singer', 'orchestra', 'symphony'],
  'Comedy': ['comedy', 'stand-up', 'comedian', 'comedians', 'improv', 'smosh', 'reddit', 'reads'],
  'Theatre': ['theatre', 'play', 'musical', 'opera', 'ballet', 'pantomime', 'panto'],
  'Sports': ['match', 'game', 'vs', 'v ', 'football', 'rugby', 'cricket', 'boxing', 'f1', 'formula 1', 'netball', 'darts', 'basketball', 'wrestling', 'ufc', 'cage warriors', 'cup final', 'cup semi'],
  'Family': ['family', 'kids', 'children', 'circus', 'dollhouse', 'cbeebies', 'peppa', 'paw patrol', 'bluey'],
  'Festival': ['festival', 'pride', 'fest'],
  // Note: Festival sub-categorisation (Camping/Non-Camping) handled by detectFestivalType() below
  'Cultural': ['cultural', 'heritage', 'parade', 'st patrick', 'book launch', 'exhibition'],
  'Dance': ['dance', 'dancing', 'strictly', 'ballroom', 'choreograph'],
  'Talks & Discussions': ['conversation', 'talk', 'discussion', 'lecture', 'in conversation', 'q&a', 'spoken word', 'podcast'],
  'Literature': ['book', 'author', 'literary', 'reading', 'poetry'],
  'Other': ['workshop', 'quilting', 'sewing', 'craft', 'knitting', 'seminar', 'masterclass', 'class', 'course']
};

/**
 * Detect category from event name and venue using keyword matching.
 * Returns the first matching category, or 'Other' if none match.
 */
function detectCategory(event, venue) {
  var text = ((event || '') + ' ' + (venue || '')).toLowerCase();

  for (var category in CATEGORY_KEYWORDS) {
    var keywords = CATEGORY_KEYWORDS[category];
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) >= 0) {
        return category;
      }
    }
  }

  return '_UNDETECTED';
}

// Known camping festivals — add to this list as new ones are confirmed
KNOWN_CAMPING_FESTIVALS = typeof KNOWN_CAMPING_FESTIVALS !== 'undefined' ? KNOWN_CAMPING_FESTIVALS : [
  'download festival',
  'leeds festival',
  'reading festival',
  'electric picnic',
  'glastonbury',
  'isle of wight festival',
  'latitude festival',
  'green man festival',
  'wilderness festival',
  'camp bestival',
  'boomtown',
  'shambala',
  'end of the road',
  'bluedot',
  'y not festival',
  'kendal calling',
  'belladrum',
  'truck festival',
  'all points east',  // camping option available
];

/**
 * Detect if a festival is camping or non-camping.
 * Returns 'Camping Festival' or 'Non-Camping Festival'.
 */
function detectFestivalType(eventName, venue) {
  var name = (eventName || '').toLowerCase();
  for (var i = 0; i < KNOWN_CAMPING_FESTIVALS.length; i++) {
    if (name.indexOf(KNOWN_CAMPING_FESTIVALS[i]) >= 0) {
      return 'Camping Festival';
    }
  }
  // Pride events are always non-camping
  if (/\bpride\b/i.test(name)) return 'Non-Camping Festival';
  // Indoor venue = non-camping
  var v = (venue || '').toLowerCase();
  if (/o2|arena|theatre|hall|stadium|academy|apollo|roundhouse|palladium|hippodrome/i.test(v)) {
    return 'Non-Camping Festival';
  }
  // Multi-day events with "days" in the time field are likely camping, but we can't check that here
  // Default to Non-Camping (safer assumption for urban/unknown festivals)
  return 'Non-Camping Festival';
}

/**
 * Normalize category to proper case. Handles lowercase from O2 scraper/PRE_APPROVED
 * and strips multi-category values down to the first one.
 */
// Valid categories (only define if not already in Code.gs)
VALID_CATEGORIES = typeof VALID_CATEGORIES !== 'undefined' ? VALID_CATEGORIES : {
  'concert': 'Concert', 'sports': 'Sports', 'festival': 'Festival',
  'camping festival': 'Camping Festival', 'non-camping festival': 'Non-Camping Festival',
  'comedy': 'Comedy', 'theatre': 'Theatre', 'cultural': 'Cultural',
  'family': 'Family', 'literature': 'Literature', 'dance': 'Dance',
  'talks & discussions': 'Talks & Discussions', 'other': 'Other'
};

function normalizeCategory(category) {
  if (!category) return '';
  var cat = category.toString().trim();
  // If multi-category (comma-separated), take the first one
  if (cat.indexOf(',') >= 0) {
    cat = cat.split(',')[0].trim();
  }
  // Normalize case
  var lookup = VALID_CATEGORIES[cat.toLowerCase()];
  return lookup || cat; // Return normalized or original if unknown
}

/**
 * Wrapper: detect category, defaulting undetected to "Concert" for monthly tab events.
 * Events that positively match 'Other' keywords stay as Other (e.g. Quilting Workshop).
 * Returns { category, assumed } so the digest can flag assumed ones.
 */
function detectCategoryWithDefault(eventName, venue) {
  var detected = normalizeCategory(detectCategory(eventName, venue));
  if (detected === '_UNDETECTED' || detected === '_undetected') {
    return { category: 'Concert', assumed: true };
  }
  // Sub-categorise festivals as Camping or Non-Camping
  if (detected === 'Festival') {
    return { category: detectFestivalType(eventName, venue), assumed: false };
  }
  return { category: detected, assumed: false };
}

/**
 * Extract city from venue string (text after last comma)
 */
function extractCityFromVenue(venue) {
  if (!venue) return '';
  const parts = venue.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  // Fallback: known venue to city mapping
  var venueFam = normalizeVenueFamily(venue);
  return VENUE_CITY_LOOKUP[venueFam] || '';
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
    const dedupResult = buildDedupKeys(existingData);
    const existingKeys = dedupResult.keys;
    const piOsKeys = dedupResult.piOsKeys;
    const cancelledKeys = getCancelledKeys(publishedSS);

    const preApprovedEvents = getEventsFromPreApproved();
    const monthlyEvents = getEventsFromMonthlyTabs();
    const mergedEvents = mergeEvents(preApprovedEvents, monthlyEvents, piOsKeys);

    log.cancelledSkipped = 0;
    log.piOsProtected = 0;
    for (const evt of mergedEvents) {
      if (cancelledKeys.has(evt.key)) {
        log.cancelledSkipped++;
      } else if (piOsKeys.has(evt.key)) {
        log.piOsProtected++;
      } else if (existingKeys.has(evt.key)) {
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

    // Dry-run dedup check
    const exactDedupResult = deduplicatePublished(publishedSheet);
    if (exactDedupResult.removed > 0) {
      log.warnings.push('Dedup (dry run): would merge ' + exactDedupResult.removed + ' duplicate row(s): ' + exactDedupResult.merged.join('; '));
    }

    // Dry-run date-varying dedup check
    const dateVaryResult = deduplicateDateVarying(publishedSheet);
    if (dateVaryResult.removed > 0) {
      log.warnings.push('Date-varying dedup (dry run): would merge ' + dateVaryResult.removed + ' row(s): ' + dateVaryResult.merged.join('; '));
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

    // Image enrichment (DRY_RUN=true so no writes, but shows what WOULD fill)
    log.enriched = enrichMissingImages(publishedSheet);

    // Link enrichment (DRY_RUN=true so no writes, but shows what WOULD fill)
    log.linksEnriched = enrichMissingEventLinks(publishedSheet);

    // Festival event page discovery (DRY_RUN=true so no writes)
    log.festivalEnriched = enrichViaFestivalDiscovery(publishedSheet);

    // Audit data quality
    log.quality = auditPublishedData(existingData);

    Logger.log(`Dry run: Would add ${log.added.length}, remove ${log.removed.length}, skip ${log.skipped}, enrich ${log.enriched.enriched} images`);
  } catch (error) {
    log.warnings.push('Error: ' + error.toString());
  }

  // Use the same enhanced email (DRY_RUN flag handled inside)
  sendDigestEmail(log);
}
