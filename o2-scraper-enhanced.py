#!/usr/bin/env python3
"""
O2 Arena Enhanced Event Scraper with Playwright
Fetches ALL upcoming events from The O2 (handles dynamic "Load More" button)
Partnership: O2 events listed as "Request Interpreter"
"""

import asyncio
import json
from datetime import datetime
from typing import List, Dict
import sys
import os

# Check if playwright is available
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("⚠️  Playwright not installed. Install with: pip install playwright && playwright install chromium")

from bs4 import BeautifulSoup

# Configuration
O2_EVENTS_URL = "https://www.theo2.co.uk/events"
SPREADSHEET_ID = "1JyyEYBc9iliYw7q4lbNqcLEOHwZV64WUYwce87JaBk8"


class O2EnhancedScraper:
    """Enhanced scraper using Playwright to handle dynamic content"""

    async def fetch_all_events_html(self) -> str:
        """
        Use Playwright to load page and click 'Load More' until all events are loaded
        Returns: Full HTML with all events
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError("Playwright is required for enhanced scraping")

        print(f"🌐 Opening browser to fetch O2 events...")

        async with async_playwright() as p:
            # Launch browser (headless mode)
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            print(f"📡 Navigating to {O2_EVENTS_URL}...")
            await page.goto(O2_EVENTS_URL, wait_until="networkidle")

            # Wait for events to load
            await page.wait_for_timeout(2000)

            # Handle cookie consent dialog if present
            try:
                print("🍪 Checking for cookie consent dialog...")
                # Try to find and click "Accept All" or "Reject All" buttons
                accept_button = await page.query_selector('button:has-text("Accept All Cookies")')
                if not accept_button:
                    accept_button = await page.query_selector('button:has-text("Accept All")')
                if not accept_button:
                    accept_button = await page.query_selector('#onetrust-accept-btn-handler')
                if not accept_button:
                    # Try reject button
                    accept_button = await page.query_selector('button:has-text("Reject All")')

                if accept_button:
                    await accept_button.click()
                    print("✅ Dismissed cookie dialog")
                    await page.wait_for_timeout(1000)
            except Exception as e:
                print(f"ℹ️  No cookie dialog or already handled: {e}")

            # Click "Load More" button repeatedly until it disappears
            load_more_count = 0
            max_attempts = 50  # Safety limit

            while load_more_count < max_attempts:
                try:
                    # Look for "Load More" button (try various selectors)
                    load_more_button = await page.query_selector('button:has-text("Load More")')

                    if not load_more_button:
                        load_more_button = await page.query_selector('a:has-text("Load More")')

                    if not load_more_button:
                        # Also try case variations
                        load_more_button = await page.query_selector('button:has-text("load more")')

                    if load_more_button:
                        # Check if button is visible and enabled
                        is_visible = await load_more_button.is_visible()
                        is_enabled = await load_more_button.is_enabled()

                        if is_visible and is_enabled:
                            print(f"🔄 Clicking 'Load More' (attempt {load_more_count + 1})...")
                            await load_more_button.click()
                            load_more_count += 1

                            # Wait for new content to load
                            await page.wait_for_timeout(1500)
                        else:
                            print("✅ 'Load More' button no longer active")
                            break
                    else:
                        print("✅ No 'Load More' button found - all events loaded")
                        break

                except Exception as e:
                    print(f"⚠️  Could not click 'Load More': {e}")
                    break

            # Get the full HTML
            html = await page.content()

            await browser.close()

            print(f"✅ Page loaded successfully ({len(html)} bytes)")
            print(f"📊 Clicked 'Load More' {load_more_count} times")

            # Save HTML for debugging
            with open('o2-page-full.html', 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"💾 Saved full HTML to o2-page-full.html for inspection")

            return html

    def parse_event_date(self, date_str: str) -> str:
        """Parse datetime to YYYY-MM-DD (handles both ISO and human-readable formats)"""
        if not date_str:
            return None

        try:
            # Try ISO datetime format first (for JSON-LD)
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass

        try:
            # Try human-readable format: "9 Dec 2025" or "9 December 2025"
            for fmt in ["%d %b %Y", "%d %B %Y"]:
                try:
                    dt = datetime.strptime(date_str.strip(), fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        except Exception:
            pass

        return None

    def detect_category(self, event_name: str, event_type: str = None) -> str:
        """
        Smart category detection - avoids false positives from simple substring matching.
        Uses JSON-LD @type when available, then pattern matching for specific keywords.
        """
        name_lower = event_name.lower()

        # First, trust JSON-LD event type if provided
        if event_type:
            if event_type == 'TheaterEvent':
                return 'Theatre'
            elif event_type == 'SportsEvent':
                return 'Sports'
            elif event_type == 'ComedyEvent':
                return 'Comedy'

        # SPORTS: Must be actual sporting events, not just "sport" in name
        # Look for specific sports keywords that are unambiguous
        sports_keywords = [
            'boxing',
            'ufc',
            'mma',
            'wrestling',  # but not "wrestling with" metaphorically
            'premier league',
            'champions league',
            'football match',
            'darts',
            'snooker',
            'world championship',
            'vs ',  # "Fighter vs Fighter" pattern
            ' v ',   # UK style "Fighter v Fighter"
            'fight night',
            'cage warriors',
        ]

        for keyword in sports_keywords:
            if keyword in name_lower:
                return 'Sports'

        # COMEDY: Look for comedy-specific indicators
        comedy_keywords = [
            'comedy',
            'stand-up',
            'standup',
            'stand up',
            'comedian',
            'live comedy',
        ]

        # Known comedians who perform at O2
        known_comedians = [
            'michael mcintyre',
            'kevin hart',
            'dave chappelle',
            'ricky gervais',
            'jimmy carr',
            'peter kay',
            'lee mack',
            'jack whitehall',
            'russell howard',
            'romesh ranganathan',
            'rob beckett',
        ]

        for keyword in comedy_keywords:
            if keyword in name_lower:
                return 'Comedy'

        for comedian in known_comedians:
            if comedian in name_lower:
                return 'Comedy'

        # THEATRE: Musicals and theatrical productions
        theatre_keywords = [
            'musical',
            'theatre',
            'theater',
            'the musical',
            'west end',
            'broadway',
            'ballet',
            'opera',
            'cirque',
            'disney on ice',
        ]

        for keyword in theatre_keywords:
            if keyword in name_lower:
                return 'Theatre'

        # Default to Concert for music events at O2
        return 'Concert'

    def extract_events_from_html(self, html: str) -> List[Dict]:
        """
        Extract events from full HTML using both JSON-LD and HTML parsing
        """
        soup = BeautifulSoup(html, 'html.parser')
        events_by_url = {}  # Use dict to dedupe by URL

        # Method 1: JSON-LD structured data
        print("🔍 Extracting events from JSON-LD structured data...")
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
                    # Look for event types
                    event_type = item.get('@type', '')

                    if event_type in ['MusicEvent', 'TheaterEvent', 'Event']:
                        # Extract details
                        event_name = item.get('name', '')

                        # Filter out Strictly Come Dancing
                        if 'strictly come dancing' in event_name.lower():
                            continue

                        start_date = item.get('startDate', '')

                        # Extract location
                        location = item.get('location', {})
                        venue_name = location.get('name', 'The O2 Arena, London')

                        # Only O2 venues
                        if 'O2' not in venue_name and 'o2' not in venue_name:
                            continue

                        # Determine venue
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

                        # Parse date/time
                        event_date = self.parse_event_date(start_date) if start_date else None
                        event_time = ''
                        if start_date:
                            try:
                                dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                                event_time = dt.strftime("%H:%M")
                            except Exception:
                                pass

                        # Determine category using smarter detection
                        category = self.detect_category(event_name, event_type)

                        # Extract performer if available
                        artist_name = ''
                        if 'performer' in item:
                            performer = item['performer']
                            if isinstance(performer, dict):
                                artist_name = performer.get('name', '')
                            elif isinstance(performer, list) and performer:
                                artist_name = performer[0].get('name', '') if isinstance(performer[0], dict) else ''

                        # Create event object
                        event = {
                            'event_name': event_name,
                            'artist_name': artist_name,
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

                        # Only add if we have essential data and add to dict by URL
                        if event['event_name'] and event['event_date'] and event['event_url']:
                            events_by_url[event['event_url']] = event

            except json.JSONDecodeError as e:
                print(f"⚠️  Could not parse JSON-LD: {e}")
                continue
            except Exception as e:
                print(f"⚠️  Error processing JSON-LD: {e}")
                continue

        print(f"✅ JSON-LD: Found {len(events_by_url)} unique events")

        # Method 2: HTML event cards (to catch dynamically loaded events)
        print("🔍 Extracting events from HTML event cards...")

        # Find event containers (the div that wraps each event)
        event_containers = soup.find_all('div', class_=lambda c: c and 'eventItem' in str(c))
        print(f"📋 Found {len(event_containers)} event containers")

        html_dates_found = 0
        for idx, container in enumerate(event_containers):
            try:
                # Extract event URL from any link in the container
                link = container.find('a', href=lambda h: h and '/events/detail/' in h)
                if not link:
                    continue

                event_url = link.get('href', '')
                if event_url and not event_url.startswith('http'):
                    event_url = f"https://www.theo2.co.uk{event_url}"

                # Skip if already captured from JSON-LD
                if event_url in events_by_url:
                    continue

                # Extract event name from h3.title
                event_name = ''
                title_elem = container.find('h3', class_='title')
                if title_elem:
                    # Get the link text inside the h3
                    link_elem = title_elem.find('a')
                    if link_elem:
                        event_name = link_elem.get_text(strip=True)

                if not event_name:
                    continue

                # Filter out Strictly Come Dancing
                if 'strictly come dancing' in event_name.lower():
                    continue

                # Clean up event name - remove "More Info for" prefix
                if event_name.startswith('More Info for '):
                    event_name = event_name.replace('More Info for ', '')
                if event_name.startswith('Book Tickets for '):
                    event_name = event_name.replace('Book Tickets for ', '')

                # Extract image
                image_url = ''
                img = container.find('img')
                if img:
                    image_url = img.get('src', '') or img.get('data-src', '')
                    if image_url and not image_url.startswith('http'):
                        image_url = f"https://www.theo2.co.uk{image_url}"

                # Extract date and time using O2's specific structure
                event_date = None
                event_time = ''

                # Look for time element
                time_elem = container.find('span', class_='time')
                if not time_elem:
                    time_elem = container.find('span', class_='m-date__time')
                if time_elem:
                    event_time = time_elem.get_text(strip=True)

                date_container = container.find('div', class_=lambda c: c and 'date' in str(c).lower())
                if date_container:
                    # O2 uses nested spans - look inside m-date__singleDate or m-date__rangeFirst
                    single_date = date_container.find('span', class_='m-date__singleDate')
                    is_range = False
                    if not single_date:
                        # Try range date (use first date of range)
                        single_date = date_container.find('span', class_='m-date__rangeFirst')
                        is_range = True

                    if single_date:
                        # Extract day, month from the nested structure
                        day_elem = single_date.find('span', class_='m-date__day')
                        month_elem = single_date.find('span', class_='m-date__month')

                        # Year handling differs for single vs range dates
                        year_elem = single_date.find('span', class_='m-date__year')
                        if not year_elem:
                            if is_range:
                                # For range dates, year is in m-date__rangeLast
                                range_last = date_container.find('span', class_='m-date__rangeLast')
                                if range_last:
                                    year_elem = range_last.find('span', class_='m-date__year')
                            else:
                                # For single dates, year might be in parent
                                year_elem = date_container.find('span', class_='m-date__year')

                        if day_elem and month_elem and year_elem:
                            day = day_elem.get_text(strip=True)
                            month = month_elem.get_text(strip=True)
                            year = year_elem.get_text(strip=True)

                            # Construct date string and parse
                            date_str = f"{day} {month} {year}"
                            event_date = self.parse_event_date(date_str)

                            if event_date:
                                html_dates_found += 1

                # Extract venue from location element
                full_venue = 'The O2 Arena, London'  # Default
                location_elem = container.find('div', class_='location')
                if location_elem:
                    venue_text = location_elem.get_text(strip=True).lower()
                    if 'indigo' in venue_text:
                        full_venue = 'indigo at The O2, London'

                # Only add if we have at least name and URL
                if event_name and event_url:

                    # Determine category using smarter detection
                    category = self.detect_category(event_name)

                    event = {
                        'event_name': event_name,
                        'artist_name': '',
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

                    events_by_url[event_url] = event

            except Exception as e:
                print(f"⚠️  Error parsing HTML card: {e}")
                continue

        print(f"✅ HTML cards: Added {len(events_by_url) - 5} new events ({html_dates_found} with dates from HTML)")

        # Convert dict to list
        events = list(events_by_url.values())

        # Sort by date (put events without dates at the end)
        events.sort(key=lambda x: x['event_date'] if x['event_date'] else '9999-99-99')

        print(f"✅ Total extracted: {len(events)} unique events")

        return events

    async def fetch_event_detail_page(self, event_url: str) -> str:
        """Fetch individual event detail page"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(event_url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(1000)
                html = await page.content()
                await browser.close()
                return html
            except Exception as e:
                print(f"⚠️  Failed to fetch {event_url}: {e}")
                await browser.close()
                return ""

    def extract_date_from_detail_page(self, html: str) -> str:
        """Extract date from individual event detail page"""
        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')

        # Try JSON-LD first
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    items = data
                else:
                    items = [data]

                for item in items:
                    if item.get('@type') in ['MusicEvent', 'TheaterEvent', 'Event']:
                        start_date = item.get('startDate', '')
                        if start_date:
                            return self.parse_event_date(start_date)
            except Exception:
                continue

        # Try HTML date structure
        date_container = soup.find('div', class_=lambda c: c and 'date' in str(c).lower())
        if date_container:
            single_date = date_container.find('span', class_='m-date__singleDate')
            is_range = False
            if not single_date:
                single_date = date_container.find('span', class_='m-date__rangeFirst')
                is_range = True

            if single_date:
                day_elem = single_date.find('span', class_='m-date__day')
                month_elem = single_date.find('span', class_='m-date__month')
                year_elem = single_date.find('span', class_='m-date__year')

                if not year_elem:
                    if is_range:
                        range_last = date_container.find('span', class_='m-date__rangeLast')
                        if range_last:
                            year_elem = range_last.find('span', class_='m-date__year')
                    else:
                        year_elem = date_container.find('span', class_='m-date__year')

                if day_elem and month_elem and year_elem:
                    day = day_elem.get_text(strip=True)
                    month = month_elem.get_text(strip=True)
                    year = year_elem.get_text(strip=True)
                    date_str = f"{day} {month} {year}"
                    return self.parse_event_date(date_str)

        return None

    async def fill_missing_dates(self, events: List[Dict]) -> tuple:
        """
        Fetch individual event pages for events missing dates
        Returns: (events_with_dates, events_without_dates, filled_count)
        """
        events_without_dates = [e for e in events if not e['event_date']]

        if not events_without_dates:
            return events, [], 0

        print(f"\n🔍 Fetching detail pages for {len(events_without_dates)} event(s) with missing dates...")

        filled_count = 0
        still_missing = []

        for event in events_without_dates:
            print(f"   Fetching: {event['event_name'][:50]}...")

            # Fetch detail page
            html = await self.fetch_event_detail_page(event['event_url'])

            # Try to extract date
            date = self.extract_date_from_detail_page(html)

            if date:
                event['event_date'] = date
                filled_count += 1
                print(f"   ✅ Found date: {date}")
            else:
                still_missing.append(event)
                print(f"   ❌ No date found")

            # Small delay to be polite
            await asyncio.sleep(0.5)

        print(f"\n✅ Fallback complete: {filled_count} date(s) found, {len(still_missing)} still missing")

        return events, still_missing, filled_count

    async def scrape_all_events(self) -> tuple:
        """
        Main async scraping method
        Returns: (events, events_without_dates, fallback_count)
        """
        html = await self.fetch_all_events_html()
        events = self.extract_events_from_html(html)

        # Try to fill missing dates via fallback
        events, events_without_dates, fallback_count = await self.fill_missing_dates(events)

        return events, events_without_dates, fallback_count


async def main():
    """Run the enhanced scraper"""
    print("=" * 70)
    print("🎭 O2 ARENA ENHANCED EVENT SCRAPER (with Load More automation)")
    print("=" * 70)

    if not PLAYWRIGHT_AVAILABLE:
        print("\n❌ ERROR: Playwright is not installed")
        print("\nTo install:")
        print("  pip install playwright")
        print("  playwright install chromium")
        sys.exit(1)

    scraper = O2EnhancedScraper()

    try:
        events, events_without_dates, fallback_count = await scraper.scrape_all_events()

        # Calculate stats
        with_dates = [e for e in events if e['event_date']]
        json_ld_dates = 5  # We know 5 come from JSON-LD
        html_dates = len(with_dates) - json_ld_dates - fallback_count

        print("\n" + "=" * 70)
        print(f"📊 SCRAPING COMPLETE")
        print("=" * 70)
        print(f"Total events: {len(events)}")
        print(f"  ✅ With dates: {len(with_dates)} ({len(with_dates)/len(events)*100:.1f}%)")
        print(f"     - From JSON-LD: {json_ld_dates}")
        print(f"     - From HTML: {html_dates}")
        if fallback_count > 0:
            print(f"     - From fallback: {fallback_count}")
        if events_without_dates:
            print(f"  ❌ Without dates: {len(events_without_dates)}")
            for e in events_without_dates:
                print(f"     - {e['event_name']}")

        # Display sample events
        print(f"\n📋 Sample events:")
        for i, event in enumerate(with_dates[:5], 1):
            print(f"\n{i}. {event['event_name']}")
            print(f"   Date: {event['event_date']} {event['event_time']}")
            print(f"   Venue: {event['venue_name']}")
            print(f"   Category: {event['category']}")

        if len(events) > 5:
            print(f"\n... and {len(events) - 5} more events")

        # Save to JSON
        output_file = "o2-events-all.json"
        with open(output_file, 'w') as f:
            json.dump(events, f, indent=2)
        print(f"\n💾 All events saved to {output_file}")

        return events, events_without_dates

    except Exception as e:
        print(f"\n❌ Scraping failed: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(main())
