import json

# PUBLIC_APPROVED data (extracted from MCP response)
public_data = [["DATE","EVENT","VENUE","TIME","INTERPRETERS","APPROVED","CATEGORY"],["15.12.25","Christmas Royal Choral Society","Royal Albert Hall, London","14:30 / 19:30","Frances Everingham & Clare Edwards","Pending","Family"],["17.12.25","Top Hat","QEH, The Southbank Centre","14:00 - 16:30","Adam Price ","Pending","Other"],["18.12.25","Stereophonics","The O2, London","18:30 - 22:30","Paula Cox & Paul Michaels","Pending","Concert"],["20.12.25","Disney On Ice Presents: Find Your Hero","Utilita Arena Sheffield","14:30 - 16:00","Karen Ward-Welch","Pending","Family"],["20.12.25","Gladiators Live Tour","Glasgow","09:30 - 20:00","Omoyele Davey","Pending","Sports, Family"],["21.12.25","Gladiators Live Tour","Glasgow","09:30 - 20:00","Omoyele Davey","Pending","Sports, Family"],["21.12.25","Aladdin Pantomime (with songs)","Epsom Playhouse","12:00 - 15:30","Hayley Wiseman","Pending","Other"],["23.12.25","Arsenal vs Crystal Palace (Carabo Cup)","Emirates Stadium","KO - 20:00","Samuel Adedeji","Pending","Sports"],["27.12.25","Arsenal vs Brighton ","Emirates Stadium","KO - 15:00","Samuel Adedeji","Pending","Sports"],["28.12.25","Disney On Ice Presents: Find Your Hero","The O2, London","09:30 - 12:00","Karen Ward-Welch","Pending","Family"]]

with open('public-approved-data.json', 'w') as f:
    json.dump(public_data, f, indent=2)
print("✓ Saved public-approved-data.json (10 events)")

# For PRE_APPROVED, I'll create a minimal sample with O2 events
pre_approved_data = [["EVENT_NAME","ARTIST_NAME","VENUE_NAME","CITY","COUNTRY","EVENT_DATE","EVENT_TIME","EVENT_URL","IMAGE_URL","ACCESS_STATUS","CATEGORY","SOURCE","NOTES","ADDED_DATE","CATEGORY_ID"]]

# Add a few O2 events from the full list
pre_approved_data.append(["The Wailers","","The O2 Arena, London","London","UK","2025-12-05","19:00","https://www.theo2.co.uk/events/detail/the-wailers-2024","https://www.theo2.co.uk/assets/img/The-Wailers_London_Assets_x5_1080-x-1080-c4bd70c1d4.jpg","Request Interpreter","Concert","O2 Auto Import","PI has agreement with The O2 – interpreters on request, not automatically booked.","2025-12-05 11:57:28",""])

# Add a PAST O2 event for testing deletion
pre_approved_data.append(["Capital's Jingle Bell Ball","","The O2 Arena, London","London","UK","2025-12-06","16:30","https://www.theo2.co.uk/events/detail/capitals-jingle-bell-ball-2025","","Request Interpreter","Concert","O2","Test - this is PAST and should be deleted","2025-12-05 11:57:28","concert"])

# Add future events
pre_approved_data.append(["Biffy Clyro","","The O2 Arena, London","London","UK","2026-01-14","","https://www.theo2.co.uk/events/detail/biffy-clyro-2026","","Request Interpreter","Concert","O2 Auto Import","","2025-12-05 11:57:28","concert"])

with open('pre-approved-data.json', 'w') as f:
    json.dump(pre_approved_data, f, indent=2)
print("✓ Saved pre-approved-data.json (4 events)")
