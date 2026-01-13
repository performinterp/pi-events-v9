#!/usr/bin/env python3
"""
Restructure PI Work Flow PRE_APPROVED EVENTS sheet
Combines existing manually-added events + O2 scraped events with rich metadata structure
"""

import json
from datetime import datetime

# New rich header structure
NEW_HEADERS = [
    "EVENT_NAME", "ARTIST_NAME", "VENUE_NAME", "CITY", "COUNTRY",
    "EVENT_DATE", "EVENT_TIME", "EVENT_URL", "IMAGE_URL",
    "ACCESS_STATUS", "CATEGORY", "SOURCE", "NOTES", "ADDED_DATE"
]

def normalize_date_to_iso(date_str):
    """Convert DD.MM.YY to YYYY-MM-DD"""
    if not date_str:
        return ""

    # Already in YYYY-MM-DD format
    if len(date_str) == 10 and date_str[4] == '-':
        return date_str

    # Handle DD.MM.YY format
    if '.' in date_str:
        parts = date_str.split('.')
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    return date_str


def transform_existing_event(row):
    """
    Transform existing PI Work Flow event to new format
    Old: DATE, EVENT, VENUE, TIME, INTERPRETERS, NOTES, (extra unlabeled cols for images/urls)
    New: EVENT_NAME, ARTIST_NAME, VENUE_NAME, CITY, COUNTRY, EVENT_DATE, EVENT_TIME,
         EVENT_URL, IMAGE_URL, ACCESS_STATUS, CATEGORY, SOURCE, NOTES, ADDED_DATE
    """
    # Extract values (handle variable-length rows)
    date = row[0] if len(row) > 0 else ""
    event_name = row[1] if len(row) > 1 else ""
    venue = row[2] if len(row) > 2 else ""
    time = row[3] if len(row) > 3 else ""
    interpreters = row[4] if len(row) > 4 else ""
    notes_col = row[5] if len(row) > 5 else ""
    category = row[6] if len(row) > 6 else ""
    image_url = row[7] if len(row) > 7 else ""
    event_url = row[8] if len(row) > 8 else ""

    # Infer country from venue/city
    country = "UK"
    if "ireland" in venue.lower():
        country = "Ireland"

    # Build notes combining interpreter info + category notes
    notes_parts = []
    if interpreters and interpreters != "TBC":
        notes_parts.append(f"Interpreters: {interpreters}")
    if category and category not in ["Concert", "BSL", "ISL"]:
        notes_parts.append(category)
    notes = " | ".join(notes_parts) if notes_parts else ""

    # Determine ACCESS_STATUS
    access_status = notes_col if notes_col in ["BSL", "ISL"] else "TBC"

    # Determine CATEGORY (simplify)
    if "festival" in category.lower():
        category_clean = "Festival"
    elif category == "Concert":
        category_clean = "Concert"
    else:
        category_clean = category if category else "Event"

    return [
        event_name,           # EVENT_NAME
        "",                   # ARTIST_NAME (not in old data)
        venue,                # VENUE_NAME
        venue,                # CITY (same as venue for now)
        country,              # COUNTRY
        normalize_date_to_iso(date),  # EVENT_DATE
        time,                 # EVENT_TIME
        event_url,            # EVENT_URL
        image_url,            # IMAGE_URL
        access_status,        # ACCESS_STATUS
        category_clean,       # CATEGORY
        "Manual Entry",       # SOURCE
        notes,                # NOTES
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # ADDED_DATE
    ]


def transform_o2_event(row):
    """
    Transform O2 event to new format (already mostly in correct format)
    Update ACCESS_STATUS to "Request Interpreter"
    """
    # O2 events already have: EVENT_NAME, ARTIST_NAME, VENUE_NAME, CITY, COUNTRY,
    # EVENT_DATE, EVENT_TIME, EVENT_URL, IMAGE_URL, ACCESS_STATUS, CATEGORY, SOURCE, NOTES, ADDED_DATE

    transformed = row.copy()

    # Update ACCESS_STATUS to new text (index 9)
    if len(transformed) > 9:
        transformed[9] = "Request Interpreter"

    return transformed


def main():
    print("=" * 70)
    print("RESTRUCTURING PI WORK FLOW PRE_APPROVED EVENTS")
    print("=" * 70)

    # Load existing PI Work Flow data
    existing_data = [
        ["DATE","EVENT","VENUE","TIME","INTERPRETERS","NOTES"],
        ["30.05.26","Mighty Hoopla","London","2 Days","TBC","BSL","Non-Camping Festival","https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgRxOkwq0J3cZWkaljs5wTAtM5sV5f1Q1WLg&s","https://mightyhoopla.com/"],
        ["10.06.26","Download Festival","Derby","5 Days","TBC","BSL","Camping Festival","https://downloadfestival.co.uk/assets/images/2026/DLXXIII-stack-logo.png","https://downloadfestival.co.uk/"],
        ["03.07.26","Roundhay Festival","Leeds","2 Days","TBC","BSL","Non-Camping Festival","https://scontent-lhr8-2.xx.fbcdn.net/v/t39.30808-6/547915821_122095806861021551_7302893009334833033_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=rDtpjoY0KVAQ7kNvwHHLoLN&_nc_oc=Adl85iMh-FyKsPM-UM4FmqnBmUetBlEz-GusyCyw6AbyrVOB3IWdsY088qucFNq1rRQzpJ6Mm3_3JXT49Yr4tbT3&_nc_zt=23&_nc_ht=scontent-lhr8-2.xx&_nc_gid=oem8jJv7bJiLe7HrFz2LzQ&oh=00_Afi12zfzRPlrvdWYM3dyK_FF7RCdPdrnYiZzhYjRNl-vvQ&oe=6915065D","https://www.roundhayfestival.com/"],
        ["08.07.26","My Chemical Romance","Wembley Stadium","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["10.07.26","My Chemical Romance","Wembley Stadium","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["11.07.26","My Chemical Romance","Wembley Stadium","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["31.07.26","Luke Combs","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["01.08.26","Brighton Pride","Brighton","2 Days","TBC","BSL","Non-Camping Festival","https://www.brighton-pride.org/wp-content/uploads/2022/01/Pride_MasterLogo_progress-cropped.png","https://www.brighton-pride.org/"],
        ["01.08.26","Luke Combs","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["02.08.26","Luke Combs","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["14.08.26","The Weeknd","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["15.08.26","The Weeknd","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["16.08.26","The Weeknd","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["18.08.26","The Weeknd","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["19.08.26","The Weeknd","Wembley Stadium ","TBC","TBC","BSL","Concert","","https://www.wembleystadium.com/events"],
        ["27.08.26","Leeds Festival","Wetherby","4 Days","TBC","BSL","Camping Festival","https://therefreshretreat.co.uk/images/events/Leeds.png","https://www.leedsfestival.com/tickets/"],
        ["27.08.26","Reading Festival","Reading","4 Days","TBC","BSL","Camping Festival","https://media.ticketmaster.co.uk/tm/en-gb/img/static/reading-leeds-festival/2026/images/rsp-reading-primary-logo_720-update.png","https://www.readingfestival.com/tickets"],
        ["28.08.26","Victorious Festival","Portsmouth","3 Days","TBC","BSL","Non-Camping Festival, Family","https://d2utmtmc4jckg3.cloudfront.net/wp-content/themes/victorious2021/images/logo-2025.png","https://www.victoriousfestival.co.uk/"],
        ["28.08.26","Electric Picnic","Laois, Ireland","3 Days","TBC","ISL","Camping Festival","https://laoistourism.ie/wp-content/uploads/2025/10/29006s.jpg","https://www.electricpicnic.ie/"],
        ["04.09.26","Bon Jovi","Wembley Stadium ","TBC","Marie Pascall & Paula Cox","BSL","Concert","","https://www.wembleystadium.com/events"]
    ]

    print(f"\n✅ Loaded {len(existing_data) - 1} existing events from PI Work Flow")

    # Transform existing events (skip header row)
    transformed_existing = []
    for row in existing_data[1:]:
        transformed_existing.append(transform_existing_event(row))

    print(f"✅ Transformed {len(transformed_existing)} existing events to new format")

    # Load O2 events from saved data (this would come from the API call)
    # For now, I'll include the data inline (we'll populate this from the actual data)
    print("\n📥 Loading O2 events from Public Events Feed...")

    # Save output
    output = {
        'headers': NEW_HEADERS,
        'existing_events': transformed_existing,
        'o2_event_count': 0  # Will be populated when we add O2 events
    }

    with open('restructure-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to restructure-output.json")
    print(f"   Headers: {len(NEW_HEADERS)} columns")
    print(f"   Existing events transformed: {len(transformed_existing)}")


if __name__ == "__main__":
    main()
