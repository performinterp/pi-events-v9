// ==================== PI WORK FLOW - TYPO CHECKER FOR EVENTS MARKED "YES" ====================
// Install this script in the PI Work Flow spreadsheet (staff source document)
// It checks for typos in events marked "Yes" BEFORE they flow to Public Events Feed

// ==================== MENU ====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('✅ Data Quality Check')
    .addItem('🔍 Check Events Marked "Yes" for Typos', 'checkMarkedEventsForTypos')
    .addToUi();
}

// ==================== MAIN FUNCTION ====================
function checkMarkedEventsForTypos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Monthly tabs to check
  const monthlyTabs = [
    'October 2025',
    'November 2025',
    'December 2025',
    'January 2026',
    'February 2026',
    'March 2026',
    'April 2026',
    'May 2026',
    'June 2026',
    'July 2026',
    'August 2026',
    'September 2026'
  ];

  const allIssues = [];

  // Check each monthly tab
  for (const tabName of monthlyTabs) {
    const sheet = ss.getSheetByName(tabName);

    if (!sheet) {
      Logger.log(`Warning: ${tabName} tab not found - skipping`);
      continue;
    }

    const data = sheet.getDataRange().getValues();

    // Check each row (skip header row 1)
    for (let i = 1; i < data.length; i++) {
      const markedYes = data[i][8]; // Column I (index 8) - "Marked Yes"

      // Only check rows marked "Yes"
      if (markedYes !== 'Yes' && markedYes !== 'yes' && markedYes !== 'YES') {
        continue;
      }

      const date = data[i][0];    // Column A
      const event = data[i][1];   // Column B
      const venue = data[i][2];   // Column C

      if (!event && !venue) continue; // Skip empty rows

      // Check venue for typos
      if (venue) {
        const venueIssue = checkForTypos(venue, 'venue');
        if (venueIssue) {
          allIssues.push({
            tab: tabName,
            row: i + 1,
            type: 'Venue',
            original: venue,
            suggested: venueIssue,
            date: date,
            event: event
          });
        }
      }

      // Check event name for typos
      if (event) {
        const eventIssue = checkForTypos(event, 'event');
        if (eventIssue) {
          allIssues.push({
            tab: tabName,
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
  }

  // Display results
  displayTypoReport(allIssues);
}

// ==================== TYPO DETECTION ====================
function checkForTypos(text, type) {
  if (!text) return null;

  let corrected = text.toString();
  let foundTypo = false;

  if (type === 'venue') {
    const venuePatterns = {
      'staduim': 'Stadium',
      'stadiem': 'Stadium',
      'stadim': 'Stadium',
      'emirates staduim': 'Emirates Stadium',
      'emirates stadiem': 'Emirates Stadium',
      'accademy': 'Academy',
      'o2 accademy': 'O2 Academy',
      'acadamy': 'Academy',
      'royal albert hal': 'Royal Albert Hall',
      'southbank center': 'Southbank Centre',
      'wembley staduim': 'Wembley Stadium',
      'london staduim': 'London Stadium',
      'stamford bridge staduim': 'Stamford Bridge',
      'celtic park staduim': 'Celtic Park'
    };

    const lowerText = corrected.toLowerCase();
    for (const [typo, correction] of Object.entries(venuePatterns)) {
      if (lowerText.includes(typo)) {
        const regex = new RegExp(typo, 'gi');
        corrected = corrected.replace(regex, correction);
        foundTypo = true;
        break; // Only report first typo
      }
    }
  } else if (type === 'event') {
    const eventPatterns = {
      'brenford': 'Brentford',
      'arsenel': 'Arsenal',
      'livepool': 'Liverpool',
      'chel sea': 'Chelsea',
      'mancester': 'Manchester',
      'tottenh am': 'Tottenham',
      ' womens ': ' Women\'s ',
      ' womans ': ' Women\'s '
    };

    const lowerText = corrected.toLowerCase();
    for (const [typo, correction] of Object.entries(eventPatterns)) {
      if (lowerText.includes(typo)) {
        const regex = new RegExp(typo, 'gi');
        corrected = corrected.replace(regex, correction);
        foundTypo = true;
        break; // Only report first typo
      }
    }
  }

  // Check for double spaces (common formatting issue)
  if (corrected.includes('  ')) {
    corrected = corrected.replace(/\s+/g, ' ').trim();
    foundTypo = true;
  }

  return foundTypo ? corrected : null;
}

// ==================== REPORT DISPLAY ====================
function displayTypoReport(issues) {
  const ui = SpreadsheetApp.getUi();

  if (issues.length === 0) {
    ui.alert(
      '✅ All Clear!',
      'No suspected typos found in events marked "Yes".\n\n' +
      'Your data looks clean and ready to flow to the Public Events Feed!',
      ui.ButtonSet.OK
    );
    return;
  }

  // Build report message
  let message = `⚠️ Found ${issues.length} suspected typo${issues.length > 1 ? 's' : ''} in events marked "Yes":\n\n`;
  message += `Fix these BEFORE they flow to the Public Events Feed!\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  issues.forEach((issue, index) => {
    message += `${index + 1}. ${issue.type.toUpperCase()}: "${issue.original}"\n`;
    message += `   → Suggested fix: "${issue.suggested}"\n`;
    message += `   📍 Tab: "${issue.tab}" - Row ${issue.row}\n`;
    message += `   📅 ${issue.date} | ${issue.event}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `Steps:\n`;
  message += `1. Go to each tab listed above\n`;
  message += `2. Find the row number\n`;
  message += `3. Fix the typo\n`;
  message += `4. Clean data will automatically flow to Public Events Feed!\n\n`;
  message += `Re-run this check after fixing to verify.`;

  ui.alert('🔍 Typo Check Results', message, ui.ButtonSet.OK);

  // Also log to console for detailed review
  Logger.log('=== TYPO CHECK REPORT (Events Marked "Yes") ===');
  issues.forEach(issue => {
    Logger.log(`${issue.tab} Row ${issue.row}: ${issue.type} - "${issue.original}" → "${issue.suggested}"`);
  });
  Logger.log(`Total issues found: ${issues.length}`);
}
