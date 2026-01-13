#!/usr/bin/env python3
"""
One-time migration script to merge VENUE_ACCESS + CONFIG → VENUES

This script:
1. Reads VENUE_ACCESS sheet (13 rows)
2. Reads CONFIG sheet (8 rows with booking guides)
3. Merges data into VENUES format
4. Generates VENUE_ID slugs
5. Populates VENUE_ALIASES from known variations
6. Sets LANGUAGE based on COUNTRY
7. Outputs JSON for Claude Code to write via MCP
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.utils import generate_venue_id, get_language_from_country


def merge_venue_access_and_config(venue_access_data, config_data):
    """
    Merge VENUE_ACCESS (13 rows) + CONFIG (8 rows) into VENUES format

    Args:
        venue_access_data: 2D array from VENUE_ACCESS sheet
        config_data: 2D array from CONFIG sheet (may be empty)

    Returns:
        List of venue rows for VENUES sheet
    """
    venues_dict = {}

    # Process VENUE_ACCESS data
    if venue_access_data and len(venue_access_data) > 1:
        headers = venue_access_data[0]
        print(f"\n📋 VENUE_ACCESS columns: {headers}")

        # Find column indices
        col_map = {}
        for i, h in enumerate(headers):
            col_map[h] = i

        for row in venue_access_data[1:]:
            if len(row) < 3:  # Need at least venue name, city, country
                continue

            venue_name = row[col_map.get('VENUE_NAME', 0)]
            if not venue_name:
                continue

            venue_id = generate_venue_id(venue_name)
            city = row[col_map.get('CITY', 1)] if col_map.get('CITY', 1) < len(row) else ""
            country = row[col_map.get('COUNTRY', 2)] if col_map.get('COUNTRY', 2) < len(row) else "UK"

            venues_dict[venue_id] = {
                'venue_id': venue_id,
                'venue_name': venue_name,
                'venue_aliases': generate_aliases(venue_name),
                'city': city,
                'country': country,
                'language': get_language_from_country(country),
                'interpreter_status': row[col_map.get('INTERPRETER_STATUS', 3)] if col_map.get('INTERPRETER_STATUS', 3) < len(row) else "",
                'access_email': row[col_map.get('ACCESS_EMAIL', 7)] if col_map.get('ACCESS_EMAIL', 7) < len(row) else "",
                'access_phone': row[col_map.get('PHONE', 9)] if col_map.get('PHONE', 9) < len(row) else "",
                'textphone': row[col_map.get('TEXTPHONE', 8)] if col_map.get('TEXTPHONE', 8) < len(row) else "",
                'vrs_provider': row[col_map.get('VRS_PROVIDER', 5)] if col_map.get('VRS_PROVIDER', 5) < len(row) else "",
                'vrs_url': row[col_map.get('VRS_URL', 6)] if col_map.get('VRS_URL', 6) < len(row) else "",
                'default_ticket_url': "",
                'default_image_url': "",
                'booking_guide_url': "",
                'access_notes': row[col_map.get('ACCESS_NOTES', 4)] if col_map.get('ACCESS_NOTES', 4) < len(row) else "",
                'official_site_url': row[col_map.get('OFFICIAL_SITE_URL', 10)] if col_map.get('OFFICIAL_SITE_URL', 10) < len(row) else ""
            }

    print(f"✅ Processed {len(venues_dict)} venues from VENUE_ACCESS")

    # Process CONFIG data (booking guides)
    if config_data and len(config_data) > 1:
        headers = config_data[0]
        print(f"\n📋 CONFIG columns: {headers}")

        # Expected columns: VENUE, HAS_BOOKING_GUIDE, BOOKING_URL, VENUE_SLUG, BOOKING_NOTE
        for row in config_data[1:]:
            if len(row) < 2:
                continue

            venue_name = row[0]  # VENUE
            if not venue_name:
                continue

            venue_id = generate_venue_id(venue_name)

            if venue_id in venues_dict:
                # Update existing venue
                if len(row) > 2:
                    venues_dict[venue_id]['default_ticket_url'] = row[2]  # BOOKING_URL
                if len(row) > 4:
                    venues_dict[venue_id]['booking_guide_url'] = row[3]  # Assuming this is the guide URL column
            else:
                # New venue from CONFIG (not in VENUE_ACCESS)
                venues_dict[venue_id] = {
                    'venue_id': venue_id,
                    'venue_name': venue_name,
                    'venue_aliases': generate_aliases(venue_name),
                    'city': '',
                    'country': 'UK',  # Default assumption
                    'language': 'BSL',
                    'interpreter_status': 'Unknown',
                    'access_email': '',
                    'access_phone': '',
                    'textphone': '',
                    'vrs_provider': '',
                    'vrs_url': '',
                    'default_ticket_url': row[2] if len(row) > 2 else "",
                    'default_image_url': '',
                    'booking_guide_url': row[3] if len(row) > 3 else "",
                    'access_notes': '',
                    'official_site_url': ''
                }

        print(f"✅ Merged with {len(config_data) - 1} CONFIG entries")

    return list(venues_dict.values())


def generate_aliases(venue_name):
    """
    Generate common aliases for a venue based on known patterns

    Args:
        venue_name: Canonical venue name

    Returns:
        JSON array string of aliases
    """
    aliases = []

    # Common variations
    name_lower = venue_name.lower()

    if 'the o2' in name_lower:
        aliases.extend(['O2 Arena', 'The O2', 'O2 London', 'The O2 Arena'])
    elif 'indigo' in name_lower and 'o2' in name_lower:
        aliases.extend(['Indigo at The O2', 'Indigo O2', 'Indigo London'])
    elif 'wembley stadium' in name_lower:
        aliases.extend(['Wembley', 'Wembley Stadium London'])
    elif 'royal albert hall' in name_lower:
        aliases.extend(['Royal Albert Hall London', 'RAH'])
    elif 'southbank centre' in name_lower:
        aliases.extend(['Southbank', 'South Bank Centre'])
    elif 'o2 academy' in name_lower:
        # Extract city from name
        for city in ['brixton', 'birmingham', 'leeds', 'glasgow']:
            if city in name_lower:
                aliases.append(f'O2 Academy {city.title()}')
                aliases.append(f'Academy {city.title()}')

    # Always include version without location suffix
    if ', ' in venue_name:
        base_name = venue_name.split(',')[0].strip()
        if base_name not in aliases:
            aliases.append(base_name)

    # Remove duplicates and empty strings
    aliases = list(dict.fromkeys([a for a in aliases if a and a != venue_name]))

    return json.dumps(aliases)


def format_for_venues_sheet(venues):
    """
    Format venue dicts into rows for VENUES sheet

    Args:
        venues: List of venue dicts

    Returns:
        2D array of venue rows
    """
    rows = []

    for venue in venues:
        row = [
            venue['venue_id'],
            venue['venue_name'],
            venue['venue_aliases'],
            venue['city'],
            venue['country'],
            venue['language'],
            venue['interpreter_status'],
            venue['access_email'],
            venue['access_phone'],
            venue['textphone'],
            venue['vrs_provider'],
            venue['vrs_url'],
            venue['default_ticket_url'],
            venue['default_image_url'],
            venue['booking_guide_url'],
            venue['access_notes'],
            venue['official_site_url']
        ]
        rows.append(row)

    return rows


def main():
    """
    Main orchestration

    Expects Claude Code to provide:
    - venue-access-data.json (from VENUE_ACCESS sheet)
    - config-data.json (from CONFIG sheet, if exists)

    Outputs:
    - venues-migrated.json (ready to write to VENUES sheet)
    """
    print("=" * 70)
    print("🔄 MIGRATE VENUE DATA")
    print("=" * 70)

    # Load VENUE_ACCESS data
    try:
        with open('migration/venue-access-data.json', 'r') as f:
            venue_access_data = json.load(f)
        print("✅ Loaded VENUE_ACCESS data")
    except FileNotFoundError:
        print("❌ Error: venue-access-data.json not found")
        print("   Claude Code must first fetch VENUE_ACCESS sheet and save to this file")
        sys.exit(1)

    # Load CONFIG data (optional)
    try:
        with open('migration/config-data.json', 'r') as f:
            config_data = json.load(f)
        print("✅ Loaded CONFIG data")
    except FileNotFoundError:
        print("⚠️  Warning: config-data.json not found, proceeding without CONFIG data")
        config_data = [[]]

    # Merge data
    venues = merge_venue_access_and_config(venue_access_data, config_data)

    # Format for sheet
    venue_rows = format_for_venues_sheet(venues)

    print(f"\n📊 SUMMARY")
    print(f"   Total venues: {len(venue_rows)}")
    print(f"\n📋 Sample venues:")
    for i, row in enumerate(venue_rows[:5], 1):
        print(f"   {i}. {row[1]} (ID: {row[0]})")
        if row[2] != '[]':
            print(f"      Aliases: {row[2]}")

    # Save output
    output = {
        'headers': [
            'VENUE_ID', 'VENUE_NAME', 'VENUE_ALIASES', 'CITY', 'COUNTRY',
            'LANGUAGE', 'INTERPRETER_STATUS', 'ACCESS_EMAIL', 'ACCESS_PHONE',
            'TEXTPHONE', 'VRS_PROVIDER', 'VRS_URL', 'DEFAULT_TICKET_URL',
            'DEFAULT_IMAGE_URL', 'BOOKING_GUIDE_URL', 'ACCESS_NOTES', 'OFFICIAL_SITE_URL'
        ],
        'rows': venue_rows
    }

    with open('migration/venues-migrated.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to: migration/venues-migrated.json")
    print(f"   Ready to write to VENUES sheet")


if __name__ == "__main__":
    main()
