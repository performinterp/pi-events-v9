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
    localStorageKey: 'pi-events-cache',
    localStorageTimestampKey: 'pi-events-cache-timestamp'
};

// ========================================
// VENUE EMAIL DATABASE
// ========================================
// Add venue access emails here as we collect them
// Keys are lowercase venue names (or aliases), values are email addresses
const VENUE_EMAILS = {
    // London
    'the o2': 'access@theo2.co.uk',
    'o2 arena': 'access@theo2.co.uk',
    'the o2 arena': 'access@theo2.co.uk',
    'the o2 arena, london': 'access@theo2.co.uk',
    'wembley stadium': 'accessforall@wembleystadium.com',
    'wembley': 'accessforall@wembleystadium.com',
    'wembley stadium, london': 'accessforall@wembleystadium.com',
    'southbank centre': 'accesslist@southbankcentre.co.uk',
    'southbank centre, london': 'accesslist@southbankcentre.co.uk',

    // Birmingham
    'utilita arena birmingham': 'boxoffice@utilitaarenabham.co.uk',
    'utilita arena': 'boxoffice@utilitaarenabham.co.uk',

    // Newcastle
    'utilita arena newcastle': 'access@utilitarena.co.uk',

    // Leeds
    'first direct arena': 'accessibility@firstdirectarena.com',
    'first direct arena leeds': 'accessibility@firstdirectarena.com',

    // Manchester
    'ao arena': 'accessibility@ao-arena.com',
    'ao arena manchester': 'accessibility@ao-arena.com',

    // Sheffield
    'utilita arena sheffield': 'boxoffice@sheffieldarena.co.uk',

    // Liverpool
    'm&s bank arena': 'accessibility@accliverpool.com',
    'm&s bank arena liverpool': 'accessibility@accliverpool.com',

    // Glasgow
    'ovo hydro': 'accessibility@ovo-hydro.com',
    'ovo hydro glasgow': 'accessibility@ovo-hydro.com',
    'the ovo hydro': 'accessibility@ovo-hydro.com',

    // Nottingham
    'motorpoint arena': 'accessibility@motorpointarenanottingham.com',
    'motorpoint arena nottingham': 'accessibility@motorpointarenanottingham.com',
};

/**
 * Find all matching venues from database
 * Returns array of { venueName, email } objects
 */
function findMatchingVenues(query) {
    if (!query || query.trim() === '') return [];

    const queryLower = query.toLowerCase().trim();
    const matches = [];
    const seenEmails = new Set(); // Avoid duplicates (same venue, different aliases)

    // Exact match first
    if (VENUE_EMAILS[queryLower]) {
        return [{ venueName: queryLower, email: VENUE_EMAILS[queryLower] }];
    }

    // Fuzzy match - find all venues that contain the query or vice versa
    for (const [key, email] of Object.entries(VENUE_EMAILS)) {
        if ((queryLower.includes(key) || key.includes(queryLower)) && !seenEmails.has(email)) {
            matches.push({ venueName: key, email });
            seenEmails.add(email);
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
                // Single match - auto-fill
                venueEmailInput.value = matches[0].email;
                wasAutoFilled = true;
                venueEmailStatus.innerHTML = '<span class="status-found">We have this venue\'s access email</span>';
                venueEmailStatus.className = 'venue-email-status found';
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

        // Build picker HTML
        const html = matches.map(m => {
            // Capitalize venue name for display
            const displayName = m.venueName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            return `<button type="button" class="venue-match-btn" data-email="${m.email}" data-venue="${displayName}">${displayName}</button>`;
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
                venueEmailStatus.innerHTML = '<span class="status-found">We have this venue\'s access email</span>';
                venueEmailStatus.className = 'venue-email-status found';
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
    if (event['TIME']) params.set('time', event['TIME']);
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
        dateInput.value = params.get('date') + (time ? ` at ${time}` : '');
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
        '/event': 'renderEventDetail'
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

        // Route to appropriate flow
        if (route === '/' || route === '') {
            this.renderHome();
        } else if (route === '/flow1' || route.startsWith('/flow1/') || route === 'events') {
            this.renderFlow1();
        } else if (route === '/flow2') {
            this.renderFlow2();
        } else if (route === '/flow3') {
            this.renderFlow3();
        } else if (route.startsWith('/event/')) {
            this.renderEventDetail();
        } else {
            this.renderHome();
        }
    },

    hideAllFlows() {
        const flows = ['homeFlow', 'flow1Section', 'flow2Section', 'flow3Section', 'eventDetailSection'];
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
        time: 'month',
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

function updateLastUpdatedTimestamp(timestamp) {
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
    element.textContent = `Events data last updated: ${formattedDate}`;
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
    
    return {
        day: '--',
        month: '---',
        full: dateString,
        timestamp: Date.now(),
        dateObj: new Date()
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
        `DESCRIPTION:${event['DESCRIPTION'] || 'BSL/ISL interpreted event'}\\nInterpreted by: ${event['INTERPRETERS'] || 'TBA'}`,
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
        text: `${event['EVENT']} - Interpreted by ${event['INTERPRETERS'] || 'Professional BSL/ISL interpreters'}`,
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
        // Green badge - ALWAYS open access-first modal (no direct ticket links)
        primaryButton = `
            <button class="btn-primary" onclick='openAccessFirstModal(${JSON.stringify(event).replace(/'/g, "&apos;")})'>
                📋 How to Book BSL Access
            </button>
        `;
    } else {
        // Orange/Red badge - show request BSL option
        // For O2 events, create pre-filled email to their accessibility team
        const venue = (event['VENUE'] || '').toLowerCase();
        const isO2Venue = venue.includes('o2') || venue.includes('indigo');

        if (isO2Venue) {
            const eventName = event['EVENT'] || 'Event';
            const eventDate = event['DATE'] || '';
            const eventTime = event['TIME'] || 'TBC';
            const subject = encodeURIComponent(`BSL Interpreter Request - ${eventName}`);
            const body = encodeURIComponent(
`Hello O2 Accessibility Team,

I would like to request a BSL interpreter for the following event:

Event: ${eventName}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${event['VENUE'] || 'The O2'}

Please let me know the process for arranging BSL interpretation for this event.

Thank you`
            );
            primaryButton = `
                <a href="mailto:access@theo2.co.uk?cc=office@performanceinterpreting.co.uk&subject=${subject}&body=${body}" class="btn-primary">
                    ✉️ Request BSL
                </a>
            `;
        } else {
            primaryButton = `
                <a href="#/flow3" class="btn-primary">
                    ✉️ Request BSL
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

                ${!isGrouped && badge.badge !== 'green' ? `
                    <div class="event-request-interpreter">
                        <a href="${buildRequestInterpreterUrl(event)}" class="request-interpreter-link">
                            Request an interpreter for this event →
                        </a>
                    </div>
                ` : ''}

                <div class="event-actions">
                    ${primaryButton}
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
    const hasTicketLink = event['EVENT URL'] && event['EVENT URL'].trim() !== '';

    return `
        <article class="event-card-compact" data-event-id="${Date.now()}-${Math.random()}">
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
                ${hasTicketLink ? `
                    <a href="${event['EVENT URL']}" target="_blank" rel="noopener" class="compact-btn">
                        🎟️ Tickets
                    </a>
                ` : ''}
            </div>
        </article>
    `;
}

/**
 * Create a list view event item (text-only rows)
 */
function createListEventItem(event) {
    const date = formatDate(event['DATE']);
    const hasTicketLink = event['EVENT URL'] && event['EVENT URL'].trim() !== '';

    return `
        <article class="event-list-item" data-event-id="${Date.now()}-${Math.random()}">
            <div class="list-date">
                <span class="list-date-day">${date.day}</span>
                <span class="list-date-month">${date.month}</span>
            </div>

            <div class="list-content">
                <h3 class="list-title">${event['EVENT']}</h3>
                <div class="list-meta">
                    <span class="list-venue">📍 ${event['VENUE']}</span>
                    ${event['TIME'] ? `<span class="list-time">🕐 ${event['TIME']}</span>` : ''}
                </div>
            </div>

            ${hasTicketLink ? `
                <a href="${event['EVENT URL']}" target="_blank" rel="noopener" class="list-btn">
                    🎟️ Tickets
                </a>
            ` : ''}
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
        // Check if we should show category-specific title or just count
        if (AppState.selectedCategory && hasCategoryFilter) {
            // Show category with icon and back button
            let categoryDisplay = AppState.selectedCategory;
            let categoryIcon = getCategoryIcon(AppState.selectedCategory);
            let backButtonText = '← Back to Categories';
            let backButtonHandler = 'backToCategorySelection()';

            // Special handling for Festival sub-categories
            if (AppState.selectedCategory === 'Festival' && AppState.festivalSubcategory) {
                backButtonText = '← Back to Festival Types';
                backButtonHandler = 'backToFestivalSubcategories()';

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
                <button onclick="${backButtonHandler}" class="back-button">
                    ${backButtonText}
                </button>
                <h2 class="results-title">${categoryIcon} ${categoryDisplay}: ${eventsToRender.length} ${eventsToRender.length === 1 ? 'event' : 'events'}</h2>
            `;
        } else {
            // Show just count with back button
            const eventWord = eventsToRender.length === 1 ? 'event' : 'events';
            const hasActiveFilters = AppState.filters.search ||
                                     AppState.filters.time !== 'all' ||
                                     AppState.filters.interpretation !== 'all' ||
                                     AppState.filters.location !== 'all';

            let titleText;
            if (hasActiveFilters) {
                titleText = `${eventsToRender.length} ${eventWord} found`;
            } else {
                titleText = `All: ${eventsToRender.length} ${eventWord}`;
            }

            resultsHeaderContent.innerHTML = `
                <button onclick="backToCategorySelection()" class="back-button">
                    ← Back to Categories
                </button>
                <h2 class="results-title">${titleText}</h2>
            `;
        }
    } else {
        updateResultsTitle(eventsToRender.length);
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
    return `
        <div class="category-card" onclick="openCategory('${category.replace(/'/g, "\\'")}')">
            <div class="category-card-icon">${icon}</div>
            <h3 class="category-card-title">${category}</h3>
            <p class="category-card-count">${count} ${count === 1 ? 'event' : 'events'}</p>
            <div class="category-card-arrow">→</div>
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

    // Get unique categories with counts
    // Apply the same time filter as applyFilters() so counts match what users see
    const categoryCounts = {};
    const now = Date.now();
    const monthFromNow = now + (30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < AppState.allEvents.length; i++) {
        const event = AppState.allEvents[i];

        // Skip events without interpreter listed
        const hasInterpreter = event['INTERPRETERS'] && event['INTERPRETERS'].trim() !== '';
        if (!hasInterpreter) {
            continue;
        }

        // Apply default time filter (month) to match what applyFilters shows
        const eventTime = formatDate(event['DATE']).timestamp;
        if (eventTime && (eventTime < now || eventTime > monthFromNow)) {
            continue;
        }

        let category = event['CATEGORY'] || 'Other';

        // Only count singular categories for filter buttons
        if (!category.includes(',')) {
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
        'Other': '❓'
    };

    // Sort categories in priority order
    const categoryOrder = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions', 'Other'];
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
        'Other': '❓'
    };
    return categoryIcons[category] || '❓';
}

// Make functions available globally
window.openCategory = openCategory;
window.openFestivalSubcategory = openFestivalSubcategory;
window.backToCategorySelection = backToCategorySelection;
window.backToFestivalSubcategories = backToFestivalSubcategories;

// ========================================
// DATA FETCHING
// ========================================

/**
 * Load cached events from localStorage
 */
function loadCachedEvents() {
    try {
        const cached = localStorage.getItem(CONFIG.localStorageKey);
        const timestamp = localStorage.getItem(CONFIG.localStorageTimestampKey);

        if (cached && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < CONFIG.cacheDuration) {
                const events = JSON.parse(cached);
                AppState.allEvents = events;
                AppState.lastFetch = parseInt(timestamp);
                // Build search vocabulary for "Did you mean?" suggestions
                buildSearchVocabulary(events);
                // Update timestamp display from cache
                updateLastUpdatedTimestamp(parseInt(timestamp));
                return events;
            }
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
        const cachedEvents = loadCachedEvents();
        if (cachedEvents && cachedEvents.length > 0) {
            console.log('Using stale cache due to fetch error');
            return cachedEvents;
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

            // For other categories, check if event directly matches the filter
            if (categories.includes(AppState.filters.category)) {
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
    const vocabulary = new Set();

    events.forEach(event => {
        // Add full event names
        if (event.EVENT) {
            vocabulary.add(event.EVENT);
            // Also add individual significant words (3+ chars)
            event.EVENT.split(/\s+/).forEach(word => {
                const cleaned = word.replace(/[^\w]/g, '');
                if (cleaned.length >= 3) {
                    vocabulary.add(cleaned);
                }
            });
        }

        // Add venue names
        if (event.VENUE) {
            vocabulary.add(event.VENUE);
            // Add venue without location suffix
            const venueParts = event.VENUE.split(',');
            if (venueParts.length > 1) {
                vocabulary.add(venueParts[0].trim());
            }
        }

        // Add interpreter names
        if (event.INTERPRETERS) {
            event.INTERPRETERS.split(/[,&]/).forEach(name => {
                const trimmed = name.trim();
                if (trimmed.length >= 3) {
                    vocabulary.add(trimmed);
                }
            });
        }
    });

    // Filter out very short terms and return as array
    AppState.searchVocabulary = Array.from(vocabulary).filter(v => v && v.length >= 3);
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

    AppState.searchVocabulary.forEach(term => {
        const termLower = term.toLowerCase();

        // Skip if it's an exact match (already found in search)
        if (termLower === queryLower) return;
        if (termLower.includes(queryLower) || queryLower.includes(termLower)) return;

        // Strategy 1: Compare full query to full term (for multi-word matches)
        const lengthDiff = Math.abs(term.length - query.length);
        if (lengthDiff <= 5) {
            const distance = levenshteinDistance(queryLower, termLower);
            // More generous: allow up to 40% of characters to be different
            const maxDistance = Math.max(2, Math.ceil(query.length * 0.4));

            if (distance > 0 && distance <= maxDistance) {
                suggestions.push({ term, distance, termLower });
                return; // Found a match, skip word-by-word check
            }
        }

        // Strategy 2: Check if any query word is similar to any word in term
        const termWords = termLower.split(/\s+/).filter(w => w.length >= 3);
        for (const qWord of queryWords) {
            for (const tWord of termWords) {
                if (Math.abs(qWord.length - tWord.length) <= 2) {
                    const wordDistance = levenshteinDistance(qWord, tWord);
                    // For individual words, allow 1-2 edits
                    if (wordDistance > 0 && wordDistance <= 2) {
                        // Weight by how good the match is
                        suggestions.push({ term, distance: wordDistance + 0.5, termLower });
                        return;
                    }
                }
            }
        }
    });

    // Sort by distance (best matches first), then alphabetically
    suggestions.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.termLower.localeCompare(b.termLower);
    });

    // Remove duplicates (case-insensitive)
    const seen = new Set();
    const unique = suggestions.filter(s => {
        if (seen.has(s.termLower)) return false;
        seen.add(s.termLower);
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
        'Other': '❓'
    };

    // Sort categories in priority order
    const categoryOrder = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions', 'Other'];
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

    // Header scroll shadow and back to top button visibility
    const backToTopBtn = document.getElementById('backToTop');
    const moreDropdownMenu = document.getElementById('moreDropdownMenu');

    window.addEventListener('scroll', () => {
        const header = document.querySelector('.app-header');
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Show/hide back to top button
        if (backToTopBtn) {
            if (window.scrollY > 500) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
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

    // Back to top button click handler
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

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
        const cachedEvents = loadCachedEvents();

        if (cachedEvents && cachedEvents.length > 0) {
            // Show cached data IMMEDIATELY for instant load
            switchToCategoryView();

            // Populate filters with cached data
            populateFilters();

            // Fetch fresh data in background and update if changed
            fetchEvents(true).then(freshEvents => {
                if (freshEvents && freshEvents.length > 0) {
                    // Check if data changed
                    const dataChanged = JSON.stringify(freshEvents) !== JSON.stringify(cachedEvents);
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

        const eventName = document.getElementById('eventName').value;
        const venueName = document.getElementById('venueName').value;
        const eventDate = document.getElementById('eventDate').value;
        const venueEmail = document.getElementById('venueEmail')?.value || '';
        const hasVenueEmail = venueEmail.trim() !== '';

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
                <p><strong>But you can still request BSL!</strong></p>
                <a href="#/flow3" class="btn-primary">Request BSL for This Event →</a>
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
                            <a href="booking-guide.html" class="btn-secondary">How to Book</a>
                        ` : `
                            <a href="#/flow3" class="btn-primary">Request BSL</a>
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
    const body = encodeURIComponent(`Hi ${currentEventForAccess.VENUE} team,

I want to book accessible tickets for ${currentEventForAccess.EVENT}.

Date: ${currentEventForAccess.DATE}
Time: ${currentEventForAccess.TIME || 'TBC'}

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
 * Open the Get Tickets modal with booking guidance
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
 * Close the Get Tickets modal
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
 * Contact venue from the Get Tickets modal
 */
function contactVenueFromTicketsModal() {
    if (!currentTicketEvent) {
        alert('No event selected');
        return;
    }

    const venueEmail = currentTicketEvent.VENUE_CONTACT_EMAIL || '';
    const language = getInterpretationLanguage(currentTicketEvent);

    const subject = encodeURIComponent(`${language} Accessible Tickets - ${currentTicketEvent.EVENT}`);
    const body = encodeURIComponent(`Hi ${currentTicketEvent.VENUE} team,

I want to book accessible tickets for ${currentTicketEvent.EVENT}.

Date: ${currentTicketEvent.DATE}
Time: ${currentTicketEvent.TIME || 'TBC'}

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
            <p>See our full booking guide for detailed steps.</p>
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

    // Update event name in subtitle
    const eventNameEl = document.getElementById('accessFirstEventName');
    if (eventNameEl && event['EVENT']) {
        eventNameEl.textContent = event['EVENT'];
    }

    // Show ACCESS_NOTES if available
    const accessNotesEl = document.getElementById('accessNotesText');
    if (accessNotesEl && event['ACCESS_NOTES'] && event['ACCESS_NOTES'].trim()) {
        accessNotesEl.textContent = event['ACCESS_NOTES'];
        accessNotesEl.style.display = 'block';
    } else if (accessNotesEl) {
        accessNotesEl.style.display = 'none';
    }

    // Handle VRS button
    const vrsButton = document.getElementById('vrsButton');
    const vrsButtonText = document.getElementById('vrsButtonText');
    if (vrsButton && event['VRS_URL'] && event['VRS_URL'].trim()) {
        vrsButton.style.display = 'block';
        // Update button text if provider name available
        if (vrsButtonText && event['VRS_PROVIDER'] && event['VRS_PROVIDER'].trim()) {
            const provider = event['VRS_PROVIDER'];
            vrsButtonText.textContent = `📹 Use ${provider}`;
        } else if (vrsButtonText) {
            vrsButtonText.textContent = '📹 Use Video Relay';
        }
    } else if (vrsButton) {
        vrsButton.style.display = 'none';
    }

    // Handle Official Site button
    const officialSiteButton = document.getElementById('officialSiteButton');
    if (officialSiteButton && event['OFFICIAL_SITE_URL'] && event['OFFICIAL_SITE_URL'].trim()) {
        officialSiteButton.style.display = 'block';
    } else if (officialSiteButton) {
        officialSiteButton.style.display = 'none';
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
 * Creates a pre-written email asking for BSL/ISL accessible seating
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

    // Format date for email
    let formattedDate = date;
    try {
        const dateObj = new Date(date);
        if (!isNaN(dateObj)) {
            formattedDate = dateObj.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (e) {
        // Keep original date if parsing fails
    }

    // Email template
    const subject = `${language} Access Request - ${eventName}`;
    const body = `Hi,

I am a Deaf ${language} user and would like to attend ${eventName} at ${venue} on ${formattedDate}.

Please can you advise how I can book tickets with a clear view of the interpreter/${language} area?

Thank you.`;

    // Get email address from event data or use fallback
    const emailTo = event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';

    // Create mailto link
    const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
    if (!currentAccessEvent || !currentAccessEvent['VRS_URL']) {
        alert('Video Relay Service link not available for this venue');
        return;
    }

    window.open(currentAccessEvent['VRS_URL'], '_blank', 'noopener,noreferrer');
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

// Make functions global
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
// START THE APP
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
