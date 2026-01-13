#!/usr/bin/env python3
"""
O2 Arena Event Scraper
Fetches upcoming events from The O2 and adds them to PRE-APPROVED EVENTS sheet
Partnership: O2 events listed as "Request Interpreter"
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import json
import re
from typing import List, Dict, Optional
import time

# Configuration
O2_EVENTS_URL = "https://www.theo2.co.uk/events"
SPREADSHEET_ID = "1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


class O2EventScraper:
    """Scrapes events from The O2 website"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})

    def fetch_events_page(self) -> str:
        """Fetch the O2 events listing page"""
        print(f"📡 Fetching O2 events from {O2_EVENTS_URL}...")
        try:
            response = self.session.get(O2_EVENTS_URL, timeout=30)
            response.raise_for_status()
            print(f"✅ Successfully fetched page ({len(response.text)} bytes)")
            return response.text
        except requests.RequestException as e:
            print(f"❌ Failed to fetch O2 events page: {e}")
            raise

    def parse_event_date(self, date_str: str) -> Optional[str]:
        """
        Parse O2 date format to ISO date
        Examples: "5 Dec 2025", "9 Dec - 14 Dec 2025"
        Returns: ISO date (YYYY-MM-DD) or None
        """
        if not date_str:
            return None

        try:
            # Clean up the date string
            date_str = date_str.strip()

            # Handle date ranges - take the first date
            if ' - ' in date_str:
                date_str = date_str.split(' - ')[0].strip()
                # Add year if not present (e.g., "9 Dec" from "9 Dec - 14 Dec 2025")
                parts = date_str.split()
                if len(parts) == 2:  # Just "9 Dec"
                    # Get year from the end of original string
                    year_match = re.search(r'(\d{4})', date_str)
                    if year_match:
                        date_str = f"{date_str} {year_match.group(1)}"
                    else:
                        # Assume current/next year
                        date_str = f"{date_str} {datetime.now().year}"

            # Parse formats like "5 Dec 2025"
            for fmt in ["%d %b %Y", "%d %B %Y"]:
                try:
                    parsed = datetime.strptime(date_str, fmt)
                    return parsed.strftime("%Y-%m-%d")
                except ValueError:
                    continue

            print(f"⚠️ Could not parse date: {date_str}")
            return None

        except Exception as e:
            print(f"⚠️ Date parsing error for '{date_str}': {e}")
            return None

    def extract_events(self, html: str) -> List[Dict]:
        """
        Extract event data from HTML using JSON-LD structured data
        Returns list of event dictionaries
        """
        soup = BeautifulSoup(html, 'html.parser')
        events = []

        print("🔍 Parsing events from JSON-LD structured data...")

        # Find all JSON-LD script tags
        json_ld_scripts = soup.find_all('script', type='application/ld+json')

        print(f"📋 Found {len(json_ld_scripts)} JSON-LD blocks")

        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)

                # Handle both single objects and lists
                if isinstance(data, list):
                    items = data
                else:
                    items = [data]

                for item in items:
                    # Look for MusicEvent or TheaterEvent types
                    event_type = item.get('@type', '')

                    if event_type in ['MusicEvent', 'TheaterEvent', 'Event']:
                        # Extract event details
                        event_name = item.get('name', '')
                        start_date = item.get('startDate', '')

                        # Extract location
                        location = item.get('location', {})
                        venue_name = location.get('name', 'The O2 Arena, London')

                        # Only include events at The O2 (main arena or indigo)
                        if 'O2' not in venue_name and 'o2' not in venue_name:
                            continue

                        # Determine specific venue
                        if 'indigo' in venue_name.lower():
                            full_venue = 'indigo at The O2, London'
                        else:
                            full_venue = 'The O2 Arena, London'

                        # Extract URL
                        event_url = item.get('url', '')
                        if event_url and not event_url.startswith('http'):
                            event_url = f"https://www.theo2.co.uk{event_url}"

                        # Extract image
                        image_url = item.get('image', '')
                        if isinstance(image_url, list):
                            image_url = image_url[0] if image_url else ''

                        # Parse date
                        event_date = None
                        event_time = ''
                        if start_date:
                            try:
                                # Handle ISO datetime format
                                dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                                event_date = dt.strftime("%Y-%m-%d")
                                event_time = dt.strftime("%H:%M")
                            except Exception as e:
                                print(f"⚠️ Could not parse date '{start_date}': {e}")
                                # Try to parse just date
                                event_date = self.parse_event_date(start_date)

                        # Determine category from event type
                        category = 'Concert'
                        if event_type == 'TheaterEvent':
                            category = 'Theatre'
                        elif 'sport' in event_name.lower() or 'game' in event_name.lower():
                            category = 'Sports'
                        elif 'comedy' in event_name.lower():
                            category = 'Comedy'

                        # Create event object
                        event = {
                            'event_name': event_name,
                            'artist_name': item.get('performer', {}).get('name', '') if isinstance(item.get('performer'), dict) else '',
                            'venue_name': full_venue,
                            'city': 'London',
                            'country': 'UK',
                            'event_date': event_date,
                            'event_time': event_time,
                            'event_url': event_url,
                            'image_url': image_url,
                            'access_status': 'Request Interpreter',
                            'category': category,
                            'source': 'O2 Auto Import',
                            'notes': 'PI has agreement with The O2 – interpreters on request, not automatically booked.',
                            'added_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }

                        # Only add if we have at least name, date, and URL
                        if event['event_name'] and event['event_date'] and event['event_url']:
                            events.append(event)

            except json.JSONDecodeError as e:
                print(f"⚠️ Could not parse JSON-LD: {e}")
                continue
            except Exception as e:
                print(f"⚠️ Error processing JSON-LD block: {e}")
                continue

        print(f"✅ Successfully parsed {len(events)} events")
        return events

    def scrape_events(self) -> List[Dict]:
        """Main scraping method"""
        html = self.fetch_events_page()
        events = self.extract_events(html)
        return events


def main():
    """Run the scraper"""
    print("=" * 60)
    print("🎭 O2 ARENA EVENT SCRAPER")
    print("=" * 60)

    scraper = O2EventScraper()

    try:
        events = scraper.scrape_events()

        print("\n" + "=" * 60)
        print(f"📊 SCRAPING COMPLETE: {len(events)} events found")
        print("=" * 60)

        # Display first few events
        for i, event in enumerate(events[:5], 1):
            print(f"\n{i}. {event['event_name']}")
            print(f"   Date: {event['event_date']}")
            print(f"   URL: {event['event_url'][:60]}...")

        if len(events) > 5:
            print(f"\n... and {len(events) - 5} more events")

        # Save to JSON for inspection
        output_file = "o2-events-scraped.json"
        with open(output_file, 'w') as f:
            json.dump(events, f, indent=2)
        print(f"\n💾 Events saved to {output_file}")

        return events

    except Exception as e:
        print(f"\n❌ Scraping failed: {e}")
        raise


if __name__ == "__main__":
    main()
