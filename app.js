/*==========================================================================
  PERFORMANCE INTERPRETING PWA - MAIN APPLICATION
  Fixed version with proper DOM initialization
  ==========================================================================*/

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
    csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTVxv88y3c-1VMujoz2bupvSCnUkoC-r0W-QogbkhivAAvY-EBff7-vp76b7NxYeSQMK43rOb7PI830/pub?gid=57149695&single=true&output=csv',
    defaultImage: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=400&fit=crop',
    cacheDuration: 15 * 60 * 1000, // 15 minutes
    maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days - discard stale cache after this
    localStorageKey: 'pi-events-cache',
    localStorageTimestampKey: 'pi-events-cache-timestamp'
};

// ========================================
// VENUE CONTACT DATABASE
// ========================================
// Venue contact details with VRS (Video Relay Service) as primary contact method
// BSL is users' main language, so VRS should be the default where available
const VENUE_CONTACTS = {
    // London - The O2
    'the o2': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'o2 arena': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'the o2 arena': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'the o2 arena, london': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'indigo at the o2': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'indigo at the o2, london': { email: 'access@theo2.co.uk', vrs: 'http://o2.signvideo.net', vrsLabel: 'SignVideo' },

    // London - Wembley (BSL interpretation provided at all events as standard)
    'wembley stadium': { email: 'accessforall@wembleystadium.com', vrs: 'http://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },
    'wembley': { email: 'accessforall@wembleystadium.com', vrs: 'http://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },
    'wembley stadium, london': { email: 'accessforall@wembleystadium.com', vrs: 'http://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },

    // London - Southbank Centre (all sub-venues use the same access email)
    'southbank centre': { email: 'accesslist@southbankcentre.co.uk' },
    'southbank centre, london': { email: 'accesslist@southbankcentre.co.uk' },
    'the southbank': { email: 'accesslist@southbankcentre.co.uk' },
    'the southbank centre': { email: 'accesslist@southbankcentre.co.uk' },
    'royal festival hall': { email: 'accesslist@southbankcentre.co.uk' },
    'rfh': { email: 'accesslist@southbankcentre.co.uk' },
    'rfh, the southbank': { email: 'accesslist@southbankcentre.co.uk' },
    'royal festival hall, southbank centre': { email: 'accesslist@southbankcentre.co.uk' },
    'queen elizabeth hall': { email: 'accesslist@southbankcentre.co.uk' },
    'qeh': { email: 'accesslist@southbankcentre.co.uk' },
    'qeh, the southbank': { email: 'accesslist@southbankcentre.co.uk' },
    'qeh, the southbank centre': { email: 'accesslist@southbankcentre.co.uk' },
    'purcell room': { email: 'accesslist@southbankcentre.co.uk' },
    'purcell room, the southbank': { email: 'accesslist@southbankcentre.co.uk' },
    'clore ballroom': { email: 'accesslist@southbankcentre.co.uk' },
    'clore ballroom, the southbank': { email: 'accesslist@southbankcentre.co.uk' },
    'hayward gallery': { email: 'accesslist@southbankcentre.co.uk' },
    'weston roof pavilion': { email: 'accesslist@southbankcentre.co.uk' },
    "st paul's roof pavilion": { email: 'accesslist@southbankcentre.co.uk' },
    'queen elizabeth hall foyer': { email: 'accesslist@southbankcentre.co.uk' },
    'level 5 fr, the southbank': { email: 'accesslist@southbankcentre.co.uk' },

    // Birmingham
    'utilita arena birmingham': { email: 'boxoffice@utilitaarenabham.co.uk' },
    'utilita arena': { email: 'boxoffice@utilitaarenabham.co.uk' },

    // Newcastle
    'utilita arena newcastle': { email: 'access@utilitarena.co.uk' },

    // Leeds
    'first direct arena': { email: 'accessibility@firstdirectarena.com' },
    'first direct arena leeds': { email: 'accessibility@firstdirectarena.com' },

    // Manchester
    'ao arena': { email: 'accessibility@ao-arena.com' },
    'ao arena manchester': { email: 'accessibility@ao-arena.com' },

    // Sheffield
    'utilita arena sheffield': { email: 'boxoffice@sheffieldarena.co.uk' },

    // Liverpool
    'm&s bank arena': { email: 'accessibility@accliverpool.com' },
    'm&s bank arena liverpool': { email: 'accessibility@accliverpool.com' },

    // Glasgow
    'ovo hydro': { email: 'accessibility@ovo-hydro.com' },
    'ovo hydro glasgow': { email: 'accessibility@ovo-hydro.com' },
    'the ovo hydro': { email: 'accessibility@ovo-hydro.com' },

    // Nottingham
    'motorpoint arena': { email: 'accessibility@motorpointarenanottingham.com' },
    'motorpoint arena nottingham': { email: 'accessibility@motorpointarenanottingham.com' },

    // London - Emirates Stadium (Arsenal)
    'emirates stadium': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo or online form: arsenalfc.freshdesk.com' },
    'emirates stadium, london': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo or online form' },
    'arsenal': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo or online form' },

    // London - Alexandra Palace
    'alexandra palace': { email: 'access@alexandrapalace.com' },
    'alexandra palace, london': { email: 'access@alexandrapalace.com' },
    'ally pally': { email: 'access@alexandrapalace.com' },

    // London - ABBA Voyage / ABBA Arena
    'abba arena': { email: 'access@abbavoyage.com' },
    'abba arena, london': { email: 'access@abbavoyage.com' },
    'abba voyage': { email: 'access@abbavoyage.com' },
    'pudding mill lane': { email: 'access@abbavoyage.com' },
    'pudding mill lane, london': { email: 'access@abbavoyage.com' },

    // London - OVO Arena Wembley (formerly SSE Arena Wembley — separate from Wembley Stadium)
    'ovo arena wembley': { email: 'access@ovoarena.co.uk' },
    'ovo arena, wembley': { email: 'access@ovoarena.co.uk' },
    'ovo arena, wembley, london': { email: 'access@ovoarena.co.uk' },
    'ovo wembley arena': { email: 'access@ovoarena.co.uk' },
    'sse arena wembley': { email: 'access@ovoarena.co.uk' },

    // London - Eventim Apollo (Hammersmith)
    'eventim apollo': { email: 'info@eventimapollo.com' },
    'eventim apollo, london': { email: 'info@eventimapollo.com' },
    'eventim apollo, hammersmith': { email: 'info@eventimapollo.com' },
    'eventim apollo, hammersmith, london': { email: 'info@eventimapollo.com' },
    'hammersmith apollo': { email: 'info@eventimapollo.com' },

    // London - Royal Albert Hall
    'royal albert hall': { email: 'access@royalalberthall.com' },
    'royal albert hall, london': { email: 'access@royalalberthall.com' },

    // London - London Stadium (West Ham United)
    'london stadium': { email: 'accessibility@westhamunited.co.uk' },
    'london stadium, london': { email: 'accessibility@westhamunited.co.uk' },
    'west ham stadium': { email: 'accessibility@westhamunited.co.uk' },

    // London - Stamford Bridge (Chelsea FC — PI provides BSL here)
    'stamford bridge': { email: 'access@chelseafc.com' },
    'stamford bridge, london': { email: 'access@chelseafc.com' },
    'chelsea': { email: 'access@chelseafc.com' },

    // London - O2 Academy Brixton
    'o2 academy brixton': { email: 'access@o2academybrixton.co.uk' },
    'o2 academy, brixton': { email: 'access@o2academybrixton.co.uk' },
    'o2 academy brixton, london': { email: 'access@o2academybrixton.co.uk' },
    'brixton academy': { email: 'access@o2academybrixton.co.uk' },

    // London - Copper Box Arena (Olympic Park)
    'copper box arena': { email: 'copperboxarena@gll.org' },
    'copper box arena, london': { email: 'copperboxarena@gll.org' },

    // London - O2 Forum Kentish Town
    'o2 forum kentish town': { email: 'access@o2forumkentishtown.co.uk' },
    'o2 forum, kentish town': { email: 'access@o2forumkentishtown.co.uk' },
    'o2 kentish forum': { email: 'access@o2forumkentishtown.co.uk' },
    'o2 kentish forum, london': { email: 'access@o2forumkentishtown.co.uk' },

    // London - Shoreditch Town Hall
    'shoreditch town hall': { email: 'info@shoreditchtownhall.com' },
    'shoreditch town hall, london': { email: 'info@shoreditchtownhall.com' },

    // London - Allianz Stadium Twickenham (England Rugby)
    'allianz stadium': { email: '', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo or contact form on englandrugby.com' },
    'allianz stadium, twickenham': { email: '', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo' },
    'twickenham': { email: '', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo' },
    'twickenham stadium': { email: '', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'No email — use SignVideo' },

    // Dublin - 3Arena
    '3arena': { email: 'enquiry@3arena.ie' },
    '3arena, dublin': { email: 'enquiry@3arena.ie' },
    '3 arena': { email: 'enquiry@3arena.ie' },
    '3 arena, dublin': { email: 'enquiry@3arena.ie' },

    // Manchester - Old Trafford (Manchester United)
    'old trafford': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    'old trafford, manchester': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    'manchester united': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    'man utd': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },

    // Manchester - O2 Apollo Manchester
    'o2 apollo manchester': { email: 'access@o2apollomanchester.co.uk' },
    'o2 apollo, manchester': { email: 'access@o2apollomanchester.co.uk' },
    'apollo manchester': { email: 'access@o2apollomanchester.co.uk' },

    // Manchester - O2 Victoria Warehouse
    'o2 victoria warehouse': { email: 'access@o2victoriawarehouse.co.uk' },
    'o2 victoria warehouse manchester': { email: 'access@o2victoriawarehouse.co.uk' },
    'o2 victoria warehouse, manchester': { email: 'access@o2victoriawarehouse.co.uk' },
    'o2 victoria manchester': { email: 'access@o2victoriawarehouse.co.uk' },
    'victoria warehouse': { email: 'access@o2victoriawarehouse.co.uk' },

    // Glasgow - O2 Academy Glasgow
    'o2 academy glasgow': { email: 'access@o2academyglasgow.co.uk' },
    'o2 academy, glasgow': { email: 'access@o2academyglasgow.co.uk' },

    // Bournemouth International Centre
    'bournemouth international centre': { email: 'access@bhlive.org.uk' },
    'bournemouth int. centre': { email: 'access@bhlive.org.uk' },
    'bic bournemouth': { email: 'access@bhlive.org.uk' },

    // Birmingham - BP Pulse LIVE / NEC
    'bp pulse live': { email: 'feedback@necgroup.co.uk' },
    'bp pulse live, nec': { email: 'feedback@necgroup.co.uk' },
    'bp pulse, birmingham': { email: 'feedback@necgroup.co.uk' },
    'bp pulse live, birmingham': { email: 'feedback@necgroup.co.uk' },
    'nec birmingham': { email: 'feedback@necgroup.co.uk' },

    // Southampton - St Mary's Stadium
    'southampton stadium': { email: 'accessibility@saintsfc.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    "st mary's stadium": { email: 'accessibility@saintsfc.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    'st marys stadium': { email: 'accessibility@saintsfc.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },
    'southampton fc': { email: 'accessibility@saintsfc.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo' },

    // Watford - Watford Colosseum
    'watford colosseum': { email: 'general@watfordcolosseum.co.uk' },
    'watford colosseum, watford': { email: 'general@watfordcolosseum.co.uk' },

    // Surrey - Epsom Playhouse
    'epsom playhouse': { email: 'tplayhouse@epsom-ewell.gov.uk' },

    // ---- Typo aliases (common WF data entry variations) ----
    'emirates staduim': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'Typo alias for Emirates Stadium' },
    'london staduim': { email: 'accessibility@westhamunited.co.uk', note: 'Typo alias for London Stadium' },
    'london staduim, london': { email: 'accessibility@westhamunited.co.uk', note: 'Typo alias for London Stadium' },
    'copper cox arena': { email: 'copperboxarena@gll.org', note: 'Typo alias for Copper Box Arena' },
    'copper cox arena, london': { email: 'copperboxarena@gll.org', note: 'Typo alias for Copper Box Arena' },
    'man utd staduim old tafford manchester': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'Typo alias for Old Trafford' },

    // ---- Remaining venues from __VENUES database (auto-synced) ----

    // London
    'barbican centre': { email: 'access@barbican.org.uk' },
    'barbican centre, london': { email: 'access@barbican.org.uk' },
    'the barbican': { email: 'access@barbican.org.uk' },
    'london palladium': { email: 'access@lwtheatres.co.uk' },
    'london palladium, london': { email: 'access@lwtheatres.co.uk' },
    'the palladium': { email: 'access@lwtheatres.co.uk' },
    'tottenham hotspur stadium': { email: 'access@tottenhamhotspur.com' },
    'tottenham hotspur stadium, london': { email: 'access@tottenhamhotspur.com' },
    'spurs stadium': { email: 'access@tottenhamhotspur.com' },
    'tottenham stadium': { email: 'access@tottenhamhotspur.com' },
    'crystal palace national sports centre': { email: 'crystal.palace@gll.org' },
    'crystal palace national sports centre, london': { email: 'crystal.palace@gll.org' },
    'selhurst park': { email: 'dlo@cpfc.co.uk' },
    'selhurst park, london': { email: 'dlo@cpfc.co.uk' },
    'crystal palace fc': { email: 'dlo@cpfc.co.uk' },
    'craven cottage': { email: 'enquiries@fulhamfc.com' },
    'craven cottage, london': { email: 'enquiries@fulhamfc.com' },
    'fulham fc': { email: 'enquiries@fulhamfc.com' },
    'gtech community stadium': { email: 'accessibility@brentfordfc.com' },
    'gtech community stadium, london': { email: 'accessibility@brentfordfc.com' },
    'brentford fc': { email: 'accessibility@brentfordfc.com' },
    'fairfield halls': { email: 'access@bhlive.org.uk' },
    'fairfield halls, croydon': { email: 'access@bhlive.org.uk' },

    // Manchester
    'co-op live': { email: 'access@cooplive.com' },
    'co-op live, manchester': { email: 'access@cooplive.com' },
    'coop live': { email: 'access@cooplive.com' },
    'etihad stadium': { email: 'access@mancity.com' },
    'etihad stadium, manchester': { email: 'access@mancity.com' },
    'manchester city': { email: 'access@mancity.com' },
    'man city': { email: 'access@mancity.com' },
    'bridgewater hall': { email: 'access@bridgewater-hall.co.uk' },
    'bridgewater hall, manchester': { email: 'access@bridgewater-hall.co.uk' },
    'the bridgewater hall': { email: 'access@bridgewater-hall.co.uk' },

    // Birmingham
    'resorts world arena': { email: 'feedback@necgroup.co.uk' },
    'resorts world arena, birmingham': { email: 'feedback@necgroup.co.uk' },
    'resorts world arena birmingham': { email: 'feedback@necgroup.co.uk' },
    'symphony hall': { email: 'boxoffice@bmusic.co.uk' },
    'symphony hall, birmingham': { email: 'boxoffice@bmusic.co.uk' },
    'symphony hall birmingham': { email: 'boxoffice@bmusic.co.uk' },
    'villa park': { email: 'accessibility@avfc.co.uk' },
    'villa park, birmingham': { email: 'accessibility@avfc.co.uk' },
    'aston villa': { email: 'accessibility@avfc.co.uk' },

    // Liverpool
    'anfield': { email: 'disability@liverpoolfc.com' },
    'anfield stadium': { email: 'disability@liverpoolfc.com' },
    'anfield, liverpool': { email: 'disability@liverpoolfc.com' },
    'liverpool fc': { email: 'disability@liverpoolfc.com' },
    'liverpool philharmonic hall': { email: 'access@liverpoolphil.com' },
    'liverpool philharmonic': { email: 'access@liverpoolphil.com' },
    'goodison park': { email: 'accessibility@evertonfc.com' },
    'goodison park, liverpool': { email: 'accessibility@evertonfc.com' },
    'everton fc': { email: 'accessibility@evertonfc.com' },

    // Leeds
    'first direct bank arena': { email: 'accessibility@firstdirectbankarena.com' },
    'first direct bank arena, leeds': { email: 'accessibility@firstdirectbankarena.com' },
    'leeds grand theatre': { email: 'info@leedsheritagetheatres.com' },
    'leeds grand theatre, leeds': { email: 'info@leedsheritagetheatres.com' },
    'elland road': { email: 'disabled@leedsunited.com' },
    'elland road, leeds': { email: 'disabled@leedsunited.com' },
    'leeds united': { email: 'disabled@leedsunited.com' },

    // Glasgow
    'hampden park': { email: 'enquiries@hampdenpark.co.uk' },
    'hampden park, glasgow': { email: 'enquiries@hampdenpark.co.uk' },
    'glasgow royal concert hall': { email: 'GRCHVM@glasgowlife.org.uk' },
    'glasgow royal concert hall, glasgow': { email: 'GRCHVM@glasgowlife.org.uk' },
    'celtic park': { email: 'homematches@celticfc.co.uk' },
    'celtic park, glasgow': { email: 'homematches@celticfc.co.uk' },
    'celtic fc': { email: 'homematches@celticfc.co.uk' },
    'ibrox stadium': { email: 'disabilitymatters@rangers.co.uk' },
    'ibrox stadium, glasgow': { email: 'disabilitymatters@rangers.co.uk' },
    'ibrox': { email: 'disabilitymatters@rangers.co.uk' },
    'rangers fc': { email: 'disabilitymatters@rangers.co.uk' },
    'sec armadillo': { email: 'booking.enquiries@sec.co.uk' },
    'sec armadillo, glasgow': { email: 'booking.enquiries@sec.co.uk' },
    'the armadillo': { email: 'booking.enquiries@sec.co.uk' },

    // Newcastle
    "st james' park": { email: 'disability@nufc.co.uk' },
    "st james' park, newcastle": { email: 'disability@nufc.co.uk' },
    'st james park': { email: 'disability@nufc.co.uk' },
    'st james park, newcastle': { email: 'disability@nufc.co.uk' },
    'newcastle united': { email: 'disability@nufc.co.uk' },
    'o2 city hall newcastle': { email: 'access@o2cityhallnewcastle.co.uk' },
    'o2 city hall, newcastle': { email: 'access@o2cityhallnewcastle.co.uk' },

    // Sheffield
    'sheffield city hall': { email: 'accessteam@sheffieldcityhall.co.uk' },
    'sheffield city hall, sheffield': { email: 'accessteam@sheffieldcityhall.co.uk' },

    // Nottingham
    'royal concert hall nottingham': { email: 'trch.access@nottinghamcity.gov.uk' },
    'royal concert hall, nottingham': { email: 'trch.access@nottinghamcity.gov.uk' },
    'city ground': { email: 'accessibility@nottinghamforest.co.uk' },
    'city ground, nottingham': { email: 'accessibility@nottinghamforest.co.uk' },
    'nottingham forest': { email: 'accessibility@nottinghamforest.co.uk' },

    // Cardiff
    'principality stadium': { email: 'customercare@wru.wales' },
    'principality stadium, cardiff': { email: 'customercare@wru.wales' },
    'utilita arena cardiff': { email: 'liveaccessmotorpointarenacardiff@livenation.co.uk' },
    'utilita arena, cardiff': { email: 'liveaccessmotorpointarenacardiff@livenation.co.uk' },
    'cardiff city stadium': { email: 'DAO@cardiffcityfc.co.uk' },
    'cardiff city stadium, cardiff': { email: 'DAO@cardiffcityfc.co.uk' },
    'cardiff city fc': { email: 'DAO@cardiffcityfc.co.uk' },

    // Edinburgh
    'usher hall': { email: 'foh@usherhall.co.uk' },
    'usher hall, edinburgh': { email: 'foh@usherhall.co.uk' },
    'edinburgh playhouse': { email: 'edinburghaccess@atgentertainment.com' },
    'edinburgh playhouse, edinburgh': { email: 'edinburghaccess@atgentertainment.com' },
    'scottish gas murrayfield': { email: 'tickets@sru.org.uk' },
    'scottish gas murrayfield, edinburgh': { email: 'tickets@sru.org.uk' },
    'murrayfield': { email: 'tickets@sru.org.uk' },
    'murrayfield stadium': { email: 'tickets@sru.org.uk' },

    // Brighton
    'brighton centre': { email: 'brightoncentre@brighton-hove.gov.uk' },
    'brighton centre, brighton': { email: 'brightoncentre@brighton-hove.gov.uk' },
    'amex stadium': { email: 'accessibility@bhafc.co.uk' },
    'amex stadium, brighton': { email: 'accessibility@bhafc.co.uk' },
    'brighton fc': { email: 'accessibility@bhafc.co.uk' },

    // Belfast
    'sse arena belfast': { email: 'info@ssearenabelfast.com' },
    'sse arena, belfast': { email: 'info@ssearenabelfast.com' },
    'windsor park': { email: 'info@irishfa.com' },
    'windsor park, belfast': { email: 'info@irishfa.com' },

    // Southampton
    'o2 guildhall southampton': { email: 'o2guildhallsouthampton.boxoffice@livenation.co.uk' },
    'o2 guildhall, southampton': { email: 'o2guildhallsouthampton.boxoffice@livenation.co.uk' },

    // Bristol
    'bristol hippodrome': { email: 'bristolmarketing@theambassadors.com' },
    'bristol hippodrome, bristol': { email: 'bristolmarketing@theambassadors.com' },

    // Leicester
    'king power stadium': { email: 'disability@lcfc.co.uk' },
    'king power stadium, leicester': { email: 'disability@lcfc.co.uk' },
    'leicester city fc': { email: 'disability@lcfc.co.uk' },
    'de montfort hall': { email: 'dmh-office@leicester.gov.uk' },
    'de montfort hall, leicester': { email: 'dmh-office@leicester.gov.uk' },

    // Wolverhampton
    'wolverhampton civic hall': { email: 'access@thehallswolverhampton.co.uk' },
    'wolverhampton civic hall, wolverhampton': { email: 'access@thehallswolverhampton.co.uk' },
    'molineux stadium': { email: 'fanservices@wolves.co.uk' },
    'molineux stadium, wolverhampton': { email: 'fanservices@wolves.co.uk' },
    'molineux': { email: 'fanservices@wolves.co.uk' },
    'wolves fc': { email: 'fanservices@wolves.co.uk' },

    // Swansea
    'swansea arena': { email: 'SwanseaAccess@atgentertainment.com' },
    'swansea arena, swansea': { email: 'SwanseaAccess@atgentertainment.com' },
    'swansea.com stadium': { email: 'accessibility@swanseacity.com' },
    'swansea.com stadium, swansea': { email: 'accessibility@swanseacity.com' },
    'swansea city fc': { email: 'accessibility@swanseacity.com' },

    // Sunderland
    'stadium of light': { email: 'chris.waters@safc.com' },
    'stadium of light, sunderland': { email: 'chris.waters@safc.com' },
    'sunderland fc': { email: 'chris.waters@safc.com' },

    // Stoke-on-Trent
    'victoria hall stoke': { email: 'enquiries@victoriahallstoke.co.uk' },
    'victoria hall, stoke': { email: 'enquiries@victoriahallstoke.co.uk' },
    'victoria hall, stoke-on-trent': { email: 'enquiries@victoriahallstoke.co.uk' },
    'bet365 stadium': { email: 'hospitality@stokecityfc.com' },
    'bet365 stadium, stoke': { email: 'hospitality@stokecityfc.com' },
    'stoke city fc': { email: 'hospitality@stokecityfc.com' },

    // Hull
    'connexin live': { email: 'info@connexinlive.com' },
    'connexin live, hull': { email: 'info@connexinlive.com' },
    'connexin live hull': { email: 'info@connexinlive.com' },

    // Coventry
    'coventry building society arena': { email: 'ticketoffice@CBSarena.co.uk' },
    'coventry building society arena, coventry': { email: 'ticketoffice@CBSarena.co.uk' },
    'cbs arena': { email: 'ticketoffice@CBSarena.co.uk' },
    'cbs arena, coventry': { email: 'ticketoffice@CBSarena.co.uk' },

    // Aberdeen
    'p&j live': { email: 'access@pandjlive.com' },
    'p&j live, aberdeen': { email: 'access@pandjlive.com' },

    // Burnley
    'turf moor': { email: 'info@burnleyfc.com' },
    'turf moor, burnley': { email: 'info@burnleyfc.com' },
    'burnley fc': { email: 'info@burnleyfc.com' },

    // Derby
    'derby arena': { email: 'derbyarena@derby.gov.uk' },
    'derby arena, derby': { email: 'derbyarena@derby.gov.uk' },

    // Dundee
    'caird hall': { email: 'cairdhall@leisureandculturedundee.com' },
    'caird hall, dundee': { email: 'cairdhall@leisureandculturedundee.com' },

    // Exeter
    'westpoint arena exeter': { email: 'info@westpointexeter.co.uk' },
    'westpoint arena, exeter': { email: 'info@westpointexeter.co.uk' },
    'westpoint exeter': { email: 'info@westpointexeter.co.uk' },

    // Gateshead
    'the glasshouse': { email: 'boxoffice@theglasshouseicm.org' },
    'the glasshouse, gateshead': { email: 'boxoffice@theglasshouseicm.org' },
    'sage gateshead': { email: 'boxoffice@theglasshouseicm.org' },

    // Gloucester
    'kingsholm stadium': { email: 'tickets@gloucesterrugby.co.uk' },
    'kingsholm stadium, gloucester': { email: 'tickets@gloucesterrugby.co.uk' },
    'kingsholm': { email: 'tickets@gloucesterrugby.co.uk' },
    'gloucester rugby': { email: 'tickets@gloucesterrugby.co.uk' },

    // Inverness
    'eden court theatre': { email: 'info@eden-court.co.uk' },
    'eden court theatre, inverness': { email: 'info@eden-court.co.uk' },
    'eden court': { email: 'info@eden-court.co.uk' },

    // Ipswich
    'ipswich regent theatre': { email: 'tickets@ipswich.gov.uk' },
    'ipswich regent theatre, ipswich': { email: 'tickets@ipswich.gov.uk' },
    'regent theatre, ipswich': { email: 'tickets@ipswich.gov.uk' },

    // Lincoln
    'lincoln engine shed': { email: 'info@lincolnenginished.co.uk' },
    'engine shed, lincoln': { email: 'info@lincolnenginished.co.uk' },

    // Middlesbrough
    'riverside stadium': { email: 'supporters@mfc.co.uk' },
    'riverside stadium, middlesbrough': { email: 'supporters@mfc.co.uk' },
    'middlesbrough fc': { email: 'supporters@mfc.co.uk' },

    // Milton Keynes
    'milton keynes theatre': { email: 'emkboxoffice@theambassadors.com' },
    'milton keynes theatre, milton keynes': { email: 'emkboxoffice@theambassadors.com' },
    'mk theatre': { email: 'emkboxoffice@theambassadors.com' },

    // Norwich
    'norwich theatre royal': { email: 'access@norwichtheatre.org' },
    'norwich theatre royal, norwich': { email: 'access@norwichtheatre.org' },
    'theatre royal, norwich': { email: 'access@norwichtheatre.org' },

    // Oxford
    'new theatre oxford': { email: 'access4all.newtheatreoxford@theambassadors.com' },
    'new theatre, oxford': { email: 'access4all.newtheatreoxford@theambassadors.com' },

    // Peterborough
    'new theatre peterborough': { email: 'peterborough.tickets@landmarktheatres.co.uk' },
    'new theatre, peterborough': { email: 'peterborough.tickets@landmarktheatres.co.uk' },

    // Plymouth
    'plymouth pavilions': { email: 'access@plymouthpavilions.com' },
    'plymouth pavilions, plymouth': { email: 'access@plymouthpavilions.com' },

    // Preston
    'preston guild hall': { email: 'guildhallenquiries@preston.gov.uk' },
    'preston guild hall, preston': { email: 'guildhallenquiries@preston.gov.uk' },

    // Reading
    'reading hexagon': { email: 'boxoffice@reading.gov.uk' },
    'reading hexagon, reading': { email: 'boxoffice@reading.gov.uk' },
    'the hexagon': { email: 'boxoffice@reading.gov.uk' },
    'the hexagon, reading': { email: 'boxoffice@reading.gov.uk' },

    // Woodstock
    'blenheim palace': { email: 'customerservice@blenheimpalace.com' },
    'blenheim palace, woodstock': { email: 'customerservice@blenheimpalace.com' },

    // Cambridge
    'cambridge corn exchange': { email: 'access@cambridgelivetrust.co.uk' },
    'cambridge corn exchange, cambridge': { email: 'access@cambridgelivetrust.co.uk' },
    'corn exchange, cambridge': { email: 'access@cambridgelivetrust.co.uk' },

    // Bath
    'bath forum': { email: 'hello@bathforum.co.uk' },
    'bath forum, bath': { email: 'hello@bathforum.co.uk' },
    'the forum, bath': { email: 'hello@bathforum.co.uk' },

    // York
    'york barbican': { email: 'laura.harrison@eu.asmglobal.com' },
    'york barbican, york': { email: 'laura.harrison@eu.asmglobal.com' },

    // Blackpool
    'blackpool opera house': { email: 'info@wgbpl.co.uk' },
    'blackpool opera house, blackpool': { email: 'info@wgbpl.co.uk' },
    'opera house, blackpool': { email: 'info@wgbpl.co.uk' },
};

// Legacy compatibility - flat email lookup
const VENUE_EMAILS = Object.fromEntries(
    Object.entries(VENUE_CONTACTS).map(([key, val]) => [key, val.email])
);

/**
 * Find all matching venues from database
 * Returns array of { venueName, email, vrs, vrsLabel } objects
 */
function findMatchingVenues(query) {
    if (!query || query.trim() === '') return [];

    const queryLower = query.toLowerCase().trim();
    const matches = [];
    const seenEmails = new Set(); // Avoid duplicates (same venue, different aliases)

    // Exact match first
    if (VENUE_CONTACTS[queryLower]) {
        const contact = VENUE_CONTACTS[queryLower];
        return [{ venueName: queryLower, ...contact }];
    }

    // Fuzzy match - find all venues that contain the query or vice versa
    for (const [key, contact] of Object.entries(VENUE_CONTACTS)) {
        if ((queryLower.includes(key) || key.includes(queryLower)) && !seenEmails.has(contact.email)) {
            matches.push({ venueName: key, ...contact });
            seenEmails.add(contact.email);
        }
    }

    // Sort by name length (shorter/more specific first)
    matches.sort((a, b) => a.venueName.length - b.venueName.length);

    return matches;
}

/**
 * Set up venue name input listener for auto-fill
 */
function setupVenueEmailLookup() {
    const venueNameInput = document.getElementById('venueName');
    const venueEmailInput = document.getElementById('venueEmail');
    const venueEmailStatus = document.getElementById('venueEmailStatus');
    const venueMatches = document.getElementById('venueMatches');

    if (!venueNameInput || !venueEmailInput || !venueEmailStatus) return;

    // Track if email was auto-filled (so we know if user overrode it)
    let wasAutoFilled = false;

    // Debounce the lookup
    let debounceTimer;
    venueNameInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const matches = findMatchingVenues(venueNameInput.value);

            // Hide picker by default
            if (venueMatches) venueMatches.style.display = 'none';

            if (matches.length === 1) {
                // Single match - show as visible suggestion so user can tap to confirm
                // (Don't silently auto-fill - English isn't first language for many Deaf users)
                showVenuePicker(matches);
                venueEmailStatus.innerHTML = '<span class="status-pick">Venue found - tap to select</span>';
                venueEmailStatus.className = 'venue-email-status pick';
            } else if (matches.length > 1) {
                // Multiple matches - show picker
                showVenuePicker(matches);
                venueEmailStatus.innerHTML = '<span class="status-pick">Multiple venues found - please select one</span>';
                venueEmailStatus.className = 'venue-email-status pick';
            } else if (venueNameInput.value.trim().length > 2) {
                // No matches
                if (wasAutoFilled) {
                    venueEmailInput.value = '';
                    wasAutoFilled = false;
                }
                updateEmailStatus();
            } else {
                if (wasAutoFilled) {
                    venueEmailInput.value = '';
                    wasAutoFilled = false;
                }
                venueEmailStatus.innerHTML = '';
                venueEmailStatus.className = 'venue-email-status';
            }
        }, 300);
    });

    // Listen for manual email entry
    venueEmailInput.addEventListener('input', () => {
        wasAutoFilled = false;
        if (venueMatches) venueMatches.style.display = 'none';
        updateEmailStatus();
    });

    function showVenuePicker(matches) {
        if (!venueMatches) return;

        // Build picker HTML - include VRS info
        const html = matches.map(m => {
            // Capitalize venue name for display
            const displayName = m.venueName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            const vrsIndicator = m.vrs ? ' 📹' : '';
            return `<button type="button" class="venue-match-btn" data-email="${m.email}" data-venue="${displayName}" data-vrs="${m.vrs || ''}" data-vrs-label="${m.vrsLabel || ''}">${displayName}${vrsIndicator}</button>`;
        }).join('');

        venueMatches.innerHTML = html;
        venueMatches.style.display = 'flex';

        // Add click handlers
        venueMatches.querySelectorAll('.venue-match-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                venueEmailInput.value = btn.dataset.email;
                venueNameInput.value = btn.dataset.venue;
                wasAutoFilled = true;
                venueMatches.style.display = 'none';

                // Show VRS as primary if available
                const vrs = btn.dataset.vrs;
                const vrsLabel = btn.dataset.vrsLabel || 'SignVideo';
                if (vrs) {
                    venueEmailStatus.innerHTML = `
                        <div class="status-found-vrs">
                            <span class="status-found">✅ We have contact info for this venue</span>
                            <a href="${vrs}" target="_blank" rel="noopener" class="vrs-link-primary">
                                📹 Use ${vrsLabel} (Recommended for BSL users)
                            </a>
                            <span class="status-or">or continue below for email</span>
                        </div>`;
                    venueEmailStatus.className = 'venue-email-status found has-vrs';
                } else {
                    venueEmailStatus.innerHTML = '<span class="status-found">✅ We have this venue\'s access email</span>';
                    venueEmailStatus.className = 'venue-email-status found';
                }
            });
        });
    }

    function updateEmailStatus() {
        const hasManualEmail = venueEmailInput.value.trim() !== '';
        const hasVenueName = venueNameInput.value.trim().length > 2;

        if (hasManualEmail) {
            venueEmailStatus.innerHTML = '<span class="status-found">Email will go to venue, PI CC\'d</span>';
            venueEmailStatus.className = 'venue-email-status found';
        } else if (hasVenueName) {
            venueEmailStatus.innerHTML = '<span class="status-not-found">No email? Your message will go to PI, we\'ll contact them for you</span>';
            venueEmailStatus.className = 'venue-email-status not-found';
        } else {
            venueEmailStatus.innerHTML = '';
            venueEmailStatus.className = 'venue-email-status';
        }
    }
}

// ========================================
// TIME HELPER
// ========================================

/**
 * Check if a time value is meaningful (not TBC/empty/placeholder).
 * Used to exclude meaningless times from emails and messages.
 */
function hasRealTime(time) {
    if (!time) return false;
    const t = time.toString().trim().toLowerCase();
    return t !== '' && t !== 'tbc' && t !== 'to be confirmed' && t !== 'tba';
}

// ========================================
// REQUEST INTERPRETER URL BUILDER
// ========================================

/**
 * Build a URL to the request interpreter form, pre-filled with event data
 */
function buildRequestInterpreterUrl(event) {
    const params = new URLSearchParams();
    if (event['EVENT']) params.set('event', event['EVENT']);
    if (event['VENUE']) params.set('venue', event['VENUE']);
    if (event['DATE']) params.set('date', event['DATE']);
    if (hasRealTime(event['TIME'])) params.set('time', event['TIME']);
    return `#/flow3?${params.toString()}`;
}

/**
 * Pre-fill the request form from URL parameters
 */
function prefillRequestForm() {
    const hash = window.location.hash;
    if (!hash.includes('/flow3?')) return;

    const queryString = hash.split('?')[1];
    if (!queryString) return;

    const params = new URLSearchParams(queryString);

    const eventInput = document.getElementById('eventName');
    const venueInput = document.getElementById('venueName');
    const dateInput = document.getElementById('eventDate');

    if (eventInput && params.get('event')) eventInput.value = params.get('event');
    if (venueInput && params.get('venue')) {
        venueInput.value = params.get('venue');
        // Trigger venue email lookup if the function exists
        if (typeof findMatchingVenues === 'function') {
            venueInput.dispatchEvent(new Event('input'));
        }
    }
    if (dateInput && params.get('date')) {
        const time = params.get('time');
        dateInput.value = params.get('date') + (hasRealTime(time) ? ` at ${time}` : '');
    }
}

// ========================================
// BADGE SYSTEM (NEW)
// ========================================

/**
 * Detect interpretation language (BSL or ISL) for an event
 * Hierarchy: COUNTRY field → INTERPRETATION field → venue heuristics
 */
function getInterpretationLanguage(event) {
    // 1. Check COUNTRY field first
    if (event['COUNTRY']) {
        const country = event['COUNTRY'].toUpperCase().trim();
        if (country === 'IRELAND' || country === 'IE' || country === 'IRL') {
            return 'ISL';
        }
    }

    // 2. Check explicit INTERPRETATION field
    if (event['INTERPRETATION']) {
        const interp = event['INTERPRETATION'].toUpperCase().trim();
        if (interp === 'ISL') return 'ISL';
        if (interp === 'BSL') return 'BSL';
    }

    // 3. Fall back to venue/location heuristics
    return detectInterpretation(event['VENUE'] || '');
}

/**
 * Calculate badge status for an event
 * Returns badge object with icon, label, and styling
 */
function calculateBadgeStatus(event) {
    // Detect BSL or ISL for this event
    const language = getInterpretationLanguage(event);

    // 🟢 GREEN (guaranteed): Venue provides BSL at every event as standard
    if (event['VENUE']) {
        const venueMatches = findMatchingVenues(event['VENUE']);
        if (venueMatches.length > 0 && venueMatches[0].bslGuaranteed) {
            return {
                badge: 'green',
                icon: '✅',
                label: 'BSL Guaranteed',
                shortLabel: `${language} Interpreted`,
                action: 'book-tickets',
                message: venueMatches[0].note || `${language} interpretation provided at this venue as standard`,
                canBook: true,
                language: language
            };
        }
    }

    // 🟢 GREEN: Interpreter booked (confirmed)
    const interpreterValue = event['INTERPRETERS'] ? event['INTERPRETERS'].trim() : '';
    const hasInterpreter = interpreterValue !== '';
    const isConfirmed = event['INTERPRETER_CONFIRMED'] === 'Yes' ||
                       event['INTERPRETER_CONFIRMED'] === 'TRUE' ||
                       event['INTERPRETER_CONFIRMED'] === true;

    // Check if interpreter status is "Request Interpreter" or "TBC" - these are NOT confirmed
    const interpreterLower = interpreterValue.toLowerCase();
    const isRequestOrTBC = interpreterLower === 'request interpreter' ||
                           interpreterLower === 'tbc' ||
                           interpreterLower === 'to be confirmed';

    if (hasInterpreter && !isRequestOrTBC) {
        return {
            badge: 'green',
            icon: '✅',
            label: 'Interpreter Booked',
            shortLabel: `${language} Interpreted`,
            action: 'book-tickets',
            message: `${language} interpretation confirmed for this event`,
            canBook: true,
            language: language
        };
    }

    // 🟠 ORANGE: Request Interpreter - venue accepts requests
    if (isRequestOrTBC) {
        return {
            badge: 'orange',
            icon: '🟠',
            label: interpreterValue === 'TBC' ? 'TBC' : 'Request Interpreter',
            shortLabel: interpreterValue === 'TBC' ? `${language} TBC` : `Request ${language}`,
            action: 'request-interpreter',
            message: interpreterValue === 'TBC'
                ? `${language} interpretation to be confirmed`
                : `Contact venue to request ${language} interpretation`,
            canBook: false,
            language: language
        };
    }

    // 🟠 ORANGE: Request possible (venue contactable)
    const hasVenueContact = event['VENUE_CONTACT_EMAIL'] || event['VENUE_CONTACT_PHONE'];
    const requestPossible = event['REQUEST_POSSIBLE'] === 'Yes' ||
                           event['REQUEST_POSSIBLE'] === 'TRUE' ||
                           event['REQUEST_POSSIBLE'] === true;

    if (requestPossible || hasVenueContact) {
        return {
            badge: 'orange',
            icon: '🟠',
            label: 'Request Possible',
            shortLabel: `Request ${language}`,
            action: 'request-interpreter',
            message: `Venue can be contacted to request ${language} interpretation`,
            canBook: false,
            language: language
        };
    }

    // 🔴 RED: No interpreter (default)
    return {
        badge: 'red',
        icon: '🔴',
        label: 'No Interpreter',
        shortLabel: `No ${language} Yet`,
        action: 'advocate',
        message: `No ${language} interpretation confirmed for this event`,
        canBook: false,
        language: language
    };
}

/**
 * Get only events with confirmed interpreters (for Flow 1)
 * LEGAL COMPLIANCE: Only show confirmed events in catalogue
 */
function getConfirmedEvents(allEvents) {
    return allEvents.filter(event => {
        const hasInterpreter = event['INTERPRETERS'] && event['INTERPRETERS'].trim() !== '';
        const isConfirmed = event['INTERPRETER_CONFIRMED'] === 'Yes' ||
                           event['INTERPRETER_CONFIRMED'] === 'TRUE' ||
                           event['INTERPRETER_CONFIRMED'] === true;
        return (isConfirmed || hasInterpreter) && hasInterpreter;
    });
}

// ========================================
// ROUTING SYSTEM (NEW)
// ========================================

/**
 * Simple hash-based routing for 3 flows
 */
const Router = {
    currentRoute: '/',

    routes: {
        '/': 'renderHome',
        '/flow1': 'renderFlow1',
        '/flow2': 'renderFlow2',
        '/flow3': 'renderFlow3',
        '/event': 'renderEventDetail',
        '/how-to-book': 'renderBookingGuide'
    },

    init() {
        window.addEventListener('hashchange', () => this.handleRouteChange());
        // Don't listen to 'load' - we'll call handleRouteChange() manually after app init
    },

    handleRouteChange() {
        const hash = window.location.hash.slice(1) || '/';
        const route = hash.split('?')[0]; // Remove query params

        // Anchor-style hashes (about, contact, etc.) are page sections, not routes.
        // Don't let the router hide flows for these - just let the browser scroll.
        if (route && !route.startsWith('/') && route !== 'events') {
            return;
        }

        this.currentRoute = route;

        // Hide all flow sections
        this.hideAllFlows();

        const isHome = (route === '/' || route === '');

        // Toggle header layout: logo left on home, centred with back arrow elsewhere
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            if (isHome) {
                headerContent.classList.add('header-home');
            } else {
                headerContent.classList.remove('header-home');
            }
        }

        // Show hero only on home page
        const hero = document.querySelector('.hero-section');
        if (hero) {
            hero.style.display = isHome ? '' : 'none';
        }

        // Always scroll to top on navigation
        if (!isHome || !sessionStorage.getItem('pi-visited')) {
            window.scrollTo(0, 0);
            if (!sessionStorage.getItem('pi-visited')) {
                sessionStorage.setItem('pi-visited', '1');
            }
        }

        // On mobile, only show about/contact/footer on home page
        const aboutSection = document.querySelector('.about-section');
        const contactSection = document.querySelector('.contact-section');
        const appFooter = document.querySelector('.app-footer');
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            if (aboutSection) aboutSection.style.display = isHome ? '' : 'none';
            if (contactSection) contactSection.style.display = isHome ? '' : 'none';
            if (appFooter) appFooter.style.display = isHome ? '' : 'none';
        } else {
            if (aboutSection) aboutSection.style.display = '';
            if (contactSection) contactSection.style.display = '';
            if (appFooter) appFooter.style.display = '';
        }

        // Route to appropriate flow
        if (isHome) {
            this.renderHome();
        } else if (route === '/flow1' || route.startsWith('/flow1/') || route === 'events') {
            this.renderFlow1();
        } else if (route === '/flow2') {
            this.renderFlow2();
        } else if (route === '/flow3') {
            this.renderFlow3();
        } else if (route === '/how-to-book') {
            this.renderBookingGuide();
        } else if (route.startsWith('/event/')) {
            this.renderEventDetail();
        } else {
            this.renderHome();
        }
    },

    hideAllFlows() {
        const flows = ['homeFlow', 'flow1Section', 'flow2Section', 'flow3Section', 'eventDetailSection', 'bookingGuideSection'];
        flows.forEach(flowId => {
            const el = document.getElementById(flowId);
            if (el) el.style.display = 'none';
        });
    },

    renderHome() {
        const homeEl = document.getElementById('homeFlow');
        if (homeEl) {
            homeEl.style.display = 'block';
        } else {
            // Fallback to flow1 if home not created yet
            this.renderFlow1();
        }
    },

    renderFlow1() {
        const flow1El = document.getElementById('flow1Section');
        if (flow1El) {
            flow1El.style.display = 'block';
        }
        // Events are already loaded during init(), no need to reload
    },

    renderFlow2() {
        const flow2El = document.getElementById('flow2Section');
        if (flow2El) {
            flow2El.style.display = 'block';
        }
    },

    renderFlow3() {
        const flow3El = document.getElementById('flow3Section');
        if (flow3El) {
            flow3El.style.display = 'block';
            // Pre-fill form from URL params if coming from an event card
            setTimeout(prefillRequestForm, 100);
        }
    },

    renderBookingGuide() {
        const bgEl = document.getElementById('bookingGuideSection');
        if (bgEl) {
            bgEl.style.display = 'block';
            // Show the inline hero within the section
            const bgHero = bgEl.querySelector('.hero-section');
            if (bgHero) bgHero.style.display = '';
        }
        // Prefetch venue fragment in background for offline readiness
        loadBgVenues();
    },

    renderEventDetail() {
        const eventDetailEl = document.getElementById('eventDetailSection');
        if (eventDetailEl) {
            eventDetailEl.style.display = 'block';
        }
    },

    navigate(path) {
        window.location.hash = path;
    }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Parse categories from comma-separated string
 * Returns array of trimmed category names
 */
function parseCategories(categoryString) {
    if (!categoryString) return [];
    return categoryString.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
}

/**
 * Check if event has a specific category
 */
function eventHasCategory(event, targetCategory) {
    const categories = parseCategories(event['CATEGORY']);

    // Special handling for Festival aggregation
    if (targetCategory === 'Festival') {
        return categories.some(cat => cat.toLowerCase().includes('festival'));
    }

    return categories.some(cat => cat.toLowerCase() === targetCategory.toLowerCase());
}

// ========================================
// STATE MANAGEMENT
// ========================================
const AppState = {
    allEvents: [],
    filteredEvents: [],
    searchVocabulary: [], // For "Did you mean?" fuzzy search suggestions
    displayMode: localStorage.getItem('pi-view-mode') || 'card', // 'card', 'compact', 'list' - how events are displayed
    currentFlow: 'home', // NEW: 'home', 'flow1', 'flow2', 'flow3'
    badgeCache: new Map(), // NEW: Cache badge calculations
    selectedEvent: null, // NEW: For event detail view
    filters: {
        search: '',
        time: 'all',
        selectedMonth: '',
        interpretation: 'all',
        category: 'all',
        location: 'all'
    },
    isLoading: false,
    lastFetch: null,
    viewMode: 'categories', // 'categories' or 'events' - which section is shown
    selectedCategory: null
};

// ========================================
// DOM ELEMENTS (Initialized after DOM loads!)
// ========================================
let DOM = {};

function initDOMReferences() {
    DOM = {
        // Header
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileNav: document.getElementById('mobileNav'),

        // Category Tabs
        categoryTabs: document.getElementById('categoryTabs'),

        // Search & Filters
        searchInput: document.getElementById('searchInput'),
        searchClear: document.getElementById('searchClear'),
        timeFilter: document.getElementById('timeFilter'),
        monthSelector: document.getElementById('monthSelector'),
        monthFilter: document.getElementById('monthFilter'),
        interpretationFilter: document.getElementById('interpretationFilter'),
        locationFilter: document.getElementById('locationFilter'),
        activeFilters: document.getElementById('activeFilters'),

        // Results
        resultsTitle: document.getElementById('resultsTitle'),
        viewToggle: document.getElementById('viewToggle'),
        refreshBtn: document.getElementById('refreshBtn'),
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        eventsGrid: document.getElementById('eventsGrid'),

        // Views
        categorySelectionView: document.getElementById('categorySelectionView'),
        filtersSection: document.querySelector('.filters-section'),
        eventsSection: document.querySelector('.events-section')
    };
}

// ========================================
// LOADING STATE
// ========================================
function setLoadingState(isLoading) {
    AppState.isLoading = isLoading;
    
    if (isLoading) {
        DOM.loadingState.classList.add('show');
        DOM.eventsGrid.classList.add('hidden');
        DOM.emptyState.classList.remove('show');
    } else {
        DOM.loadingState.classList.remove('show');
    }
}

// ========================================
// LAST UPDATED TIMESTAMP
// ========================================

function updateLastUpdatedTimestamp(timestamp, isStale = false) {
    const element = document.getElementById('lastUpdatedTimestamp');
    if (!element) return;

    const date = new Date(timestamp);
    const options = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    const formattedDate = date.toLocaleDateString('en-GB', options);

    if (isStale) {
        // Show stale cache indicator with relative time
        const hoursAgo = Math.round((Date.now() - timestamp) / (1000 * 60 * 60));
        const timeAgo = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`;
        element.innerHTML = `<span class="stale-badge">Cached data from ${timeAgo}</span> (${formattedDate})`;
    } else {
        element.textContent = `Events data last updated: ${formattedDate}`;
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    
    const events = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length < headers.length) continue;
        
        const event = {};
        headers.forEach((header, index) => {
            event[header] = row[index] ? row[index].trim() : '';
        });
        
        if (event['EVENT'] && event['DATE']) {
            events.push(event);
        }
    }
    
    return events;
}

function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const nextChar = row[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function formatDate(dateString) {
    try {
        const parts = dateString.split(/[./\-]/);
        if (parts.length === 3) {
            let [day, month, year] = parts;
            
            if (year.length === 2) {
                year = '20' + year;
            }
            
            const date = new Date(`${year}-${month}-${day}`);
            
            if (!isNaN(date.getTime())) {
                return {
                    day: day.padStart(2, '0'),
                    month: date.toLocaleString('en-GB', { month: 'short' }).toUpperCase(),
                    full: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                    timestamp: date.getTime(),
                    dateObj: date
                };
            }
        }
    } catch (error) {
        console.warn('Date parse error:', error);
    }
    
    // Unparseable dates sort to the end (far future) rather than appearing as "now"
    return {
        day: '--',
        month: '---',
        full: dateString,
        timestamp: Number.MAX_SAFE_INTEGER,
        dateObj: new Date(9999, 11, 31)
    };
}

function detectInterpretation(venue) {
    const venueUpper = venue.toUpperCase();

    // Comprehensive Irish locations list
    const irishLocations = [
        // Major cities
        'DUBLIN', 'CORK', 'GALWAY', 'LIMERICK', 'BELFAST', 'WATERFORD',
        // Country/region identifiers
        'IRELAND', 'EIRE', 'IRISH',
        // Counties
        'LAOIS', 'WICKLOW', 'KILDARE', 'MAYO', 'DONEGAL', 'KERRY',
        // Festival-specific locations
        'STRADBALLY', 'ELECTRIC PICNIC', 'PICNIC',
        // Other Irish venues/festivals
        'SLANE', 'MARLAY PARK', '3ARENA', 'AVIVA STADIUM'
    ];

    if (irishLocations.some(loc => venueUpper.includes(loc))) {
        return 'ISL';
    }
    return 'BSL';
}

function generateCalendarFile(event) {
    const date = formatDate(event['DATE']);
    const startDate = date.dateObj;
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    
    const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Performance Interpreting//Events//EN',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@performanceinterpreting.co.uk`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${event['EVENT']}`,
        `DESCRIPTION:${event['DESCRIPTION'] || 'BSL & ISL interpreted event'}\\nInterpreted by: ${event['INTERPRETERS'] || 'TBA'}`,
        `LOCATION:${event['VENUE']}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    return icsContent;
}

function downloadCalendar(event) {
    const icsContent = generateCalendarFile(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event['EVENT'].replace(/[^a-z0-9]/gi, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function shareEvent(event) {
    const shareData = {
        title: event['EVENT'],
        text: `${event['EVENT']} - Interpreted by ${event['INTERPRETERS'] || 'Professional BSL & ISL interpreters'}`,
        url: event['EVENT URL'] || event['BOOKING GUIDE'] || window.location.href
    };
    
    try {
        if (navigator.share && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            const text = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
            await navigator.clipboard.writeText(text);
            alert('Event details copied to clipboard!');
        }
    } catch (error) {
        console.error('Share failed:', error);
    }
}

// ========================================
// MULTI-DATE EVENT GROUPING
// ========================================

/**
 * Normalize event name for grouping comparison
 */
function normalizeEventName(name) {
    if (!name) return '';
    return name.toString().toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/['"]/g, '')
        .replace(/\s*\(\d+ dates?\).*$/i, ''); // Remove existing "(X dates)" suffix
}

/**
 * Normalize venue name for grouping comparison
 */
function normalizeVenueName(venue) {
    if (!venue) return '';
    let normalized = venue.toString().toLowerCase().trim();
    normalized = normalized.replace(/\bthe\b/g, '');
    normalized = normalized.replace(/,?\s*london$/i, '');
    normalized = normalized.replace(/,?\s*uk$/i, '');
    return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Parse date string to Date object
 * Handles DD.MM.YY and DD.MM.YYYY formats
 */
function parseDateString(dateStr) {
    if (!dateStr) return null;

    // Handle date ranges - take first date
    if (dateStr.includes(' - ')) {
        dateStr = dateStr.split(' - ')[0];
    }

    const parts = dateStr.toString().trim().split('.');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;

    return new Date(year, month, day);
}

/**
 * Format date range from array of dates
 * Returns: "24 Jul" for single, "24-26 Jul" for consecutive, "24, 25, 28 Jul" for non-consecutive
 */
function formatDateRange(dates) {
    if (!dates || dates.length === 0) return '';
    if (dates.length === 1) {
        const d = dates[0];
        return `${d.day} ${d.month}`;
    }

    // Sort dates
    const sorted = [...dates].sort((a, b) => a.dateObj - b.dateObj);

    // Check if consecutive
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];

    // If all in same month, show range
    if (firstDate.month === lastDate.month) {
        return `${firstDate.day}-${lastDate.day} ${firstDate.month}`;
    }

    // Different months
    return `${firstDate.day} ${firstDate.month} - ${lastDate.day} ${lastDate.month}`;
}

/**
 * Group events by event name + venue
 * Returns array of grouped event objects with allDates array
 */
function groupEventsByNameAndVenue(events) {
    const groups = new Map();

    events.forEach(event => {
        const eventName = normalizeEventName(event['EVENT']);
        const venueName = normalizeVenueName(event['VENUE']);
        const key = `${eventName}|||${venueName}`;

        if (!groups.has(key)) {
            groups.set(key, {
                ...event,
                allDates: [],
                isGrouped: false
            });
        }

        const group = groups.get(key);
        const dateStr = event['DATE'];
        const dateObj = parseDateString(dateStr);
        const formatted = formatDate(dateStr);

        group.allDates.push({
            original: dateStr,
            dateObj: dateObj,
            day: formatted.day,
            month: formatted.month,
            time: event['TIME'] || '',
            interpreters: event['INTERPRETERS'] || ''
        });

        // Keep the earliest date as the primary display date
        if (dateObj && (!group._earliestDate || dateObj < group._earliestDate)) {
            group._earliestDate = dateObj;
            group['DATE'] = dateStr;
            group['TIME'] = event['TIME'];
            group['INTERPRETERS'] = event['INTERPRETERS'];
        }
    });

    // Mark groups with multiple dates
    groups.forEach(group => {
        if (group.allDates.length > 1) {
            group.isGrouped = true;
            // Sort dates chronologically
            group.allDates.sort((a, b) => a.dateObj - b.dateObj);
        }
    });

    return Array.from(groups.values());
}

// ========================================
// EVENT CARD GENERATION
// ========================================

function createEventCard(event) {
    const date = formatDate(event['DATE']);
    const hasBookingGuide = event['BOOKING GUIDE'] && event['BOOKING GUIDE'].trim() !== '';
    const hasTicketLink = event['EVENT URL'] && event['EVENT URL'].trim() !== '';

    // Check if this is a multi-date grouped event
    const isGrouped = event.isGrouped && event.allDates && event.allDates.length > 1;
    const dateRange = isGrouped ? formatDateRange(event.allDates) : null;
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // NEW: Calculate badge status
    const badge = calculateBadgeStatus(event);

    // NEW: Updated primary button based on badge status
    // ACCESS FIRST - No direct ticket links for green badge events
    let primaryButton = '';
    if (badge.canBook) {
        // Green badge - open access-first modal for booking guidance
        primaryButton = `
            <button class="btn-primary" onclick='openAccessFirstModal(${JSON.stringify(event).replace(/'/g, "&apos;")})'>
                🎟️ Book BSL Tickets
            </button>
        `;
    } else {
        // Orange/Red badge - show request BSL option
        // If venue has VRS or contact info in VENUE_CONTACTS, open the modal
        // so the user gets VRS as primary + email as secondary. Otherwise go to Flow 3.
        const venueMatches = findMatchingVenues(event['VENUE'] || '');
        const hasVenueInfo = venueMatches.length > 0 && (venueMatches[0].vrs || venueMatches[0].email);

        if (hasVenueInfo) {
            // Known venue — open modal with VRS/email options
            primaryButton = `
                <button class="btn-orange" onclick='openRequestBSLModal(${JSON.stringify(event).replace(/'/g, "&apos;")})'>
                    ✉️ Request Interpreter
                </button>
            `;
        } else {
            // Unknown venue — go to Flow 3 general request form
            primaryButton = `
                <a href="${buildRequestInterpreterUrl(event)}" class="btn-orange">
                    ✉️ Request Interpreter
                </a>
            `;
        }
    }

    // Build expandable dates section for multi-date events
    let expandableDates = '';
    if (isGrouped) {
        const datesList = event.allDates.map(d => `
            <div class="expandable-date-item">
                <span class="date-item-date">📅 ${d.day} ${d.month}</span>
                ${d.time ? `<span class="date-item-time">🕐 ${d.time}</span>` : ''}
                ${d.interpreters ? `<span class="date-item-interpreters">👥 ${d.interpreters}</span>` : ''}
            </div>
        `).join('');

        expandableDates = `
            <div class="multi-date-section">
                <button class="multi-date-toggle" onclick="toggleDates('${eventId}')" aria-expanded="false">
                    <span class="toggle-text">📅 ${event.allDates.length} dates available</span>
                    <span class="toggle-arrow">▼</span>
                </button>
                <div class="expandable-dates" id="dates-${eventId}" style="display: none;">
                    ${datesList}
                </div>
            </div>
        `;
    }

    // Date badge shows range for multi-date, single date otherwise
    // For multi-date: show 3 lines - days, month, count
    let dateBadgeContent;
    if (isGrouped) {
        const hasValidRange = dateRange && !dateRange.includes('undefined');
        if (hasValidRange) {
            // Split "27-28 JAN" into days and month
            const parts = dateRange.split(' ');
            const days = parts[0]; // "27-28"
            const month = parts.slice(1).join(' '); // "JAN" or "JAN - 28 FEB" for cross-month
            dateBadgeContent = `
                <span class="date-badge-day">${days}</span>
                <span class="date-badge-month">${month}</span>
                <span class="date-badge-count">${event.allDates.length} dates</span>
            `;
        } else {
            dateBadgeContent = `
                <span class="date-badge-multi-icon">📅</span>
                <span class="date-badge-count">${event.allDates.length} shows</span>
            `;
        }
    } else {
        dateBadgeContent = `
            <span class="date-badge-day">${date.day}</span>
            <span class="date-badge-month">${date.month}</span>
        `;
    }

    const isCancelled = (event['STATUS'] || '').toLowerCase() === 'cancelled';

    return `
        <article class="event-card ${isGrouped ? 'multi-date-card' : ''} ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${eventId}">
            ${isCancelled ? `
            <div class="event-badge-indicator badge-cancelled">
                <span class="badge-label">CANCELLED</span>
            </div>
            ` : badge.badge === 'green' ? `
            <div class="event-badge-indicator badge-green">
                <span class="badge-label">${badge.shortLabel}</span>
            </div>
            ` : ''}

            <div class="event-image-container">
                <img
                    src="${event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? event['IMAGE URL'] : CONFIG.defaultImage}"
                    alt="${event['EVENT']}"
                    class="event-image"
                    onerror="this.src='${CONFIG.defaultImage}'"
                >

                <div class="date-badge ${isGrouped ? 'date-badge-multi' : ''}">
                    ${dateBadgeContent}
                </div>
            </div>

            <div class="event-content">
                <h3 class="event-title">${event['EVENT']}</h3>

                <div class="event-meta-simple">
                    📍 ${event['VENUE']}<br>
                    ${!isGrouped && event['TIME'] ? `🕐 ${event['TIME']}` : ''}
                </div>

                ${expandableDates}

                ${!isGrouped && event['INTERPRETERS'] && badge.badge === 'green' ? `
                    <div class="event-interpreters-simple">
                        👥 ${event['INTERPRETERS']}
                    </div>
                ` : ''}

                <div class="event-actions">
                    ${primaryButton}
                </div>

                <div class="event-utility-actions">
                    <button class="utility-btn" onclick='addToCalendar(${JSON.stringify(event).replace(/'/g, "&apos;")})' aria-label="Add to calendar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Calendar</span>
                    </button>
                    <button class="utility-btn" onclick='shareEvent(${JSON.stringify(event).replace(/'/g, "&apos;")})' aria-label="Share event">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                        <span>Share</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Toggle expandable dates section
 */
function toggleDates(eventId) {
    const datesDiv = document.getElementById(`dates-${eventId}`);
    const button = datesDiv.previousElementSibling;
    const arrow = button.querySelector('.toggle-arrow');

    if (datesDiv.style.display === 'none') {
        datesDiv.style.display = 'block';
        arrow.textContent = '▲';
        button.setAttribute('aria-expanded', 'true');
    } else {
        datesDiv.style.display = 'none';
        arrow.textContent = '▼';
        button.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Create a compact event card (2-column grid on mobile)
 */
function createCompactEventCard(event) {
    const date = formatDate(event['DATE']);
    const badge = calculateBadgeStatus(event);
    const eventJson = JSON.stringify(event).replace(/'/g, "&apos;");

    let actionButton = '';
    if (badge.canBook) {
        actionButton = `<button class="compact-btn" onclick='openAccessFirstModal(${eventJson})'>🎟️ Book BSL Tickets</button>`;
    } else {
        const venueMatches = findMatchingVenues(event['VENUE'] || '');
        const hasVenueInfo = venueMatches.length > 0 && (venueMatches[0].vrs || venueMatches[0].email);
        if (hasVenueInfo) {
            actionButton = `<button class="compact-btn compact-btn-orange" onclick='openRequestBSLModal(${eventJson})'>✉️ Request Interpreter</button>`;
        } else {
            actionButton = `<a href="${buildRequestInterpreterUrl(event)}" class="compact-btn compact-btn-orange">✉️ Request Interpreter</a>`;
        }
    }

    const isCancelled = (event['STATUS'] || '').toLowerCase() === 'cancelled';
    let badgeIndicator = '';
    if (isCancelled) {
        badgeIndicator = `<div class="event-badge-indicator badge-cancelled"><span class="badge-label">CANCELLED</span></div>`;
    } else if (badge.badge === 'green') {
        badgeIndicator = `<div class="event-badge-indicator badge-green"><span class="badge-label">✅ BSL</span></div>`;
    }

    return `
        <article class="event-card-compact ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${Date.now()}-${Math.random()}">
            ${badgeIndicator}
            <div class="compact-image-container">
                <img
                    src="${event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? event['IMAGE URL'] : CONFIG.defaultImage}"
                    alt="${event['EVENT']}"
                    class="compact-image"
                    onerror="this.src='${CONFIG.defaultImage}'"
                >
                <div class="compact-date-badge">
                    <span class="compact-badge-day">${date.day}</span>
                    <span class="compact-badge-month">${date.month}</span>
                </div>
            </div>

            <div class="compact-content">
                <h3 class="compact-title">${event['EVENT']}</h3>
                <div class="compact-venue">📍 ${event['VENUE']}</div>
                ${actionButton}
            </div>
        </article>
    `;
}

/**
 * Create a list view event item (text-only rows)
 */
function createListEventItem(event) {
    const date = formatDate(event['DATE']);
    const badge = calculateBadgeStatus(event);
    const eventJson = JSON.stringify(event).replace(/'/g, "&apos;");

    let actionButton = '';
    if (badge.canBook) {
        actionButton = `<button class="list-btn" onclick='openAccessFirstModal(${eventJson})'>🎟️ Book BSL Tickets</button>`;
    } else {
        const venueMatches = findMatchingVenues(event['VENUE'] || '');
        const hasVenueInfo = venueMatches.length > 0 && (venueMatches[0].vrs || venueMatches[0].email);
        if (hasVenueInfo) {
            actionButton = `<button class="list-btn list-btn-orange" onclick='openRequestBSLModal(${eventJson})'>✉️ Request Interpreter</button>`;
        } else {
            actionButton = `<a href="${buildRequestInterpreterUrl(event)}" class="list-btn list-btn-orange">✉️ Request Interpreter</a>`;
        }
    }

    const isCancelled = (event['STATUS'] || '').toLowerCase() === 'cancelled';
    let statusBadge = '';
    if (isCancelled) {
        statusBadge = `<span class="list-status-badge badge-cancelled-inline">CANCELLED</span>`;
    } else if (badge.badge === 'green') {
        statusBadge = `<span class="list-status-badge badge-green-inline">✅ BSL</span>`;
    }

    return `
        <article class="event-list-item ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${Date.now()}-${Math.random()}">
            <div class="list-date">
                <span class="list-date-day">${date.day}</span>
                <span class="list-date-month">${date.month}</span>
            </div>

            <div class="list-content">
                <h3 class="list-title">${event['EVENT']}</h3>
                <div class="list-meta">
                    <span class="list-venue">📍 ${event['VENUE']}</span>
                    ${event['TIME'] ? `<span class="list-time">🕐 ${event['TIME']}</span>` : ''}
                    ${statusBadge}
                </div>
            </div>

            ${actionButton}
        </article>
    `;
}

function renderEvents(events) {
    DOM.eventsGrid.innerHTML = '';

    if (events.length === 0) {
        DOM.emptyState.classList.add('show');
        DOM.eventsGrid.classList.add('hidden');
        updateResultsTitle(0);
        return;
    }

    DOM.emptyState.classList.remove('show');
    DOM.eventsGrid.classList.remove('hidden');

    // Update grid class based on display mode
    DOM.eventsGrid.className = 'events-grid';
    DOM.eventsGrid.classList.add(`view-${AppState.displayMode}`);

    // Group multi-date events (same event + venue = one card)
    // Only for default card view, not compact or list
    let eventsToRender = events;
    if (AppState.displayMode === 'card' || !AppState.displayMode) {
        eventsToRender = groupEventsByNameAndVenue(events);
    }

    // Use DocumentFragment for faster rendering
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');

    // Choose the appropriate card function based on display mode
    const cardFunction = AppState.displayMode === 'compact' ? createCompactEventCard :
                        AppState.displayMode === 'list' ? createListEventItem :
                        createEventCard;

    eventsToRender.forEach(event => {
        tempDiv.innerHTML = cardFunction(event);
        fragment.appendChild(tempDiv.firstElementChild);
    });

    DOM.eventsGrid.appendChild(fragment);

    // Update title with back button if in events view
    const hasCategoryFilter = AppState.filters.category !== 'all';
    const resultsHeaderContent = document.querySelector('.results-header-content');

    if (AppState.viewMode === 'events' && resultsHeaderContent) {
        const badgeLegend = `<div class="badge-legend">
            <span class="badge-legend-item badge-legend-green">✅ Interpreter Booked</span>
            <span class="badge-legend-item badge-legend-orange">🟠 Request Interpreter</span>
        </div>`;

        // Check if we should show category-specific title or just count
        if (AppState.selectedCategory && hasCategoryFilter) {
            let categoryDisplay = AppState.selectedCategory;
            let categoryIcon = getCategoryIcon(AppState.selectedCategory);

            // Special handling for Festival sub-categories
            if (AppState.selectedCategory === 'Festival' && AppState.festivalSubcategory) {
                if (AppState.festivalSubcategory === 'all') {
                    categoryDisplay = 'All Festivals';
                    categoryIcon = '🎪';
                } else if (AppState.festivalSubcategory === 'camping') {
                    categoryDisplay = 'Camping Festivals';
                    categoryIcon = '⛺';
                } else if (AppState.festivalSubcategory === 'non-camping') {
                    categoryDisplay = 'Non-Camping Festivals';
                    categoryIcon = '🎵';
                }
            }

            resultsHeaderContent.innerHTML = `
                ${badgeLegend}
                <h2 class="results-title">${categoryIcon} ${categoryDisplay}: ${events.length} ${events.length === 1 ? 'event' : 'events'}</h2>
            `;
        } else {
            // Show just count
            const eventWord = events.length === 1 ? 'event' : 'events';
            const hasActiveFilters = AppState.filters.search ||
                                     AppState.filters.time !== 'all' ||
                                     AppState.filters.interpretation !== 'all' ||
                                     AppState.filters.location !== 'all';

            let titleText;
            if (hasActiveFilters) {
                titleText = `${events.length} ${eventWord} found`;
            } else {
                titleText = `All: ${events.length} ${eventWord}`;
            }

            resultsHeaderContent.innerHTML = `
                ${badgeLegend}
                <h2 class="results-title">${titleText}</h2>
            `;
        }
    } else {
        updateResultsTitle(events.length);
    }
}

function updateResultsTitle(count) {
    const eventWord = count === 1 ? 'event' : 'events';
    const resultsHeaderContent = document.querySelector('.results-header-content');
    if (resultsHeaderContent) {
        // Check if there are any active filters
        const hasActiveFilters = AppState.filters.search ||
                                 AppState.filters.time !== 'all' ||
                                 AppState.filters.interpretation !== 'all' ||
                                 AppState.filters.category !== 'all' ||
                                 AppState.filters.location !== 'all';

        let titleText;
        if (hasActiveFilters) {
            titleText = `${count} ${eventWord} found`;
        } else {
            titleText = `All: ${count} ${eventWord}`;
        }

        resultsHeaderContent.innerHTML = `<h2 class="results-title" id="resultsTitle">${titleText}</h2>`;
        // Re-get the DOM reference since we just replaced it
        DOM.resultsTitle = document.getElementById('resultsTitle');
    }
}

// ========================================
// CATEGORY SELECTION VIEW
// ========================================

/**
 * Create a large category card for the selection view
 */
function createCategoryCard(category, count, icon) {
    const escaped = category.replace(/'/g, "\\'");
    return `
        <div class="category-card" role="button" tabindex="0"
             aria-label="${category}, ${count} ${count === 1 ? 'event' : 'events'}"
             onclick="openCategory('${escaped}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCategory('${escaped}')}">
            <div class="category-card-icon" aria-hidden="true">${icon}</div>
            <h3 class="category-card-title">${category}</h3>
            <p class="category-card-count">${count} ${count === 1 ? 'event' : 'events'}</p>
            <div class="category-card-arrow" aria-hidden="true">→</div>
        </div>
    `;
}

/**
 * Render category selection view - OPTIMIZED with instant UI
 */
function renderCategorySelection() {
    const cardsContainer = document.getElementById('categoryCardsContainer');

    if (!cardsContainer) {
        return;
    }

    if (AppState.allEvents.length === 0) {
        cardsContainer.innerHTML = '<p style="text-align: center; color: #64748B; padding: 40px 20px;">Loading events...</p>';
        return;
    }

    // Count individual events per category (matches the count shown in event listings)
    const categoryCounts = {};

    for (let i = 0; i < AppState.allEvents.length; i++) {
        const event = AppState.allEvents[i];

        const categories = parseCategories(event['CATEGORY'] || 'Other');

        for (const rawCat of categories) {
            let category = rawCat;

            // Aggregate all festival types under "Festival"
            if (category.toLowerCase().includes('festival')) {
                category = 'Festival';
            } else {
                // Normalize category case to canonical form
                const knownCategories = ['Concert', 'Sports', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions'];
                const match = knownCategories.find(c => c.toLowerCase() === category.toLowerCase());
                if (match) category = match;
            }

            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    }

    // Category icons mapping
    const categoryIcons = {
        'Concert': '🏟️',
        'Sports': '🏆',
        'Festival': '🎪',
        'Comedy': '😂',
        'Family': '👨‍👩‍👧‍👦',
        'Literature': '📚',
        'Theatre': '🎭',
        'Dance': '💃',
        'Talks & Discussions': '🗣️',
        'Cultural': '🏛️',
        'Other': '🎟️'
    };

    // Sort categories in priority order
    const categoryOrder = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions', 'Cultural', 'Other'];
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // Build HTML using array join for better performance
    const cardsHtml = sortedCategories.map(category => {
        const icon = categoryIcons[category] || categoryIcons['Other'];
        const count = categoryCounts[category];
        return createCategoryCard(category, count, icon);
    }).join('');

    // Single DOM update to cards container only
    cardsContainer.innerHTML = cardsHtml;
}

/**
 * Open a specific category and show its events
 */
function openCategory(category) {
    // Special handling for Festival - show sub-category selection
    if (category === 'Festival') {
        AppState.viewMode = 'festival-subcategories';
        AppState.selectedCategory = category;
        renderFestivalSubcategories();
        return;
    }

    AppState.viewMode = 'events';
    AppState.selectedCategory = category;
    AppState.filters.category = category;

    // Switch views
    switchToEventsView();

    // Apply filters and render events
    applyFilters();
}

/**
 * Render Festival sub-category selection view
 */
function renderFestivalSubcategories() {
    const cardsContainer = document.getElementById('categoryCardsContainer');

    if (!cardsContainer) {
        return;
    }

    // Count festival types - LEGAL COMPLIANCE: only confirmed interpreters
    let allFestivalsCount = 0;
    let campingCount = 0;
    let nonCampingCount = 0;

    AppState.allEvents.forEach(event => {
        // Filter for confirmed interpreters only
        const hasInterpreter = event['INTERPRETERS'] && event['INTERPRETERS'].trim() !== '';
        const isConfirmed = event['INTERPRETER_CONFIRMED'] === 'Yes' ||
                           event['INTERPRETER_CONFIRMED'] === 'TRUE' ||
                           event['INTERPRETER_CONFIRMED'] === true;

        // Skip events without confirmed interpreters
        if (!hasInterpreter || (!isConfirmed && !hasInterpreter)) {
            return;
        }

        const categories = parseCategories(event['CATEGORY']);
        const festivalCategories = categories.filter(cat => cat.toLowerCase().includes('festival'));

        if (festivalCategories.length > 0) {
            allFestivalsCount++;

            // Check category types
            const hasCamping = festivalCategories.some(cat => {
                const catLower = cat.toLowerCase();
                return catLower.includes('camping') && !catLower.includes('non-camping');
            });
            const hasNonCamping = festivalCategories.some(cat => {
                const catLower = cat.toLowerCase();
                return catLower.includes('non-camping') ||
                       (!catLower.includes('camping') && catLower.includes('festival'));
            });

            if (hasCamping) campingCount++;
            if (hasNonCamping) nonCampingCount++;
        }
    });

    // Build sub-category cards
    const cardsHtml = `
        <div class="festival-header">
            <button onclick="backToCategorySelection()" class="back-button">
                ← Back to Categories
            </button>
            <div class="festival-title-section">
                <h2 class="festival-title">🎪 Festival Events</h2>
                <p class="festival-subtitle">Choose a festival type to browse</p>
            </div>
        </div>

        <div class="festival-subcategory-grid">
            <div class="category-card" onclick="openFestivalSubcategory('all')">
                <div class="category-card-icon">🎪</div>
                <h3 class="category-card-title">All Festivals</h3>
                <p class="category-card-count">${allFestivalsCount} ${allFestivalsCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>

            <div class="category-card" onclick="openFestivalSubcategory('camping')">
                <div class="category-card-icon">⛺</div>
                <h3 class="category-card-title">Camping Festivals</h3>
                <p class="category-card-count">${campingCount} ${campingCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>

            <div class="category-card" onclick="openFestivalSubcategory('non-camping')">
                <div class="category-card-icon">🎵</div>
                <h3 class="category-card-title">Non-Camping Festivals</h3>
                <p class="category-card-count">${nonCampingCount} ${nonCampingCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>
        </div>
    `;

    cardsContainer.innerHTML = cardsHtml;

    // Make sure the category selection view is visible
    if (DOM.categorySelectionView) {
        DOM.categorySelectionView.style.display = 'block';
    }
    if (DOM.filtersSection) {
        DOM.filtersSection.style.display = 'none';
    }
    if (DOM.eventsSection) {
        DOM.eventsSection.style.display = 'none';
    }
}

/**
 * Open a Festival sub-category
 */
function openFestivalSubcategory(subcategory) {
    AppState.viewMode = 'events';
    AppState.selectedCategory = 'Festival';
    AppState.filters.category = 'Festival'; // Set the filter!
    AppState.festivalSubcategory = subcategory; // Track sub-category

    // Switch views
    switchToEventsView();

    // Apply filters with festival sub-category
    applyFilters();
}

/**
 * Return to Festival sub-category selection
 */
function backToFestivalSubcategories() {
    AppState.viewMode = 'festival-subcategories';
    AppState.festivalSubcategory = null;
    AppState.filters.search = '';

    // Reset search input
    DOM.searchInput.value = '';
    DOM.searchClear.classList.remove('visible');

    // Render festival sub-categories
    renderFestivalSubcategories();
}

/**
 * Return to category selection view
 */
function backToCategorySelection() {
    AppState.viewMode = 'categories';
    AppState.selectedCategory = null;
    AppState.filters.category = 'all';
    AppState.filters.search = '';
    AppState.festivalSubcategory = null; // Reset festival sub-category

    // Reset search input
    DOM.searchInput.value = '';
    DOM.searchClear.classList.remove('visible');

    // Switch views
    switchToCategoryView();
}

/**
 * Switch to category selection view
 */
function switchToCategoryView() {
    if (DOM.categorySelectionView) {
        DOM.categorySelectionView.style.display = 'block';
    }

    if (DOM.filtersSection) {
        DOM.filtersSection.style.display = 'none';
    }

    if (DOM.eventsSection) {
        DOM.eventsSection.style.display = 'none';
    }

    renderCategorySelection();
}

/**
 * Switch to events list view
 */
function switchToEventsView() {
    if (DOM.categorySelectionView) {
        DOM.categorySelectionView.style.display = 'none';
    }
    if (DOM.filtersSection) {
        DOM.filtersSection.style.display = 'block';
    }
    if (DOM.eventsSection) {
        DOM.eventsSection.style.display = 'block';
    }
}

/**
 * Change display mode (card, compact, list)
 */
function changeDisplayMode(mode) {
    if (['card', 'compact', 'list'].includes(mode)) {
        AppState.displayMode = mode;
        localStorage.setItem('pi-view-mode', mode);
        updateViewToggleButtons();
        renderEvents(AppState.filteredEvents);
    }
}

/**
 * Update active state on view toggle buttons
 */
function updateViewToggleButtons() {
    if (!DOM.viewToggle) return;

    const viewToggleBtns = DOM.viewToggle.querySelectorAll('.view-toggle-btn');
    viewToggleBtns.forEach(btn => {
        const btnMode = btn.getAttribute('data-view');
        if (btnMode === AppState.displayMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Get category icon
 */
function getCategoryIcon(category) {
    const categoryIcons = {
        'Concert': '🏟️',
        'Sports': '🏆',
        'Festival': '🎪',
        'Comedy': '😂',
        'Family': '👨‍👩‍👧‍👦',
        'Literature': '📚',
        'Theatre': '🎭',
        'Dance': '💃',
        'Talks & Discussions': '🗣️',
        'Cultural': '🏛️',
        'Other': '🎟️'
    };
    return categoryIcons[category] || '🎟️';
}

// Make functions available globally
window.openCategory = openCategory;
window.openFestivalSubcategory = openFestivalSubcategory;
window.backToCategorySelection = backToCategorySelection;
window.backToFestivalSubcategories = backToFestivalSubcategories;

/**
 * Context-aware back navigation for the header back button.
 * Steps back through the in-app hierarchy before falling back to history.back().
 */
function handleBackNavigation() {
    const route = Router.currentRoute;
    const isInFlow1 = route === '/flow1' || (route && route.startsWith('/flow1/'));

    if (isInFlow1 && AppState.viewMode === 'events') {
        if (AppState.selectedCategory === 'Festival' && AppState.festivalSubcategory) {
            backToFestivalSubcategories();
        } else {
            backToCategorySelection();
        }
    } else if (isInFlow1 && AppState.viewMode === 'festival-subcategories') {
        backToCategorySelection();
    } else if (route === '/how-to-book') {
        Router.navigate('/');
    } else {
        history.back();
    }
}
window.handleBackNavigation = handleBackNavigation;

// ========================================
// CATEGORY SEARCH BAR
// ========================================

function initCategorySearch() {
    const input = document.getElementById('categorySearchInput');
    const clearBtn = document.getElementById('categorySearchClear');
    const suggestionsContainer = document.getElementById('categorySearchSuggestions');
    if (!input) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        clearBtn.classList.toggle('visible', query.length > 0);

        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }

        // Build suggestions from events data
        const matches = new Set();
        (AppState.allEvents || []).forEach(event => {
            const name = (event.event || '').toLowerCase();
            const venue = (event.venue || '').toLowerCase();
            const city = (event.city || '').toLowerCase();
            if (name.includes(query)) matches.add(event.event);
            if (venue.includes(query)) matches.add(event.venue);
            if (city.includes(query)) matches.add(event.city);
        });

        // Show up to 5 suggestion pills
        const suggestions = [...matches].filter(Boolean).slice(0, 5);
        suggestionsContainer.innerHTML = suggestions.map(s =>
            `<button class="category-search-suggestion" onclick="executeCategorySearch('${s.replace(/'/g, "\\'")}')">${s}</button>`
        ).join('');
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = input.value.trim();
            if (query) executeCategorySearch(query);
        }
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.remove('visible');
        suggestionsContainer.innerHTML = '';
    });
}

function executeCategorySearch(query) {
    // Jump to events view with this search pre-filled
    AppState.viewMode = 'events';
    AppState.selectedCategory = null;
    AppState.filters.category = 'all';
    AppState.filters.search = query;
    switchToEventsView();
    // Fill the events search bar too
    if (DOM.searchInput) {
        DOM.searchInput.value = query;
        DOM.searchClear.classList.add('visible');
    }
    applyFilters();
    // Clear category search
    const catInput = document.getElementById('categorySearchInput');
    const catSuggestions = document.getElementById('categorySearchSuggestions');
    if (catInput) catInput.value = '';
    if (catSuggestions) catSuggestions.innerHTML = '';
    document.getElementById('categorySearchClear')?.classList.remove('visible');
}
window.executeCategorySearch = executeCategorySearch;

// ========================================
// DATA FETCHING
// ========================================

/**
 * Load cached events from localStorage
 * Returns { events, isStale } or null if no valid cache
 */
function loadCachedEvents() {
    try {
        const cached = localStorage.getItem(CONFIG.localStorageKey);
        const timestamp = localStorage.getItem(CONFIG.localStorageTimestampKey);

        if (cached && timestamp) {
            const age = Date.now() - parseInt(timestamp);

            // Discard cache if older than 7 days (likely too stale to be useful)
            if (age > CONFIG.maxCacheAge) {
                console.log('Cache too old (>7 days), discarding');
                localStorage.removeItem(CONFIG.localStorageKey);
                localStorage.removeItem(CONFIG.localStorageTimestampKey);
                return null;
            }

            const events = JSON.parse(cached);
            AppState.allEvents = events;
            AppState.lastFetch = parseInt(timestamp);
            // Build search vocabulary for "Did you mean?" suggestions
            buildSearchVocabulary(events);
            // Update timestamp display from cache
            updateLastUpdatedTimestamp(parseInt(timestamp));

            // Return with staleness indicator
            const isStale = age >= CONFIG.cacheDuration;
            return { events, isStale, cacheAge: age };
        }
    } catch (error) {
        console.error('Error loading cached events:', error);
    }
    return null;
}

/**
 * Save events to localStorage
 */
function saveCachedEvents(events) {
    try {
        localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(events));
        localStorage.setItem(CONFIG.localStorageTimestampKey, Date.now().toString());
    } catch (error) {
        console.error('Error saving cached events:', error);
    }
}

async function fetchEvents(skipCache = false) {
    const now = Date.now();

    // Return in-memory cache if available and fresh
    if (!skipCache && AppState.lastFetch && (now - AppState.lastFetch) < CONFIG.cacheDuration) {
        return AppState.allEvents;
    }

    setLoadingState(true);

    try {
        const response = await fetch(CONFIG.csvUrl, {
            cache: 'default'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        const events = parseCSV(csvText);

        // Sort events by date
        events.sort((a, b) => {
            const dateA = formatDate(a['DATE']).timestamp;
            const dateB = formatDate(b['DATE']).timestamp;
            return dateA - dateB;
        });

        AppState.allEvents = events;
        AppState.lastFetch = now;

        // Build search vocabulary for "Did you mean?" suggestions
        buildSearchVocabulary(events);

        // Save to localStorage for instant next load
        saveCachedEvents(events);

        // Update last updated timestamp
        updateLastUpdatedTimestamp(now);

        return events;
    } catch (error) {
        console.error('Error fetching events:', error);

        // If fetch fails, try to use stale cache
        const cacheResult = loadCachedEvents();
        if (cacheResult && cacheResult.events && cacheResult.events.length > 0) {
            console.log('Using stale cache due to fetch error');
            // Show stale indicator since we're offline/having network issues
            updateLastUpdatedTimestamp(AppState.lastFetch, true);
            return cacheResult.events;
        }

        showErrorState(error.message);
        return [];
    } finally {
        setLoadingState(false);
    }
}

function showErrorState(errorMessage) {
    const categorySection = document.getElementById('categorySelectionView');
    if (categorySection) {
        categorySection.innerHTML = `
            <div class="container" style="text-align: center; padding: 60px 20px;">
                <div style="max-width: 500px; margin: 0 auto;">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" style="margin: 0 auto 20px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h2 style="color: #1E293B; font-size: 24px; margin-bottom: 12px;">Unable to Load Events</h2>
                    <p style="color: #64748B; font-size: 16px; margin-bottom: 24px; line-height: 1.6;">
                        We couldn't fetch the latest events. Please check your internet connection and try again.
                    </p>
                    <button
                        onclick="location.reload()"
                        style="background: #2563EB; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='#1E40AF'"
                        onmouseout="this.style.background='#2563EB'"
                    >
                        Try Again
                    </button>
                    ${errorMessage ? `<p style="color: #94A3B8; font-size: 14px; margin-top: 16px;">Error: ${errorMessage}</p>` : ''}
                </div>
            </div>
        `;
    }
}

// ========================================
// FILTERING & SEARCH
// ========================================

function applyFilters() {
    let filtered = [...AppState.allEvents];

    // LEGAL COMPLIANCE: Flow 1 only shows events with interpreter assignments
    // NOTE: INTERPRETER_CONFIRMED field not yet populated in pipeline, so we use
    // hasInterpreter as fallback. When INTERPRETER_CONFIRMED is implemented,
    // change to: return hasInterpreter && isConfirmed;
    if (AppState.currentFlow === 'flow1' || window.location.hash.includes('/flow1')) {
        filtered = filtered.filter(event => {
            const hasInterpreter = event['INTERPRETERS'] && event['INTERPRETERS'].trim() !== '';
            const isConfirmed = event['INTERPRETER_CONFIRMED'] === 'Yes' ||
                               event['INTERPRETER_CONFIRMED'] === 'TRUE' ||
                               event['INTERPRETER_CONFIRMED'] === true;
            // Show events with interpreter listed (confirmation check ready for future use)
            return hasInterpreter;
        });
    }

    if (AppState.filters.search) {
        const searchTerm = AppState.filters.search.toLowerCase();
        filtered = filtered.filter(event => {
            return (
                event['EVENT'].toLowerCase().includes(searchTerm) ||
                event['VENUE'].toLowerCase().includes(searchTerm) ||
                (event['INTERPRETERS'] && event['INTERPRETERS'].toLowerCase().includes(searchTerm)) ||
                (event['CATEGORY'] && event['CATEGORY'].toLowerCase().includes(searchTerm))
            );
        });
    }
    
    if (AppState.filters.time !== 'all') {
        const now = Date.now();
        const weekFromNow = now + (7 * 24 * 60 * 60 * 1000);
        const monthFromNow = now + (30 * 24 * 60 * 60 * 1000);
        
        filtered = filtered.filter(event => {
            const eventTime = formatDate(event['DATE']).timestamp;
            
            if (AppState.filters.time === 'week') {
                return eventTime >= now && eventTime <= weekFromNow;
            } else if (AppState.filters.time === 'month') {
                return eventTime >= now && eventTime <= monthFromNow;
            } else if (AppState.filters.time === 'select-month' && AppState.filters.selectedMonth) {
                const eventDate = formatDate(event['DATE']).dateObj;
                const eventMonthYear = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
                return eventMonthYear === AppState.filters.selectedMonth;
            }
            return true;
        });
    }
    
    if (AppState.filters.interpretation !== 'all') {
        filtered = filtered.filter(event => {
            const interpretation = event['INTERPRETATION'] || detectInterpretation(event['VENUE']);
            return interpretation === AppState.filters.interpretation;
        });
    }
    
    if (AppState.filters.category !== 'all') {
        filtered = filtered.filter(event => {
            const categories = parseCategories(event['CATEGORY']);

            // Special handling for Festival category with sub-categories
            if (AppState.filters.category === 'Festival') {
                // Check if event has any festival category
                const hasFestival = categories.some(cat => cat.toLowerCase().includes('festival'));

                if (!hasFestival) {
                    return false;
                }

                // If no sub-category specified (e.g., from search), show all festivals
                if (!AppState.festivalSubcategory) {
                    return true;
                }

                // Filter by sub-category
                if (AppState.festivalSubcategory === 'all') {
                    return true;
                } else if (AppState.festivalSubcategory === 'camping') {
                    // Match "Camping Festival" but NOT "Non-Camping Festival"
                    return categories.some(cat => {
                        const catLower = cat.toLowerCase();
                        return catLower.includes('camping') && catLower.includes('festival') && !catLower.includes('non-camping');
                    });
                } else if (AppState.festivalSubcategory === 'non-camping') {
                    // Match "Non-Camping Festival" or plain "Festival"
                    return categories.some(cat => {
                        const catLower = cat.toLowerCase();
                        return catLower.includes('non-camping') ||
                               (!catLower.includes('camping') && catLower.includes('festival'));
                    });
                }
            }

            // For other categories, check if event matches the filter (case-insensitive)
            const filterLower = AppState.filters.category.toLowerCase();
            if (categories.some(cat => cat.toLowerCase() === filterLower)) {
                return true;
            }

            // Also aggregate all festival types under "Festival" category filter
            if (AppState.filters.category === 'Festival') {
                return categories.some(cat => cat.toLowerCase().includes('festival'));
            }

            return false;
        });
    }
    
    if (AppState.filters.location !== 'all') {
        filtered = filtered.filter(event => {
            // Check CITY column first, then fallback to VENUE
            const city = event['CITY'] || '';
            const venue = event['VENUE'] || '';
            return city === AppState.filters.location || venue.includes(AppState.filters.location);
        });
    }
    
    AppState.filteredEvents = filtered;
    renderEvents(filtered);
    updateActiveFilters();

    // Show "Did you mean?" suggestions if no results and search term exists
    if (AppState.filters.search && AppState.filters.search.length >= 3 && filtered.length === 0) {
        showSearchSuggestions(AppState.filters.search);
    } else {
        hideSearchSuggestions();
    }
}

// ========================================
// FUZZY SEARCH ("Did you mean?")
// ========================================

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits to transform one into the other)
 */
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first column and row
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Build search vocabulary from loaded events
 * Called after events are loaded
 */
function buildSearchVocabulary(events) {
    const eventNames = new Set();
    const venueNames = new Set();
    const interpreterNames = new Set();

    events.forEach(event => {
        // Add full event names only (no individual word fragments)
        if (event.EVENT && event.EVENT.length >= 3) {
            eventNames.add(event.EVENT);
        }

        // Add venue names
        if (event.VENUE) {
            venueNames.add(event.VENUE);
            const venueParts = event.VENUE.split(',');
            if (venueParts.length > 1) {
                venueNames.add(venueParts[0].trim());
            }
        }

        // Add interpreter names
        if (event.INTERPRETERS) {
            event.INTERPRETERS.split(/[,&]/).forEach(name => {
                const trimmed = name.trim();
                if (trimmed.length >= 3) {
                    interpreterNames.add(trimmed);
                }
            });
        }
    });

    // Store categorised vocabulary for smarter ranking
    AppState.searchVocabulary = [
        ...Array.from(eventNames).map(t => ({ term: t, type: 'event' })),
        ...Array.from(venueNames).map(t => ({ term: t, type: 'venue' })),
        ...Array.from(interpreterNames).map(t => ({ term: t, type: 'interpreter' }))
    ].filter(v => v.term && v.term.length >= 3);
    console.log(`Built search vocabulary with ${AppState.searchVocabulary.length} terms`);
}

/**
 * Find similar terms to a query using Levenshtein distance
 * Handles both full phrases and individual words
 */
function findSimilarTerms(query, maxSuggestions = 3) {
    if (!AppState.searchVocabulary || !query || query.length < 3) {
        return [];
    }

    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3);
    const suggestions = [];

    AppState.searchVocabulary.forEach(entry => {
        const term = entry.term;
        const termLower = term.toLowerCase();

        // Skip if it's an exact match (already found in search)
        if (termLower === queryLower) return;
        if (termLower.includes(queryLower) || queryLower.includes(termLower)) return;

        // Strategy 1: Prefix match — query starts like a word in the term
        const termWords = termLower.split(/\s+/).filter(w => w.length >= 3);
        for (const tWord of termWords) {
            if (tWord.startsWith(queryLower.slice(0, 4)) && Math.abs(tWord.length - queryLower.length) <= 3) {
                suggestions.push({ term, distance: 0.5, type: entry.type });
                return;
            }
        }

        // Strategy 2: Compare full query to full term (tight threshold: 25%)
        const lengthDiff = Math.abs(term.length - query.length);
        if (lengthDiff <= 4) {
            const distance = levenshteinDistance(queryLower, termLower);
            const maxDistance = Math.max(2, Math.ceil(query.length * 0.25));
            if (distance > 0 && distance <= maxDistance) {
                suggestions.push({ term, distance, type: entry.type });
                return;
            }
        }

        // Strategy 3: Word-level match — a query word closely matches a term word
        for (const qWord of queryWords) {
            for (const tWord of termWords) {
                if (Math.abs(qWord.length - tWord.length) <= 2) {
                    const wordDistance = levenshteinDistance(qWord, tWord);
                    // Strict: allow only 1 edit for short words, 2 for longer
                    const maxWordDist = qWord.length <= 5 ? 1 : 2;
                    if (wordDistance > 0 && wordDistance <= maxWordDist) {
                        suggestions.push({ term, distance: wordDistance + 1, type: entry.type });
                        return;
                    }
                }
            }
        }
    });

    // Sort: events first, then by distance, then alphabetically
    const typePriority = { event: 0, venue: 1, interpreter: 2 };
    suggestions.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        const aPri = typePriority[a.type] ?? 3;
        const bPri = typePriority[b.type] ?? 3;
        if (aPri !== bPri) return aPri - bPri;
        return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
    });

    // Remove duplicates (case-insensitive)
    const seen = new Set();
    const unique = suggestions.filter(s => {
        const key = s.term.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return unique.slice(0, maxSuggestions).map(s => s.term);
}

/**
 * Show "Did you mean?" suggestions
 */
function showSearchSuggestions(query) {
    const container = document.getElementById('searchSuggestions');
    const itemsContainer = document.getElementById('suggestionItems');

    if (!container || !itemsContainer) return;

    const suggestions = findSimilarTerms(query);

    if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Build suggestion buttons
    itemsContainer.innerHTML = suggestions.map(term =>
        `<button class="suggestion-item" onclick="applySuggestion('${term.replace(/'/g, "\\'")}')">${term}</button>`
    ).join('');

    container.style.display = 'block';
}

/**
 * Hide search suggestions
 */
function hideSearchSuggestions() {
    const container = document.getElementById('searchSuggestions');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * Apply a suggestion to the search input
 */
function applySuggestion(term) {
    DOM.searchInput.value = term;
    AppState.filters.search = term;
    DOM.searchClear.classList.add('visible');
    hideSearchSuggestions();
    applyFilters();
}

/**
 * Populate filter dropdowns with unique values
 */
function populateFilters() {
    // Generate category tabs (NEW!)
    generateCategoryTabs();
    
    // Locations - use CITY column if available, otherwise extract from VENUE
    const locations = [...new Set(AppState.allEvents.map(e => {
        // Prefer CITY column if available
        if (e['CITY'] && e['CITY'].trim()) {
            return e['CITY'].trim();
        }
        // Fallback: extract city from venue string (e.g., "The O2 Arena, London" → "London")
        const venue = e['VENUE'] || '';
        const parts = venue.split(',');
        return parts[parts.length - 1].trim();
    }).filter(Boolean))];
    locations.sort();
    DOM.locationFilter.innerHTML = '<option value="all">All Locations</option>' +
        locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    
    // Populate month filter
    populateMonthFilter();
}

/**
 * Generate category tabs with icons and counts
 */
function generateCategoryTabs() {
    // Get unique categories with counts
    // Aggregate all Festival types into one "Festival" category
    const categoryCounts = {};
    AppState.allEvents.forEach(event => {
        const categories = parseCategories(event['CATEGORY']);

        if (categories.length === 0) {
            categoryCounts['Other'] = (categoryCounts['Other'] || 0) + 1;
            return;
        }

        categories.forEach(category => {
            // Aggregate all festival types under "Festival"
            if (category.toLowerCase().includes('festival')) {
                categoryCounts['Festival'] = (categoryCounts['Festival'] || 0) + 1;
            } else {
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        });
    });
    
    // Category icons mapping
    const categoryIcons = {
        'All': '🎭',
        'Concert': '🏟️',
        'Sports': '🏆',
        'Festival': '🎪',
        'Comedy': '😂',
        'Family': '👨‍👩‍👧‍👦',
        'Literature': '📚',
        'Theatre': '🎭',
        'Dance': '💃',
        'Talks & Discussions': '🗣️',
        'Cultural': '🏛️',
        'Other': '🎟️'
    };

    // Sort categories in priority order
    const categoryOrder = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions', 'Cultural', 'Other'];
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
    
    // Build tabs HTML
    let tabsHtml = `
        <button 
            class="category-tab active" 
            data-category="all"
            onclick="selectCategory('all')"
        >
            <span class="category-tab-icon">${categoryIcons['All']}</span>
            <span>All Events</span>
            <span class="category-tab-count">${AppState.allEvents.length}</span>
        </button>
    `;
    
    sortedCategories.forEach(category => {
        const icon = categoryIcons[category] || categoryIcons['Other'];
        const count = categoryCounts[category];
        
        tabsHtml += `
            <button 
                class="category-tab" 
                data-category="${category}"
                onclick="selectCategory('${category.replace(/'/g, "\\'")}')"
            >
                <span class="category-tab-icon">${icon}</span>
                <span>${category}</span>
                <span class="category-tab-count">${count}</span>
            </button>
        `;
    });
    
    DOM.categoryTabs.innerHTML = tabsHtml;
}

/**
 * Handle category tab selection
 */
function selectCategory(category) {
    // Update active state
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const selectedTab = document.querySelector(`[data-category="${category}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');

        // Scroll tab into view on mobile
        selectedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Update filter state
    if (category === 'all') {
        AppState.filters.category = 'all';
        AppState.festivalSubcategory = null;
    } else {
        AppState.filters.category = category;
        // Reset festival sub-category when switching categories via tabs
        AppState.festivalSubcategory = null;
    }

    // Clear selected category so title shows just event count (tabs show the category)
    AppState.selectedCategory = null;

    // Apply filters
    applyFilters();
}

// Make function available globally
window.selectCategory = selectCategory;

function populateMonthFilter() {
    const monthsMap = new Map();
    
    AppState.allEvents.forEach(event => {
        const date = formatDate(event['DATE']).dateObj;
        const year = date.getFullYear();
        const month = date.getMonth();
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        
        if (!monthsMap.has(value)) {
            monthsMap.set(value, { value, label });
        }
    });
    
    const months = Array.from(monthsMap.values());
    months.sort((a, b) => a.value.localeCompare(b.value));
    
    DOM.monthFilter.innerHTML = '<option value="">Select a month...</option>' +
        months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

function updateActiveFilters() {
    const activeFiltersHtml = [];
    
    if (AppState.filters.search) {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                Search: "${AppState.filters.search}"
                <button class="filter-pill-remove" onclick="clearFilter('search')">×</button>
            </div>
        `);
    }
    
    if (AppState.filters.time !== 'all') {
        let timeLabel = '';
        if (AppState.filters.time === 'week') {
            timeLabel = 'This Week';
        } else if (AppState.filters.time === 'month') {
            timeLabel = 'This Month';
        } else if (AppState.filters.time === 'select-month' && AppState.filters.selectedMonth) {
            const monthOption = DOM.monthFilter.querySelector(`option[value="${AppState.filters.selectedMonth}"]`);
            timeLabel = monthOption ? monthOption.textContent : 'Selected Month';
        }
        
        if (timeLabel) {
            activeFiltersHtml.push(`
                <div class="filter-pill">
                    ${timeLabel}
                    <button class="filter-pill-remove" onclick="clearFilter('time')">×</button>
                </div>
            `);
        }
    }
    
    if (AppState.filters.interpretation !== 'all') {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                ${AppState.filters.interpretation}
                <button class="filter-pill-remove" onclick="clearFilter('interpretation')">×</button>
            </div>
        `);
    }
    
    if (AppState.filters.category !== 'all') {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                ${AppState.filters.category}
                <button class="filter-pill-remove" onclick="clearFilter('category')">×</button>
            </div>
        `);
    }
    
    if (AppState.filters.location !== 'all') {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                ${AppState.filters.location}
                <button class="filter-pill-remove" onclick="clearFilter('location')">×</button>
            </div>
        `);
    }
    
    DOM.activeFilters.innerHTML = activeFiltersHtml.join('');
}

window.clearFilter = function(filterType) {
    if (filterType === 'search') {
        AppState.filters.search = '';
        DOM.searchInput.value = '';
        DOM.searchClear.classList.remove('visible');
    } else if (filterType === 'time') {
        AppState.filters.time = 'all';
        AppState.filters.selectedMonth = '';
        DOM.timeFilter.value = 'all';
        DOM.monthSelector.style.display = 'none';
    } else if (filterType === 'category') {
        AppState.filters.category = 'all';
        AppState.selectedCategory = null; // Clear selected category
        AppState.festivalSubcategory = null; // Clear festival subcategory

        // Reset category tabs to "All"
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const allTab = document.querySelector('[data-category="all"]');
        if (allTab) {
            allTab.classList.add('active');
        }
    } else {
        AppState.filters[filterType] = 'all';
        const filterElement = document.getElementById(`${filterType}Filter`);
        if (filterElement) {
            filterElement.value = 'all';
        }
    }
    applyFilters();
};

// ========================================
// GLOBAL EVENT HANDLERS
// ========================================

window.handleAddToCalendar = function(event) {
    downloadCalendar(event);
};

window.handleShare = function(event) {
    shareEvent(event);
};

// ========================================
// EVENT LISTENERS
// ========================================

// Close mobile menu function (used by navigation links)
function closeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');

    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.classList.remove('active');
        mobileNav.classList.remove('active');
    }
}

// Make closeMobileMenu available globally
window.closeMobileMenu = closeMobileMenu;

function scrollToSection(id) {
    // Navigate home first if not already there, then scroll
    const route = window.location.hash.slice(1) || '/';
    if (route !== '/' && route !== '') {
        window.location.hash = '/';
        // Wait for route change to show sections, then scroll
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } else {
        // Already home — make sure sections are visible on mobile then scroll
        const el = document.getElementById(id);
        if (el) {
            el.style.display = '';
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }
}
window.scrollToSection = scrollToSection;

function toggleFestivalSection(header) {
    const body = header.nextElementSibling;
    const isActive = header.classList.contains('active');
    // Close all others in this modal
    const modal = header.closest('.festival-modal-body');
    if (modal) {
        modal.querySelectorAll('.festival-accordion-toggle.active').forEach(h => {
            h.classList.remove('active');
            h.nextElementSibling.classList.remove('active');
        });
    }
    if (!isActive) {
        header.classList.add('active');
        body.classList.add('active');
    }
}
window.toggleFestivalSection = toggleFestivalSection;

function initEventListeners() {
    // Mobile menu toggle
    if (DOM.mobileMenuBtn && DOM.mobileNav) {
        DOM.mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.mobileMenuBtn.classList.toggle('active');
            DOM.mobileNav.classList.toggle('active');
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (DOM.mobileNav.classList.contains('active')) {
                if (!DOM.mobileNav.contains(e.target) && !DOM.mobileMenuBtn.contains(e.target)) {
                    DOM.mobileMenuBtn.classList.remove('active');
                    DOM.mobileNav.classList.remove('active');
                }
            }
        });
    }
    
    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
        AppState.filters.search = e.target.value.trim();
        DOM.searchClear.classList.toggle('visible', AppState.filters.search !== '');
        applyFilters();
    });
    
    // Search clear button
    DOM.searchClear.addEventListener('click', () => {
        AppState.filters.search = '';
        DOM.searchInput.value = '';
        DOM.searchClear.classList.remove('visible');
        applyFilters();
    });
    
    // Filter dropdowns
    DOM.timeFilter.addEventListener('change', (e) => {
        AppState.filters.time = e.target.value;
        
        if (e.target.value === 'select-month') {
            DOM.monthSelector.style.display = 'block';
        } else {
            DOM.monthSelector.style.display = 'none';
            AppState.filters.selectedMonth = '';
        }
        
        applyFilters();
    });
    
    DOM.monthFilter.addEventListener('change', (e) => {
        AppState.filters.selectedMonth = e.target.value;
        applyFilters();
    });
    
    DOM.interpretationFilter.addEventListener('change', (e) => {
        AppState.filters.interpretation = e.target.value;
        applyFilters();
    });

    // Note: categoryFilter removed - we use category cards instead

    DOM.locationFilter.addEventListener('change', (e) => {
        AppState.filters.location = e.target.value;
        applyFilters();
    });
    
    // Refresh button - also clears service worker cache for fresh data
    DOM.refreshBtn.addEventListener('click', async () => {
        AppState.lastFetch = null;
        // Clear service worker data cache so fresh CSV is fetched
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.filter(name => name.includes('-data'))
                    .map(name => caches.delete(name))
            );
        }
        const events = await fetchEvents();
        populateFilters();
        applyFilters();
    });

    // View toggle buttons
    if (DOM.viewToggle) {
        console.log('View toggle found:', DOM.viewToggle);
        const viewToggleBtns = DOM.viewToggle.querySelectorAll('.view-toggle-btn');
        console.log('View toggle buttons found:', viewToggleBtns.length);

        viewToggleBtns.forEach((btn, index) => {
            console.log(`Setting up button ${index}:`, btn.getAttribute('data-view'));

            // Use both click and touchend for better mobile support
            const handleViewChange = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const viewMode = btn.getAttribute('data-view');
                console.log('View mode clicked:', viewMode);
                changeDisplayMode(viewMode);
            };

            btn.addEventListener('click', handleViewChange, { passive: false });
            btn.addEventListener('touchend', handleViewChange, { passive: false });
        });

        // Set initial active state
        updateViewToggleButtons();
        console.log('View toggle buttons initialized, active mode:', AppState.displayMode);
    } else {
        console.error('View toggle element not found!');
    }

    // Header scroll shadow and scroll-to-top button visibility
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    const moreDropdownMenu = document.getElementById('moreDropdownMenu');

    window.addEventListener('scroll', () => {
        const header = document.querySelector('.app-header');
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Show/hide scroll to top button
        if (scrollTopBtn) {
            if (window.scrollY > 500) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        }

        // Close dropdowns when scrolling
        if (moreDropdownMenu && moreDropdownMenu.classList.contains('active')) {
            moreDropdownMenu.classList.remove('active');
        }
        if (DOM.mobileNav && DOM.mobileNav.classList.contains('active')) {
            DOM.mobileNav.classList.remove('active');
            if (DOM.mobileMenuBtn) {
                DOM.mobileMenuBtn.classList.remove('active');
            }
        }
    });

    // Scroll to top button click handler
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Swipe right-to-left to go back (like the header back arrow)
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = Math.abs(e.changedTouches[0].screenY - touchStartY);
        // Swipe right (finger moves left→right) with enough distance and not too vertical
        if (dx > 80 && dy < 100) {
            history.back();
        }
    }, { passive: true });

    // Make logo clickable to scroll to top
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Desktop "More" dropdown
    const moreDropdownBtn = document.getElementById('moreDropdownBtn');

    if (moreDropdownBtn && moreDropdownMenu) {
        moreDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moreDropdownMenu.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (moreDropdownMenu.classList.contains('active')) {
                if (!moreDropdownMenu.contains(e.target) && !moreDropdownBtn.contains(e.target)) {
                    moreDropdownMenu.classList.remove('active');
                }
            }
        });
    }

    // Mobile "More" dropdown
    const mobileMoreBtn = document.getElementById('mobileMoreBtn');
    const mobileMoreMenu = document.getElementById('mobileMoreMenu');

    if (mobileMoreBtn && mobileMoreMenu) {
        mobileMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMoreMenu.classList.toggle('active');

            // Rotate the arrow
            const arrow = mobileMoreBtn.textContent.includes('▾') ? '▴' : '▾';
            mobileMoreBtn.textContent = mobileMoreMenu.classList.contains('active') ? 'More ▴' : 'More ▾';
        });
    }
}

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    try {
        // Initialize DOM references FIRST
        initDOMReferences();

        // Initialize event listeners
        initEventListeners();

        // Set default filters
        DOM.timeFilter.value = 'all';
        AppState.filters.time = 'all';
        AppState.filters.category = 'all';

        // INSTANT LOAD: Try to load from localStorage cache first
        const cacheResult = loadCachedEvents();

        if (cacheResult && cacheResult.events && cacheResult.events.length > 0) {
            // Show cached data IMMEDIATELY for instant load
            switchToCategoryView();

            // If serving stale cache, update timestamp display to show it
            if (cacheResult.isStale) {
                updateLastUpdatedTimestamp(AppState.lastFetch, true);
            }

            // Populate filters with cached data
            populateFilters();

            // Fetch fresh data in background and update if changed
            fetchEvents(true).then(freshEvents => {
                if (freshEvents && freshEvents.length > 0) {
                    // Check if data changed
                    const dataChanged = JSON.stringify(freshEvents) !== JSON.stringify(cacheResult.events);
                    if (dataChanged) {
                        // Silently update the view with fresh data
                        populateFilters();
                        if (AppState.viewMode === 'categories') {
                            renderCategorySelection();
                        } else {
                            applyFilters();
                        }
                    }
                }
            });

            checkInstallPrompt();
        } else {
            // No cache - fetch and display (first time load)
            const events = await fetchEvents();
            switchToCategoryView();

            // Defer filter population to next frame for faster initial render
            requestAnimationFrame(() => {
                populateFilters();
                checkInstallPrompt();
            });
        }

        // Initialize request BSL form handler (NEW)
        handleRequestBSLForm();

        // Initialize venue email lookup for Request BSL form
        setupVenueEmailLookup();

        // Initialize Flow 2 search handler (NEW)
        handleFlow2Search();

        // Initialize category search bar
        initCategorySearch();

        // Initialize routing system AFTER everything is loaded (NEW)
        Router.init();
        // Manually trigger initial route
        Router.handleRouteChange();

        // Initialize rights ticker
        initRightsTicker();

    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Failed to initialize app. Please refresh the page.\n\nError: ' + error.message);
    }
}

// ========================================
// SERVICE WORKER REGISTRATION & UPDATE DETECTION
// ========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                // Check for updates every 60 seconds
                setInterval(() => {
                    registration.update();
                }, 60000);

                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is ready
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });

        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                // Service worker updated successfully
            }
        });

        // Handle controller change (when new service worker takes over)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Only reload if we're not already reloading
            if (!window.isReloading) {
                window.isReloading = true;
                window.location.reload();
            }
        });
    });
}

/**
 * Show update notification and auto-reload
 */
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'updateNotification';
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-notification-content">
            <div class="update-icon">🔄</div>
            <div class="update-text">
                <strong>App Update Incoming...</strong>
                <p>This version will close and auto-reload in <span id="updateCountdown">5</span> seconds</p>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Countdown and reload
    let countdown = 5;
    const countdownElement = document.getElementById('updateCountdown');

    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            // Tell the waiting service worker to activate
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            }
        }
    }, 1000);
}

// ========================================
// PWA INSTALL TRACKING
// ========================================

/**
 * Track PWA installations anonymously
 */
function trackPWAInstall() {
    try {
        // Send anonymous install event to analytics endpoint
        fetch('https://api.performanceinterpreting.co.uk/api/track-install', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                standalone: window.matchMedia('(display-mode: standalone)').matches
            })
        }).catch(err => {
            // Silently fail - don't break the app
            console.log('Install tracking failed (non-critical):', err);
        });

        // Mark that we've tracked this install
        localStorage.setItem('pi-install-tracked', 'true');
    } catch (error) {
        console.error('Install tracking error:', error);
    }
}

// Listen for app installed event
window.addEventListener('appinstalled', () => {
    trackPWAInstall();
});

// Check if app is running in standalone mode and track if not already tracked
if (window.matchMedia('(display-mode: standalone)').matches) {
    const hasTracked = localStorage.getItem('pi-install-tracked');
    if (!hasTracked) {
        trackPWAInstall();
    }
}

// ========================================
// INSTALL PROMPT FUNCTIONS
// ========================================

/**
 * Open install guide modal
 */
function openInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    prompt.classList.add('show');
    document.body.classList.add('modal-open');
}

/**
 * Close install guide modal
 */
function closeInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    prompt.classList.remove('show');
    document.body.classList.remove('modal-open');

    // Remember that user has seen this
    localStorage.setItem('pi-install-prompt-seen', 'true');
}

/**
 * Check if app should show install prompt automatically
 */
function checkInstallPrompt() {
    // Don't show if already seen
    if (localStorage.getItem('pi-install-prompt-seen')) {
        return;
    }

    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    // Don't show on desktop
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    if (!isMobile) {
        return;
    }

    // Show after 10 seconds
    setTimeout(() => {
        openInstallPrompt();
    }, 10000);
}

// Make functions available globally
window.openInstallPrompt = openInstallPrompt;
window.closeInstallPrompt = closeInstallPrompt;

// ========================================
// MESSAGE TEMPLATES (NEW)
// ========================================

const MessageTemplates = {
    formal: {
        name: 'Formal Request',
        generate: (eventName, venueName, eventDate) => {
            return `Dear ${venueName} Access Team,

I am planning to attend ${eventName}${eventDate ? ' on ' + eventDate : ''}.

I am Deaf and use BSL.

Under the Equality Act 2010, I am requesting BSL interpretation for this event.

Please confirm if BSL will be provided.
Please tell me how to book accessible tickets.

Thank you.`;
        }
    },

    friendly: {
        name: 'Friendly Request',
        generate: (eventName, venueName, eventDate, includePINote = false) => {
            const piNote = includePINote ? `\n\nI've CC'd Performance Interpreting to help support this request.` : '';
            return `Hi ${venueName} team,

I want to attend ${eventName}${eventDate ? ' on ' + eventDate : ''}!

I am Deaf and use BSL.
Will there be a BSL interpreter?

If not, can you arrange one?${piNote}

Thank you!`;
        }
    }
};

// Handle request BSL form submission
function handleRequestBSLForm() {
    const form = document.getElementById('requestBSLForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const eventName = document.getElementById('eventName').value.trim();
        const venueName = document.getElementById('venueName').value.trim();
        const eventDate = document.getElementById('eventDate').value.trim();
        const venueEmail = document.getElementById('venueEmail')?.value.trim() || '';

        // Clear previous errors
        clearFormErrors();

        // Validate required fields
        if (!eventName || !venueName) {
            if (!eventName) {
                showFormError('eventName', 'Please enter the event name');
            }
            if (!venueName) {
                showFormError('venueName', 'Please enter the venue name');
            }
            const firstEmpty = !eventName ? document.getElementById('eventName') : document.getElementById('venueName');
            firstEmpty.focus();
            return;
        }

        // Validate email format if provided
        if (venueEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(venueEmail)) {
            showFormError('venueEmail', 'Please enter a valid email address');
            document.getElementById('venueEmail').focus();
            return;
        }

        const hasVenueEmail = venueEmail !== '';

        // Generate message using friendly template
        // Include PI note only when email goes to venue (PI will be CC'd)
        const message = MessageTemplates.friendly.generate(eventName, venueName, eventDate, hasVenueEmail);

        // Show message template
        const messageTemplate = document.getElementById('messageTemplate');
        const messageContent = document.getElementById('messageContent');
        const emailNote = document.getElementById('emailNote');

        if (messageContent) {
            messageContent.textContent = message;
        }
        if (messageTemplate) {
            messageTemplate.style.display = 'block';
        }

        // Set dynamic email note based on whether we have venue email
        if (emailNote) {
            if (hasVenueEmail) {
                emailNote.innerHTML = 'This email goes to the <strong>venue\'s access team</strong>. PI is CC\'d to support your request if needed.';
                emailNote.className = 'email-note venue-email';
            } else {
                emailNote.innerHTML = 'This email goes to <strong>Performance Interpreting</strong>. We\'ll contact the venue on your behalf.';
                emailNote.className = 'email-note pi-email';
            }
        }

        // Store for copy/email functions
        window.currentMessage = {
            message: message,
            venueName: venueName,
            eventName: eventName,
            venueEmail: venueEmail,
            hasVenueEmail: hasVenueEmail
        };

        // Scroll to message
        messageTemplate.scrollIntoView({ behavior: 'smooth' });
    });
}

// Form error helper functions for accessibility
function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorSpan = document.getElementById(fieldId + 'Error');
    if (field) {
        field.setAttribute('aria-invalid', 'true');
    }
    if (errorSpan) {
        errorSpan.textContent = message;
    }
}

function clearFormErrors() {
    const fields = ['eventName', 'venueName', 'venueEmail'];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorSpan = document.getElementById(fieldId + 'Error');
        if (field) {
            field.removeAttribute('aria-invalid');
        }
        if (errorSpan) {
            errorSpan.textContent = '';
        }
    });
}

// Copy message to clipboard
function copyMessage() {
    if (!window.currentMessage) return;

    navigator.clipboard.writeText(window.currentMessage.message).then(() => {
        alert('✅ Message copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('❌ Could not copy message');
    });
}

// Open email with pre-filled message
function openEmail() {
    if (!window.currentMessage) return;

    const subject = encodeURIComponent('BSL Interpretation Request - ' + window.currentMessage.eventName);
    const body = encodeURIComponent(window.currentMessage.message);

    if (window.currentMessage.hasVenueEmail) {
        // Send to venue, CC PI
        window.location.href = 'mailto:' + window.currentMessage.venueEmail + '?cc=office@performanceinterpreting.co.uk&subject=' + subject + '&body=' + body;
    } else {
        // Send to PI directly (they'll contact venue on user's behalf)
        window.location.href = 'mailto:office@performanceinterpreting.co.uk?subject=' + subject + '&body=' + body;
    }
}

// Make functions global
window.copyMessage = copyMessage;
window.openEmail = openEmail;

// ========================================
// FLOW 2: SEARCH FUNCTIONALITY (NEW)
// ========================================

/**
 * Fuzzy search events by name, venue, or category
 */
function fuzzySearchEvents(query, events) {
    if (!query || query.trim() === '') return [];

    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(' ').filter(w => w.length > 0);

    return events
        .map(event => {
            let score = 0;
            const searchText = `${event.EVENT} ${event.VENUE} ${event.CATEGORY}`.toLowerCase();

            // Exact match bonus
            if (searchText.includes(queryLower)) {
                score += 100;
            }

            // Word match scoring
            words.forEach(word => {
                if (searchText.includes(word)) {
                    score += 10;
                }
            });

            // Event name match bonus
            if (event.EVENT.toLowerCase().includes(queryLower)) {
                score += 50;
            }

            return { event, score };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Top 10 results
        .map(result => result.event);
}

/**
 * Display search results in Flow 2
 */
function displaySearchResults(results, query) {
    const resultsContainer = document.getElementById('flow2Results');
    if (!resultsContainer) return;

    if (results.length === 0) {
        // No results found - show "Did you mean?" suggestions
        const suggestions = query.length >= 3 ? findSimilarTerms(query) : [];
        const suggestionsHTML = suggestions.length > 0 ? `
            <div class="search-suggestions" style="display: block; margin-bottom: 20px;">
                <span class="suggestion-label">Did you mean:</span>
                <div class="suggestion-items">
                    ${suggestions.map(term =>
                        `<button class="suggestion-item" onclick="applyFlow2Suggestion('${term.replace(/'/g, "\\'")}')">${term}</button>`
                    ).join('')}
                </div>
            </div>
        ` : '';

        resultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">🔴</div>
                <h3>No events found for "${query}"</h3>
                ${suggestionsHTML}
                <p>We couldn't find any events matching your search.</p>
                <p><strong>But you can still request an interpreter!</strong></p>
                <a href="#/flow3" class="btn-primary">Request Interpreter for This Event →</a>
            </div>
        `;
        return;
    }

    // Display results with badges
    const resultsHTML = results.map(event => {
        const badge = calculateBadgeStatus(event);
        const date = formatDate(event.DATE);

        return `
            <div class="search-result-card">
                <div class="search-result-badge badge-${badge.badge}">
                    <span class="badge-icon">${badge.icon}</span>
                    <span class="badge-label">${badge.shortLabel}</span>
                </div>
                <div class="search-result-content">
                    <h3 class="search-result-title">${event.EVENT}</h3>
                    <p class="search-result-meta">
                        📍 ${event.VENUE}<br>
                        🗓️ ${event.DATE}
                        ${event.TIME ? `<br>🕐 ${event.TIME}` : ''}
                    </p>
                    ${event.INTERPRETERS ? `
                        <p class="search-result-interpreters">
                            👥 <strong>Interpreters:</strong> ${event.INTERPRETERS}
                        </p>
                    ` : ''}
                    <div class="search-result-actions">
                        ${badge.canBook ? `
                            <a href="#/how-to-book" class="btn-secondary">How to Book</a>
                        ` : `
                            <a href="#/flow3" class="btn-primary">Request Interpreter</a>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = `
        <div class="search-results-header">
            <h3>Found ${results.length} event${results.length === 1 ? '' : 's'}</h3>
        </div>
        ${resultsHTML}
    `;
}

/**
 * Handle search form submission
 */
function handleFlow2Search() {
    const searchInput = document.getElementById('flow2SearchInput');
    const searchBtn = document.getElementById('flow2SearchBtn');

    if (!searchInput || !searchBtn) return;

    const performSearch = () => {
        const query = searchInput.value;
        if (!query || query.trim() === '') {
            alert('Please enter an event name to search');
            return;
        }

        const results = fuzzySearchEvents(query, AppState.allEvents);
        displaySearchResults(results, query);
    };

    // Search on button click
    searchBtn.addEventListener('click', performSearch);

    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

/**
 * Apply a "Did you mean?" suggestion in Flow 2
 */
function applyFlow2Suggestion(term) {
    const searchInput = document.getElementById('flow2SearchInput');
    if (searchInput) {
        searchInput.value = term;
        const results = fuzzySearchEvents(term, AppState.allEvents);
        displaySearchResults(results, term);
    }
}

// ========================================
// GET ACCESS MODAL (NEW)
// ========================================

let currentEventForAccess = null;

/**
 * Open the Get Access modal with event-specific details
 */
function openGetAccessModal(event) {
    currentEventForAccess = event;
    const modal = document.getElementById('getAccessModal');
    if (!modal) return;

    // Update modal title with event name
    const titleEl = modal.querySelector('.access-modal-title');
    if (titleEl) {
        titleEl.textContent = `How to Book: ${event.EVENT}`;
    }

    // Update subtitle with venue
    const subtitleEl = modal.querySelector('.access-modal-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = `At ${event.VENUE} • Follow 3 steps`;
    }

    // Update Step 1 with specific venue name
    const step1Text = modal.querySelector('.access-step:nth-child(1) p');
    if (step1Text) {
        step1Text.innerHTML = `Contact ${event.VENUE}<br>Ask for accessibility team`;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close the Get Access modal
 */
function closeGetAccessModal() {
    const modal = document.getElementById('getAccessModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
    }
    currentEventForAccess = null;
}

/**
 * Email venue from the Get Access modal
 */
function emailVenueFromModal() {
    if (!currentEventForAccess) {
        alert('No event selected');
        return;
    }

    // Use venue contact email if available, otherwise leave blank
    const venueEmail = currentEventForAccess.VENUE_CONTACT_EMAIL || '';

    const subject = encodeURIComponent('BSL Accessible Tickets - ' + currentEventForAccess.EVENT);
    const timeLine = hasRealTime(currentEventForAccess.TIME) ? `\nTime: ${currentEventForAccess.TIME}` : '';
    const body = encodeURIComponent(`Hi ${currentEventForAccess.VENUE} team,

I want to book accessible tickets for ${currentEventForAccess.EVENT}.

Date: ${currentEventForAccess.DATE}${timeLine}

I am Deaf and use BSL.
I see there will be BSL interpretation.

Please confirm:
- How to book accessible tickets
- Where the BSL section will be
- Any special procedures

Thank you!`);

    window.location.href = `mailto:${venueEmail}?subject=${subject}&body=${body}`;
}

// ========================================
// GET TICKETS MODAL (Interception for accessible booking)
// ========================================

let currentTicketEvent = null;

/**
 * Open the Event Info modal with booking guidance
 */
function openGetTicketsModal(event) {
    currentTicketEvent = event;
    const modal = document.getElementById('getTicketsModal');
    if (!modal) return;

    // Store ticket URL for continue button
    const continueBtn = document.getElementById('continueToTicketsBtn');
    if (continueBtn) {
        continueBtn.setAttribute('data-ticket-url', event['EVENT URL']);
    }

    // Show/hide SignVideo button if link available
    const signVideoBtn = document.getElementById('signVideoBtn');
    if (signVideoBtn && event['SIGNVIDEO_LINK']) {
        signVideoBtn.style.display = 'block';
        signVideoBtn.setAttribute('data-signvideo-url', event['SIGNVIDEO_LINK']);
    } else if (signVideoBtn) {
        signVideoBtn.style.display = 'none';
    }

    // Show/hide contact venue button if email available
    const contactBtn = document.getElementById('contactVenueBtn');
    if (contactBtn && event['VENUE_CONTACT_EMAIL']) {
        contactBtn.style.display = 'block';
    } else if (contactBtn) {
        contactBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close the Event Info modal
 */
function closeGetTicketsModal() {
    const modal = document.getElementById('getTicketsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentTicketEvent = null;
}

/**
 * Continue to external ticket site after seeing guidance
 */
function continueToTickets() {
    if (!currentTicketEvent || !currentTicketEvent['EVENT URL']) {
        alert('No ticket link available');
        return;
    }

    // Open ticket link in new tab
    window.open(currentTicketEvent['EVENT URL'], '_blank', 'noopener,noreferrer');

    // Close the modal
    closeGetTicketsModal();
}

/**
 * Contact venue from the Event Info modal
 */
function contactVenueFromTicketsModal() {
    if (!currentTicketEvent) {
        alert('No event selected');
        return;
    }

    const venueEmail = currentTicketEvent.VENUE_CONTACT_EMAIL || '';
    const language = getInterpretationLanguage(currentTicketEvent);

    const subject = encodeURIComponent(`${language} Accessible Tickets - ${currentTicketEvent.EVENT}`);
    const timeLine = hasRealTime(currentTicketEvent.TIME) ? `\nTime: ${currentTicketEvent.TIME}` : '';
    const body = encodeURIComponent(`Hi ${currentTicketEvent.VENUE} team,

I want to book accessible tickets for ${currentTicketEvent.EVENT}.

Date: ${currentTicketEvent.DATE}${timeLine}

I am Deaf and use ${language}.
I see there will be ${language} interpretation.

Please confirm:
- How to book accessible tickets
- Where ${language} section will be
- Best seats for viewing interpreter

Thank you!`);

    window.location.href = `mailto:${venueEmail}?subject=${subject}&body=${body}`;
}

/**
 * Open SignVideo link for venue
 */
function openSignVideoLink() {
    if (!currentTicketEvent || !currentTicketEvent['SIGNVIDEO_LINK']) {
        alert('No SignVideo link available for this venue');
        return;
    }

    // Open SignVideo link in new tab
    window.open(currentTicketEvent['SIGNVIDEO_LINK'], '_blank', 'noopener,noreferrer');
}

// ========================================
// VENUE BOOKING GUIDE MODAL (Venue-specific instructions)
// ========================================

/**
 * Open venue-specific booking guide modal
 */
function openVenueBookingGuide(event) {
    const modal = document.getElementById('venueBookingModal');
    if (!modal) return;

    // Update modal title
    const titleEl = document.getElementById('venueBookingTitle');
    if (titleEl) {
        titleEl.textContent = `How to Book: ${event.EVENT}`;
    }

    // Update venue subtitle
    const venueEl = document.getElementById('venueBookingVenue');
    if (venueEl) {
        venueEl.textContent = `At ${event.VENUE}`;
    }

    // Update content with venue-specific guide
    const contentEl = document.getElementById('venueBookingContent');
    if (contentEl && event['BOOKING GUIDE']) {
        // Convert newlines to <br> and render the guide
        const guideHtml = event['BOOKING GUIDE']
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => `<p>${line}</p>`)
            .join('');

        contentEl.innerHTML = guideHtml;
    } else if (contentEl) {
        // Fallback generic message
        contentEl.innerHTML = `
            <p>Contact ${event.VENUE} to book accessible tickets.</p>
            <p>Ask for seats with clear view of BSL interpreter.</p>
            <p>See our <a href="#/how-to-book" onclick="closeVenueBookingGuideModal()">full booking guide</a> for detailed steps.</p>
        `;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close venue booking guide modal
 */
function closeVenueBookingModal() {
    const modal = document.getElementById('venueBookingModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ========================================
// KNOW YOUR RIGHTS MODAL & TICKER
// ========================================

/**
 * Open Know Your Rights modal
 */
function openKnowYourRightsModal() {
    const modal = document.getElementById('knowYourRightsModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close Know Your Rights modal
 */
function closeKnowYourRightsModal() {
    const modal = document.getElementById('knowYourRightsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

/**
 * Dynamic rights ticker - rotates empowerment messages
 */
const rightsMessages = [
    "You can <strong>request BSL</strong> at any event",
    "Venues <strong>must consider</strong> access requests",
    "Ask for seats with <strong>clear interpreter view</strong>",
    "Request info in <strong>accessible formats</strong>",
    "<strong>No group needed</strong> to request BSL",
    "Your access is <strong>protected by law</strong>",
    "Venues should respond in <strong>reasonable time</strong>",
    "You have the <strong>right to enjoy</strong> events equally"
];

let currentRightsIndex = 0;
let rightsTickerInterval = null;

/**
 * Initialize the rights ticker
 */
function initRightsTicker() {
    const tickerEl = document.getElementById('rightsTicker');
    if (!tickerEl) return;

    // Set initial message
    tickerEl.innerHTML = rightsMessages[0];
    tickerEl.classList.add('rights-ticker-visible');

    // Rotate every 5 seconds
    rightsTickerInterval = setInterval(() => {
        // Fade out
        tickerEl.classList.remove('rights-ticker-visible');

        setTimeout(() => {
            // Change message
            currentRightsIndex = (currentRightsIndex + 1) % rightsMessages.length;
            tickerEl.innerHTML = rightsMessages[currentRightsIndex];

            // Fade in
            tickerEl.classList.add('rights-ticker-visible');
        }, 300); // Wait for fade out
    }, 5000);
}

// ========================================
// ACCESS FIRST MODAL - Primary booking modal for green badge events
// ========================================

// Store current event for modal actions
let currentAccessEvent = null;

/**
 * Open Access First Modal
 * This is the primary modal for all green badge events
 * Provides 3 actions: Generate Email, Use VRS, Visit Official Site
 */
function openAccessFirstModal(event) {
    currentAccessEvent = event;
    const modal = document.getElementById('accessFirstModal');
    if (!modal) return;

    // Reset to booking mode (in case previously opened in request mode)
    event._isRequestMode = false;

    const titleEl = document.getElementById('accessFirstModalTitle');
    if (titleEl) titleEl.textContent = 'Book BSL Tickets';

    // Update event name in subtitle
    const eventNameEl = document.getElementById('accessFirstEventName');
    if (eventNameEl && event['EVENT']) {
        eventNameEl.textContent = event['EVENT'];
    }

    // Handle VRS button - VRS is primary contact method for BSL users
    const vrsButton = document.getElementById('vrsButton');
    const vrsButtonText = document.getElementById('vrsButtonText');
    const emailButton = document.getElementById('generateEmailBtn');

    // Check for VRS: first from spreadsheet, then from VENUE_CONTACTS lookup
    let vrsUrl = event['VRS_URL'] && event['VRS_URL'].trim();
    let vrsProvider = event['VRS_PROVIDER'] && event['VRS_PROVIDER'].trim();
    let venueNote = '';

    // If no VRS in spreadsheet data, try VENUE_CONTACTS lookup
    if (!vrsUrl && event['VENUE']) {
        const venueMatches = findMatchingVenues(event['VENUE']);
        if (venueMatches.length > 0) {
            if (venueMatches[0].vrs) {
                vrsUrl = venueMatches[0].vrs;
                vrsProvider = venueMatches[0].vrsLabel || 'SignVideo';
            }
            if (venueMatches[0].note) {
                venueNote = venueMatches[0].note;
            }
        }
    }

    // Set tip text — show venue note if available, otherwise default tip
    const noteEl = modal.querySelector('.access-modal-note');
    if (noteEl) {
        if (venueNote) {
            noteEl.innerHTML = `<strong>✅ ${venueNote}</strong>`;
        } else {
            noteEl.innerHTML = '<strong>💡 Tip:</strong><br>Contact venue before buying tickets<br>Ask for BSL accessible seating';
        }
    }

    const hasVRS = !!vrsUrl;

    if (vrsButton && hasVRS) {
        vrsButton.style.display = 'block';
        vrsButton.className = 'btn-primary btn-large'; // VRS is primary when available

        // Store VRS URL for openVRSLink function
        vrsButton.dataset.vrsUrl = vrsUrl;

        // Update button text with provider name
        if (vrsButtonText && vrsProvider) {
            vrsButtonText.textContent = `📹 Use ${vrsProvider} (Recommended)`;
        } else if (vrsButtonText) {
            vrsButtonText.textContent = '📹 Use SignVideo (Recommended)';
        }

        // Demote email button to secondary when VRS is available
        if (emailButton) {
            emailButton.className = 'btn-secondary btn-large';
        }
    } else {
        if (vrsButton) vrsButton.style.display = 'none';
        // Keep email as primary when no VRS
        if (emailButton) {
            emailButton.className = 'btn-primary btn-large';
        }
    }

    // Resolve venue email: event data → VENUE_CONTACTS lookup → PI fallback
    let resolvedEmail = event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';
    if (!resolvedEmail && event['VENUE']) {
        const venueMatches = findMatchingVenues(event['VENUE']);
        if (venueMatches.length > 0 && venueMatches[0].email) {
            resolvedEmail = venueMatches[0].email;
        }
    }
    // Store resolved email on the event so generateAccessEmail can use it
    currentAccessEvent._resolvedEmail = resolvedEmail;

    // Update email button label to indicate where it goes
    if (emailButton) {
        if (resolvedEmail) {
            emailButton.innerHTML = '✉️ Email Venue Access Team';
        } else {
            emailButton.innerHTML = '✉️ Email PI (We\'ll Contact Venue)';
        }
    }

    // Handle ticket link button — show if EVENT URL exists
    const ticketButton = document.getElementById('ticketLinkButton');
    const hasTicketUrl = event['EVENT URL'] && event['EVENT URL'].trim();
    if (ticketButton && hasTicketUrl) {
        ticketButton.style.display = 'block';
        ticketButton.setAttribute('data-ticket-url', event['EVENT URL'].trim());
    } else if (ticketButton) {
        ticketButton.style.display = 'none';
    }

    // Handle Official Site button
    const officialSiteButton = document.getElementById('officialSiteButton');
    if (officialSiteButton && event['OFFICIAL_SITE_URL'] && event['OFFICIAL_SITE_URL'].trim()) {
        officialSiteButton.style.display = 'block';
    } else if (officialSiteButton) {
        officialSiteButton.style.display = 'none';
    }

    // Add gentle bounce to primary CTA button (Item 1: entice users to press)
    // Bounce VRS if available, otherwise bounce email
    if (vrsButton) vrsButton.classList.remove('bounce-cta');
    if (emailButton) emailButton.classList.remove('bounce-cta');
    if (hasVRS && vrsButton) {
        vrsButton.classList.add('bounce-cta');
    } else if (emailButton) {
        emailButton.classList.add('bounce-cta');
    }

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close Access First Modal
 */
function closeAccessFirstModal() {
    const modal = document.getElementById('accessFirstModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

/**
 * Generate Access Email
 * Creates a pre-written email asking for BSL & ISL accessible seating
 */
function generateAccessEmail() {
    if (!currentAccessEvent) {
        alert('Event information not available');
        return;
    }

    const event = currentAccessEvent;
    const language = getInterpretationLanguage(event);
    const eventName = event['EVENT'] || 'this event';
    const venue = event['VENUE'] || 'your venue';
    const date = event['DATE'] || '[date]';
    const isRequestMode = event._isRequestMode || false;

    // Format date for email
    let formattedDate = date;
    try {
        const parsed = parseDateString(date);
        if (parsed && !isNaN(parsed)) {
            formattedDate = parsed.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (e) {
        // Keep original date if parsing fails
    }

    // Choose email template based on mode
    let subject, body;
    if (isRequestMode) {
        // Requesting BSL — interpreter not yet confirmed
        subject = `${language} Interpreter Request - ${eventName}`;
        body = `Hi,

I am Deaf and use ${language}. I would like to attend ${eventName} at ${venue} on ${formattedDate}.

Will there be a ${language} interpreter at this event? If not, is it possible to arrange one?

Thank you.`;
    } else {
        // Booking BSL — interpreter already confirmed
        subject = `${language} Access Request - ${eventName}`;
        body = `Hi,

I am a Deaf ${language} user and would like to attend ${eventName} at ${venue} on ${formattedDate}.

Please can you advise how I can book tickets with a clear view of the interpreter/${language} area?

Thank you.`;
    }

    // Get email address: resolved venue email or fall back to PI
    const venueEmail = event._resolvedEmail || event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';

    let mailtoLink;
    if (venueEmail) {
        // Send to venue, CC PI for support
        mailtoLink = `mailto:${venueEmail}?cc=office@performanceinterpreting.co.uk&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
        // No venue email — send to PI, they'll contact the venue on user's behalf
        const piBody = `Hi PI,

I am Deaf and use ${language}. I would like to attend ${eventName} at ${venue} on ${formattedDate}.

I couldn't find the venue's access email. Could you help me contact them${isRequestMode ? ' about arranging a ' + language + ' interpreter' : ' about booking tickets with a view of the ' + language + ' interpreter area'}?

Thank you.`;
        mailtoLink = `mailto:office@performanceinterpreting.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(piBody)}`;
    }

    // Open email client
    window.location.href = mailtoLink;

    // Close modal after a brief delay
    setTimeout(() => {
        closeAccessFirstModal();
    }, 500);
}

/**
 * Open VRS (Video Relay Service) link
 */
function openVRSLink() {
    // Try to get VRS URL from event data first, then from button dataset (VENUE_CONTACTS lookup)
    let vrsUrl = currentAccessEvent && currentAccessEvent['VRS_URL'];

    if (!vrsUrl) {
        const vrsButton = document.getElementById('vrsButton');
        if (vrsButton && vrsButton.dataset.vrsUrl) {
            vrsUrl = vrsButton.dataset.vrsUrl;
        }
    }

    if (!vrsUrl) {
        alert('Video Relay Service link not available for this venue');
        return;
    }

    window.open(vrsUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Open Official Site
 */
function openOfficialSite() {
    if (!currentAccessEvent || !currentAccessEvent['OFFICIAL_SITE_URL']) {
        alert('Official site not available for this event');
        return;
    }

    window.open(currentAccessEvent['OFFICIAL_SITE_URL'], '_blank', 'noopener,noreferrer');
}

/**
 * Open ticket link from the Access First modal
 */
function openTicketLink() {
    const ticketButton = document.getElementById('ticketLinkButton');
    const url = ticketButton && ticketButton.getAttribute('data-ticket-url');
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
window.openTicketLink = openTicketLink;

/**
 * Open the Access First Modal in "Request BSL" mode.
 * Used for orange/red badge events at venues with known VRS or contact info.
 * Reuses the same modal but adjusts title and email template for requesting.
 */
function openRequestBSLModal(event) {
    currentAccessEvent = event;
    const modal = document.getElementById('accessFirstModal');
    if (!modal) return;

    // Set request-mode title and subtitle
    const titleEl = document.getElementById('accessFirstModalTitle');
    const eventNameEl = document.getElementById('accessFirstEventName');
    if (titleEl) titleEl.textContent = 'Request Interpreter';
    if (eventNameEl && event['EVENT']) eventNameEl.textContent = event['EVENT'];

    // Resolve VRS and email from VENUE_CONTACTS
    const venueMatches = findMatchingVenues(event['VENUE'] || '');
    let vrsUrl = event['VRS_URL'] || '';
    let vrsProvider = event['VRS_PROVIDER'] || '';
    let resolvedEmail = event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';

    if (venueMatches.length > 0) {
        if (!vrsUrl && venueMatches[0].vrs) {
            vrsUrl = venueMatches[0].vrs;
            vrsProvider = venueMatches[0].vrsLabel || 'SignVideo';
        }
        if (!resolvedEmail && venueMatches[0].email) {
            resolvedEmail = venueMatches[0].email;
        }
    }

    // Store for generateRequestEmail
    currentAccessEvent._resolvedEmail = resolvedEmail;
    currentAccessEvent._isRequestMode = true;

    // VRS button
    const vrsButton = document.getElementById('vrsButton');
    const vrsButtonText = document.getElementById('vrsButtonText');
    const emailButton = document.getElementById('generateEmailBtn');

    if (vrsButton && vrsUrl) {
        vrsButton.style.display = 'block';
        vrsButton.className = 'btn-primary btn-large';
        vrsButton.dataset.vrsUrl = vrsUrl;
        if (vrsButtonText) vrsButtonText.textContent = `📹 Use ${vrsProvider || 'SignVideo'} (Recommended)`;
        if (emailButton) emailButton.className = 'btn-secondary btn-large';
    } else {
        if (vrsButton) vrsButton.style.display = 'none';
        if (emailButton) emailButton.className = 'btn-primary btn-large';
    }

    // Email button label
    if (emailButton) {
        if (resolvedEmail) {
            emailButton.innerHTML = '✉️ Email Venue Access Team';
        } else {
            emailButton.innerHTML = '✉️ Email PI (We\'ll Contact Venue)';
        }
    }

    // Show "More Info" button if EVENT URL exists (links to official event page)
    const ticketButton = document.getElementById('ticketLinkButton');
    const hasTicketUrl = event['EVENT URL'] && event['EVENT URL'].trim();
    if (ticketButton && hasTicketUrl) {
        ticketButton.style.display = 'block';
        ticketButton.setAttribute('data-ticket-url', event['EVENT URL'].trim());
    } else if (ticketButton) {
        ticketButton.style.display = 'none';
    }

    // Hide official site button in request mode
    const officialSiteButton = document.getElementById('officialSiteButton');
    if (officialSiteButton) officialSiteButton.style.display = 'none';

    // Update tip text for request context
    const noteEl = modal.querySelector('.access-modal-note');
    if (noteEl) {
        noteEl.innerHTML = '<strong>💡 Tip:</strong><br>VRS lets you call the venue in BSL via video relay — it\'s faster than email.';
    }

    // Add gentle bounce to primary CTA button
    if (vrsButton) vrsButton.classList.remove('bounce-cta');
    if (emailButton) emailButton.classList.remove('bounce-cta');
    if (vrsUrl && vrsButton) {
        vrsButton.classList.add('bounce-cta');
    } else if (emailButton) {
        emailButton.classList.add('bounce-cta');
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.openRequestBSLModal = openRequestBSLModal;

// ========================================
// CALENDAR & SHARE FUNCTIONS
// ========================================

/**
 * Add event to calendar (generates ICS file download)
 */
function addToCalendar(event) {
    const eventName = event['EVENT'] || 'BSL Interpreted Event';
    const venue = event['VENUE'] || '';
    const dateStr = event['DATE'] || '';
    const timeStr = event['TIME'] || '';
    const interpretation = event['INTERPRETATION'] || 'BSL';

    // Parse date (DD.MM.YY format)
    const dateParts = dateStr.split('.');
    if (dateParts.length !== 3) {
        alert('Could not parse event date');
        return;
    }

    let [day, month, year] = dateParts;
    if (year.length === 2) year = '20' + year;

    // Parse time if available
    let startHour = 19, startMin = 0, endHour = 22, endMin = 0;
    if (timeStr && timeStr !== 'TBC') {
        const timeParts = timeStr.split(' - ');
        const startTime = timeParts[0];
        const endTime = timeParts[1] || null;

        const startMatch = startTime.match(/(\d{1,2}):(\d{2})/);
        if (startMatch) {
            startHour = parseInt(startMatch[1]);
            startMin = parseInt(startMatch[2]);
        }

        if (endTime) {
            const endMatch = endTime.match(/(\d{1,2}):(\d{2})/);
            if (endMatch) {
                endHour = parseInt(endMatch[1]);
                endMin = parseInt(endMatch[2]);
            }
        } else {
            // Default to 3 hours after start
            endHour = startHour + 3;
            endMin = startMin;
        }
    }

    // Format dates for ICS (YYYYMMDDTHHMMSS)
    const pad = n => n.toString().padStart(2, '0');
    const startDate = `${year}${pad(month)}${pad(day)}T${pad(startHour)}${pad(startMin)}00`;
    const endDate = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(endMin)}00`;
    const now = new Date();
    const created = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // Build ICS content
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Performance Interpreting//Events App//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `DTSTAMP:${created}`,
        `UID:${Date.now()}@performanceinterpreting.co.uk`,
        `SUMMARY:${eventName} (${interpretation} Interpreted)`,
        `LOCATION:${venue}`,
        `DESCRIPTION:${interpretation} interpreted event.\\n\\nVenue: ${venue}${event['EVENT URL'] ? '\\n\\nEvent info: ' + event['EVENT URL'] : ''}\\n\\nFor accessible booking info visit: https://app.performanceinterpreting.co.uk/#/how-to-book`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Share event using Web Share API (with clipboard fallback)
 */
async function shareEvent(event) {
    const eventName = event['EVENT'] || 'BSL Interpreted Event';
    const venue = event['VENUE'] || '';
    const dateStr = event['DATE'] || '';
    const interpretation = event['INTERPRETATION'] || 'BSL';
    const eventUrl = event['EVENT URL'] || 'https://app.performanceinterpreting.co.uk';

    const shareText = `${eventName} - ${interpretation} Interpreted\n📍 ${venue}\n📅 ${dateStr}\n\nFind more accessible events: https://app.performanceinterpreting.co.uk`;

    const shareData = {
        title: `${eventName} (${interpretation} Interpreted)`,
        text: shareText,
        url: eventUrl
    };

    // Try Web Share API first (works on mobile)
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
            return;
        } catch (err) {
            // User cancelled or share failed, fall through to clipboard
            if (err.name === 'AbortError') return;
        }
    }

    // Fallback: copy to clipboard
    try {
        await navigator.clipboard.writeText(shareText);
        showToast('Event details copied to clipboard!');
    } catch (err) {
        // Final fallback: show text in prompt
        prompt('Copy this text to share:', shareText);
    }
}

/**
 * Show a toast notification
 */
function showToast(message, duration = 3000) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Make functions global
window.addToCalendar = addToCalendar;
window.shareEvent = shareEvent;
window.showToast = showToast;
window.openAccessFirstModal = openAccessFirstModal;
window.closeAccessFirstModal = closeAccessFirstModal;
window.generateAccessEmail = generateAccessEmail;
window.openVRSLink = openVRSLink;
window.openOfficialSite = openOfficialSite;
window.openGetAccessModal = openGetAccessModal;
window.closeGetAccessModal = closeGetAccessModal;
window.emailVenueFromModal = emailVenueFromModal;
window.openGetTicketsModal = openGetTicketsModal;
window.closeGetTicketsModal = closeGetTicketsModal;
window.continueToTickets = continueToTickets;
window.contactVenueFromTicketsModal = contactVenueFromTicketsModal;
window.openSignVideoLink = openSignVideoLink;
window.openVenueBookingGuide = openVenueBookingGuide;
window.closeVenueBookingModal = closeVenueBookingModal;
window.openKnowYourRightsModal = openKnowYourRightsModal;
window.closeKnowYourRightsModal = closeKnowYourRightsModal;

// ========================================
// COMMUNICATION SUPPORT MODAL
// ========================================

let sttRecognition = null;
let sttIsListening = false;

function openVideoModal() {
    const video = document.getElementById('bslVideo');
    if (!video) return;

    video.currentTime = 0;

    // Start play and request PiP together — both need user gesture
    const playPromise = video.play();
    const canPiP = document.pictureInPictureEnabled && !document.pictureInPictureElement;

    if (canPiP) {
        // Request PiP synchronously in the same gesture tick
        video.requestPictureInPicture().then(() => {
            video.addEventListener('leavepictureinpicture', () => {
                video.pause();
            }, { once: true });
        }).catch(() => {
            // PiP failed — show modal instead
            showVideoModal();
        });
    } else {
        showVideoModal();
    }
}

function showVideoModal() {
    const modal = document.getElementById('bslVideoModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeVideoModal() {
    const modal = document.getElementById('bslVideoModal');
    const video = document.getElementById('bslVideo');
    if (video) video.pause();
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
    }
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

window.openVideoModal = openVideoModal;
window.closeVideoModal = closeVideoModal;

// BSL Video URL map — update URLs when real recordings are ready
const bslVideoUrls = {
    'orientation':  'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'how-to-book':  'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'know-rights':  'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'request':      'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'booking':      'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'faqs':         'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'tips':         'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4',
    'at-event':     'https://media.performanceinterpreting.co.uk/pi-events-bsl-video.mp4'
};

function playBSLVideo(name) {
    const video = document.getElementById('bslVideo');
    if (!video) return;
    const url = bslVideoUrls[name] || bslVideoUrls['orientation'];
    const source = video.querySelector('source');
    if (source && source.src !== url) {
        source.src = url;
        video.load();
    }
    video.currentTime = 0;
    showVideoModal();
    video.play().catch(() => {});
}

window.playBSLVideo = playBSLVideo;

function openCommSupportModal() {
    const modal = document.getElementById('commSupportModal');
    if (!modal) return;

    // Check Speech API support
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const supportedEl = document.getElementById('sttSupported');
    const unsupportedEl = document.getElementById('sttUnsupported');
    if (supportedEl) supportedEl.style.display = supported ? 'block' : 'none';
    if (unsupportedEl) unsupportedEl.style.display = supported ? 'none' : 'block';

    // Reset to card tab
    switchCommTab('card');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCommSupportModal() {
    const modal = document.getElementById('commSupportModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    // Stop STT if running
    if (sttRecognition && sttIsListening) {
        sttRecognition.stop();
        sttIsListening = false;
    }
    // Stop FTM if running
    if (ftmActive) stopFTM();
}

function switchCommTab(tab) {
    const tabMap = {
        card: 'commCardTab',
        order: 'commOrderTab',
        emergency: 'commEmergencyTab',
        stt: 'commSTTTab',
        ftm: 'commFTMTab'
    };
    const tabKeys = Object.keys(tabMap);
    const tabs = document.querySelectorAll('.comm-tab');

    tabs.forEach((t, i) => {
        t.classList.toggle('active', tabKeys[i] === tab);
    });

    tabKeys.forEach(key => {
        const el = document.getElementById(tabMap[key]);
        if (el) el.style.display = key === tab ? 'block' : 'none';
    });
}

// Order builder functions
let currentOrder = [];

function addOrderItem(btn) {
    currentOrder.push(btn.textContent.trim());
    renderOrderItems();
}

function addCustomOrderItem() {
    const input = document.getElementById('orderCustomInput');
    if (input && input.value.trim()) {
        currentOrder.push(input.value.trim());
        input.value = '';
        renderOrderItems();
    }
}

function removeOrderItem(index) {
    currentOrder.splice(index, 1);
    renderOrderItems();
}

function renderOrderItems() {
    const container = document.getElementById('orderItems');
    if (!container) return;
    if (currentOrder.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = currentOrder.map((item, i) =>
        `<span class="order-item-tag">${item} <button onclick="removeOrderItem(${i})" aria-label="Remove">&times;</button></span>`
    ).join('');
}

function showOrderCard() {
    if (currentOrder.length === 0) return;
    const displayCard = document.getElementById('orderDisplayCard');
    const displayList = document.getElementById('orderDisplayList');
    if (!displayCard || !displayList) return;
    displayList.innerHTML = currentOrder.map(item =>
        `<p class="staff-card-line" style="font-size: 1.4rem; font-weight: 600;">${item}</p>`
    ).join('');
    displayCard.style.display = 'block';
    displayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearOrder() {
    currentOrder = [];
    renderOrderItems();
    const displayCard = document.getElementById('orderDisplayCard');
    if (displayCard) displayCard.style.display = 'none';
}

function toggleSTT() {
    if (sttIsListening) {
        stopSTT();
    } else {
        startSTT();
    }
}

function startSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    sttRecognition = new SpeechRecognition();
    sttRecognition.continuous = true;
    sttRecognition.interimResults = true;
    sttRecognition.lang = 'en-GB';

    const display = document.getElementById('sttDisplay');
    const textEl = document.getElementById('sttText');
    const placeholder = document.getElementById('sttPlaceholder');
    const toggleBtn = document.getElementById('sttToggleBtn');

    let finalTranscript = textEl.textContent || '';

    sttRecognition.onstart = () => {
        sttIsListening = true;
        if (display) display.classList.add('listening');
        if (placeholder) placeholder.style.display = 'none';
        if (toggleBtn) {
            toggleBtn.textContent = 'Stop Listening';
            toggleBtn.classList.add('listening');
        }
    };

    sttRecognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        if (textEl) {
            textEl.textContent = finalTranscript + interim;
        }
    };

    sttRecognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
            console.error('STT error:', event.error);
        }
    };

    sttRecognition.onend = () => {
        sttIsListening = false;
        if (display) display.classList.remove('listening');
        if (toggleBtn) {
            toggleBtn.textContent = 'Start Listening';
            toggleBtn.classList.remove('listening');
        }
    };

    sttRecognition.start();
}

function stopSTT() {
    if (sttRecognition) {
        sttRecognition.stop();
    }
}

function clearSTT() {
    const textEl = document.getElementById('sttText');
    const placeholder = document.getElementById('sttPlaceholder');
    if (textEl) textEl.textContent = '';
    if (placeholder) placeholder.style.display = 'block';
    if (sttRecognition && sttIsListening) {
        sttRecognition.stop();
    }
}

// ========================================
// FEEL THE MUSIC (Sound-to-Haptic)
// ========================================

let ftmActive = false;
let ftmAudioCtx = null;
let ftmAnalyser = null;
let ftmStream = null;
let ftmAnimFrame = null;
let ftmLastBassHaptic = 0;
let ftmLastMidHaptic = 0;
let ftmPrevBass = 0;
let ftmPrevMid = 0;
let ftmAvgBassFlux = 0;
let ftmAvgMidFlux = 0;
let ftmBeatDecay = 0;

const FTM_FFT_SIZE = 512;
const FTM_SUB_BASS_END = 3;
const FTM_BASS_END = 6;
const FTM_MID_START = 6;
const FTM_MID_END = 18;
const FTM_MIN_BASS_GAP = 180;
const FTM_MIN_MID_GAP = 120;
const FTM_FLUX_ALPHA = 0.06;
const FTM_BASS_THRESHOLD = 1.8;
const FTM_MID_THRESHOLD = 2.0;
const FTM_NOISE_FLOOR = 0.06;

function getSensitivityMultiplier() {
    const slider = document.getElementById('ftmSensitivity');
    const val = slider ? parseInt(slider.value) : 3;
    return [0.4, 0.55, 0.75, 1.1, 1.6][val - 1];
}

function ftmAnalyseLoop() {
    if (!ftmActive || !ftmAnalyser) return;

    const data = new Uint8Array(ftmAnalyser.frequencyBinCount);
    ftmAnalyser.getByteFrequencyData(data);

    let bassEnergy = 0;
    for (let i = 0; i < FTM_BASS_END; i++) {
        const weight = i < FTM_SUB_BASS_END ? 1.0 : 0.6;
        bassEnergy += (data[i] / 255) * weight;
    }
    bassEnergy /= FTM_BASS_END;

    let midEnergy = 0;
    for (let i = FTM_MID_START; i < FTM_MID_END; i++) {
        midEnergy += data[i] / 255;
    }
    midEnergy /= (FTM_MID_END - FTM_MID_START);

    const bassFlux = Math.max(0, bassEnergy - ftmPrevBass);
    const midFlux = Math.max(0, midEnergy - ftmPrevMid);
    ftmPrevBass = bassEnergy;
    ftmPrevMid = midEnergy;

    ftmAvgBassFlux = ftmAvgBassFlux * (1 - FTM_FLUX_ALPHA) + bassFlux * FTM_FLUX_ALPHA;
    ftmAvgMidFlux = ftmAvgMidFlux * (1 - FTM_FLUX_ALPHA) + midFlux * FTM_FLUX_ALPHA;

    const sensitivity = getSensitivityMultiplier();
    const bassThresh = Math.max(FTM_NOISE_FLOOR, ftmAvgBassFlux * FTM_BASS_THRESHOLD) / sensitivity;
    const midThresh = Math.max(FTM_NOISE_FLOOR, ftmAvgMidFlux * FTM_MID_THRESHOLD) / sensitivity;

    const now = Date.now();
    let isBeat = false;

    if (bassFlux > bassThresh && (now - ftmLastBassHaptic) >= FTM_MIN_BASS_GAP) {
        const strength = bassFlux / bassThresh;
        ftmLastBassHaptic = now;
        ftmBeatDecay = 1.0;
        isBeat = true;
        ftmFireHaptic(strength > 2.5 ? 'HEAVY' : 'MEDIUM', 'bass');
    }

    if (midFlux > midThresh && (now - ftmLastMidHaptic) >= FTM_MIN_MID_GAP) {
        if (now - ftmLastBassHaptic > 30) {
            ftmLastMidHaptic = now;
            if (!isBeat) ftmBeatDecay = 0.6;
            isBeat = true;
            ftmFireHaptic('LIGHT', 'mid');
        }
    }

    ftmBeatDecay = Math.max(0, ftmBeatDecay - 0.04);
    if (!document.hidden) {
        ftmUpdateVisual(ftmBeatDecay, isBeat, bassFlux > bassThresh, bassEnergy);
    }
}

function ftmFireHaptic(intensity, band) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        const Haptics = window.Capacitor.Plugins.Haptics;
        try {
            if (band === 'bass') {
                Haptics.impact({ style: intensity });
            } else {
                Haptics.notification({ type: 'SUCCESS' });
            }
        } catch (e) {
            ftmVibrateNative(intensity);
        }
        return;
    }
    ftmVibrateNative(intensity);
}

function ftmVibrateNative(intensity) {
    if (!navigator.vibrate) return;
    const durations = { HEAVY: 50, MEDIUM: 30, LIGHT: 15 };
    navigator.vibrate(durations[intensity] || 30);
}

function ftmUpdateVisual(decay, isBeat, isBass, energy) {
    const ring = document.getElementById('ftmPulseRing');
    const inner = document.getElementById('ftmPulseInner');
    const status = document.getElementById('ftmStatus');
    if (!ring) return;

    const scale = 1 + (decay * 0.2);
    ring.style.transform = 'scale(' + scale.toFixed(3) + ')';

    const glow = Math.min(1, energy * 3);
    if (inner) {
        inner.style.background = isBass
            ? 'rgba(239, 68, 68, ' + (0.1 + glow * 0.3).toFixed(2) + ')'
            : 'rgba(37, 99, 235, ' + (0.08 + glow * 0.25).toFixed(2) + ')';
    }

    ring.classList.remove('heavy');
    if (isBeat && isBass) {
        ring.classList.add('heavy');
        if (status) status.textContent = 'BASS!';
    } else if (isBeat) {
        if (status) status.textContent = 'BEAT!';
    } else if (decay > 0.3) {
        if (status) status.textContent = 'Feeling the music...';
    } else {
        ring.style.transform = 'scale(1)';
        if (status) status.textContent = 'Listening...';
    }
}

async function startFTM() {
    const errorEl = document.getElementById('ftmError');
    const ring = document.getElementById('ftmPulseRing');
    const btn = document.getElementById('ftmToggleBtn');
    const status = document.getElementById('ftmStatus');

    if (errorEl) errorEl.style.display = 'none';

    try {
        ftmStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        if (errorEl) errorEl.style.display = 'block';
        return;
    }

    ftmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ftmAnalyser = ftmAudioCtx.createAnalyser();
    ftmAnalyser.fftSize = FTM_FFT_SIZE;
    ftmAnalyser.smoothingTimeConstant = 0.3;

    const source = ftmAudioCtx.createMediaStreamSource(ftmStream);
    source.connect(ftmAnalyser);

    ftmActive = true;
    ftmPrevBass = 0;
    ftmPrevMid = 0;
    ftmAvgBassFlux = 0;
    ftmAvgMidFlux = 0;
    ftmLastBassHaptic = 0;
    ftmLastMidHaptic = 0;
    ftmBeatDecay = 0;

    if (ring) ring.classList.add('active');
    if (btn) { btn.textContent = 'Stop'; btn.classList.add('active'); }
    if (status) { status.textContent = 'Listening...'; status.classList.add('active'); }

    ftmAnimFrame = setInterval(ftmAnalyseLoop, 16);
    ftmRequestWakeLock();
}

let ftmWakeLock = null;

async function ftmRequestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            ftmWakeLock = await navigator.wakeLock.request('screen');
            ftmWakeLock.addEventListener('release', () => { ftmWakeLock = null; });
        }
    } catch (e) {}
}

function ftmReleaseWakeLock() {
    if (ftmWakeLock) {
        ftmWakeLock.release().catch(() => {});
        ftmWakeLock = null;
    }
}

function stopFTM() {
    ftmActive = false;

    if (ftmAnimFrame) {
        clearInterval(ftmAnimFrame);
        ftmAnimFrame = null;
    }

    if (ftmStream) {
        ftmStream.getTracks().forEach(t => t.stop());
        ftmStream = null;
    }

    if (ftmAudioCtx) {
        ftmAudioCtx.close().catch(() => {});
        ftmAudioCtx = null;
        ftmAnalyser = null;
    }

    ftmReleaseWakeLock();

    const ring = document.getElementById('ftmPulseRing');
    const btn = document.getElementById('ftmToggleBtn');
    const status = document.getElementById('ftmStatus');

    if (ring) { ring.classList.remove('active', 'heavy'); ring.style.transform = ''; }
    if (btn) { btn.textContent = 'Start Feeling'; btn.classList.remove('active'); }
    if (status) { status.textContent = 'Feel the bass through your phone'; status.classList.remove('active'); }
}

function toggleFTM() {
    if (ftmActive) {
        stopFTM();
    } else {
        startFTM();
    }
}

// Re-acquire Wake Lock when screen comes back on
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && ftmActive && !ftmWakeLock) {
        ftmRequestWakeLock();
    }
});

window.openCommSupportModal = openCommSupportModal;
window.closeCommSupportModal = closeCommSupportModal;
window.switchCommTab = switchCommTab;
window.toggleSTT = toggleSTT;
window.clearSTT = clearSTT;
window.toggleFTM = toggleFTM;

// ========================================
// BOOKING GUIDE FUNCTIONS
// ========================================

let bgVenuesLoaded = false;

function openBgModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('bg-modal-open');
    // If opening venues modal, load content if not yet loaded
    if (id === 'bgVenuesModal' && !bgVenuesLoaded) {
        loadBgVenues();
    }
}

function closeBgModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('bg-modal-open');
}

function closeBgModalOnOverlay(e, id) {
    if (e.target.classList.contains('bg-modal-overlay')) {
        closeBgModal(id);
    }
}

function toggleBgTip(header) {
    const isActive = header.classList.contains('active');
    const tipBody = header.nextElementSibling;
    // Close all tips
    document.querySelectorAll('.bg-tip-header').forEach(h => h.classList.remove('active'));
    document.querySelectorAll('.bg-tip-body').forEach(b => b.classList.remove('show'));
    if (!isActive) {
        header.classList.add('active');
        tipBody.classList.add('show');
    }
}

function toggleBgFaq(e, btn) {
    e.stopPropagation();
    const answerContainer = btn.nextElementSibling;
    const isActive = btn.classList.contains('active');
    document.querySelectorAll('.bg-faq-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bg-faq-answer-container').forEach(a => a.classList.remove('show'));
    if (!isActive) {
        btn.classList.add('active');
        answerContainer.classList.add('show');
    }
}

function toggleBgCountry(event, button) {
    event.stopPropagation();
    const countryRegions = button.nextElementSibling;
    const isActive = button.classList.contains('active');
    const modal = button.closest('.bg-modal-body');
    if (!modal) return;
    modal.querySelectorAll('.country-button').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.country-regions').forEach(r => r.classList.remove('show'));
    modal.querySelectorAll('.region-button').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.region-venues').forEach(r => r.classList.remove('show'));
    modal.querySelectorAll('.venue-button').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.venue-details').forEach(d => d.classList.remove('show'));
    if (!isActive) {
        button.classList.add('active');
        countryRegions.classList.add('show');
    }
}

function toggleBgRegion(event, button) {
    event.stopPropagation();
    const regionVenues = button.nextElementSibling;
    const isActive = button.classList.contains('active');
    const modal = button.closest('.bg-modal-body');
    if (!modal) return;
    modal.querySelectorAll('.region-button').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.region-venues').forEach(r => r.classList.remove('show'));
    modal.querySelectorAll('.venue-button').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.venue-details').forEach(d => d.classList.remove('show'));
    if (!isActive) {
        button.classList.add('active');
        regionVenues.classList.add('show');
    }
}

function toggleBgVenue(event, button) {
    event.stopPropagation();
    const details = button.nextElementSibling;
    const isActive = button.classList.contains('active');
    const region = button.closest('.region-venues');
    if (region) {
        region.querySelectorAll('.venue-button').forEach(b => b.classList.remove('active'));
        region.querySelectorAll('.venue-details').forEach(d => d.classList.remove('show'));
    }
    if (!isActive) {
        button.classList.add('active');
        details.classList.add('show');
    }
}

function searchBgVenues() {
    const searchTerm = document.getElementById('bgVenueSearch').value.toLowerCase();
    const container = document.getElementById('bgVenueContent');
    if (!container) return;
    const countries = container.querySelectorAll('.venue-country');
    const noResults = container.querySelector('.no-results');
    let visibleCount = 0;

    countries.forEach(country => {
        const regions = country.querySelectorAll('.venue-region');
        let countryHasMatch = false;

        regions.forEach(region => {
            const buttons = region.querySelectorAll('.venue-button');
            let regionHasMatch = false;

            buttons.forEach(btn => {
                const venueName = (btn.getAttribute('data-venue') || btn.querySelector('.venue-name')?.textContent || '').toLowerCase();
                if (!searchTerm || venueName.includes(searchTerm)) {
                    btn.style.display = '';
                    btn.nextElementSibling.style.display = '';
                    regionHasMatch = true;
                    visibleCount++;
                } else {
                    btn.style.display = 'none';
                    btn.nextElementSibling.style.display = 'none';
                }
            });

            region.classList.toggle('hidden', !regionHasMatch);
            if (regionHasMatch) countryHasMatch = true;
        });

        country.classList.toggle('hidden', !countryHasMatch);

        // Auto-expand when searching
        if (searchTerm && countryHasMatch) {
            country.querySelector('.country-button')?.classList.add('active');
            country.querySelector('.country-regions')?.classList.add('show');
            country.querySelectorAll('.venue-region:not(.hidden)').forEach(r => {
                r.querySelector('.region-button')?.classList.add('active');
                r.querySelector('.region-venues')?.classList.add('show');
            });
        } else if (!searchTerm) {
            country.querySelector('.country-button')?.classList.remove('active');
            country.querySelector('.country-regions')?.classList.remove('show');
            country.querySelectorAll('.region-button').forEach(b => b.classList.remove('active'));
            country.querySelectorAll('.region-venues').forEach(r => r.classList.remove('show'));
        }
    });

    if (noResults) {
        noResults.classList.toggle('show', searchTerm && visibleCount === 0);
    }
}

function loadBgVenues() {
    if (bgVenuesLoaded) return;
    const container = document.getElementById('bgVenueContent');
    if (!container) return;

    fetch('booking-guide-venues.html')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load venues');
            return res.text();
        })
        .then(html => {
            container.innerHTML = html;
            bgVenuesLoaded = true;
        })
        .catch(err => {
            console.error('Error loading venue data:', err);
            container.innerHTML = '<p style="text-align:center;padding:40px;color:#64748B;">Unable to load venues. Please try again later.</p>';
        });
}

// Expose booking guide functions globally
window.openBgModal = openBgModal;
window.closeBgModal = closeBgModal;
window.closeBgModalOnOverlay = closeBgModalOnOverlay;
window.toggleBgTip = toggleBgTip;
window.toggleBgFaq = toggleBgFaq;
window.toggleBgCountry = toggleBgCountry;
window.toggleBgRegion = toggleBgRegion;
window.toggleBgVenue = toggleBgVenue;
window.searchBgVenues = searchBgVenues;

// Extend ESC key handler for booking guide modals
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const activeBgModal = document.querySelector('.bg-modal-overlay.active');
        if (activeBgModal) {
            closeBgModal(activeBgModal.id);
        }
    }
});

// ========================================
// START THE APP
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
