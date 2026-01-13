// ==================== PI WORK FLOW - APPROVAL GATE WITH TYPO CHECKER ====================
// Install this script in the PI Work Flow spreadsheet (staff source document)
// Creates an approval gate in PUBLIC_APPROVED to catch typos before they flow to Public Events Feed
// VERSION 2: Added date filtering to only show future events

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('✅ Quality Control')
    .addItem('🔄 Refresh PUBLIC_APPROVED', 'refreshPublicApproved')
    .addSeparator()
    .addItem('🔍 Check PUBLIC_APPROVED for Typos', 'checkPublicApprovedForTypos')
    .addItem('🔗 Add Source Links', 'addSourceLinksColumn')
    .addSeparator()
    .addItem('📋 Mark All as Pending', 'markAllAsPending')
    .addItem('✅ Mark Selected as Approved', 'markSelectedAsApproved')
    .addItem('⚠️ Mark Selected as Pending', 'markSelectedAsPending')
    .addSeparator()
    .addItem('🔧 Setup APPROVED Column', 'setupApprovedColumn')
    .addItem('📝 Setup PRE_APPROVED EVENTS', 'setupPreApprovedEvents')
    .addToUi();
}

// ==================== DATE PARSING ====================
function parseEventDate(dateStr) {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();

  // Handle "DD.MM.YY" or "DD.MM.YYYY" format
  const parts = str.split('.');

  if (parts.length === 3) {
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
    let year = parseInt(parts[2]);

    // Handle 2-digit year
    if (year < 100) {
      year += 2000;
    }

    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return null;
}

// ==================== SETUP APPROVED COLUMN ====================
function setupApprovedColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  // Add header if not exists
  const headerValue = sheet.getRange('F1').getValue();
  if (headerValue !== 'APPROVED') {
    sheet.getRange('F1').setValue('APPROVED');
  }

  // Set all existing events to "Pending"
  const data = sheet.getDataRange().getValues();
  const updates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0]; // Column A - DATE

    // If row has data but APPROVED is empty, set to "Pending"
    if (dateStr && !data[i][5]) { // Column F (index 5) - APPROVED
      // Only set to Pending if it's a future event
      const eventDate = parseEventDate(dateStr);
      if (eventDate && eventDate >= today) {
        updates.push(['Pending']);
      } else {
        updates.push(['']); // Leave past events blank
      }
    } else if (dateStr) {
      updates.push([data[i][5]]); // Keep existing value
    } else {
      updates.push(['']); // Empty row
    }
  }

  if (updates.length > 0) {
    sheet.getRange(2, 6, updates.length, 1).setValues(updates);
  }

  // Add dropdown validation to column F (from row 2 onwards)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const validationRange = sheet.getRange(2, 6, lastRow - 1, 1); // Column F
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Approved'], true)
      .setAllowInvalid(false)
      .build();
    validationRange.setDataValidation(rule);
  }

  SpreadsheetApp.getUi().alert(
    '✅ Setup Complete!',
    `APPROVED column is now set up in PUBLIC_APPROVED!\n\n` +
    `• Column F header: "APPROVED"\n` +
    `• Future events: "Pending"\n` +
    `• Past events: Left blank\n` +
    `• Dropdown validation: Pending/Approved\n\n` +
    `Next steps:\n` +
    `1. Run "🔍 Check PUBLIC_APPROVED for Typos"\n` +
    `2. Fix any typos in monthly sheets\n` +
    `3. Mark clean FUTURE events as "Approved"`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ==================== MARK AS APPROVED/PENDING ====================
function markAllAsPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const updates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let futureCount = 0;

  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0]; // Column A
    if (dateStr) {
      const eventDate = parseEventDate(dateStr);
      if (eventDate && eventDate >= today) {
        updates.push(['Pending']);
        futureCount++;
      } else {
        updates.push(['']); // Leave past events blank
      }
    } else {
      updates.push(['']);
    }
  }

  if (updates.length > 0) {
    sheet.getRange(2, 6, updates.length, 1).setValues(updates);
  }

  SpreadsheetApp.getUi().alert(`✅ Marked ${futureCount} future event(s) as "Pending"\n\nPast events left blank.`);
}

function markSelectedAsApproved() {
  const sheet = SpreadsheetApp.getActiveSheet();

  if (sheet.getName() !== 'PUBLIC_APPROVED') {
    SpreadsheetApp.getUi().alert('❌ Please select cells in PUBLIC_APPROVED sheet first');
    return;
  }

  const range = sheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let approvedCount = 0;
  let pastCount = 0;

  const updates = [];
  const data = sheet.getRange(startRow, 1, numRows, 6).getValues();

  for (let i = 0; i < numRows; i++) {
    const dateStr = data[i][0]; // Column A
    const eventDate = parseEventDate(dateStr);

    if (eventDate && eventDate >= today) {
      updates.push(['Approved']);
      approvedCount++;
    } else {
      updates.push(['']); // Don't approve past events
      pastCount++;
    }
  }

  sheet.getRange(startRow, 6, numRows, 1).setValues(updates); // Column F

  let message = `✅ Marked ${approvedCount} future event(s) as "Approved"\n\nThese will now flow to Public Events Feed!`;
  if (pastCount > 0) {
    message += `\n\n⚠️ Skipped ${pastCount} past event(s)`;
  }

  SpreadsheetApp.getUi().alert(message);
}

function markSelectedAsPending() {
  const sheet = SpreadsheetApp.getActiveSheet();

  if (sheet.getName() !== 'PUBLIC_APPROVED') {
    SpreadsheetApp.getUi().alert('❌ Please select cells in PUBLIC_APPROVED sheet first');
    return;
  }

  const range = sheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  const updates = [];
  for (let i = 0; i < numRows; i++) {
    updates.push(['Pending']);
  }

  sheet.getRange(startRow, 6, numRows, 1).setValues(updates); // Column F

  SpreadsheetApp.getUi().alert(`✅ Marked ${numRows} event(s) as "Pending"`);
}

// ==================== CHECK PUBLIC_APPROVED FOR TYPOS ====================
function checkPublicApprovedForTypos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const issues = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0];    // Column A
    const event = data[i][1];   // Column B
    const venue = data[i][2];   // Column C
    const approved = data[i][5]; // Column F - APPROVED status

    if (!event && !venue) continue; // Skip empty rows

    // Skip past events
    const eventDate = parseEventDate(dateStr);
    if (eventDate && eventDate < today) continue;

    // Only check events that are NOT already approved
    if (approved === 'Approved') continue;

    // Check venue for typos
    if (venue) {
      const venueIssue = checkForTypos(venue, 'venue');
      if (venueIssue) {
        issues.push({
          row: i + 1,
          type: 'Venue',
          original: venue,
          suggested: venueIssue,
          date: dateStr,
          event: event,
          approved: approved || 'Not Set'
        });
      }
    }

    // Check event name for typos
    if (event) {
      const eventIssue = checkForTypos(event, 'event');
      if (eventIssue) {
        issues.push({
          row: i + 1,
          type: 'Event',
          original: event,
          suggested: eventIssue,
          date: dateStr,
          event: event,
          approved: approved || 'Not Set'
        });
      }
    }
  }

  // Display results
  displayTypoReport(issues);
}

// ==================== TYPO DETECTION ====================
function checkForTypos(text, type) {
  if (!text) return null;

  let corrected = text.toString();
  let foundTypo = false;

  if (type === 'venue') {
    // Check for common typos - order matters! Check specific patterns first
    const venueTypos = [
      { pattern: /staduim/gi, replacement: 'Stadium' },
      { pattern: /stadiem/gi, replacement: 'Stadium' },
      { pattern: /stadim/gi, replacement: 'Stadium' },
      { pattern: /accademy/gi, replacement: 'Academy' },
      { pattern: /acadamy/gi, replacement: 'Academy' },
      { pattern: /\bhal\b/gi, replacement: 'Hall' }, // "hal" at end of word becomes "Hall"
      { pattern: /\b02\b/g, replacement: 'O2' }, // "02" → "O2" (case-sensitive, no 'i' flag)
      { pattern: /\bo2\b/g, replacement: 'O2' }, // "o2" → "O2" (case-sensitive, no 'i' flag)
      { pattern: /centre/gi, replacement: 'Centre' },  // Fix "centre" vs "center"
      { pattern: /center(?!.*centre)/gi, replacement: 'Centre' } // American to British
    ];

    for (const typo of venueTypos) {
      if (typo.pattern.test(corrected)) {
        corrected = corrected.replace(typo.pattern, typo.replacement);
        foundTypo = true;
        // Don't break - check all patterns to catch multiple typos
      }
    }
  } else if (type === 'event') {
    const eventTypos = [
      { pattern: /brenford/gi, replacement: 'Brentford' },
      { pattern: /arsenel/gi, replacement: 'Arsenal' },
      { pattern: /livepool/gi, replacement: 'Liverpool' },
      { pattern: /chel sea/gi, replacement: 'Chelsea' },
      { pattern: /mancester/gi, replacement: 'Manchester' },
      { pattern: /tottenh am/gi, replacement: 'Tottenham' },
      { pattern: /\bwomens\b/gi, replacement: 'Women\'s' },
      { pattern: /\bwomans\b/gi, replacement: 'Women\'s' },
      { pattern: /\bbrunley\b/gi, replacement: 'Burnley' }, // Common typo
      { pattern: /\bvs\s{2,}/gi, replacement: 'vs ' }, // Normalize "vs  " (2+ spaces) to "vs "
    ];

    for (const typo of eventTypos) {
      if (typo.pattern.test(corrected)) {
        corrected = corrected.replace(typo.pattern, typo.replacement);
        foundTypo = true;
        // Don't break - check all patterns
      }
    }
  }

  // Check for double spaces
  if (corrected.includes('  ')) {
    corrected = corrected.replace(/\s+/g, ' ').trim();
    foundTypo = true;
  }

  return foundTypo ? corrected : null;
}

// Helper function to normalize dates for comparison
function normalizeDate(date) {
  if (!date) return '';
  const str = date.toString().trim();
  // Handle both "DD.MM.YY" and "DD.MM.YYYY"
  const parts = str.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 4) {
      year = year.substring(2);
    }
    return `${day}.${month}.${year}`;
  }
  return str;
}

function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

// ==================== REPORT DISPLAY ====================
function displayTypoReport(issues) {
  const ui = SpreadsheetApp.getUi();

  if (issues.length === 0) {
    ui.alert(
      '✅ All Clear!',
      'No suspected typos found in future events in PUBLIC_APPROVED.\n\n' +
      'Your data looks clean!\n\n' +
      'Next step: Mark clean events as "Approved" so they flow to Public Events Feed.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Build report
  let message = `⚠️ Found ${issues.length} suspected typo${issues.length > 1 ? 's' : ''} in future events:\n\n`;
  message += `💡 TIP: Use "🔗 Add Source Links" then click the SOURCE link to jump to the typo!\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  issues.forEach((issue, index) => {
    message += `${index + 1}. ${issue.type.toUpperCase()}: "${issue.original}"\n`;
    message += `   → Suggested fix: "${issue.suggested}"\n`;
    message += `   📍 PUBLIC_APPROVED Row ${issue.row}\n`;
    message += `   📅 ${issue.date} | Status: ${issue.approved}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `Steps to fix:\n`;
  message += `1. Click "🔗 Add Source Links" (if not already done)\n`;
  message += `2. Click the SOURCE link in PUBLIC_APPROVED to jump to typo\n`;
  message += `3. Fix the typo in the monthly sheet\n`;
  message += `4. Mark clean events as "Approved"\n\n`;
  message += `Only "Approved" future events will flow to Public Events Feed!`;

  ui.alert('🔍 Typo Check Results', message, ui.ButtonSet.OK);

  // Log for detailed review
  Logger.log('=== TYPO CHECK REPORT (PUBLIC_APPROVED) ===');
  issues.forEach(issue => {
    Logger.log(`Row ${issue.row}: ${issue.type} - "${issue.original}" → "${issue.suggested}"`);
  });
  Logger.log(`Total issues found: ${issues.length}`);
}

// ==================== ADD SOURCE LINKS ====================
function addSourceLinksColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  // Auto-discover all monthly tabs (same as refreshPublicApproved)
  const allSheets = ss.getSheets();
  const monthlySheets = [];
  const monthPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/;

  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (monthPattern.test(sheetName)) {
      monthlySheets.push(sheet.getName());
    }
  });

  // Add header in column G if not exists
  const headerValue = publicApprovedSheet.getRange('G1').getValue();
  if (headerValue !== 'SOURCE') {
    publicApprovedSheet.getRange('G1').setValue('SOURCE');
  }

  const data = publicApprovedSheet.getDataRange().getValues();
  const spreadsheetId = ss.getId();
  const links = [];

  // Process each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][0];  // Column A - Date
    const event = data[i][1];    // Column B - Event

    if (!dateStr || !event) {
      links.push(['']);
      continue;
    }

    let foundSource = false;

    // Check if event is from PRE_APPROVED EVENTS first
    const preApprovedSheet = ss.getSheetByName('PRE_APPROVED EVENTS');
    if (preApprovedSheet) {
      const preData = preApprovedSheet.getDataRange().getValues();
      for (let j = 1; j < preData.length; j++) {
        const preDate = preData[j][0];
        const preEvent = preData[j][1];

        const dateMatch = normalizeDate(preDate) === normalizeDate(dateStr);
        const eventMatch = normalizeText(preEvent) === normalizeText(event);

        if (dateMatch && eventMatch) {
          links.push(['📌 PRE_APPROVED EVENTS']);
          foundSource = true;
          break;
        }
      }
    }

    if (foundSource) continue;

    // Search monthly tabs for matching event
    for (const tabName of monthlySheets) {
      const monthSheet = ss.getSheetByName(tabName);
      if (!monthSheet) continue;

      const monthData = monthSheet.getDataRange().getValues();
      const sheetId = monthSheet.getSheetId();

      for (let j = 1; j < monthData.length; j++) {
        const monthDate = monthData[j][1];  // Column B - Date
        const monthEvent = monthData[j][2]; // Column C - Event
        const markedYes = monthData[j][8];  // Column I - Public App

        if (markedYes !== 'Yes' && markedYes !== 'yes' && markedYes !== 'YES') continue;

        // Normalize and compare
        const dateMatch = normalizeDate(monthDate) === normalizeDate(dateStr);
        const eventMatch = normalizeText(monthEvent) === normalizeText(event);

        if (dateMatch && eventMatch) {
          // Create hyperlink to source row
          const rowNumber = j + 1;
          const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowNumber}`;
          const formula = `=HYPERLINK("${url}", "📍 ${tabName} Row ${rowNumber}")`;
          links.push([formula]);
          foundSource = true;
          break;
        }
      }

      if (foundSource) break;
    }

    if (!foundSource) {
      links.push(['❓ Source not found']);
    }
  }

  // Write links to column G
  if (links.length > 0) {
    publicApprovedSheet.getRange(2, 7, links.length, 1).setFormulas(links);
  }

  SpreadsheetApp.getUi().alert(
    '✅ Source Links Added!',
    `Added clickable links in column G (SOURCE).\n\n` +
    `Click any link to jump directly to the source row in the monthly sheet!\n\n` +
    `Note: Links only work for events found in monthly tabs.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ==================== REFRESH PUBLIC_APPROVED ====================
function refreshPublicApproved() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Auto-discover all monthly tabs (sheets with month/year pattern)
  const allSheets = ss.getSheets();
  const monthlySheets = [];

  // Pattern to match: "Month YYYY" (e.g., "October 2025", "November 2025")
  const monthPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/;

  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (monthPattern.test(sheetName)) {
      monthlySheets.push(sheet);
    }
  });

  if (monthlySheets.length === 0) {
    SpreadsheetApp.getUi().alert(
      '⚠️ No Monthly Tabs Found',
      'Could not find any sheets matching the pattern "Month YYYY".\n\n' +
      'Example: "October 2025", "November 2025"',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // Collect all events marked "Yes" from future dates
  const allEvents = [];
  let preApprovedCount = 0;

  // First, pull from PRE_APPROVED EVENTS sheet
  const preApprovedSheet = ss.getSheetByName('PRE_APPROVED EVENTS');
  if (preApprovedSheet) {
    const preData = preApprovedSheet.getDataRange().getValues();

    // Skip header row, process data rows
    for (let i = 1; i < preData.length; i++) {
      const row = preData[i];
      const dateStr = row[0];     // Column A - Date
      const event = row[1];       // Column B - Event
      const venue = row[2];       // Column C - Venue
      const time = row[3];        // Column D - Time
      const interpreters = row[4]; // Column E - Interpreters
      // Note: Column F (row[5]) is NOTES - we don't include in PUBLIC_APPROVED

      // Skip empty rows
      if (!dateStr || !event) continue;

      // Only include future events
      const eventDate = parseEventDate(dateStr);
      if (!eventDate || eventDate < today) continue;

      // Add to collection
      allEvents.push([
        dateStr,      // A: DATE
        event,        // B: EVENT
        venue,        // C: VENUE
        time,         // D: TIME
        interpreters, // E: INTERPRETERS
        'Pending'     // F: APPROVED
      ]);
      preApprovedCount++;
    }
  }

  // Then, pull from monthly tabs (confirmed events marked "Yes")
  monthlySheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();

    // Skip header row, process data rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateStr = row[1];     // Column B - Date
      const event = row[2];       // Column C - Event
      const venue = row[3];       // Column D - Venue
      const time = row[4];        // Column E - Time
      const interpreters = row[5]; // Column F - Interpreters
      const markedYes = row[8];   // Column I - Public App

      // Only include if marked "Yes"
      if (markedYes !== 'Yes' && markedYes !== 'yes' && markedYes !== 'YES') continue;

      // Skip empty rows
      if (!dateStr || !event) continue;

      // Only include future events
      const eventDate = parseEventDate(dateStr);
      if (!eventDate || eventDate < today) continue;

      // Add to collection
      allEvents.push([
        dateStr,      // A: DATE
        event,        // B: EVENT
        venue,        // C: VENUE
        time,         // D: TIME
        interpreters, // E: INTERPRETERS
        'Pending'     // F: APPROVED
      ]);
    }
  });

  // Sort by date (earliest first)
  allEvents.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });

  // Clear existing data (keep headers)
  publicApprovedSheet.clear();

  // Set headers
  const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS', 'APPROVED'];
  publicApprovedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style headers
  const headerRange = publicApprovedSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // Add data
  if (allEvents.length > 0) {
    publicApprovedSheet.getRange(2, 1, allEvents.length, headers.length).setValues(allEvents);
  }

  // Set up APPROVED column validation
  if (allEvents.length > 0) {
    const validationRange = publicApprovedSheet.getRange(2, 6, allEvents.length, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Approved'], true)
      .setAllowInvalid(false)
      .build();
    validationRange.setDataValidation(rule);
  }

  const confirmedCount = allEvents.length - preApprovedCount;

  let message = '✅ PUBLIC_APPROVED Refreshed!\n\n';

  if (preApprovedCount > 0) {
    message += `📌 Pre-approved events: ${preApprovedCount}\n`;
  }

  message += `✓ Confirmed events from ${monthlySheets.length} monthly tab${monthlySheets.length > 1 ? 's' : ''}: ${confirmedCount}\n\n`;

  if (monthlySheets.length > 0) {
    message += `Monthly tabs:\n` + monthlySheets.map(s => `• ${s.getName()}`).join('\n') + '\n\n';
  }

  message += `Total: ${allEvents.length} future event${allEvents.length !== 1 ? 's' : ''}\n\n`;
  message += `Next steps:\n`;
  message += `1. Run "🔍 Check for Typos"\n`;
  message += `2. Fix any typos in source sheets\n`;
  message += `3. Mark clean events as "Approved"`;

  SpreadsheetApp.getUi().alert('✅ PUBLIC_APPROVED Refreshed!', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ==================== SETUP PRE_APPROVED EVENTS ====================
function setupPreApprovedEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let preApprovedSheet = ss.getSheetByName('PRE_APPROVED EVENTS');

  // Create sheet if it doesn't exist
  if (!preApprovedSheet) {
    preApprovedSheet = ss.insertSheet('PRE_APPROVED EVENTS');
  } else {
    // Clear existing content
    preApprovedSheet.clear();
  }

  // Set up headers
  const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS', 'NOTES'];
  preApprovedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style headers
  const headerRange = preApprovedSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#f4b400'); // Gold/orange for pre-approved
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);

  // Set column widths
  preApprovedSheet.setColumnWidth(1, 100); // DATE
  preApprovedSheet.setColumnWidth(2, 300); // EVENT
  preApprovedSheet.setColumnWidth(3, 200); // VENUE
  preApprovedSheet.setColumnWidth(4, 100); // TIME
  preApprovedSheet.setColumnWidth(5, 150); // INTERPRETERS
  preApprovedSheet.setColumnWidth(6, 250); // NOTES

  // Add example row
  const exampleRow = [
    '15.08.2026',
    'Edinburgh Fringe Festival',
    'Various Venues, Edinburgh',
    'TBC',
    'TBC',
    'Annual festival - awaiting confirmation'
  ];
  preApprovedSheet.getRange(2, 1, 1, headers.length).setValues([exampleRow]);

  // Style example row
  const exampleRange = preApprovedSheet.getRange(2, 1, 1, headers.length);
  exampleRange.setBackground('#fef7e0'); // Light gold
  exampleRange.setFontStyle('italic');

  // Freeze header row
  preApprovedSheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    '✅ PRE_APPROVED EVENTS Setup Complete!',
    `Created PRE_APPROVED EVENTS sheet.\n\n` +
    `Use this sheet to list "pencilled in" events like:\n` +
    `• Annual festivals\n` +
    `• Recurring events\n` +
    `• Events you know will happen but don't have interpreter confirmation yet\n\n` +
    `These events will be pulled into PUBLIC_APPROVED when you run "🔄 Refresh PUBLIC_APPROVED".\n\n` +
    `Example row added - you can delete it and add your own events.\n\n` +
    `TIP: Use NOTES column to explain status (e.g., "Awaiting confirmation")`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
