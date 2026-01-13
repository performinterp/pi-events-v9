// ==================== CONFIG SHEET API ====================
// Web service API for admin panel to read/write CONFIG sheet
// Deploy this as a Web App with "Anyone" access

// ==================== WEB APP ENTRY POINT ====================
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getVenues':
        return getVenuesAPI();
      case 'getVenue':
        return getVenueAPI(e.parameter.index);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() }, 500);
  }
}

function doPost(e) {
  const action = e.parameter.action;

  try {
    const data = JSON.parse(e.postData.contents);

    switch (action) {
      case 'addVenue':
        return addVenueAPI(data);
      case 'updateVenue':
        return updateVenueAPI(e.parameter.index, data);
      case 'deleteVenue':
        return deleteVenueAPI(e.parameter.index);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() }, 500);
  }
}

// ==================== API FUNCTIONS ====================

function getVenuesAPI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    return jsonResponse({ error: 'CONFIG sheet not found' }, 404);
  }

  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  const venues = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // Skip empty rows

    venues.push({
      name: data[i][0] || '',
      hasGuide: data[i][1] === 'TRUE' || data[i][1] === true,
      guideUrl: data[i][2] || '',
      venueSlug: data[i][3] || '',
      bookingNote: data[i][4] || '',
      rowIndex: i + 1 // Store actual row number for updates
    });
  }

  return jsonResponse({
    success: true,
    venues: venues,
    count: venues.length
  });
}

function getVenueAPI(index) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    return jsonResponse({ error: 'CONFIG sheet not found' }, 404);
  }

  const rowIndex = parseInt(index) + 2; // +2 for header and 0-based index
  const rowData = configSheet.getRange(rowIndex, 1, 1, 5).getValues()[0];

  return jsonResponse({
    success: true,
    venue: {
      name: rowData[0] || '',
      hasGuide: rowData[1] === 'TRUE' || rowData[1] === true,
      guideUrl: rowData[2] || '',
      venueSlug: rowData[3] || '',
      bookingNote: rowData[4] || ''
    }
  });
}

function addVenueAPI(venue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');

  // Create CONFIG sheet if it doesn't exist
  if (!configSheet) {
    configSheet = ss.insertSheet('CONFIG');
    const headers = ['VENUE_NAME', 'HAS_GUIDE', 'GUIDE_URL', 'VENUE_SLUG', 'BOOKING_NOTE'];
    configSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header
    const headerRange = configSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4a86e8');
    headerRange.setFontColor('#ffffff');
    configSheet.setFrozenRows(1);
  }

  // Add new venue row
  const newRow = [
    venue.name,
    venue.hasGuide ? 'TRUE' : 'FALSE',
    venue.guideUrl || '',
    venue.venueSlug || generateSlug(venue.name),
    venue.bookingNote || 'Contact venue directly about BSL availability'
  ];

  configSheet.appendRow(newRow);

  return jsonResponse({
    success: true,
    message: `Added venue: ${venue.name}`,
    venue: {
      name: newRow[0],
      hasGuide: newRow[1] === 'TRUE',
      guideUrl: newRow[2],
      venueSlug: newRow[3],
      bookingNote: newRow[4]
    }
  });
}

function updateVenueAPI(index, venue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    return jsonResponse({ error: 'CONFIG sheet not found' }, 404);
  }

  const rowIndex = parseInt(index) + 2; // +2 for header and 0-based index

  const updatedRow = [
    venue.name,
    venue.hasGuide ? 'TRUE' : 'FALSE',
    venue.guideUrl || '',
    venue.venueSlug || generateSlug(venue.name),
    venue.bookingNote || 'Contact venue directly about BSL availability'
  ];

  configSheet.getRange(rowIndex, 1, 1, 5).setValues([updatedRow]);

  return jsonResponse({
    success: true,
    message: `Updated venue: ${venue.name}`
  });
}

function deleteVenueAPI(index) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('CONFIG');

  if (!configSheet) {
    return jsonResponse({ error: 'CONFIG sheet not found' }, 404);
  }

  const rowIndex = parseInt(index) + 2; // +2 for header and 0-based index
  const venueName = configSheet.getRange(rowIndex, 1).getValue();

  configSheet.deleteRow(rowIndex);

  return jsonResponse({
    success: true,
    message: `Deleted venue: ${venueName}`
  });
}

// ==================== HELPER FUNCTIONS ====================

function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  if (statusCode !== 200) {
    // Note: Apps Script Web Apps don't support custom HTTP status codes
    // But we can include it in the response
    data.statusCode = statusCode;
  }

  return output;
}

function generateSlug(name) {
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

// ==================== TEST FUNCTIONS ====================
// Run these to test the API locally

function testGetVenues() {
  const result = getVenuesAPI();
  Logger.log(result.getContent());
}

function testAddVenue() {
  const testVenue = {
    name: 'Test Venue',
    hasGuide: true,
    guideUrl: 'https://app.performanceinterpreting.co.uk/booking-guide#test-venue',
    venueSlug: 'test-venue',
    bookingNote: 'This is a test venue'
  };

  const result = addVenueAPI(testVenue);
  Logger.log(result.getContent());
}

function testUpdateVenue() {
  const testVenue = {
    name: 'Updated Test Venue',
    hasGuide: false,
    guideUrl: '',
    venueSlug: 'updated-test-venue',
    bookingNote: 'Contact venue directly'
  };

  const result = updateVenueAPI('0', testVenue);
  Logger.log(result.getContent());
}

function testDeleteVenue() {
  const result = deleteVenueAPI('0');
  Logger.log(result.getContent());
}
