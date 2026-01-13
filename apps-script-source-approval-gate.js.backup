// ==================== PI WORK FLOW - APPROVAL GATE WITH TYPO CHECKER ====================
// Install this script in the PI Work Flow spreadsheet (staff source document)
// Creates an approval gate in PUBLIC_APPROVED to catch typos before they flow to Public Events Feed

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('✅ Quality Control')
    .addItem('🔍 Check PUBLIC_APPROVED for Typos', 'checkPublicApprovedForTypos')
    .addItem('📊 Generate Typo Report Sheet', 'generateTypoReportSheet')
    .addSeparator()
    .addItem('📋 Mark All as Pending', 'markAllAsPending')
    .addItem('✅ Mark Selected as Approved', 'markSelectedAsApproved')
    .addItem('⚠️ Mark Selected as Pending', 'markSelectedAsPending')
    .addSeparator()
    .addItem('🔧 Setup APPROVED Column', 'setupApprovedColumn')
    .addToUi();
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

  for (let i = 1; i < data.length; i++) {
    const date = data[i][0]; // Column A - DATE

    // If row has data but APPROVED is empty, set to "Pending"
    if (date && !data[i][5]) { // Column F (index 5) - APPROVED
      updates.push(['Pending']);
    } else if (date) {
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
    `• All existing events: "Pending"\n` +
    `• Dropdown validation: Pending/Approved\n\n` +
    `Next steps:\n` +
    `1. Run "🔍 Check PUBLIC_APPROVED for Typos"\n` +
    `2. Fix any typos in monthly sheets\n` +
    `3. Mark clean events as "Approved"`,
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

  for (let i = 1; i < data.length; i++) {
    const date = data[i][0]; // Column A
    if (date) {
      updates.push(['Pending']);
    } else {
      updates.push(['']);
    }
  }

  if (updates.length > 0) {
    sheet.getRange(2, 6, updates.length, 1).setValues(updates);
  }

  SpreadsheetApp.getUi().alert(`✅ Marked ${updates.filter(u => u[0] === 'Pending').length} events as "Pending"`);
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

  const updates = [];
  for (let i = 0; i < numRows; i++) {
    updates.push(['Approved']);
  }

  sheet.getRange(startRow, 6, numRows, 1).setValues(updates); // Column F

  SpreadsheetApp.getUi().alert(`✅ Marked ${numRows} event(s) as "Approved"\n\nThese will now flow to Public Events Feed!`);
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

  // Check each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const date = data[i][0];    // Column A
    const event = data[i][1];   // Column B
    const venue = data[i][2];   // Column C
    const approved = data[i][5]; // Column F - APPROVED status

    if (!event && !venue) continue; // Skip empty rows

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
          date: date,
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
          date: date,
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
      { pattern: /\bhal\b/gi, replacement: 'Hall' }, // \b = word boundary, so "HalL" at end becomes "Hall"
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
      { pattern: /\bvs\s+/gi, replacement: 'vs ' }, // Normalize "vs  " to "vs "
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

// ==================== GENERATE TYPO REPORT SHEET ====================
function generateTypoReportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    SpreadsheetApp.getUi().alert('❌ Error: PUBLIC_APPROVED sheet not found');
    return;
  }

  // Check for typos first
  const publicApprovedData = publicApprovedSheet.getDataRange().getValues();
  const publicApprovedIssues = [];

  for (let i = 1; i < publicApprovedData.length; i++) {
    const date = publicApprovedData[i][0];
    const event = publicApprovedData[i][1];
    const venue = publicApprovedData[i][2];
    const approved = publicApprovedData[i][5];

    if (!event && !venue) continue;
    if (approved === 'Approved') continue;

    if (venue) {
      const venueIssue = checkForTypos(venue, 'venue');
      if (venueIssue) {
        publicApprovedIssues.push({
          source: 'PUBLIC_APPROVED',
          row: i + 1,
          type: 'Venue',
          original: venue,
          suggested: venueIssue,
          date: date,
          event: event
        });
      }
    }

    if (event) {
      const eventIssue = checkForTypos(event, 'event');
      if (eventIssue) {
        publicApprovedIssues.push({
          source: 'PUBLIC_APPROVED',
          row: i + 1,
          type: 'Event',
          original: event,
          suggested: eventIssue,
          date: date,
          event: event
        });
      }
    }
  }

  // Find source rows in monthly tabs
  const monthlyTabs = [
    'October 2025', 'November 2025', 'December 2025', 'January 2026',
    'February 2026', 'March 2026', 'April 2026', 'May 2026',
    'June 2026', 'July 2026', 'August 2026', 'September 2026'
  ];

  const issuesWithSource = [];

  publicApprovedIssues.forEach(issue => {
    // Find this event in the monthly tabs
    for (const tabName of monthlyTabs) {
      const monthSheet = ss.getSheetByName(tabName);
      if (!monthSheet) continue;

      const monthData = monthSheet.getDataRange().getValues();

      for (let i = 1; i < monthData.length; i++) {
        const monthDate = monthData[i][0];
        const monthEvent = monthData[i][1];
        const markedYes = monthData[i][8];

        if (markedYes !== 'Yes' && markedYes !== 'yes' && markedYes !== 'YES') continue;

        // Normalize and compare
        const dateMatch = normalizeDate(monthDate) === normalizeDate(issue.date);
        const eventMatch = normalizeText(monthEvent) === normalizeText(issue.event);

        if (dateMatch && eventMatch) {
          issuesWithSource.push({
            ...issue,
            sourceTab: tabName,
            sourceRow: i + 1
          });
          break;
        }
      }
    }
  });

  if (issuesWithSource.length === 0) {
    SpreadsheetApp.getUi().alert(
      '✅ All Clear!',
      'No suspected typos found in PUBLIC_APPROVED.\n\n' +
      'Your data looks clean!\n\n' +
      'Next step: Mark clean events as "Approved" so they flow to Public Events Feed.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // Create or clear TYPO_REPORT sheet
  let reportSheet = ss.getSheetByName('TYPO_REPORT');
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet('TYPO_REPORT');
  }

  // Set up headers
  const headers = [
    'SOURCE TAB',
    'ROW',
    'DATE',
    'EVENT',
    'TYPO TYPE',
    'ORIGINAL (WRONG)',
    'SUGGESTED FIX',
    'STATUS'
  ];

  reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style headers
  const headerRange = reportSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);

  // Add data
  const reportData = issuesWithSource.map(issue => [
    issue.sourceTab || 'Unknown',
    issue.sourceRow || '?',
    issue.date,
    issue.event,
    issue.type,
    issue.original,
    issue.suggested,
    'Pending'
  ]);

  reportSheet.getRange(2, 1, reportData.length, headers.length).setValues(reportData);

  // Format columns
  reportSheet.setColumnWidth(1, 150); // SOURCE TAB
  reportSheet.setColumnWidth(2, 50);  // ROW
  reportSheet.setColumnWidth(3, 100); // DATE
  reportSheet.setColumnWidth(4, 300); // EVENT
  reportSheet.setColumnWidth(5, 100); // TYPO TYPE
  reportSheet.setColumnWidth(6, 200); // ORIGINAL
  reportSheet.setColumnWidth(7, 200); // SUGGESTED FIX
  reportSheet.setColumnWidth(8, 100); // STATUS

  // Highlight wrong values in red
  const originalRange = reportSheet.getRange(2, 6, reportData.length, 1);
  originalRange.setBackground('#fce8e6');
  originalRange.setFontColor('#cc0000');

  // Highlight suggested fixes in green
  const suggestedRange = reportSheet.getRange(2, 7, reportData.length, 1);
  suggestedRange.setBackground('#d9ead3');
  suggestedRange.setFontColor('#38761d');

  // Freeze header row
  reportSheet.setFrozenRows(1);

  // Activate the report sheet
  reportSheet.activate();

  SpreadsheetApp.getUi().alert(
    '📊 Typo Report Generated!',
    `Found ${issuesWithSource.length} typo${issuesWithSource.length > 1 ? 's' : ''} to fix.\n\n` +
    `The TYPO_REPORT sheet shows:\n` +
    `• Which monthly tab to go to\n` +
    `• Which row to fix\n` +
    `• Side-by-side comparison of wrong vs correct\n\n` +
    `Next steps:\n` +
    `1. Look at SOURCE TAB column\n` +
    `2. Go to that monthly sheet\n` +
    `3. Find the ROW number\n` +
    `4. Fix the typo (copy from SUGGESTED FIX column)\n` +
    `5. Data will auto-sync to PUBLIC_APPROVED\n` +
    `6. Mark events as "Approved"`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
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
      'No suspected typos found in PUBLIC_APPROVED.\n\n' +
      'Your data looks clean!\n\n' +
      'Next step: Mark clean events as "Approved" so they flow to Public Events Feed.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Build report
  let message = `⚠️ Found ${issues.length} suspected typo${issues.length > 1 ? 's' : ''} in PUBLIC_APPROVED:\n\n`;
  message += `💡 TIP: Use "📊 Generate Typo Report Sheet" for easier fixing!\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  issues.forEach((issue, index) => {
    message += `${index + 1}. ${issue.type.toUpperCase()}: "${issue.original}"\n`;
    message += `   → Suggested fix: "${issue.suggested}"\n`;
    message += `   📍 PUBLIC_APPROVED Row ${issue.row}\n`;
    message += `   📅 ${issue.date} | Status: ${issue.approved}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `Steps to fix:\n`;
  message += `1. Click "📊 Generate Typo Report Sheet" for easier workflow\n`;
  message += `   OR manually find events in monthly sheets\n`;
  message += `2. Fix the typo in the monthly sheet\n`;
  message += `3. Mark clean events as "Approved"\n\n`;
  message += `Only "Approved" events will flow to Public Events Feed!`;

  ui.alert('🔍 Typo Check Results', message, ui.ButtonSet.OK);

  // Log for detailed review
  Logger.log('=== TYPO CHECK REPORT (PUBLIC_APPROVED) ===');
  issues.forEach(issue => {
    Logger.log(`Row ${issue.row}: ${issue.type} - "${issue.original}" → "${issue.suggested}"`);
  });
  Logger.log(`Total issues found: ${issues.length}`);
}
