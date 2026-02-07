"""
Shared configuration for PI Events pipeline.

STATUS: STAGING / DORMANT
This Python pipeline is NOT the production publish path.
The canonical daily publish runs via AutoPublish.gs (Google Apps Script).
This pipeline exists for bulk staging, validation, and future PI OS integration.

If activating this pipeline, ensure READY_TO_PUBLISH column names match
what the frontend app.js expects (see PUBLISHED_HEADERS in AutoPublish-config-only.gs).
"""

# Spreadsheet IDs
PI_WORK_FLOW_ID = "1NiiWMcEEwjiU_DeVuUre_Qxyf5DGqEwG8Z8mYIRMuGU"
PUBLIC_EVENTS_FEED_ID = "1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8"

# Sheet names
SHEETS = {
    'PRE_APPROVED_EVENTS': 'PRE_APPROVED EVENTS',
    'INGEST_FROM_MONTHLY': '__AS_INGEST_FROM_MONTHLY',
    'STAGED_EVENTS': '__AS_STAGED_EVENTS',
    'VENUES': '__VENUES',
    'EVENT_CATEGORIES': '__EVENT_CATEGORIES',
    'READY_TO_PUBLISH': 'READY_TO_PUBLISH',
    'VENUE_ACCESS': '__VENUE_ACCESS',
    'CONFIG': 'CONFIG'
}

# Validation rules
REQUIRED_FIELDS = [
    'EVENT_DATE', 'EVENT_TIME', 'EVENT_NAME',
    'VENUE_ID', 'EVENT_URL', 'IMAGE_URL',
    'CATEGORY_ID', 'LANGUAGE'
]

# Column mappings
STAGED_EVENTS_COLUMNS = [
    'EVENT_ID', 'SOURCE', 'SOURCE_REFERENCE', 'EVENT_DATE', 'EVENT_TIME',
    'EVENT_NAME', 'ARTIST_NAME', 'EVENT_ORGANISER',
    'VENUE_ID', 'VENUE_NAME', 'CITY', 'COUNTRY', 'LANGUAGE',
    'EVENT_URL', 'IMAGE_URL', 'CATEGORY_ID', 'CATEGORY_SUGGESTION',
    'VENUE_ID_OVERRIDE', 'CATEGORY_OVERRIDE', 'EVENT_URL_OVERRIDE', 'IMAGE_URL_OVERRIDE',
    'ACCESS_STATUS', 'NOTES', 'VALIDATION_STATUS', 'APPROVE', 'INTERPRETERS'
]

# IMPORTANT: These column names MUST match what the frontend (app.js) reads from the CSV.
# The frontend expects: DATE, EVENT, VENUE, CITY, TIME, INTERPRETERS, INTERPRETATION,
# CATEGORY, IMAGE URL, EVENT URL, STATUS, SOURCE
# See AutoPublish-config-only.gs PUBLISHED_HEADERS for the canonical list.
READY_TO_PUBLISH_COLUMNS = [
    'DATE', 'EVENT', 'VENUE', 'CITY', 'TIME',
    'INTERPRETERS', 'INTERPRETATION', 'CATEGORY',
    'IMAGE URL', 'EVENT URL', 'STATUS', 'SOURCE'
]

VENUES_COLUMNS = [
    'VENUE_ID', 'VENUE_NAME', 'VENUE_ALIASES', 'CITY', 'COUNTRY',
    'LANGUAGE', 'INTERPRETER_STATUS', 'ACCESS_EMAIL', 'ACCESS_PHONE',
    'TEXTPHONE', 'VRS_PROVIDER', 'VRS_URL', 'DEFAULT_TICKET_URL',
    'DEFAULT_IMAGE_URL', 'BOOKING_GUIDE_URL', 'ACCESS_NOTES', 'OFFICIAL_SITE_URL'
]

EVENT_CATEGORIES_COLUMNS = [
    'CATEGORY_ID', 'CATEGORY_NAME', 'KEYWORDS', 'DEFAULT_IMAGE_URL'
]

INGEST_FROM_MONTHLY_COLUMNS = [
    'SOURCE_TAB', 'SOURCE_ROW', 'EVENT_DATE', 'EVENT_NAME', 'VENUE_NAME', 'EVENT_TIME', 'INTERPRETERS', 'EVENT_ORGANISER'
]

# Timezone
TIMEZONE = 'Europe/London'

# Monthly tab patterns
MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December']

# Fuzzy matching threshold
VENUE_MATCH_THRESHOLD = 0.85

# Event categories — aligned with AutoPublish.gs CATEGORY_KEYWORDS
# AutoPublish uses: Concert, Comedy, Theatre, Sports, Family, Festival, Cultural, Dance,
#                   Talks & Discussions, Literature
INITIAL_CATEGORIES = [
    {
        'category_id': 'concert',
        'category_name': 'Concert',
        'keywords': '["concert", "gig", "live music", "band", "singer", "orchestra", "symphony"]',
        'default_image_url': ''
    },
    {
        'category_id': 'sports',
        'category_name': 'Sports',
        'keywords': '["match", "game", "vs", "football", "rugby", "cricket", "boxing", "darts", "basketball", "wrestling"]',
        'default_image_url': ''
    },
    {
        'category_id': 'theatre',
        'category_name': 'Theatre',
        'keywords': '["theatre", "play", "musical", "opera", "ballet", "pantomime"]',
        'default_image_url': ''
    },
    {
        'category_id': 'comedy',
        'category_name': 'Comedy',
        'keywords': '["comedy", "stand-up", "comedian"]',
        'default_image_url': ''
    },
    {
        'category_id': 'family',
        'category_name': 'Family',
        'keywords': '["family", "kids", "children", "circus"]',
        'default_image_url': ''
    },
    {
        'category_id': 'cultural',
        'category_name': 'Cultural',
        'keywords': '["cultural", "heritage", "parade", "exhibition"]',
        'default_image_url': ''
    },
    {
        'category_id': 'festival',
        'category_name': 'Festival',
        'keywords': '["festival", "pride", "fest"]',
        'default_image_url': ''
    },
    {
        'category_id': 'dance',
        'category_name': 'Dance',
        'keywords': '["dance", "dancing"]',
        'default_image_url': ''
    },
    {
        'category_id': 'talks',
        'category_name': 'Talks & Discussions',
        'keywords': '["conversation", "talk", "discussion", "lecture", "q&a", "spoken word"]',
        'default_image_url': ''
    },
    {
        'category_id': 'literature',
        'category_name': 'Literature',
        'keywords': '["book", "author", "literary", "reading", "poetry"]',
        'default_image_url': ''
    }
]

# Color coding for validation status
VALIDATION_COLORS = {
    'ERROR': '#f4cccc',     # Red
    'WARNING': '#fff2cc',   # Amber
    'OK': '#d9ead3'         # Green
}
