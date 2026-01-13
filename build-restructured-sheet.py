#!/usr/bin/env python3
"""
Build complete restructured PRE_APPROVED EVENTS sheet data
Combines existing + O2 events, ready for Google Sheets upload
"""

import json
from datetime import datetime

# New header
HEADERS = [
    "EVENT_NAME", "ARTIST_NAME", "VENUE_NAME", "CITY", "COUNTRY",
    "EVENT_DATE", "EVENT_TIME", "EVENT_URL", "IMAGE_URL",
    "ACCESS_STATUS", "CATEGORY", "SOURCE", "NOTES", "ADDED_DATE"
]

def normalize_date(date_str):
    """Convert DD.MM.YY to YYYY-MM-DD"""
    if not date_str:
        return ""
    if len(date_str) == 10 and date_str[4] == '-':
        return date_str
    if '.' in date_str:
        parts = date_str.split('.')
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return date_str

# Existing PI Work Flow events (from the read operation)
existing_raw = [
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

# Transform existing events
print("Transforming existing events...")
existing_transformed = []

for row in existing_raw:
    date = row[0] if len(row) > 0 else ""
    event_name = row[1] if len(row) > 1 else ""
    venue = row[2] if len(row) > 2 else ""
    time = row[3] if len(row) > 3 else ""
    interpreters = row[4] if len(row) > 4 else ""
    access = row[5] if len(row) > 5 else ""
    category = row[6] if len(row) > 6 else ""
    image_url = row[7] if len(row) > 7 else ""
    event_url = row[8] if len(row) > 8 else ""

    country = "Ireland" if "ireland" in venue.lower() else "UK"

    # Build notes
    notes_parts = []
    if interpreters and interpreters not in ["TBC", ""]:
        notes_parts.append(f"Interpreters: {interpreters}")
    if category and category not in ["Concert", "BSL", "ISL"]:
        notes_parts.append(category)
    notes = " | ".join(notes_parts)

    # Simplify category
    if "festival" in category.lower():
        category_clean = "Festival"
    elif category == "Concert":
        category_clean = "Concert"
    else:
        category_clean = "Event"

    transformed = [
        event_name,           # EVENT_NAME
        "",                   # ARTIST_NAME
        venue,                # VENUE_NAME
        venue,                # CITY
        country,              # COUNTRY
        normalize_date(date), # EVENT_DATE
        time,                 # EVENT_TIME
        event_url,            # EVENT_URL
        image_url,            # IMAGE_URL
        access,               # ACCESS_STATUS (BSL or ISL)
        category_clean,       # CATEGORY
        "Manual Entry",       # SOURCE
        notes,                # NOTES
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # ADDED_DATE
    ]
    existing_transformed.append(transformed)

print(f"✅ Transformed {len(existing_transformed)} existing events")

# Save to JSON for Claude to use with MCP tools
output = {
    'headers': HEADERS,
    'existing_events': existing_transformed
}

with open('restructured-existing-events.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"💾 Saved to restructured-existing-events.json")
print(f"   Ready to combine with O2 events")
