"""Shared configuration for PI Events pipeline"""

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
    'VENUE_ID', 'TICKET_URL', 'IMAGE_URL',
    'CATEGORY_ID', 'LANGUAGE'
]

# Column mappings
STAGED_EVENTS_COLUMNS = [
    'EVENT_ID', 'SOURCE', 'SOURCE_REFERENCE', 'EVENT_DATE', 'EVENT_TIME',
    'EVENT_NAME', 'ARTIST_NAME', 'EVENT_ORGANISER',
    'VENUE_ID', 'VENUE_NAME', 'CITY', 'COUNTRY', 'LANGUAGE',
    'TICKET_URL', 'IMAGE_URL', 'CATEGORY_ID', 'CATEGORY_SUGGESTION',
    'VENUE_ID_OVERRIDE', 'CATEGORY_OVERRIDE', 'TICKET_URL_OVERRIDE', 'IMAGE_URL_OVERRIDE',
    'ACCESS_STATUS', 'NOTES', 'VALIDATION_STATUS', 'APPROVE', 'INTERPRETERS'
]

READY_TO_PUBLISH_COLUMNS = [
    'EVENT_ID', 'DATE', 'TIME', 'EVENT', 'ARTIST', 'ORGANISER', 'VENUE',
    'CITY', 'COUNTRY', 'LANGUAGE', 'URL', 'IMAGE',
    'CATEGORY', 'ACCESS_STATUS', 'LAST_UPDATED'
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

# Event categories initial data
INITIAL_CATEGORIES = [
    {
        'category_id': 'concert',
        'category_name': 'Concert',
        'keywords': '["concert", "music", "band", "tour", "festival"]',
        'default_image_url': ''
    },
    {
        'category_id': 'sports',
        'category_name': 'Sports',
        'keywords': '["football", "basketball", "rugby", "game", "match", "sport"]',
        'default_image_url': ''
    },
    {
        'category_id': 'theatre',
        'category_name': 'Theatre',
        'keywords': '["theatre", "musical", "play", "opera", "ballet"]',
        'default_image_url': ''
    },
    {
        'category_id': 'comedy',
        'category_name': 'Comedy',
        'keywords': '["comedy", "comedian", "stand-up"]',
        'default_image_url': ''
    },
    {
        'category_id': 'family',
        'category_name': 'Family',
        'keywords': '["family", "kids", "children"]',
        'default_image_url': ''
    },
    {
        'category_id': 'cultural',
        'category_name': 'Cultural',
        'keywords': '["exhibition", "talk", "workshop", "cultural"]',
        'default_image_url': ''
    },
    {
        'category_id': 'festival-camping',
        'category_name': 'Festival - Camping',
        'keywords': '["festival", "camping"]',
        'default_image_url': ''
    },
    {
        'category_id': 'festival-non-camping',
        'category_name': 'Festival - Non-Camping',
        'keywords': '["festival"]',
        'default_image_url': ''
    }
]

# Color coding for validation status
VALIDATION_COLORS = {
    'ERROR': '#f4cccc',     # Red
    'WARNING': '#fff2cc',   # Amber
    'OK': '#d9ead3'         # Green
}
