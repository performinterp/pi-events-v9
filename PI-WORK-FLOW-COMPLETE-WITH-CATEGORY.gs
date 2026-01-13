// ==================== PI WORK FLOW - APPROVAL GATE WITH TYPO CHECKER + CATEGORY ====================
// Install this script in the PI Work Flow spreadsheet (staff source document)
// Creates an approval gate in PUBLIC_APPROVED to catch typos before they flow to Public Events Feed
// VERSION 3: Added CATEGORY column for event categorization

// ==================== CONFIGURATION ====================
const CATEGORY_OPTIONS = [
  'Concert',
  'Sports',
  'Theatre',
  'Comedy',
  'Family',
  'Cultural',
  'Festival - Camping',
  'Festival - Non-Camping'
];

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
    .addItem('🎭 Setup CATEGORY Column', 'setupCategoryColumn')
    .addItem('🔄 Update Category Validation', 'updateCategoryValidationOnly')
    .addItem('🤖 Auto-Detect Categories', 'autoDetectCategories')
    .addItem('🏷️ Set Categories (Multi-Select)', 'setCategoriesMultiSelect')
    .addItem('➕ Add New Category Option', 'addNewCategoryUI')
    .addSeparator()
    .addItem('📝 Setup PRE_APPROVED EVENTS', 'setupPreApprovedEvents')
    .addToUi();
}

// ==================== DATE PARSING ====================
function parseEventDate(dateStr) {
  if (!dateStr) return null;

  let str = dateStr.toString().trim();

  // Handle date ranges: "DD.MM.YY - DD.MM.YY" or "DD.MM.YY & DD.MM.YY"
  // Extract the first date only
  if (str.includes('-') || str.includes('&')) {
    // Split by common separators
    const firstPart = str.split(/[-&]/)[0].trim();
    str = firstPart;
  }

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

// ==================== SETUP CATEGORY COLUMN ====================
function setupCategoryColumn() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    ui.alert('❌ Error', 'PUBLIC_APPROVED sheet not found', ui.ButtonSet.OK);
    return;
  }

  // Check if CATEGORY column already exists
  const headers = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  const categoryCol = headers.indexOf('CATEGORY');

  if (categoryCol !== -1) {
    const response = ui.alert(
      '⚠️ CATEGORY Column Exists',
      'CATEGORY column already exists in column ' + String.fromCharCode(65 + categoryCol) + '.\n\n' +
      'Do you want to update the dropdown options?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      updateCategoryValidation(publicApprovedSheet, categoryCol + 1);
      ui.alert('✅ Category dropdown options updated!');
    }
    return;
  }

  // Add CATEGORY column at column G (after F - APPROVED)
  const categoryColIndex = 7; // Column G

  // Check if column G already has data
  const currentGHeader = publicApprovedSheet.getRange(1, 7).getValue();
  if (currentGHeader) {
    // Insert new column
    publicApprovedSheet.insertColumnAfter(6);
  }

  // Set header
  publicApprovedSheet.getRange(1, categoryColIndex).setValue('CATEGORY');
  publicApprovedSheet.getRange(1, categoryColIndex)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Add validation with dropdown
  updateCategoryValidation(publicApprovedSheet, categoryColIndex);

  ui.alert(
    '✅ CATEGORY Column Added!',
    'CATEGORY column added to column G!\n\n' +
    'To enable MULTI-SELECT checkboxes:\n\n' +
    'OPTION 1 - Enable via Apps Script (automatic):\n' +
    '1. Extensions → Apps Script\n' +
    '2. Left sidebar: Services (+)\n' +
    '3. Find "Google Sheets API" → Add\n' +
    '4. Close Apps Script, re-run "🎭 Setup CATEGORY Column"\n\n' +
    'OPTION 2 - Enable manually (one-time):\n' +
    '1. Click CATEGORY column header (column G)\n' +
    '2. Data → Data validation\n' +
    '3. Check "Allow multiple selections" at bottom\n' +
    '4. Click Done\n\n' +
    'Categories: ' + CATEGORY_OPTIONS.join(', '),
    ui.ButtonSet.OK
  );
}

function updateCategoryValidation(sheet, columnIndex) {
  if (sheet.getLastRow() <= 1) return;

  const ss = sheet.getParent();
  const spreadsheetId = ss.getId();
  const sheetId = sheet.getSheetId();

  // Create or get CATEGORY_OPTIONS sheet for reference range
  let optionsSheet = ss.getSheetByName('CATEGORY_OPTIONS');
  if (!optionsSheet) {
    optionsSheet = ss.insertSheet('CATEGORY_OPTIONS');
    optionsSheet.hideSheet(); // Hide it from normal view
  }

  // Write category options to the hidden sheet
  const optionsData = CATEGORY_OPTIONS.map(cat => [cat]);
  optionsSheet.clear();
  optionsSheet.getRange(1, 1, optionsData.length, 1).setValues(optionsData);

  const optionsSheetId = optionsSheet.getSheetId();

  // Use Sheets API v4 to set validation with multiple selections enabled
  const requests = [{
    "setDataValidation": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 1, // Row 2 (0-indexed)
        "endRowIndex": sheet.getMaxRows(),
        "startColumnIndex": columnIndex - 1,
        "endColumnIndex": columnIndex
      },
      "rule": {
        "condition": {
          "type": "ONE_OF_RANGE",
          "values": [{
            "userEnteredValue": "=CATEGORY_OPTIONS!$A$1:$A$" + CATEGORY_OPTIONS.length
          }]
        },
        "inputMessage": "Select one or more categories",
        "strict": false, // Changed to false to allow comma-separated combinations
        "showCustomUi": true // This enables multiple selections!
      }
    }
  }];

  try {
    Sheets.Spreadsheets.batchUpdate({"requests": requests}, spreadsheetId);
  } catch (e) {
    // Fallback to basic Apps Script method if Sheets API not enabled
    Logger.log("Sheets API not enabled. Using fallback method.");
    Logger.log("To enable multiple selections:");
    Logger.log("1. Go to Resources > Advanced Google Services");
    Logger.log("2. Enable 'Google Sheets API'");
    Logger.log("3. Re-run this function");

    const optionsRange = optionsSheet.getRange(1, 1, CATEGORY_OPTIONS.length, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(optionsRange, true)
      .setAllowInvalid(true) // Changed to true to allow comma-separated combinations
      .setHelpText('Select one or more categories')
      .build();

    const validationRange = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1);
    validationRange.setDataValidation(rule);
  }
}

// ==================== UPDATE CATEGORY VALIDATION ONLY ====================
function updateCategoryValidationOnly() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    ui.alert('❌ Error', 'PUBLIC_APPROVED sheet not found', ui.ButtonSet.OK);
    return;
  }

  // Check if CATEGORY column exists
  const headers = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  const categoryCol = headers.indexOf('CATEGORY');

  if (categoryCol === -1) {
    ui.alert(
      '⚠️ CATEGORY Column Missing',
      'CATEGORY column not found. Run "🎭 Setup CATEGORY Column" first.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Remove all validation (to prevent red warning triangles)
  const dataRange = publicApprovedSheet.getRange(2, categoryCol + 1, publicApprovedSheet.getMaxRows() - 1, 1);
  dataRange.clearDataValidations();

  ui.alert(
    '✅ Validation Removed!',
    'Category column validation has been removed.\n\n' +
    'You can now type any categories freely:\n' +
    '• Single: "Sports"\n' +
    '• Multiple: "Sports, Family"\n' +
    '• Any combination you want\n\n' +
    'Note: You lost the dropdown, but gained flexibility.\n' +
    'No more red warning triangles!',
    ui.ButtonSet.OK
  );
}

// ==================== AUTO-DETECT CATEGORIES ====================
function autoDetectCategories() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    ui.alert('❌ Error', 'PUBLIC_APPROVED sheet not found', ui.ButtonSet.OK);
    return;
  }

  // Find columns
  const headers = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  const eventCol = headers.indexOf('EVENT') + 1;
  const venueCol = headers.indexOf('VENUE') + 1;
  const categoryCol = headers.indexOf('CATEGORY') + 1;

  if (!eventCol || !venueCol || !categoryCol) {
    ui.alert('❌ Error', 'Required columns not found (EVENT, VENUE, CATEGORY)', ui.ButtonSet.OK);
    return;
  }

  const response = ui.alert(
    '🤖 Auto-Detect Categories',
    'This will automatically guess categories for events based on:\n' +
    '• Event names (football, concert, comedy, etc.)\n' +
    '• Venue names (O2, Stadium, Theatre, etc.)\n\n' +
    'Options:\n' +
    '• YES: Only fill empty CATEGORY cells\n' +
    '• NO: Overwrite ALL categories (including manual ones)\n' +
    '• CANCEL: Cancel\n\n' +
    'Recommended: Choose YES to keep manual edits',
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (response === ui.Button.CANCEL) return;

  const overwriteAll = response === ui.Button.NO;
  const data = publicApprovedSheet.getRange(2, 1, publicApprovedSheet.getLastRow() - 1, publicApprovedSheet.getLastColumn()).getValues();

  let detected = 0;
  let skipped = 0;
  const updates = [];

  for (let i = 0; i < data.length; i++) {
    const event = data[i][eventCol - 1];
    const venue = data[i][venueCol - 1];
    const existingCategory = data[i][categoryCol - 1];

    // Skip empty rows
    if (!event && !venue) {
      updates.push(['']);
      continue;
    }

    // Skip if category exists and we're not overwriting
    if (existingCategory && !overwriteAll) {
      updates.push([existingCategory]);
      skipped++;
      continue;
    }

    // Detect category
    const detectedCategory = detectCategory(event, venue);
    updates.push([detectedCategory]);
    detected++;
  }

  // Write updates
  if (updates.length > 0) {
    publicApprovedSheet.getRange(2, categoryCol, updates.length, 1).setValues(updates);
  }

  ui.alert(
    '✅ Auto-Detection Complete!',
    `Detected: ${detected} event${detected !== 1 ? 's' : ''}\n` +
    `Skipped: ${skipped} (already had categories)\n\n` +
    'Please review and correct any wrong guesses!',
    ui.ButtonSet.OK
  );
}

function detectCategory(event, venue) {
  const eventStr = (event || '').toString().toLowerCase();
  const venueStr = (venue || '').toString().toLowerCase();
  const combined = eventStr + ' ' + venueStr;

  // Sports - check venue and event keywords
  if (combined.match(/\b(stadium|arena|fc|football|rugby|cricket|tennis|basketball|boxing|golf|racing|f1|formula|grand prix)\b/i)) {
    // Check if it's actually a concert at a stadium
    if (combined.match(/\b(concert|tour|live|music|singer|band)\b/i)) {
      return 'Concert';
    }
    return 'Sports';
  }

  // Festivals
  if (combined.match(/\b(festival|fest|fringe)\b/i)) {
    if (combined.match(/\b(camping|camp site|weekend|glastonbury|download|reading|leeds festival)\b/i)) {
      return 'Festival - Camping';
    }
    return 'Festival - Non-Camping';
  }

  // Theatre/Musicals
  if (combined.match(/\b(theatre|theater|musical|play|opera|ballet|dance)\b/i)) {
    // Check if it's for families
    if (combined.match(/\b(kids|children|family|disney|panto|pantomime)\b/i)) {
      return 'Family, Theatre';
    }
    return 'Theatre';
  }

  // Comedy
  if (combined.match(/\b(comedy|comedian|stand.?up|comic)\b/i)) {
    return 'Comedy';
  }

  // Concerts - check for music venues and keywords
  if (combined.match(/\b(o2|arena|academy|concert|tour|live|music|singer|band|gig)\b/i)) {
    return 'Concert';
  }

  // Family events
  if (combined.match(/\b(kids|children|family|disney|paw patrol|peppa pig|baby|toddler)\b/i)) {
    return 'Family';
  }

  // Cultural
  if (combined.match(/\b(exhibition|museum|gallery|art|culture|heritage)\b/i)) {
    return 'Cultural';
  }

  return 'Other';
}

// ==================== ADD NEW CATEGORY ====================
function addNewCategoryUI() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const publicApprovedSheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!publicApprovedSheet) {
    ui.alert('❌ Error', 'PUBLIC_APPROVED sheet not found', ui.ButtonSet.OK);
    return;
  }

  // Check if CATEGORY column exists
  const headers = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  const categoryCol = headers.indexOf('CATEGORY');

  if (categoryCol === -1) {
    ui.alert(
      '⚠️ CATEGORY Column Missing',
      'CATEGORY column not found. Run "🎭 Setup CATEGORY Column" first.',
      ui.ButtonSet.OK
    );
    return;
  }

  const input = ui.prompt(
    '➕ Add New Category',
    'Enter new category name:\n\n' +
    'Current categories:\n' +
    CATEGORY_OPTIONS.join(', ') + '\n\n' +
    'Examples:\n' +
    '• Dance\n' +
    '• Classical Music\n' +
    '• Art Exhibition\n' +
    '• Festival - Day Event',
    ui.ButtonSet.OK_CANCEL
  );

  if (input.getSelectedButton() !== ui.Button.OK) return;

  const newCategory = input.getResponseText().trim();

  if (!newCategory) {
    ui.alert('❌ Error', 'Category name cannot be empty', ui.ButtonSet.OK);
    return;
  }

  if (CATEGORY_OPTIONS.includes(newCategory)) {
    ui.alert('⚠️ Warning', 'Category "' + newCategory + '" already exists', ui.ButtonSet.OK);
    return;
  }

  // Add to options array
  CATEGORY_OPTIONS.push(newCategory);

  // Update the hidden CATEGORY_OPTIONS sheet
  let optionsSheet = ss.getSheetByName('CATEGORY_OPTIONS');
  if (optionsSheet) {
    const optionsData = CATEGORY_OPTIONS.map(cat => [cat]);
    optionsSheet.clear();
    optionsSheet.getRange(1, 1, optionsData.length, 1).setValues(optionsData);
  }

  // Update validation
  updateCategoryValidation(publicApprovedSheet, categoryCol + 1);

  ui.alert(
    '✅ Category Added!',
    'Added "' + newCategory + '" to category options.\n\n' +
    '⚠️ IMPORTANT:\n' +
    'This change is temporary. To make it permanent:\n\n' +
    '1. Open Apps Script (Extensions → Apps Script)\n' +
    '2. Find line ~8: const CATEGORY_OPTIONS = [...]\n' +
    '3. Add \'' + newCategory + '\' to the list\n' +
    '4. Save\n\n' +
    'Otherwise it will reset when you reload the spreadsheet.',
    ui.ButtonSet.OK
  );
}

// ==================== SET CATEGORIES (MULTI-SELECT) ====================
function setCategoriesMultiSelect() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Check if we're in PUBLIC_APPROVED sheet
  if (sheet.getName() !== 'PUBLIC_APPROVED') {
    ui.alert(
      '⚠️ Wrong Sheet',
      'Please select rows in PUBLIC_APPROVED sheet first.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Check if CATEGORY column exists
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const categoryCol = headers.indexOf('CATEGORY');

  if (categoryCol === -1) {
    ui.alert(
      '⚠️ CATEGORY Column Missing',
      'CATEGORY column not found. Run "🎭 Setup CATEGORY Column" first.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Get selected range
  const range = sheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  if (startRow === 1) {
    ui.alert(
      '⚠️ Invalid Selection',
      'Please select data rows (not the header row).',
      ui.ButtonSet.OK
    );
    return;
  }

  // Store selection info in script properties so the dialog can access it
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('SELECTED_START_ROW', startRow.toString());
  scriptProperties.setProperty('SELECTED_NUM_ROWS', numRows.toString());
  scriptProperties.setProperty('CATEGORY_COL', (categoryCol + 1).toString());

  // Show HTML dialog with checkboxes
  const html = HtmlService.createHtmlOutput(getCategoryDialogHtml())
    .setWidth(400)
    .setHeight(450);

  ui.showModalDialog(html, '🏷️ Select Categories');
}

function getCategoryDialogHtml() {
  const checkboxes = CATEGORY_OPTIONS.map((cat, index) => {
    return `
      <div style="margin: 8px 0;">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" name="category" value="${cat}" style="margin-right: 8px; cursor: pointer;">
          <span style="font-size: 14px;">${cat}</span>
        </label>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 16px;
            margin: 0;
          }
          .container {
            max-height: 320px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 12px;
            border-radius: 4px;
            background: #f9f9f9;
          }
          .buttons {
            margin-top: 16px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          }
          button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }
          .btn-primary {
            background: #4285f4;
            color: white;
          }
          .btn-primary:hover {
            background: #357abd;
          }
          .btn-secondary {
            background: #f1f3f4;
            color: #202124;
          }
          .btn-secondary:hover {
            background: #e8eaed;
          }
          .header {
            margin-bottom: 12px;
            color: #5f6368;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          Select one or more categories for the selected row(s):
        </div>
        <div class="container">
          ${checkboxes}
        </div>
        <div class="buttons">
          <button class="btn-secondary" onclick="google.script.host.close()">Cancel</button>
          <button class="btn-primary" onclick="applyCategories()">Apply to Selected Rows</button>
        </div>

        <script>
          function applyCategories() {
            // More robust checkbox detection
            const allCheckboxes = document.querySelectorAll('input[type="checkbox"][name="category"]');
            const selected = [];

            for (let i = 0; i < allCheckboxes.length; i++) {
              if (allCheckboxes[i].checked) {
                selected.push(allCheckboxes[i].value);
              }
            }

            console.log('Found ' + allCheckboxes.length + ' checkboxes total');
            console.log('Found ' + selected.length + ' checked');
            console.log('Selected values: ' + selected.join(', '));

            if (selected.length === 0) {
              alert('Error: No categories detected as checked.\n\nPlease try again or use the dropdown in the cell directly.');
              return;
            }

            const categoriesString = selected.join(', ');

            google.script.run
              .withSuccessHandler(function() {
                google.script.host.close();
              })
              .withFailureHandler(function(error) {
                alert('❌ Error: ' + error.message);
              })
              .applyCategoryToSelection(categoriesString);
          }
        </script>
      </body>
    </html>
  `;
}

function applyCategoryToSelection(categoriesString) {
  // Get stored selection info from script properties
  const scriptProperties = PropertiesService.getScriptProperties();
  const startRow = parseInt(scriptProperties.getProperty('SELECTED_START_ROW'));
  const numRows = parseInt(scriptProperties.getProperty('SELECTED_NUM_ROWS'));
  const categoryCol = parseInt(scriptProperties.getProperty('CATEGORY_COL'));

  if (!startRow || !numRows || !categoryCol) {
    throw new Error('Selection information not found. Please try again.');
  }

  // Get PUBLIC_APPROVED sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PUBLIC_APPROVED');

  if (!sheet) {
    throw new Error('PUBLIC_APPROVED sheet not found');
  }

  // Set category for all selected rows
  const updates = [];
  for (let i = 0; i < numRows; i++) {
    updates.push([categoriesString]);
  }

  sheet.getRange(startRow, categoryCol, numRows, 1).setValues(updates);

  // Clean up stored properties
  scriptProperties.deleteProperty('SELECTED_START_ROW');
  scriptProperties.deleteProperty('SELECTED_NUM_ROWS');
  scriptProperties.deleteProperty('CATEGORY_COL');
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

  // Find the SOURCE column (should be after CATEGORY if it exists, or after APPROVED)
  const headers = publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0];
  let sourceCol = headers.indexOf('SOURCE') + 1;

  if (sourceCol === 0) {
    // SOURCE column doesn't exist, add it after the last existing column
    sourceCol = headers.length + 1;
    publicApprovedSheet.getRange(1, sourceCol).setValue('SOURCE');
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

  // Write links to SOURCE column
  if (links.length > 0) {
    publicApprovedSheet.getRange(2, sourceCol, links.length, 1).setFormulas(links);
  }

  SpreadsheetApp.getUi().alert(
    '✅ Source Links Added!',
    `Added clickable links in column ${String.fromCharCode(64 + sourceCol)} (SOURCE).\n\n` +
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

  // BEFORE clearing, save existing categories to preserve manual edits
  const existingData = publicApprovedSheet.getLastRow() > 1 ?
    publicApprovedSheet.getRange(2, 1, publicApprovedSheet.getLastRow() - 1, publicApprovedSheet.getLastColumn()).getValues() : [];

  const existingHeaders = publicApprovedSheet.getLastColumn() > 0 ?
    publicApprovedSheet.getRange(1, 1, 1, publicApprovedSheet.getLastColumn()).getValues()[0] : [];

  const existingCategoryCol = existingHeaders.indexOf('CATEGORY');
  const existingApprovedCol = existingHeaders.indexOf('APPROVED');
  const eventDataMap = {}; // Map of "date|event|venue" -> {category, approved}

  // Build map of existing categories and approved statuses
  for (let i = 0; i < existingData.length; i++) {
    const date = existingData[i][0];
    const event = existingData[i][1];
    const venue = existingData[i][2];
    const category = existingCategoryCol !== -1 ? existingData[i][existingCategoryCol] : '';
    const approved = existingApprovedCol !== -1 ? existingData[i][existingApprovedCol] : '';

    if (date && event) {
      const key = `${normalizeDate(date)}|${normalizeText(event)}|${normalizeText(venue)}`;
      eventDataMap[key] = {
        category: category || '',
        approved: approved || 'Pending'
      };
    }
  }

  // Sort by date (earliest first)
  allEvents.sort((a, b) => {
    const dateA = parseEventDate(a[0]);
    const dateB = parseEventDate(b[0]);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });

  // Clear existing data (keep headers)
  publicApprovedSheet.clear();

  // Set headers - now including CATEGORY
  const headers = ['DATE', 'EVENT', 'VENUE', 'TIME', 'INTERPRETERS', 'APPROVED', 'CATEGORY'];
  publicApprovedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style headers
  const headerRange = publicApprovedSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // Add data with categories and approved status restored or auto-detected
  let newEventsCount = 0;
  let restoredCount = 0;
  let alreadyApprovedCount = 0;

  if (allEvents.length > 0) {
    // Add CATEGORY and APPROVED columns to each event
    const eventsWithData = allEvents.map(event => {
      const date = event[0];
      const eventName = event[1];
      const venue = event[2];
      const key = `${normalizeDate(date)}|${normalizeText(eventName)}|${normalizeText(venue)}`;

      // Check if we have saved data for this event
      if (eventDataMap[key]) {
        restoredCount++;
        const savedData = eventDataMap[key];

        // Count already approved events
        if (savedData.approved === 'Approved') {
          alreadyApprovedCount++;
        }

        // Restore both category and approved status
        const category = savedData.category || detectCategory(eventName, venue);
        return [date, eventName, venue, event[3], event[4], savedData.approved, category];
      } else {
        newEventsCount++;
        // New event - auto-detect category, set to Pending
        const detected = detectCategory(eventName, venue);
        return [date, eventName, venue, event[3], event[4], 'Pending', detected];
      }
    });

    publicApprovedSheet.getRange(2, 1, eventsWithData.length, headers.length).setValues(eventsWithData);
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

  message += `📊 Status Summary:\n`;
  message += `• Existing events (edits preserved): ${restoredCount}\n`;
  message += `  - Already Approved: ${alreadyApprovedCount}\n`;
  message += `  - Still Pending: ${restoredCount - alreadyApprovedCount}\n`;
  message += `• New events (auto-detected): ${newEventsCount}\n\n`;

  if (alreadyApprovedCount > 0) {
    message += `✅ ${alreadyApprovedCount} already-approved event${alreadyApprovedCount !== 1 ? 's' : ''} preserved!\n`;
    message += `These will NOT be re-imported to Public Events Feed.\n\n`;
  }

  message += `Next steps:\n`;
  if (newEventsCount > 0) {
    message += `1. Review ${newEventsCount} new event${newEventsCount !== 1 ? 's' : ''} (auto-detected categories)\n`;
    message += `2. Run "🔍 Check for Typos"\n`;
    message += `3. Fix any typos\n`;
    message += `4. Mark new events as "Approved" when ready\n`;
  } else {
    message += `1. Run "🔍 Check for Typos"\n`;
    message += `2. All events already categorized and approved!\n`;
  }

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
