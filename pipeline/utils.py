"""Shared utility functions for PI Events pipeline"""

import hashlib
import re
from datetime import datetime, timedelta
import pytz
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher


def normalize_url(url: str) -> str:
    """
    Normalize URL for deduplication (strips protocol, www, params, trailing slashes)

    Example:
        normalize_url("https://www.theo2.co.uk/events/detail/event?ref=123")
        Returns: "theo2.co.uk/events/detail/event"
    """
    if not url:
        return ""

    url = url.lower().strip()
    url = url.replace('https://', '').replace('http://', '')

    if '?' in url:
        url = url.split('?', 1)[0]

    url = url.rstrip('/')
    url = url.replace('www.', '')

    return url


def normalize_event_name(name: str) -> str:
    """
    Normalize event name for deduplication

    Example:
        normalize_event_name("The Beatles - Live Tour 2026")
        Returns: "beatles - live tour"
    """
    if not name:
        return ""

    # Convert to lowercase, strip whitespace
    name = name.lower().strip()

    # Remove common suffixes/prefixes
    patterns = [
        r'\s*-\s*live$',
        r'^the\s+',
        r'\s+tour$',
        r'\s+\d{4}$',  # Year suffixes
        r'\s*\(.*\)$',  # Parenthetical notes
    ]

    for pattern in patterns:
        name = re.sub(pattern, '', name)

    # Normalize whitespace
    name = re.sub(r'\s+', ' ', name)

    return name.strip()


def normalize_venue_name(venue: str) -> str:
    """
    Normalize venue name for matching

    Example:
        normalize_venue_name("The O2 Arena, London")
        Returns: "o2"
    """
    if not venue:
        return ""

    venue = venue.lower().strip()

    # Remove common location suffixes
    venue = re.sub(r',\s*london$', '', venue)
    venue = re.sub(r',\s*uk$', '', venue)
    venue = re.sub(r',\s*ireland$', '', venue)

    # Normalize common venue name variations
    replacements = {
        'the o2 arena': 'the o2',
        'o2 arena': 'the o2',
        'indigo at the o2': 'indigo',
    }

    for old, new in replacements.items():
        if old in venue:
            venue = venue.replace(old, new)

    return venue.strip()


def generate_event_id(event_date: str, event_name: str, venue_id: str) -> str:
    """
    Generate unique EVENT_ID from event key using SHA-256 hash

    Example:
        generate_event_id("2026-06-15", "Taylor Swift", "wembley-stadium-london")
        Returns: "a1b2c3d4e5f6g7h8"  (first 16 chars of hash)
    """
    key = f"{event_date}|{normalize_event_name(event_name)}|{venue_id}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def create_event_key(event_date: str, event_name: str, venue_id: str) -> str:
    """
    Create deduplication key (date|name|venue)

    Example:
        create_event_key("2026-06-15", "Taylor Swift", "wembley-stadium-london")
        Returns: "2026-06-15|taylor swift|wembley-stadium-london"
    """
    return f"{event_date}|{normalize_event_name(event_name)}|{venue_id}"


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to YYYY-MM-DD

    Supported formats:
        - YYYY-MM-DD (already normalized)
        - DD.MM.YY or DD.MM.YYYY
        - DD/MM/YY or DD/MM/YYYY

    Example:
        parse_date("15.06.26") Returns: "2026-06-15"
        parse_date("15/06/2026") Returns: "2026-06-15"
        parse_date("2026-06-15") Returns: "2026-06-15"
    """
    if not date_str:
        return None

    date_str = str(date_str).strip()

    # Already in YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str

    # Handle date ranges: "DD.MM.YY - DD.MM.YY" -> extract first date
    if ' - ' in date_str or ' & ' in date_str:
        date_str = re.split(r'\s*[-&]\s*', date_str)[0].strip()

    # DD.MM.YY or DD.MM.YYYY
    if '.' in date_str:
        parts = date_str.split('.')
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            try:
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            except:
                return None

    # DD/MM/YY or DD/MM/YYYY
    if '/' in date_str:
        parts = date_str.split('/')
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            try:
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            except:
                return None

    return None


def is_event_outdated(event_date: str, event_time: str, hours_buffer: int = 6) -> bool:
    """
    Check if event is outdated (end time < now - hours_buffer)

    Args:
        event_date: Date in YYYY-MM-DD format
        event_time: Time string (HH:MM or other formats)
        hours_buffer: Grace period in hours (default: 6)

    Returns:
        True if event is outdated, False otherwise

    Example:
        is_event_outdated("2025-12-01", "19:00", 6)
        Returns: True (if current date is > 2025-12-02 01:00)
    """
    tz = pytz.timezone('Europe/London')
    now = datetime.now(tz)

    try:
        date_obj = datetime.strptime(event_date, '%Y-%m-%d')

        # Parse time (default to 23:59 if missing or unparseable)
        hour, minute = 23, 59
        if event_time:
            time_clean = event_time.strip()
            # Handle time ranges: "19:00 - 22:00" -> use first time
            if '-' in time_clean:
                time_clean = time_clean.split('-')[0].strip()
            if '/' in time_clean:
                time_clean = time_clean.split('/')[0].strip()
            if ':' in time_clean:
                parts = time_clean.split(':')
                try:
                    hour = int(parts[0])
                    minute = int(parts[1][:2])  # Extract first 2 digits
                except:
                    pass

        event_dt = tz.localize(datetime(date_obj.year, date_obj.month, date_obj.day, hour, minute))
        cutoff = now - timedelta(hours=hours_buffer)

        return event_dt < cutoff
    except Exception as e:
        # If parsing fails, assume event is not outdated (safer)
        return False


def fuzzy_match_venue(venue_name: str, venues_data: List[List[str]], threshold: float = 0.85) -> Optional[str]:
    """
    Match venue name to VENUES.VENUE_ID using tiered matching

    Algorithm (in order of priority):
        1. Exact normalized match against canonical name
        2. Exact normalized match against aliases
        3. Fuzzy match (Levenshtein distance) against canonical name and aliases

    Args:
        venue_name: Input venue name to match
        venues_data: 2D array from VENUES sheet (headers + data rows)
        threshold: Similarity threshold for fuzzy matching (0.0 to 1.0, default: 0.85)

    Returns:
        VENUE_ID if match found, None otherwise

    Example:
        fuzzy_match_venue("O2 Arena London", venues_data, 0.85)
        Returns: "the-o2-arena-london"
    """
    if not venues_data or len(venues_data) < 2:
        return None

    normalized_input = normalize_venue_name(venue_name)

    headers = venues_data[0]
    try:
        venue_id_idx = headers.index('VENUE_ID')
        venue_name_idx = headers.index('VENUE_NAME')
        aliases_idx = headers.index('VENUE_ALIASES') if 'VENUE_ALIASES' in headers else -1
    except ValueError:
        return None

    # Tier 1: Exact normalized match against canonical name
    for row in venues_data[1:]:
        if len(row) <= venue_id_idx:
            continue

        canonical_name = row[venue_name_idx] if venue_name_idx < len(row) else ""
        normalized_canonical = normalize_venue_name(canonical_name)

        if normalized_input == normalized_canonical:
            return row[venue_id_idx]

    # Tier 2: Exact normalized match against aliases
    for row in venues_data[1:]:
        if len(row) <= venue_id_idx:
            continue

        venue_id = row[venue_id_idx]
        aliases_str = row[aliases_idx] if aliases_idx >= 0 and aliases_idx < len(row) else ""

        if aliases_str:
            # Parse aliases (JSON array or comma-separated)
            aliases = []
            if aliases_str.startswith('['):
                try:
                    import json
                    aliases = json.loads(aliases_str)
                except:
                    aliases = [a.strip().strip('"[]') for a in aliases_str.split(',')]
            else:
                aliases = [a.strip().strip('"[]') for a in aliases_str.split(',')]

            for alias in aliases:
                if not alias:
                    continue
                normalized_alias = normalize_venue_name(alias)
                if normalized_input == normalized_alias:
                    return venue_id

    # Tier 3: Fuzzy match (Levenshtein distance)
    best_match = None
    best_score = 0.0

    for row in venues_data[1:]:
        if len(row) <= venue_id_idx:
            continue

        venue_id = row[venue_id_idx]
        canonical_name = row[venue_name_idx] if venue_name_idx < len(row) else ""
        aliases_str = row[aliases_idx] if aliases_idx >= 0 and aliases_idx < len(row) else ""

        # Check canonical name
        normalized_canonical = normalize_venue_name(canonical_name)
        score = SequenceMatcher(None, normalized_input, normalized_canonical).ratio()

        if score > best_score:
            best_score = score
            best_match = venue_id

        # Check aliases
        if aliases_str:
            aliases = []
            if aliases_str.startswith('['):
                try:
                    import json
                    aliases = json.loads(aliases_str)
                except:
                    aliases = [a.strip().strip('"[]') for a in aliases_str.split(',')]
            else:
                aliases = [a.strip().strip('"[]') for a in aliases_str.split(',')]

            for alias in aliases:
                if not alias:
                    continue
                normalized_alias = normalize_venue_name(alias)
                score = SequenceMatcher(None, normalized_input, normalized_alias).ratio()
                if score > best_score:
                    best_score = score
                    best_match = venue_id

    return best_match if best_score >= threshold else None


def generate_venue_id(venue_name: str) -> str:
    """
    Generate VENUE_ID slug from VENUE_NAME

    Algorithm:
        1. Lowercase and strip
        2. Replace non-alphanumeric characters with hyphens
        3. Remove duplicate hyphens
        4. Strip leading/trailing hyphens

    Example:
        generate_venue_id("The O2 Arena, London")
        Returns: "the-o2-arena-london"
    """
    if not venue_name:
        return ""

    # Lowercase and strip
    slug = venue_name.lower().strip()

    # Replace non-alphanumeric characters with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', slug)

    # Remove duplicate hyphens
    slug = re.sub(r'-+', '-', slug)

    # Strip leading/trailing hyphens
    slug = slug.strip('-')

    return slug


def is_truthy_value(value: str) -> bool:
    """
    Check if value is truthy for "Public App" column

    Truthy values:
        - "Yes", "YES", "yes"
        - "True", "TRUE", "true"
        - "1"
        - "X", "x"
        - "✓"
        - "checked"

    Args:
        value: String value to check

    Returns:
        True if truthy, False otherwise
    """
    if not value:
        return False

    value_lower = str(value).lower().strip()
    return value_lower in ['yes', 'true', '1', 'x', '✓', 'checked']


def get_language_from_country(country: str) -> str:
    """
    Determine sign language based on country

    Args:
        country: Country code or name (UK, Ireland, etc.)

    Returns:
        "BSL" for UK, "ISL" for Ireland, "BSL" as default
    """
    if not country:
        return "BSL"

    country_lower = country.lower().strip()

    if 'ireland' in country_lower or country_lower == 'ie':
        return "ISL"
    else:
        return "BSL"  # Default to BSL
