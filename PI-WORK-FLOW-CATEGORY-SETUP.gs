// ==================== PI WORK FLOW - ADD CATEGORY COLUMN TO PUBLIC_APPROVED ====================
// Install this in the PI Work Flow spreadsheet (NOT Public Events Feed)
// This adds a CATEGORY column with multi-select dropdown to PUBLIC_APPROVED

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
    .addItem('📝 Setup PRE_APPROVED EVENTS', 'setupPreApprovedEvents')
    .addSeparator()
    .addItem('🎭 Setup CATEGORY Column', 'setupCategoryColumn')
    .addItem('➕ Add New Category Option', 'addNewCategoryUI')
    .addToUi();
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

  // Add CATEGORY column after APPROVED (column F)
  const approvedCol = headers.indexOf('APPROVED');

  if (approvedCol === -1) {
    ui.alert(
      '⚠️ Warning',
      'APPROVED column not found. Adding CATEGORY as column G anyway.',
      ui.ButtonSet.OK
    );
  }

  // Insert CATEGORY column at column G (after F - APPROVED)
  const categoryColIndex = 7; // Column G
  publicApprovedSheet.insertColumnAfter(6);

  // Set header
  publicApprovedSheet.getRange(1, categoryColIndex).setValue('CATEGORY');
  publicApprovedSheet.getRange(1, categoryColIndex)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Add validation with multi-select
  updateCategoryValidation(publicApprovedSheet, categoryColIndex);

  ui.alert(
    '✅ CATEGORY Column Added!',
    'CATEGORY column added to column G.\n\n' +
    'HOW TO USE:\n' +
    '• Single category: Select from dropdown\n' +
    '• Multiple categories: Type them with commas\n' +
    '  Examples:\n' +
    '  - "Family, Concert"\n' +
    '  - "Festival - Camping, Family"\n' +
    '  - "Sports, Family"\n\n' +
    'Current categories:\n' +
    CATEGORY_OPTIONS.join(', ') + '\n\n' +
    'Use "➕ Add New Category Option" to add more.',
    ui.ButtonSet.OK
  );
}

function updateCategoryValidation(sheet, columnIndex) {
  if (sheet.getLastRow() <= 1) return;

  // Create validation rule
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CATEGORY_OPTIONS, true)
    .setAllowInvalid(true) // Allow custom entries for combining categories
    .setHelpText('Select one or combine multiple with commas (e.g., "Family, Concert")')
    .build();

  // Apply to all data rows
  const validationRange = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1);
  validationRange.setDataValidation(rule);
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

// ==================== HELPER: GET CATEGORY FROM ROW ====================
function getCategoryFromRow(row) {
  // This function can be called by other scripts to get the category
  // Row should be the full row data from PUBLIC_APPROVED
  const headers = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('PUBLIC_APPROVED')
    .getRange(1, 1, 1, 20)
    .getValues()[0];

  const categoryCol = headers.indexOf('CATEGORY');

  if (categoryCol === -1) return 'Other';

  return row[categoryCol] || 'Other';
}

// ==================== EXISTING FUNCTIONS FROM SOURCE APPROVAL GATE ====================
// Keep all your existing functions below (refreshPublicApproved, checkPublicApprovedForTypos, etc.)
// Just add the setupCategoryColumn and addNewCategoryUI functions above

// NOTE: You need to paste your existing PI Work Flow script functions here
// This is just the CATEGORY column additions

function refreshPublicApproved() {
  // Your existing function
  SpreadsheetApp.getUi().alert('Paste your existing refreshPublicApproved function here');
}

function checkPublicApprovedForTypos() {
  // Your existing function
  SpreadsheetApp.getUi().alert('Paste your existing checkPublicApprovedForTypos function here');
}

function addSourceLinksColumn() {
  // Your existing function (if you have it)
}

function markAllAsPending() {
  // Your existing function
}

function markSelectedAsApproved() {
  // Your existing function
}

function markSelectedAsPending() {
  // Your existing function
}

function setupApprovedColumn() {
  // Your existing function
}

function setupPreApprovedEvents() {
  // Your existing function
}
