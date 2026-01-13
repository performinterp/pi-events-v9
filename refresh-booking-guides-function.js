// ==================== REFRESH BOOKING GUIDES FUNCTION ====================
// Add this to your IMPROVED-Code.gs file

// Add this menu item to the onOpen() function (around line 44):
// .addItem('🔄 Refresh Booking Guide Data', 'refreshBookingGuidesUI')

// ==================== REFRESH BOOKING GUIDES ====================
function refreshBookingGuidesUI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔄 Refresh Booking Guide Data',
    'This will update ALL events in CURATED with the latest booking guide information from CONFIG.\n\n' +
    'Use this after:\n' +
    '• Updating booking notes in CONFIG\n' +
    '• Adding new venues to CONFIG\n' +
    '• Changing venue guide URLs\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  try {
    const result = refreshBookingGuides();
    ui.alert(
      '✅ Booking Guides Refreshed!',
      `Updated ${result.updated} events\n` +
      `${result.withGuides} events have booking guides\n` +
      `${result.updated - result.withGuides} events need direct venue contact`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', 'Failed to refresh: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function refreshBookingGuides() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curatedSheet = ss.getSheetByName('CURATED');

  if (!curatedSheet) {
    throw new Error('CURATED sheet not found');
  }

  // Load latest booking guides from CONFIG
  const bookingGuides = loadBookingGuidesFromConfig();

  // Get headers to find booking guide columns
  const headers = curatedSheet.getRange(1, 1, 1, curatedSheet.getLastColumn()).getValues()[0];

  const hasGuideCol = headers.indexOf('HAS_BOOKING_GUIDE') + 1;
  const guideUrlCol = headers.indexOf('BOOKING_GUIDE_URL') + 1;
  const bookingNoteCol = headers.indexOf('BOOKING_NOTE') + 1;

  if (!hasGuideCol || !guideUrlCol || !bookingNoteCol) {
    throw new Error('Booking guide columns not found. Run "Run Full Automation" first.');
  }

  const lastRow = curatedSheet.getLastRow();
  if (lastRow <= 1) {
    return { updated: 0, withGuides: 0 };
  }

  const data = curatedSheet.getRange(2, 1, lastRow - 1, curatedSheet.getLastColumn()).getValues();
  let updatedCount = 0;
  let withGuideCount = 0;

  // Update each event with latest CONFIG data
  for (let i = 0; i < data.length; i++) {
    const venue = data[i][2]; // Column C - VENUE
    const event = data[i][1]; // Column B - EVENT

    if (!venue && !event) continue;

    // Get latest booking guide info from CONFIG
    const guideInfo = findBookingGuideFromConfig(venue, event, bookingGuides);
    const rowNum = i + 2;

    // Update the booking guide columns
    curatedSheet.getRange(rowNum, hasGuideCol).setValue(guideInfo.hasGuide ? 'TRUE' : 'FALSE');
    curatedSheet.getRange(rowNum, guideUrlCol).setValue(guideInfo.guideUrl);
    curatedSheet.getRange(rowNum, bookingNoteCol).setValue(guideInfo.bookingNote);

    if (guideInfo.hasGuide) {
      withGuideCount++;
    }

    updatedCount++;
  }

  return {
    updated: updatedCount,
    withGuides: withGuideCount
  };
}

// ==================== HOW TO USE ====================
/*

1. Add the menu item to onOpen() function (line 44):
   .addItem('🔄 Refresh Booking Guide Data', 'refreshBookingGuidesUI')

2. The full menu section should look like this:

    .addSeparator()
    .addItem('⚙️ Setup CONFIG Sheet', 'setupConfigSheet')
    .addItem('📖 Add Venue to Booking Guides', 'addVenueToConfigUI')
    .addItem('🔄 Refresh Booking Guide Data', 'refreshBookingGuidesUI')
    .addToUi();

3. Copy the refreshBookingGuidesUI() and refreshBookingGuides() functions
   into your IMPROVED-Code.gs file (anywhere after the onOpen function)

4. Save and reload your spreadsheet

5. Now when you:
   - Update a booking note in CONFIG
   - Add a new venue to CONFIG
   - Change a guide URL

   Just click: 🎭 Event Automation → 🔄 Refresh Booking Guide Data

   And ALL events will update with the latest CONFIG data!

*/
