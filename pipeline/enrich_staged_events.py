#!/usr/bin/env python3
"""
Job 3: Enrich STAGED_EVENTS

Enriches events with:
- Venue matching (exact → alias → fuzzy) with override support
- Derived fields (CITY, COUNTRY, LANGUAGE) - always recomputed from VENUE_ID
- Ticket URL enrichment with override support
- Image URL enrichment with override support
- Category suggestion with override support

Key behaviors:
- Override columns take precedence
- Derived fields are ALWAYS recomputed (never cached)
- Venue matching uses tiered approach: exact → alias → fuzzy
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.utils import fuzzy_match_venue
from pipeline.config import VENUE_MATCH_THRESHOLD


def get_effective_venue_id(venue_name: str, venue_id_override: str, venues_data: list) -> str:
    """
    Get effective VENUE_ID (use override if present, else match)

    Args:
        venue_name: Raw venue name from event
        venue_id_override: Manual override (if set)
        venues_data: VENUES sheet data

    Returns:
        VENUE_ID or empty string
    """
    if venue_id_override:
        return venue_id_override

    # Match venue using tiered approach (exact → alias → fuzzy)
    return fuzzy_match_venue(venue_name, venues_data, threshold=VENUE_MATCH_THRESHOLD) or ""


def get_venue_details(venue_id: str, venues_data: list) -> dict:
    """
    Lookup venue details by VENUE_ID

    Args:
        venue_id: VENUE_ID to lookup
        venues_data: VENUES sheet data

    Returns:
        Dict with venue details (city, country, language, default_ticket_url, default_image_url, access_status)
    """
    if not venue_id or not venues_data or len(venues_data) < 2:
        return {}

    headers = venues_data[0]
    col_map = {h: i for i, h in enumerate(headers)}

    for row in venues_data[1:]:
        if len(row) <= col_map.get('VENUE_ID', 0):
            continue

        if row[col_map['VENUE_ID']] == venue_id:
            return {
                'city': row[col_map.get('CITY', -1)] if col_map.get('CITY', -1) >= 0 and col_map.get('CITY', -1) < len(row) else "",
                'country': row[col_map.get('COUNTRY', -1)] if col_map.get('COUNTRY', -1) >= 0 and col_map.get('COUNTRY', -1) < len(row) else "",
                'language': row[col_map.get('LANGUAGE', -1)] if col_map.get('LANGUAGE', -1) >= 0 and col_map.get('LANGUAGE', -1) < len(row) else "",
                'default_ticket_url': row[col_map.get('DEFAULT_TICKET_URL', -1)] if col_map.get('DEFAULT_TICKET_URL', -1) >= 0 and col_map.get('DEFAULT_TICKET_URL', -1) < len(row) else "",
                'default_image_url': row[col_map.get('DEFAULT_IMAGE_URL', -1)] if col_map.get('DEFAULT_IMAGE_URL', -1) >= 0 and col_map.get('DEFAULT_IMAGE_URL', -1) < len(row) else "",
                'access_status': row[col_map.get('INTERPRETER_STATUS', -1)] if col_map.get('INTERPRETER_STATUS', -1) >= 0 and col_map.get('INTERPRETER_STATUS', -1) < len(row) else ""
            }

    return {}


def enrich_ticket_url(event_ticket_url: str, ticket_url_override: str, venue_details: dict) -> str:
    """
    Enrich TICKET_URL using hierarchy:
    1. Override (if set)
    2. Existing event URL
    3. Venue default ticket URL
    4. Empty (flag for manual review)

    Args:
        event_ticket_url: Original event URL
        ticket_url_override: Manual override
        venue_details: Venue details dict

    Returns:
        Enriched ticket URL
    """
    if ticket_url_override:
        return ticket_url_override

    if event_ticket_url:
        return event_ticket_url

    if venue_details.get('default_ticket_url'):
        return venue_details['default_ticket_url']

    return ""


def enrich_image_url(event_image_url: str, image_url_override: str, ticket_url: str, venue_details: dict, category_details: dict) -> str:
    """
    Enrich IMAGE_URL using hierarchy:
    1. Override (if set)
    2. Existing event image
    3. og:image from ticket URL (future: requires HTTP fetch)
    4. Venue default image
    5. Category default image
    6. Empty (flag for manual review)

    Note: og:image extraction is commented out for now (requires requests/BeautifulSoup)
    Can be enabled later if needed

    Args:
        event_image_url: Original event image
        image_url_override: Manual override
        ticket_url: Event ticket URL (for og:image extraction)
        venue_details: Venue details dict
        category_details: Category details dict

    Returns:
        Enriched image URL
    """
    if image_url_override:
        return image_url_override

    if event_image_url:
        return event_image_url

    # Future enhancement: Extract og:image from ticket_url
    # if ticket_url:
    #     og_image = fetch_og_image(ticket_url)
    #     if og_image:
    #         return og_image

    if venue_details.get('default_image_url'):
        return venue_details['default_image_url']

    if category_details.get('default_image_url'):
        return category_details['default_image_url']

    return ""


def suggest_category(event_name: str, categories_data: list) -> str:
    """
    Suggest CATEGORY_ID using keyword matching

    Args:
        event_name: Event name
        categories_data: EVENT_CATEGORIES sheet data

    Returns:
        Suggested CATEGORY_ID or empty string
    """
    if not categories_data or len(categories_data) < 2:
        return ""

    headers = categories_data[0]
    col_map = {h: i for i, h in enumerate(headers)}
    event_lower = event_name.lower()

    best_match = None
    best_score = 0

    for row in categories_data[1:]:
        if len(row) <= col_map.get('CATEGORY_ID', 0):
            continue

        category_id = row[col_map['CATEGORY_ID']]
        keywords_str = row[col_map.get('KEYWORDS', -1)] if col_map.get('KEYWORDS', -1) >= 0 and col_map.get('KEYWORDS', -1) < len(row) else "[]"

        # Parse keywords (JSON array)
        try:
            keywords = json.loads(keywords_str)
        except:
            keywords = [k.strip() for k in keywords_str.strip('[]').replace('"', '').split(',')]

        # Count keyword matches
        matches = sum(1 for kw in keywords if kw.lower() in event_lower)

        if matches > best_score:
            best_score = matches
            best_match = category_id

    return best_match if best_score > 0 else ""


def get_effective_category_id(category_suggestion: str, category_override: str) -> str:
    """
    Get effective CATEGORY_ID (use override if present, else suggestion)

    Args:
        category_suggestion: Auto-suggested category
        category_override: Manual override

    Returns:
        Effective CATEGORY_ID
    """
    return category_override if category_override else category_suggestion


def get_category_details(category_id: str, categories_data: list) -> dict:
    """
    Lookup category details by CATEGORY_ID

    Args:
        category_id: CATEGORY_ID to lookup
        categories_data: EVENT_CATEGORIES sheet data

    Returns:
        Dict with category details
    """
    if not category_id or not categories_data or len(categories_data) < 2:
        return {}

    headers = categories_data[0]
    col_map = {h: i for i, h in enumerate(headers)}

    for row in categories_data[1:]:
        if len(row) <= col_map.get('CATEGORY_ID', 0):
            continue

        if row[col_map['CATEGORY_ID']] == category_id:
            return {
                'default_image_url': row[col_map.get('DEFAULT_IMAGE_URL', -1)] if col_map.get('DEFAULT_IMAGE_URL', -1) >= 0 and col_map.get('DEFAULT_IMAGE_URL', -1) < len(row) else ""
            }

    return {}


def enrich_events(staged_events_data: list, venues_data: list, categories_data: list) -> list:
    """
    Enrich all events in STAGED_EVENTS

    Key behaviors:
    - Use overrides when present
    - ALWAYS recompute derived fields (CITY, COUNTRY, LANGUAGE) from effective VENUE_ID
    - Match venues using tiered approach (exact → alias → fuzzy)

    Args:
        staged_events_data: STAGED_EVENTS sheet data
        venues_data: VENUES sheet data
        categories_data: EVENT_CATEGORIES sheet data

    Returns:
        Enriched rows
    """
    if not staged_events_data or len(staged_events_data) < 2:
        return staged_events_data

    headers = staged_events_data[0]
    col_map = {h: i for i, h in enumerate(headers)}
    enriched_rows = [headers]

    print(f"\n🔧 Enriching events...")

    matched_count = 0
    unmatched_count = 0

    for i, row in enumerate(staged_events_data[1:], start=2):
        # Get effective VENUE_ID (override or matched)
        venue_name = row[col_map.get('VENUE_NAME', -1)]
        venue_id_override = row[col_map.get('VENUE_ID_OVERRIDE', -1)] if col_map.get('VENUE_ID_OVERRIDE', -1) >= 0 and col_map.get('VENUE_ID_OVERRIDE', -1) < len(row) else ""

        effective_venue_id = get_effective_venue_id(venue_name, venue_id_override, venues_data)

        if effective_venue_id:
            matched_count += 1
            venue_details = get_venue_details(effective_venue_id, venues_data)

            # ALWAYS recompute derived fields from VENUE_ID
            row[col_map['VENUE_ID']] = effective_venue_id
            row[col_map['CITY']] = venue_details.get('city', "")
            row[col_map['COUNTRY']] = venue_details.get('country', "")
            row[col_map['LANGUAGE']] = venue_details.get('language', "")

            # Enrich ACCESS_STATUS if not already set
            if not row[col_map.get('ACCESS_STATUS', -1)]:
                row[col_map['ACCESS_STATUS']] = venue_details.get('access_status', "")
        else:
            unmatched_count += 1
            print(f"   ⚠️  Row {i}: Could not match venue: {venue_name}")
            venue_details = {}

        # Suggest category if not already set
        event_name = row[col_map.get('EVENT_NAME', -1)]
        existing_category_suggestion = row[col_map.get('CATEGORY_SUGGESTION', -1)]

        if not existing_category_suggestion:
            suggested_category = suggest_category(event_name, categories_data)
            row[col_map['CATEGORY_SUGGESTION']] = suggested_category
        else:
            suggested_category = existing_category_suggestion

        # Get effective CATEGORY_ID (override or suggestion)
        category_override = row[col_map.get('CATEGORY_OVERRIDE', -1)] if col_map.get('CATEGORY_OVERRIDE', -1) >= 0 and col_map.get('CATEGORY_OVERRIDE', -1) < len(row) else ""
        effective_category_id = get_effective_category_id(suggested_category, category_override)

        row[col_map['CATEGORY_ID']] = effective_category_id

        # Get category details for image fallback
        category_details = get_category_details(effective_category_id, categories_data)

        # Enrich TICKET_URL
        event_ticket_url = row[col_map.get('TICKET_URL', -1)]
        ticket_url_override = row[col_map.get('TICKET_URL_OVERRIDE', -1)] if col_map.get('TICKET_URL_OVERRIDE', -1) >= 0 and col_map.get('TICKET_URL_OVERRIDE', -1) < len(row) else ""
        enriched_ticket_url = enrich_ticket_url(event_ticket_url, ticket_url_override, venue_details)

        row[col_map['TICKET_URL']] = enriched_ticket_url

        # Enrich IMAGE_URL
        event_image_url = row[col_map.get('IMAGE_URL', -1)]
        image_url_override = row[col_map.get('IMAGE_URL_OVERRIDE', -1)] if col_map.get('IMAGE_URL_OVERRIDE', -1) >= 0 and col_map.get('IMAGE_URL_OVERRIDE', -1) < len(row) else ""
        enriched_image_url = enrich_image_url(event_image_url, image_url_override, enriched_ticket_url, venue_details, category_details)

        row[col_map['IMAGE_URL']] = enriched_image_url

        enriched_rows.append(row)

    print(f"\n✅ Enrichment complete:")
    print(f"   Venues matched: {matched_count}")
    print(f"   Venues unmatched: {unmatched_count}")

    return enriched_rows


def main():
    """
    Main orchestration

    Expects:
        - staged-events-data.json (from STAGED_EVENTS sheet)
        - venues-data.json (from VENUES sheet)
        - categories-data.json (from EVENT_CATEGORIES sheet)

    Outputs:
        - enriched-staged-events-output.json (ready to update STAGED_EVENTS sheet)
    """
    print("=" * 70)
    print("🎨 JOB 3: ENRICH STAGED_EVENTS")
    print("=" * 70)

    # Load data
    try:
        with open('staged-events-data.json', 'r') as f:
            staged_events_data = json.load(f)
        with open('venues-data.json', 'r') as f:
            venues_data = json.load(f)
        with open('categories-data.json', 'r') as f:
            categories_data = json.load(f)
        print("✅ Loaded all data sources")
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

    # Enrich
    enriched_rows = enrich_events(staged_events_data, venues_data, categories_data)

    print(f"\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"=" * 70)
    print(f"   Total events enriched: {len(enriched_rows) - 1}")

    # Save output
    with open('enriched-staged-events-output.json', 'w') as f:
        json.dump(enriched_rows, f, indent=2)

    print(f"\n💾 Output saved to: enriched-staged-events-output.json")
    print(f"   Ready to update STAGED_EVENTS sheet")


if __name__ == "__main__":
    main()
