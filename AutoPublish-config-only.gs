// ==================== SHARED CONFIGURATION ====================
// These constants are used by both Code.gs and other .gs files.
// Declared here with const to avoid duplication.

const PI_WORKFLOW_ID = '1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU';
const PUBLIC_FEED_ID = '1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8';

const PRE_APPROVED_SHEET = 'PRE_APPROVED EVENTS';
const PUBLISHED_SHEET = 'PUBLISHED';

// DIGEST_EMAIL: Set in Script Properties for security, or uses this default
const DIGEST_EMAIL = PropertiesService.getScriptProperties().getProperty('DIGEST_EMAIL') || 'admin@performanceinterpreting.co.uk';

var DRY_RUN = false; // Set true to test without writing

const CANCELLED_SHEET = 'CANCELLED';

const PUBLISHED_HEADERS = [
  'DATE', 'EVENT', 'VENUE', 'CITY', 'TIME',
  'INTERPRETERS', 'INTERPRETATION', 'CATEGORY',
  'IMAGE URL', 'EVENT URL', 'STATUS'
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
