/*==========================================================================
  PERFORMANCE INTERPRETING - MAIN APPLICATION
  Supports PWA (browser) and native (Capacitor iOS/Android)
  ==========================================================================*/

// ========================================
// NATIVE APP DETECTION
// ========================================
let IS_NATIVE_APP = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

// Global error handlers — prevent silent async crashes
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
window.addEventListener('error', (e) => {
    console.error('Uncaught error:', e.message, e.filename, e.lineno);
});

// Re-detect at DOMContentLoaded in case Capacitor bridge loads after initial script parse
document.addEventListener('DOMContentLoaded', () => {
    if (!IS_NATIVE_APP && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        IS_NATIVE_APP = true;
        // Trigger native init that was skipped
        document.body.classList.add('native-app');
        // Remove PWA shell elements
        document.querySelectorAll('.app-header, .hero-section, .app-footer, #homeFlow, #scrollTopBtn, #atEventFab').forEach(el => el.remove());
        // Re-run init to pick up native mode
        if (typeof NativeShell !== 'undefined') {
            NativeShell.init();
        }
    }
});

// ========================================
// NATIVE APP INITIALIZATION
// ========================================
if (IS_NATIVE_APP) {
    document.addEventListener('DOMContentLoaded', () => {
        // Override openFeedbackModal in native — always go to the inline Feedback page
        // Runs after DOMContentLoaded so it overwrites the index.html inline definition
        setTimeout(function() {
            window.openFeedbackModal = function() {
                // Close any open bg modals first
                document.querySelectorAll('.bg-modal-overlay.active').forEach(function(m) { m.classList.remove('active'); });
                document.body.style.overflow = '';
                NativeShell.switchTab('more');
                setTimeout(function() { NativeShell.handleMoreAction('feedback'); }, 200);
            };
            // Bind Quick Tips feedback button (lives in bgTipsModal, not cloned)
            var tipsFeedbackBtn = document.getElementById('bgTipsFeedbackBtn');
            if (tipsFeedbackBtn) {
                tipsFeedbackBtn.addEventListener('click', function() { window.openFeedbackModal(); });
            }
        }, 100);
        const { StatusBar, SplashScreen, Keyboard, App } = window.Capacitor.Plugins || {};

        // Configure status bar — white text on blue background
        if (StatusBar) {
            try {
                StatusBar.setStyle({ style: 'DARK' });
                StatusBar.setBackgroundColor({ color: '#2563EB' });
                StatusBar.setOverlaysWebView({ overlay: false });
            } catch (e) { console.warn('StatusBar plugin error:', e); }
        }

        // Android edge-to-edge: modern Android enforces overlay mode.
        // Use dynamic status bar height via CSS env() or JS measurement.
        const isAndroid = window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android';
        if (isAndroid) {
            document.body.classList.add('native-android');
            // Measure actual status bar + navigation bar heights
            if (StatusBar && StatusBar.getInfo) {
                try {
                    StatusBar.getInfo().then(info => {
                        const sbHeight = (info && info.height) ? info.height : 24;
                        document.documentElement.style.setProperty('--android-status-bar-height', sbHeight + 'px');
                    }).catch(() => {});
                } catch (e) {}
            }
            // Navigation bar height — use Android system insets via Capacitor
            // Fallback: measure from visualViewport vs screen difference
            const setNavBarHeight = () => {
                const vv = window.visualViewport;
                const viewportH = vv ? vv.height : window.innerHeight;
                const navH = screen.height - viewportH;
                if (navH > 20 && navH < 200) {
                    document.documentElement.style.setProperty('--android-nav-bar-height', navH + 'px');
                } else {
                    // Safe default for 3-button nav at mdpi-hdpi
                    document.documentElement.style.setProperty('--android-nav-bar-height', '48px');
                }
            };
            setNavBarHeight();
            window.addEventListener('resize', setNavBarHeight);
        }

        // Hide native splash, show animated welcome screen
        if (SplashScreen) {
            try { SplashScreen.hide(); } catch (e) { console.warn('SplashScreen plugin error:', e); }
        }
        showWelcomeScreen();

        // Keyboard: don't resize viewport (capacitor.config.json resize:none + Android adjustNothing)
        // Manually scroll focused input above keyboard on all platforms
        function _kbShow(kh) {
            document.documentElement.style.setProperty('--keyboard-height', kh + 'px');
            let spacer = document.getElementById('_kbSpacer');
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.id = '_kbSpacer';
                document.body.appendChild(spacer);
            }
            spacer.style.height = kh + 'px';
            setTimeout(() => {
                const el = document.activeElement;
                if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) return;
                const rect = el.getBoundingClientRect();
                const visibleBottom = window.innerHeight - kh;
                if (rect.bottom > visibleBottom - 20) {
                    window.scrollBy({ top: rect.bottom - visibleBottom + 60, behavior: 'smooth' });
                }
            }, 150);
        }
        function _kbHide() {
            document.documentElement.style.setProperty('--keyboard-height', '0px');
            const spacer = document.getElementById('_kbSpacer');
            if (spacer) spacer.style.height = '0px';
        }

        if (Keyboard) {
            try {
                Keyboard.setAccessoryBarVisible({ isVisible: true });
                // iOS fires keyboardWillShow, Android fires keyboardDidShow — listen to both
                Keyboard.addListener('keyboardWillShow', (info) => _kbShow(info.keyboardHeight));
                Keyboard.addListener('keyboardDidShow', (info) => _kbShow(info.keyboardHeight));
                Keyboard.addListener('keyboardWillHide', _kbHide);
                Keyboard.addListener('keyboardDidHide', _kbHide);
            } catch (e) { console.warn('Keyboard plugin error:', e); }
        }

        // Fallback: use visualViewport resize for tablets/web where plugin may not fire
        if (window.visualViewport) {
            let _lastVVH = window.visualViewport.height;
            window.visualViewport.addEventListener('resize', () => {
                const vv = window.visualViewport;
                const diff = window.innerHeight - vv.height;
                if (diff > 100) {
                    _kbShow(diff);
                } else if (_lastVVH < window.innerHeight - 100 && diff < 100) {
                    _kbHide();
                }
                _lastVVH = vv.height;
            });
        }

        // Handle hardware back button (Android)
        if (App) {
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });

        }

        // Remove manifest link — not needed in native
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) manifestLink.remove();

        // Remove PWA shell elements that shouldn't appear in native
        document.querySelectorAll('.app-header, .hero-section, .app-footer, #homeFlow, #scrollTopBtn, #atEventFab').forEach(el => {
            el.remove();
        });
        // Hide (don't remove) about/contact — More tab reparents them
        document.querySelectorAll('.about-section, .contact-section').forEach(el => {
            el.style.display = 'none';
        });


        // Hide "Install App" buttons in nav menus
        document.querySelectorAll('[onclick*="openInstallPrompt"]').forEach(el => {
            el.style.display = 'none';
        });

        // In native mode, override modal opens to show content inline (cloned, not moved)
        function nativeShowInline(sourceSelector, title, key) {
            const source = document.querySelector(sourceSelector);
            if (!source) return;
            const subview = document.getElementById('nativeMoreSubview');
            const grid = document.getElementById('nativeMoreGrid');
            if (!subview || !grid) return;
            subview.innerHTML = '';
            // Clone the body content so original stays intact
            const bodyEl = source.querySelector('.bg-modal-body, .festival-modal-body, .feedback-modal-container');
            if (bodyEl) {
                const clone = bodyEl.cloneNode(true);
                subview.appendChild(clone);
            } else {
                // Clone the whole source element (e.g. bookingGuideSection)
                const clone = source.cloneNode(true);
                clone.style.display = 'block';
                subview.appendChild(clone);
            }
            grid.style.display = 'none';
            const lrInline = document.getElementById('nativeMoreLegalRow');
            if (lrInline) lrInline.style.display = 'none';
            const vbInline = document.getElementById('nativeVolunteerBanner');
            if (vbInline) vbInline.style.display = 'none';
            subview.classList.add('active');
            NativeShell.updateTopBar(title, true);
            NativeShell.tabHistory.more.push({ type: 'subview', key, title });
            window.scrollTo(0, 0);
            // Re-bind ALL interactive elements on cloned content
            // Skip elements that get direct bindings below (bg-faq-button, bg-tip-header, festival toggles)
            subview.querySelectorAll('[onclick]').forEach(el => {
                if (el.classList.contains('bg-faq-button') || el.classList.contains('bg-tip-header') ||
                    el.classList.contains('festival-accordion-toggle') || el.classList.contains('festival-section-title') ||
                    el.classList.contains('country-button') || el.classList.contains('region-button') ||
                    el.classList.contains('venue-button') || el.classList.contains('festival-contact-btn')) {
                    el.removeAttribute('onclick');
                    return;
                }
                const handler = el.getAttribute('onclick');
                el.removeAttribute('onclick');
                el.addEventListener('click', function(e) {
                    // Execute onclick handler without eval (CSP-safe)
                    // Extract function name and args from handler string
                    const match = handler.match(/^(\w+)\((.*)\)$/);
                    if (match) {
                        const fnName = match[1];
                        const fn = window[fnName];
                        if (typeof fn === 'function') {
                            // Parse simple string/number args
                            const argStr = match[2].trim();
                            if (argStr) {
                                const args = argStr.split(',').map(a => {
                                    a = a.trim();
                                    // Pass actual event/element for special keywords
                                    if (a === 'event' || a === 'e') return e;
                                    if (a === 'this') return el;
                                    if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) {
                                        return a.slice(1, -1);
                                    }
                                    if (!isNaN(a)) return Number(a);
                                    return a;
                                });
                                fn.apply(el, args);
                            } else {
                                fn.call(el);
                            }
                        }
                    }
                });
            });
            // Also directly bind accordion toggles
            subview.querySelectorAll('.bg-tip-header').forEach(h => {
                h.style.cursor = 'pointer';
                h.addEventListener('click', () => { if (typeof toggleBgTip === 'function') toggleBgTip(h); });
            });
            subview.querySelectorAll('.bg-faq-button').forEach(b => {
                b.style.cursor = 'pointer';
                b.addEventListener('click', (e) => { if (typeof toggleBgFaq === 'function') toggleBgFaq(e, b); });
            });
            subview.querySelectorAll('.festival-accordion-toggle, .festival-section-title').forEach(t => {
                t.style.cursor = 'pointer';
                t.addEventListener('click', () => { if (typeof toggleFestivalSection === 'function') toggleFestivalSection(t); });
            });
            // Venue country/region/venue buttons
            subview.querySelectorAll('.country-button').forEach(b => {
                b.style.cursor = 'pointer';
                b.addEventListener('click', (e) => { if (typeof toggleBgCountry === 'function') toggleBgCountry(e, b); });
            });
            subview.querySelectorAll('.region-button').forEach(b => {
                b.style.cursor = 'pointer';
                b.addEventListener('click', (e) => { if (typeof toggleBgRegion === 'function') toggleBgRegion(e, b); });
            });
            subview.querySelectorAll('.venue-button').forEach(b => {
                b.style.cursor = 'pointer';
                b.addEventListener('click', (e) => { if (typeof toggleBgVenue === 'function') toggleBgVenue(e, b); });
            });
            // Feedback/contact buttons
            subview.querySelectorAll('.festival-contact-btn').forEach(b => {
                b.removeAttribute('onclick');
                b.addEventListener('click', () => { if (typeof openFeedbackModal === 'function') openFeedbackModal(); });
            });
            // Update video language labels on cloned content
            if (typeof updateVideoLangLabels === 'function') updateVideoLangLabels();
        }

        const origOpenBgModal = window.openBgModal;
        window.openBgModal = function(modalId) {
            if (!IS_NATIVE_APP) { origOpenBgModal(modalId); return; }
            const titles = {
                bgBookingModal: 'How to Book',
                bgVenuesModal: 'Venues',
                bgTipsModal: 'Quick Tips',
                bgFaqModal: 'FAQs'
            };
            nativeShowInline('#' + modalId, titles[modalId] || 'Details', modalId);
        };

        const origOpenKYR = window.openKnowYourRightsModal;
        window.openKnowYourRightsModal = function() {
            if (!IS_NATIVE_APP) { origOpenKYR(); return; }
            nativeShowInline('#knowYourRightsModal', 'Know Your Rights', 'knowYourRights');
        };

        const origOpenFC = window.openFestivalChecklistModal;
        window.openFestivalChecklistModal = function() {
            if (!IS_NATIVE_APP) { origOpenFC(); return; }
            nativeShowInline('#festivalChecklistModal', 'Festival Checklist', 'festivalChecklist');
        };

        const origOpenNotif = window.openNotificationPreferences;
        window.openNotificationPreferences = function() {
            if (!IS_NATIVE_APP) { if (origOpenNotif) origOpenNotif(); return; }
            nativeShowInline('#notificationPreferencesModal', 'Notifications', 'notifications');
            // Point notification functions at the cloned subview DOM and initialize
            const subview = document.getElementById('nativeMoreSubview');
            if (subview) {
                if (typeof setNotificationRoot === 'function') setNotificationRoot(subview);
                if (typeof initializeNotificationModal === 'function') initializeNotificationModal();
            }
        };

        // Feedback stays as modal (Tally form needs its original DOM)
        // No override — use original openFeedbackModal

        // ========================================
        // NATIVE PUSH NOTIFICATIONS (Capacitor)
        // Disabled for v1 — re-enable for v2
        // ========================================
        const { PushNotifications } = window.Capacitor.Plugins || {};
        if (PushNotifications) {
            // Don't request permissions on launch — wait for user to subscribe
            // via notification preferences. Expose a function to trigger it.
            window.requestNativePush = async function() {
                const result = await PushNotifications.requestPermissions();
                if (result.receive === 'granted') {
                    PushNotifications.register();
                    return true;
                }
                return false;
            };

            // Handle registration success — store device token
            // Backend registration is handled by subscribeNativePush() in notifications.js
            // to avoid race conditions with preference saving
            PushNotifications.addListener('registration', token => {
                window._nativePushToken = token.value;
                localStorage.setItem('pi-push-token', token.value);
            });

            // Handle registration error
            PushNotifications.addListener('registrationError', err => {
                console.error('[Native Push] Registration failed:', err);
            });

            // Handle push received while app is open
            PushNotifications.addListener('pushNotificationReceived', notification => {
                storeNotification({
                    title: notification.title || 'New Event',
                    body: notification.body || '',
                    data: notification.data || {},
                    time: new Date().toISOString(),
                });
                // Refresh notification pane if it's currently open
                const drawer = document.getElementById('notificationsDrawer');
                if (drawer && drawer.classList.contains('open') && typeof openNotificationsDrawer === 'function') {
                    openNotificationsDrawer();
                } else {
                    // Show blue in-app banner (matches notification prompt style)
                    showPushBanner(notification.title, notification.body);
                }
            });

            // Handle push tap (opens app from background → open notification pane)
            PushNotifications.addListener('pushNotificationActionPerformed', notification => {
                console.log('[Native Push] Action performed:', notification);
                const n = notification.notification || {};
                storeNotification({
                    title: n.title || 'New Event',
                    body: n.body || '',
                    data: n.data || {},
                    time: new Date().toISOString(),
                });
                PushNotifications.removeAllDeliveredNotifications();
                // Open the notification pane after a short delay (app needs to render first)
                setTimeout(() => {
                    if (typeof openNotificationsDrawer === 'function') {
                        openNotificationsDrawer();
                    }
                }, 500);
            });

            // When app resumes from background: pick up any notifications that arrived
            // while the app was closed/backgrounded (pushNotificationReceived only fires
            // when the app is foregrounded, so background-delivered notifications are missed
            // unless we explicitly fetch them here).
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    PushNotifications.getDeliveredNotifications().then(result => {
                        const pending = (result && result.notifications) || [];
                        pending.forEach(n => {
                            storeNotification({
                                title: n.title || 'New Event',
                                body: n.body || '',
                                data: n.data || {},
                                time: new Date().toISOString(),
                            });
                        });
                    }).catch(() => {}).finally(() => {
                        PushNotifications.removeAllDeliveredNotifications();
                        navigator.clearAppBadge?.();
                    });
                }
            });
        }
    });
}

// ========================================
// WELCOME SCREEN (Native only)
// ========================================
function showWelcomeScreen() {
    const overlay = document.createElement('div');
    overlay.id = 'welcomeScreen';

    const topLogos = [
        { src: 'client-logos/Festival Republic.jpg', alt: 'Festival Republic' },
        { src: 'client-logos/The O2.png', alt: 'The O2' },
        { src: 'client-logos/Live nation.png', alt: 'Live Nation' },
        { src: 'client-logos/Arsenal.png', alt: 'Arsenal' },
        { src: 'client-logos/Wembley Stadium.svg', alt: 'Wembley Stadium' },
        { src: 'client-logos/BBC.svg', alt: 'BBC' },
    ];
    const bottomLogos = [
        { src: 'client-logos/Southbank.jpg', alt: 'Southbank Centre' },
        { src: 'client-logos/NFL.png', alt: 'NFL' },
        { src: 'client-logos/Croke Park.png', alt: 'Croke Park' },
        { src: 'client-logos/MCD.jpg', alt: 'MCD' },
        { src: 'client-logos/Chelsea.svg', alt: 'Chelsea' },
        { src: 'client-logos/RAH.png', alt: 'Royal Albert Hall' },
    ];
    const toImgs = (arr) => arr.map(l => `<img src="${l.src}" alt="${l.alt}" class="carousel-logo">`).join('');
    const topSet = toImgs(topLogos);
    const bottomSet = toImgs(bottomLogos);

    overlay.innerHTML = `
        <video id="welcomeVideo" autoplay loop muted playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:0;transition:opacity 0.3s;">
            <source src="hero-video.mp4" type="video/mp4">
        </video>
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(180deg, rgba(30,64,175,0.2) 0%, rgba(30,64,175,0.35) 25%, rgba(30,64,175,0.5) 45%, rgba(255,255,255,0.85) 65%, rgba(255,255,255,1) 75%);z-index:1;"></div>
        <div class="welcome-carousel" style="position:absolute;top:var(--android-status-bar-height, 0px);left:0;right:0;z-index:3;background:#fff;">
            <div class="welcome-carousel-track">${topSet}${topSet}${topSet}${topSet}${topSet}${topSet}${topSet}${topSet}${topSet}${topSet}</div>
        </div>
        <div id="welcomeTop" style="position:absolute;top:12%;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 32px;">
            <img src="pi-logo-white-hires.png" alt="Performance Interpreting" style="max-width:200px;height:auto;opacity:1;" />
            <p style="text-align:center;font-size:26px;font-weight:700;font-style:italic;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.4);opacity:1;">Inclusivity is more than a word; it's an <span style="color:#93C5FD;font-weight:800;">experience</span>!</p>
        </div>
        <div id="welcomeBottom" style="position:absolute;bottom:calc(65px + env(safe-area-inset-bottom, 0px));left:0;right:0;z-index:4;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 24px;">
            <div style="background:rgba(255,255,255,0.95);border:1.5px solid #BFDBFE;border-radius:12px;padding:10px 16px;max-width:300px;">
                <p style="margin:0;font-size:14px;font-weight:800;color:#991B1B;text-align:center;">PI does not sell tickets</p>
                <p style="margin:2px 0 0;font-size:12px;font-weight:600;color:#374151;text-align:center;">We help you find and request interpreted events</p>
            </div>
            <button id="welcomeEnterBtn" class="btn-shimmer" style="position:relative;padding:14px 48px;font-size:17px;font-weight:700;color:#fff;background:#2563EB;border:none;border-radius:12px;cursor:pointer;opacity:1;">Enter</button>
        </div>
        <div class="welcome-carousel reverse" style="position:absolute;bottom:calc(env(safe-area-inset-bottom, 0px) + 8px);left:0;right:0;z-index:3;background:#fff;">
            <div class="welcome-carousel-track">${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}${bottomSet}</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Show video only after it starts playing (hides Android's default play button)
    var welcomeVid = document.getElementById('welcomeVideo');
    if (welcomeVid) {
        welcomeVid.addEventListener('playing', function() { welcomeVid.style.opacity = '1'; }, { once: true });
        // Fallback: show after 1s even if playing event doesn't fire
        setTimeout(function() { if (welcomeVid) welcomeVid.style.opacity = '1'; }, 1000);
    }

    // Dismiss on button tap — show language selector, then categories
    document.getElementById('welcomeEnterBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        overlay.classList.add('fade-out');
        overlay.addEventListener('transitionend', () => {
            const vid = overlay.querySelector('video'); if (vid) { vid.pause(); vid.src = ''; }
            overlay.remove();
            _showUserTypeSelector();
        });
        setTimeout(() => {
            const el = document.getElementById('welcomeScreen');
            if (el) {
                const v = el.querySelector('video'); if (v) { v.pause(); v.src = ''; }
                el.remove();
                _showUserTypeSelector();
            }
        }, 1000);
    });
}

function _showUserTypeSelector() {
    // Only show once — if user type already set, skip to language selector
    if (localStorage.getItem('pi-user-type')) {
        _showLanguageSelector();
        return;
    }
    const modal = document.createElement('div');
    modal.id = 'userTypeSelectorModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
            <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1F2937;">Tell us about you</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6B7280;">This helps us set up the app for your needs</p>
            <button class="user-type-btn" data-type="deaf" style="display:block;width:100%;padding:16px;margin-bottom:10px;border:2px solid #2563EB;border-radius:12px;background:#EFF6FF;cursor:pointer;text-align:left;">
                <span style="font-size:18px;font-weight:700;color:#2563EB;">I am Deaf</span><br>
                <span style="font-size:14px;color:#374151;">Standard app experience</span>
            </button>
            <button class="user-type-btn" data-type="deafblind" style="display:block;width:100%;padding:18px;margin-bottom:10px;border:3px solid #DC2626;border-radius:12px;background:#1a1a1a;cursor:pointer;text-align:left;position:relative;">
                <span style="font-size:20px;font-weight:800;color:#FECACA;">I am Deafblind</span><br>
                <span style="font-size:15px;font-weight:600;color:#E0E0E0;">High contrast, large text, tactile BSL support</span>
                <span style="position:absolute;top:12px;right:14px;font-size:22px;">🦯</span>
            </button>

        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.user-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            localStorage.setItem('pi-user-type', type);
            nativeHaptic(type === 'deafblind' ? 'medium' : 'light');
            if (type === 'deafblind') {
                _applyDeafblindMode(true);
            }
            modal.remove();
            _showLanguageSelector();
        });
    });
}

function _showLanguageSelector() {
    // Only show once
    if (localStorage.getItem('pi-lang-chosen')) return;
    const modal = document.createElement('div');
    modal.id = 'langSelectorModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
            <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1F2937;">Please choose your language</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6B7280;">This sets your preferred sign language for videos</p>
            <button id="langChooseBSL" style="display:block;width:100%;padding:16px;margin-bottom:10px;border:2px solid #2563EB;border-radius:12px;background:#EFF6FF;cursor:pointer;text-align:left;">
                <span style="font-size:18px;font-weight:700;color:#2563EB;">BSL</span><br>
                <span style="font-size:14px;color:#374151;">British Sign Language</span>
            </button>
            <button id="langChooseISL" style="display:block;width:100%;padding:16px;border:2px solid #10B981;border-radius:12px;background:#ECFDF5;cursor:pointer;text-align:left;">
                <span style="font-size:18px;font-weight:700;color:#059669;">ISL</span><br>
                <span style="font-size:14px;color:#374151;">Irish Sign Language</span>
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('langChooseBSL').addEventListener('click', () => {
        if (typeof setVideoLanguage === 'function') setVideoLanguage('bsl');
        localStorage.setItem('pi-lang-chosen', '1');
        modal.remove();
        _showIntroModal('bsl');
    });
    document.getElementById('langChooseISL').addEventListener('click', () => {
        if (typeof setVideoLanguage === 'function') setVideoLanguage('isl');
        localStorage.setItem('pi-lang-chosen', '1');
        modal.remove();
        _showIntroModal('isl');
    });
}

function _showIntroModal(lang) {
    if (localStorage.getItem('pi-intro-dismissed') === '1') return;
    const langLabel = (lang || 'bsl').toUpperCase();
    const modal = document.createElement('div');
    modal.id = 'introModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
            <div style="font-size:40px;margin-bottom:12px;">👋</div>
            <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1F2937;">New to this app?</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.5;">Watch a short ${langLabel} video to learn how to find and book interpreted events</p>
            <button id="introWatchBtn" style="display:block;width:100%;padding:14px;margin-bottom:10px;border:none;border-radius:12px;background:#2563EB;color:#fff;font-size:16px;font-weight:700;cursor:pointer;">▶ Watch Intro Video</button>
            <button id="introSkipBtn" style="display:block;width:100%;padding:12px;border:none;border-radius:12px;background:#F3F4F6;color:#6B7280;font-size:14px;font-weight:500;cursor:pointer;">Skip, I'll explore</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('introWatchBtn').addEventListener('click', () => {
        localStorage.setItem('pi-intro-dismissed', '1');
        modal.remove();
        if (typeof playBSLVideo === 'function') playBSLVideo('orientation');
    });
    document.getElementById('introSkipBtn').addEventListener('click', () => {
        localStorage.setItem('pi-intro-dismissed', '1');
        modal.remove();
    });
}

// ========================================
// NATIVE SHELL — Tab-based layout for Capacitor
// ========================================
const NativeShell = {
    activeTab: 'events',
    activeSegment: 'browse',
    tabHistory: { events: [], bsl: [], atEvent: [], more: [] },
    scrollPositions: { events: 0, bsl: 0, atEvent: 0, more: 0 },

    init() {
        this.createShell();
        this.reparentContent();
        // Activate initial tab (bypass the early-return check)
        this.activeTab = null;
        this.switchTab('events');

        // Scroll indicator — only visible on event listings (not categories)
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'native-scroll-indicator hidden';
        const chevronSvg = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="rgba(37,99,235,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        scrollIndicator.innerHTML = chevronSvg + chevronSvg;
        document.body.appendChild(scrollIndicator);
        window._nativeScrollIndicator = scrollIndicator;

        // Scroll to top button
        const scrollTopBtn = document.createElement('button');
        scrollTopBtn.className = 'native-scroll-top';
        scrollTopBtn.innerHTML = '↑';
        scrollTopBtn.setAttribute('aria-label', 'Scroll to top');
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.querySelectorAll('.native-panel').forEach(p => p.scrollTo({ top: 0, behavior: 'smooth' }));
        });
        document.body.appendChild(scrollTopBtn);

        // Show/hide scroll-to-top based on scroll position (use capture on window)
        const updateScrollUI = () => {
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            // Only show chevrons on scrollable content pages (event listings, know your rights, festival, contact, privacy)
            const onEventsList = self.activeTab === 'events' && DOM && DOM.filtersSection && DOM.filtersSection.style.display !== 'none';
            // Only on event listings — not on More subviews
            const onScrollablePage = onEventsList;
            if (scrollY > 200) {
                scrollIndicator.classList.add('hidden');
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
                scrollIndicator.classList.toggle('hidden', !onScrollablePage);
            }
        };
        window.addEventListener('scroll', updateScrollUI, { passive: true });

        // Edge swipe back (swipe right from left edge)
        let touchStartX = 0;
        let touchStartY = 0;
        const self = this;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
            if (touchStartX < 40 && dx > 60 && dy < 120) {
                // Close any open bg modal first (How to Book, FAQ, Venues, Tips)
                const openBgModal = document.querySelector('.bg-modal-overlay[style*="flex"], .bg-modal-overlay.active');
                if (openBgModal) {
                    const modalId = openBgModal.id;
                    if (typeof closeBgModal === 'function' && modalId) {
                        closeBgModal(modalId);
                        return;
                    }
                }
                // Close any open festival modal (Know Your Rights, Festival Checklist)
                const openFestival = document.querySelector('.festival-modal-overlay.active');
                if (openFestival) {
                    const closeBtn = openFestival.querySelector('.festival-modal-close');
                    if (closeBtn) { closeBtn.click(); return; }
                }
                // Close feedback modal if open
                const feedbackEl = document.getElementById('feedbackModal');
                if (feedbackEl && feedbackEl.classList.contains('active')) {
                    if (typeof closeFeedbackModal === 'function') closeFeedbackModal();
                    return;
                }
                // On events tab viewing event list — back to categories
                if (self.activeTab === 'events' && typeof backToCategories === 'function') {
                    const catView = document.getElementById('categorySelectionView');
                    if (catView && catView.style.display === 'none') {
                        backToCategories();
                        return;
                    }
                }
                // On any tab with history — go back
                if (self.tabHistory[self.activeTab] && self.tabHistory[self.activeTab].length > 0) {
                    self.handleBack();
                }
            }
        }, { passive: true });

        // Override openCommSupportModal to switch to At Event tab
        window.openCommSupportModal = () => {
            this.switchTab('atEvent');
        };

        // Wrap Router.handleRouteChange to map routes to tabs
        const originalHandleRoute = Router.handleRouteChange.bind(Router);
        Router.handleRouteChange = () => {
            const hash = window.location.hash.slice(1) || '/';
            const route = hash.split('?')[0];

            if (route === '/flow1' || route.startsWith('/flow1/')) {
                this.switchTab('events');
                this.setSegment('browse');
                return; // NativeShell handles visibility
            } else if (route === '/flow2') {
                this.switchTab('events');
                this.setSegment('search');
                return;
            } else if (route === '/flow3') {
                this.switchTab('events');
                this.setSegment('request');
                // Still call original for flow3 to handle prefill logic
                originalHandleRoute();
                return;
            } else if (route === '/how-to-book') {
                this.switchTab('more');
                this.handleMoreAction('howToBook');
                return;
            } else if (route.startsWith('/event/')) {
                this.switchTab('events');
                this.setSegment('browse');
                // Let original router show the detail section
                originalHandleRoute();
                this.tabHistory.events.push({ type: 'eventDetail' });
                this.updateTopBar('Event', true);
                return;
            }

            // For unmatched routes, call original handler
            originalHandleRoute();
        };

        // Override Android hardware back button
        const { App: CapApp } = (window.Capacitor && window.Capacitor.Plugins) || {};
        if (CapApp) {
            CapApp.removeAllListeners('backButton');
            CapApp.addListener('backButton', () => {
                if (!this.handleBack()) {
                    CapApp.exitApp();
                }
            });
        }
    },

    createShell() {
        // --- Top Bar ---
        const topBar = document.createElement('div');
        topBar.className = 'native-top-bar';
        topBar.innerHTML = `
            <button class="native-top-bar-back" id="nativeBackBtn" aria-label="Back">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span class="native-top-bar-title" id="nativeTopTitle">Events</span>
            <button id="nativeLogoBtn" class="native-top-bar-logo-btn" aria-label="Notifications">
                <img src="pi-icon-white.png" alt="" class="native-top-bar-logo">
                <span id="nativeLogoDot" class="native-logo-dot" style="display:none;"></span>
            </button>
        `;
        document.body.prepend(topBar);

        // Logo tap — open notifications drawer
        document.getElementById('nativeLogoBtn').addEventListener('click', () => {
            nativeHaptic('light');
            toggleNotificationsDrawer();
        });

        // Show red dot if unread notifications or not subscribed
        updateNotifDot();

        // Build notifications drawer
        const drawer = document.createElement('div');
        drawer.id = 'notificationsDrawer';
        drawer.className = 'notif-drawer';
        drawer.innerHTML = `
            <div class="notif-drawer-overlay" onclick="closeNotificationsDrawer()"></div>
            <div class="notif-drawer-panel">
                <div class="notif-drawer-header">
                    <div style="display:flex;align-items:center;gap:0;flex:1;">
                        <button id="drawerTabNotifs" onclick="switchDrawerTab('notifications')" style="flex:1;padding:8px 0;font-size:14px;font-weight:700;color:#2563EB;border:none;background:none;border-bottom:2px solid #2563EB;cursor:pointer;">🔔 Notifications</button>
                        <button id="drawerTabMyEvents" onclick="switchDrawerTab('myevents')" style="flex:1;padding:8px 0;font-size:14px;font-weight:600;color:#9CA3AF;border:none;background:none;border-bottom:2px solid transparent;cursor:pointer;">❤️ My Events</button>
                    </div>
                    <button onclick="closeNotificationsDrawer()" style="background:none;border:none;font-size:22px;color:#9CA3AF;cursor:pointer;padding:4px;flex-shrink:0;">✕</button>
                </div>
                <div id="notifDrawerContent" class="notif-drawer-content"></div>
                <div id="myEventsDrawerContent" class="notif-drawer-content" style="display:none;"></div>
            </div>
        `;
        document.body.appendChild(drawer);

        document.getElementById('nativeBackBtn').addEventListener('click', () => this.handleBack());

        // --- Tab Panels ---
        const main = document.querySelector('.main-content') || document.body;
        const panels = ['events', 'bsl', 'atEvent', 'more'];
        panels.forEach(id => {
            const panel = document.createElement('div');
            panel.className = 'native-tab-panel';
            panel.id = 'nativePanel_' + id;
            main.appendChild(panel);
        });

        // --- Segmented Control in Events panel ---
        const eventsPanel = document.getElementById('nativePanel_events');
        const segControl = document.createElement('div');
        segControl.className = 'native-segment-control';
        segControl.innerHTML = `
            <button class="native-segment-btn active" data-seg="browse">👀 Browse</button>
            <button class="native-segment-btn" data-seg="search">🔍 Search</button>
            <button class="native-segment-btn" data-seg="request">✉️ Request</button>
        `;
        eventsPanel.appendChild(segControl);
        segControl.querySelectorAll('.native-segment-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSegment(btn.dataset.seg));
        });

        // --- BSL Tab Content ---
        this.createBSLTab();

        // --- More Tab Content ---
        this.createMoreTab();

        // --- Bottom Tab Bar ---
        const tabBar = document.createElement('div');
        tabBar.className = 'native-tab-bar';
        tabBar.innerHTML = `
            <button class="native-tab active" data-tab="events">
                <span class="native-tab-icon"><svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z" opacity="0.2"/><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V80H208ZM48,64V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V64Zm56,60a12,12,0,1,1-12-12A12,12,0,0,1,104,124Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,144,124Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,184,124Zm-80,40a12,12,0,1,1-12-12A12,12,0,0,1,104,164Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,144,164Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,184,164Z"/></svg></span>
                <span class="native-tab-label">Events</span>
            </button>
            <button class="native-tab" data-tab="atEvent">
                <span class="native-tab-icon"><svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M224,64V192a8,8,0,0,1-8,8H80L26.74,237.37A8,8,0,0,1,16,232V64a8,8,0,0,1,8-8H216A8,8,0,0,1,224,64Z" opacity="0.2"/><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83.2,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a16,16,0,0,0-10.25,3.73l-.09.07L40,220V64H216ZM116,128a12,12,0,1,1,12,12A12,12,0,0,1,116,128Zm-44,0a12,12,0,1,1,12,12A12,12,0,0,1,72,128Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,128Z"/></svg></span>
                <span class="native-tab-label">Support</span>
            </button>
            <button class="native-tab" data-tab="bsl">
                <span class="native-tab-icon"><svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M232,128a104,104,0,1,1-104-104A104.12,104.12,0,0,1,232,128Z" opacity="0.2"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48.24-94.78-64-40A8,8,0,0,0,100,88v80a8,8,0,0,0,12.24,6.78l64-40a8,8,0,0,0,0-13.56ZM116,153.57V102.43L156.91,128Z"/></svg></span>
                <span class="native-tab-label">BSL & ISL</span>
            </button>
            <button class="native-tab" data-tab="more">
                <span class="native-tab-icon"><svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M128,96a32,32,0,1,0,32,32A32,32,0,0,0,128,96Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,128,144Zm80-48a32,32,0,1,0,32,32A32,32,0,0,0,208,96Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,208,144ZM48,96a32,32,0,1,0,32,32A32,32,0,0,0,48,96Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,48,144Z"/></svg></span>
                <span class="native-tab-label">More</span>
            </button>
        `;
        document.body.appendChild(tabBar);
        tabBar.querySelectorAll('.native-tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
    },

    reparentContent() {
        // Move flow sections into Events panel
        const eventsPanel = document.getElementById('nativePanel_events');
        ['flow1Section', 'flow2Section', 'flow3Section', 'eventDetailSection', 'bookingGuideSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) eventsPanel.appendChild(el);
        });

        // Move comm support content into At Event panel
        const atEventPanel = document.getElementById('nativePanel_atEvent');
        const commModal = document.getElementById('commSupportModal');
        if (commModal && atEventPanel) {
            const content = commModal.querySelector('.comm-support-content');
            if (content) {
                atEventPanel.classList.add('native-at-event-inline');
                atEventPanel.appendChild(content);
                // Check speech API support
                const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
                const supportedEl = document.getElementById('sttSupported');
                const unsupportedEl = document.getElementById('sttUnsupported');
                if (supportedEl) supportedEl.style.display = supported ? 'block' : 'none';
                if (unsupportedEl) unsupportedEl.style.display = supported ? 'none' : 'block';
                // Default to card tab and render cards
                if (typeof switchCommTab === 'function') switchCommTab('card');
                _renderStaffCards();
            }
        }
    },

    createBSLTab() {
        const panel = document.getElementById('nativePanel_bsl');
        const currentLang = getVideoLanguage();
        const hasChosenLang = localStorage.getItem('piVideoLanguage') !== null;

        // --- First-launch language prompt ---
        if (!hasChosenLang) {
            const prompt = document.createElement('div');
            prompt.className = 'bsl-lang-prompt';
            prompt.id = 'bslLangPrompt';
            prompt.innerHTML = `
                <p class="bsl-lang-prompt-title">Which sign language do you prefer?</p>
                <p class="bsl-lang-prompt-desc">Choose your preferred language for videos. You can change this any time.</p>
                <div class="bsl-lang-prompt-buttons">
                    <button class="bsl-lang-prompt-btn" data-lang="bsl">BSL</button>
                    <button class="bsl-lang-prompt-btn" data-lang="isl">ISL</button>
                </div>
            `;
            prompt.querySelectorAll('.bsl-lang-prompt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    nativeHaptic('light');
                    setVideoLanguage(btn.dataset.lang);
                });
            });
            panel.appendChild(prompt);
        }

        // --- Language toggle (segmented control) ---
        const toggle = document.createElement('div');
        toggle.className = 'bsl-lang-toggle';
        toggle.innerHTML = `
            <button class="bsl-lang-toggle-btn ${currentLang === 'bsl' ? 'active' : ''}" data-lang="bsl">BSL</button>
            <button class="bsl-lang-toggle-btn ${currentLang === 'isl' ? 'active' : ''}" data-lang="isl">ISL</button>
        `;
        toggle.querySelectorAll('.bsl-lang-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                nativeHaptic('light');
                setVideoLanguage(btn.dataset.lang);
            });
        });
        panel.appendChild(toggle);

        // --- Video cards ---
        const videos = [
            { key: 'orientation', icon: '📱', title: 'App Guide', desc: 'How to use this app' },
            { key: 'how-to-book', icon: '📖', title: 'How to Book', desc: 'Booking interpreters' },
            { key: 'request', icon: '✉️', title: 'Request Interpreter', desc: 'How to make a request' },
            { key: 'categories', icon: '🔍', title: 'Browse & Search', desc: 'Finding events by category' },
            { key: 'at-event', icon: '🎪', title: 'At the Event', desc: 'Using support tools on the day' },
            { key: 'booking', icon: '📋', title: 'Booking Guidance', desc: 'Tips for venues and organisers' },
            { key: 'know-rights', icon: '⚖️', title: 'Know Your Rights', desc: 'Your legal rights explained' },
            { key: 'notifications', icon: '🔔', title: 'Notifications', desc: 'Setting up event alerts' },
            { key: 'volunteer', icon: '🤝', title: 'Volunteering', desc: 'How to volunteer with PI' },
            { key: 'faqs', icon: '❓', title: 'FAQs', desc: 'Common questions answered' },
            { key: 'tips', icon: '💡', title: 'Quick Tips', desc: 'Useful tips for events' }
        ];
        const list = document.createElement('div');
        list.className = 'native-bsl-list';
        videos.forEach(v => {
            const card = document.createElement('div');
            card.className = 'native-bsl-card';
            card.innerHTML = `
                <span class="native-bsl-card-icon">${v.icon}</span>
                <div class="native-bsl-card-text">
                    <p class="native-bsl-card-title">${v.title}</p>
                    <p class="native-bsl-card-desc">${v.desc}</p>
                </div>
                <span class="native-bsl-card-play">▶</span>
            `;
            card.addEventListener('click', () => {
                nativeHaptic('light');
                if (typeof playBSLVideo === 'function') playBSLVideo(v.key);
            });
            list.appendChild(card);
        });
        panel.appendChild(list);
    },

    createMoreTab() {
        const panel = document.getElementById('nativePanel_more');

        // Grid of option cards
        const grid = document.createElement('div');
        grid.className = 'native-more-grid';
        grid.id = 'nativeMoreGrid';
        const items = [
            { key: 'howToBook', icon: '📖', label: 'How to Book' },
            { key: 'knowYourRights', icon: '⚖️', label: 'Know Your Rights' },
            { key: 'festivalChecklist', icon: '✅', label: 'Festival Checklist' },
            { key: 'festivalApps', icon: '📱', label: 'Festival Apps' },
            { key: 'feedback', icon: '💬', label: 'Feedback' },
            { key: 'settings', icon: '⚙️', label: 'Settings' },
            { key: 'about', icon: 'ℹ️', label: 'About PI' },
            { key: 'contact', icon: '📧', label: 'Contact' },
        ];
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'native-more-card';
            card.innerHTML = `
                <span class="native-more-card-icon">${item.icon}</span>
                <span class="native-more-card-label">${item.label}</span>
            `;
            card.addEventListener('click', () => {
                nativeHaptic('light');
                this.handleMoreAction(item.key);
            });
            grid.appendChild(card);
        });

        // Volunteer banner — full-width above the grid
        const volBanner = document.createElement('div');
        volBanner.id = 'nativeVolunteerBanner';
        volBanner.style.cssText = 'margin:12px 16px 16px;padding:0;border-radius:12px;cursor:pointer;overflow:hidden;position:relative;';
        volBanner.className = 'btn-shimmer';
        volBanner.innerHTML = `
            <img src="https://media.performanceinterpreting.co.uk/volunteers/volunteer-festival-stall.jpg" alt="" style="width:100%;height:180px;object-fit:cover;object-position:center 20%;display:block;" />
            <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 16px;background:linear-gradient(transparent,rgba(0,0,0,0.7));">
                <p style="margin:0;font-size:18px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.5);text-align:center;">Fancy volunteering with PI?</p>
            </div>
        `;
        volBanner.addEventListener('click', () => {
            nativeHaptic('light');
            this.handleMoreAction('volunteer');
        });
        panel.appendChild(volBanner);

        panel.appendChild(grid);

        // Legal links row — hidden when subview is active (tied to grid visibility)
        const legalRow = document.createElement('div');
        legalRow.id = 'nativeMoreLegalRow';
        // Divider line above legal buttons
        const divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:#E5E7EB;margin:16px 16px 0;';
        legalRow.appendChild(divider);

        const privacyBtn = document.createElement('button');
        privacyBtn.className = 'native-privacy-btn';
        privacyBtn.id = 'nativePrivacyBtn';
        privacyBtn.textContent = '🔒 Privacy Policy';
        privacyBtn.style.cssText = 'display:inline-block;width:calc(50% - 20px);margin:12px 0 0 16px;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;color:#6B7280;font-size:13px;font-weight:500;cursor:pointer;text-align:center;';
        privacyBtn.addEventListener('click', () => {
            nativeHaptic('light');
            this.handleMoreAction('privacy');
        });
        legalRow.appendChild(privacyBtn);

        const termsBtn = document.createElement('button');
        termsBtn.id = 'nativeTermsBtn';
        termsBtn.textContent = '📄 Terms of Use';
        termsBtn.style.cssText = 'display:inline-block;width:calc(50% - 20px);margin:12px 16px 0 4px;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;color:#6B7280;font-size:13px;font-weight:500;cursor:pointer;text-align:center;';
        termsBtn.addEventListener('click', () => {
            nativeHaptic('light');
            this.handleMoreAction('terms');
        });
        legalRow.appendChild(termsBtn);

        panel.appendChild(legalRow);

        // Sub-views for How to Book, About, Contact
        const subview = document.createElement('div');
        subview.className = 'native-more-subview';
        subview.id = 'nativeMoreSubview';
        panel.appendChild(subview);
    },

    handleMoreAction(key) {
        switch (key) {
            case 'howToBook': {
                // Clone the booking guide section into subview
                const bgSection = document.getElementById('bookingGuideSection');
                const subview = document.getElementById('nativeMoreSubview');
                const grid = document.getElementById('nativeMoreGrid');
                if (bgSection && subview && grid) {
                    subview.innerHTML = '';
                    const clone = bgSection.cloneNode(true);
                    clone.style.display = 'block';
                    clone.removeAttribute('id'); // avoid duplicate IDs
                    // Add bg-modal-body class so venue toggles can scope correctly
                    const modalBody = clone.querySelector('.bg-modal-body') || clone;
                    modalBody.classList.add('bg-modal-body');
                    subview.appendChild(clone);
                    if (typeof loadBgVenues === 'function') loadBgVenues();
                    // Re-bind FAQ accordion buttons (remove inline onclick to prevent double-fire)
                    subview.querySelectorAll('.bg-faq-button').forEach(b => {
                        b.removeAttribute('onclick');
                        b.style.cursor = 'pointer';
                        b.addEventListener('click', (e) => { if (typeof toggleBgFaq === 'function') toggleBgFaq(e, b); });
                    });
                    subview.querySelectorAll('.country-button').forEach(b => {
                        b.style.cursor = 'pointer';
                        b.addEventListener('click', (e) => { if (typeof toggleBgCountry === 'function') toggleBgCountry(e, b); });
                    });
                    subview.querySelectorAll('.region-button').forEach(b => {
                        b.style.cursor = 'pointer';
                        b.addEventListener('click', (e) => { if (typeof toggleBgRegion === 'function') toggleBgRegion(e, b); });
                    });
                    subview.querySelectorAll('.venue-button').forEach(b => {
                        b.style.cursor = 'pointer';
                        b.addEventListener('click', (e) => { if (typeof toggleBgVenue === 'function') toggleBgVenue(e, b); });
                    });
                    if (typeof updateVideoLangLabels === 'function') updateVideoLangLabels();
                    grid.style.display = 'none';
                    const lr = document.getElementById('nativeMoreLegalRow');
                    if (lr) lr.style.display = 'none';
                    const vb = document.getElementById('nativeVolunteerBanner');
                    if (vb) vb.style.display = 'none';
                    subview.classList.add('active');
                    this.updateTopBar('How to Book', true);
                    this.tabHistory.more.push({ type: 'subview', key: 'howToBook', title: 'How to Book' });
                    window.scrollTo(0, 0);
                }
                break;
            }
            case 'knowYourRights':
                if (typeof openKnowYourRightsModal === 'function') openKnowYourRightsModal();
                break;
            case 'festivalChecklist':
                if (typeof openFestivalChecklistModal === 'function') openFestivalChecklistModal();
                break;
            case 'festivalApps':
                this.showFestivalAppsView();
                break;
            case 'feedback':
                this.showFeedbackView();
                break;
            case 'settings':
                this.showSettingsView();
                break;
            case 'about':
                this.showMoreSubView('about', 'About PI');
                break;
            case 'contact':
                this.showMoreSubView('contact', 'Contact');
                break;
            case 'privacy':
                this.showMoreSubView('privacy', 'Privacy Policy');
                break;
            case 'terms':
                this.showMoreSubView('terms', 'Terms of Use');
                break;
            case 'notifications':
                if (typeof openNotificationPreferences === 'function') openNotificationPreferences();
                break;
            case 'volunteer':
                this.showVolunteerView();
                break;
        }
    },

    showVolunteerView() {
        const subview = document.getElementById('nativeMoreSubview');
        const grid = document.getElementById('nativeMoreGrid');
        const volBanner = document.getElementById('nativeVolunteerBanner');
        if (!subview || !grid) return;

        subview.innerHTML = `
            <div style="background:#fff;padding-top:16px;">
                <img src="https://media.performanceinterpreting.co.uk/volunteers/volunteer-booth.jpg" alt="PI volunteer at festival booth" style="width:calc(100% - 32px);height:auto;display:block;border-radius:12px;margin:0 auto;" />

                <div style="padding:20px 16px;">
                    <div class="bsl-video-link-center" style="margin-bottom:16px;">
                        <button class="bsl-video-link" onclick="playBSLVideo('volunteer')">
                            <span class="bsl-video-link-icon">▶</span> <span class="video-lang-label">BSL</span>
                        </button>
                    </div>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:0.5px;">Get Involved</p>
                    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1F2937;">Volunteer with PI</h2>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4B5563;">Volunteering with PI is a way to be part of something bigger. Help welcome Deaf attendees, support interpreter teams on site, and be at the heart of live access.</p>

                    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:18px;">🎟️</span>
                            <span style="font-size:14px;color:#374151;font-weight:500;">Free entry to events and festivals</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:18px;">🤝</span>
                            <span style="font-size:14px;color:#374151;font-weight:500;">Meet the community and make connections</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:18px;">⭐</span>
                            <span style="font-size:14px;color:#374151;font-weight:500;">Experience live-access environments first-hand</span>
                        </div>
                    </div>

                    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
                        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1E40AF;">Who can volunteer?</p>
                        <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.6;color:#374151;">
                            <li>Deaf and fluent in BSL</li>
                            <li>Hearing with BSL Level 6 or higher</li>
                        </ul>
                    </div>

                    <div style="position:relative;width:100%;padding-bottom:56.25%;border-radius:12px;overflow:hidden;margin-bottom:20px;background:#000;">
                        <iframe src="https://www.youtube.com/embed/UxoWvztsIM8?start=19&end=210&rel=0&modestbranding=1&playsinline=1&origin=capacitor%3A%2F%2Flocalhost" title="PI Volunteering — Chris &amp; Emmila" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"></iframe>
                    </div>

                    <p style="margin:0 0 20px;font-size:14px;font-style:italic;color:#6B7280;line-height:1.5;text-align:center;padding:0 8px;">"I came to help, and left inspired."</p>

                    <a href="https://tally.so/r/wvQ0Kl" target="_blank" rel="noopener" style="display:block;width:100%;padding:14px;background:linear-gradient(135deg,#1E40AF 0%,#7C3AED 100%);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;text-align:center;text-decoration:none;cursor:pointer;">Register Your Interest →</a>

                    <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">We'll be in touch about upcoming opportunities.</p>
                </div>
            </div>
        `;

        grid.style.display = 'none';
        if (volBanner) volBanner.style.display = 'none';
        const lr = document.getElementById('nativeMoreLegalRow');
        if (lr) lr.style.display = 'none';
        subview.classList.add('active');
        this.updateTopBar('Volunteer', true);
        this.tabHistory.more.push({ type: 'subview', key: 'volunteer', title: 'Volunteer' });
        window.scrollTo(0, 0);
    },

    showMoreSubView(key, title) {
        const grid = document.getElementById('nativeMoreGrid');
        const subview = document.getElementById('nativeMoreSubview');
        const legalRow = document.getElementById('nativeMoreLegalRow');
        if (!grid || !subview) return;

        subview.innerHTML = '';

        if (key === 'howToBook') {
            // Move booking guide section into subview
            const bgSection = document.getElementById('bookingGuideSection');
            if (bgSection) {
                bgSection.style.display = 'block';
                subview.appendChild(bgSection);
                if (typeof loadBgVenues === 'function') loadBgVenues();
            }
        } else if (key === 'about') {
            const aboutEl = document.querySelector('.about-section');
            if (aboutEl) subview.appendChild(aboutEl);
        } else if (key === 'contact') {
            const contactEl = document.querySelector('.contact-section');
            if (contactEl) subview.appendChild(contactEl);
        } else if (key === 'privacy') {
            // Load privacy policy content directly (iframe blocked by CSP in native)
            fetch('privacy-policy.html')
                .then(r => r.text())
                .then(html => {
                    const container = document.createElement('div');
                    container.className = 'privacy-policy-content';
                    // Extract just the body content
                    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    container.innerHTML = match ? match[1] : html;
                    subview.appendChild(container);
                })
                .catch(() => {
                    subview.innerHTML = '<p style="padding:20px">Unable to load privacy policy.</p>';
                });
        } else if (key === 'terms') {
            fetch('terms-of-use.html')
                .then(r => r.text())
                .then(html => {
                    const container = document.createElement('div');
                    container.className = 'privacy-policy-content';
                    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    container.innerHTML = match ? match[1] : html;
                    subview.appendChild(container);
                })
                .catch(() => {
                    subview.innerHTML = '<p style="padding:20px">Unable to load terms of use.</p>';
                });
        }

        grid.style.display = 'none';
        if (legalRow) legalRow.style.display = 'none';
        const vbInline = document.getElementById('nativeVolunteerBanner');
        if (vbInline) vbInline.style.display = 'none';
        subview.classList.add('active');
        this.updateTopBar(title, true);
        this.tabHistory.more.push({ type: 'subview', key, title });
        window.scrollTo(0, 0);
    },

    closeMoreSubView() {
        const grid = document.getElementById('nativeMoreGrid');
        const subview = document.getElementById('nativeMoreSubview');
        if (!grid || !subview) return;

        // Return reparented elements to their original location
        const bgSection = subview.querySelector('#bookingGuideSection');
        if (bgSection) {
            bgSection.style.display = 'none';
            document.getElementById('nativePanel_events').appendChild(bgSection);
        }
        const aboutEl = subview.querySelector('.about-section');
        if (aboutEl) document.querySelector('.main-content').appendChild(aboutEl);
        const contactEl = subview.querySelector('.contact-section');
        if (contactEl) document.querySelector('.main-content').appendChild(contactEl);

        subview.classList.remove('active');
        subview.innerHTML = '';
        grid.style.display = '';
        const legalRow = document.getElementById('nativeMoreLegalRow');
        if (legalRow) legalRow.style.display = '';
        const volBanner = document.getElementById('nativeVolunteerBanner');
        if (volBanner) volBanner.style.display = '';
        window._feedbackBslDone = false; // Reset so BSL prompt shows next feedback visit
        if (typeof setNotificationRoot === 'function') setNotificationRoot(null); // Reset to document
        this.updateTopBar('More', false);
    },

    showFestivalAppsView() {
        const grid = document.getElementById('nativeMoreGrid');
        const subview = document.getElementById('nativeMoreSubview');
        if (!grid || !subview) return;

        subview.innerHTML = '';
        const container = document.createElement('div');
        container.style.cssText = 'padding:20px 16px 40px;';

        const isIOS = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';

        // Deduplicate festivals (remove alias keys)
        const seen = new Set();
        const festivals = [];
        for (const [key, data] of Object.entries(FESTIVAL_APPS)) {
            if (seen.has(data.name)) continue;
            seen.add(data.name);
            festivals.push(data);
        }

        container.innerHTML = `
            <p style="font-size:14px;color:#6B7280;margin:0 0 16px;text-align:center;">Download the official festival app for access to maps, line-ups and more info</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${festivals.map(f => {
                    const hasApp = f.ios || f.android;
                    const link = isIOS ? (f.ios || f.web) : (f.android || f.web);
                    return `
                    <button onclick="openExternalLink('${link}')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;cursor:pointer;text-align:left;">
                        <div>
                            <div style="font-size:16px;font-weight:600;color:#1F2937;">${f.name}</div>
                            ${f.note ? '<div style="font-size:12px;color:#F59E0B;font-weight:500;margin-top:2px;">' + f.note + '</div>' : ''}
                        </div>
                        <span style="font-size:13px;font-weight:600;color:${hasApp ? '#2563EB' : '#6B7280'};white-space:nowrap;">${hasApp ? '📱 Get App' : '🌐 Website'}</span>
                    </button>`;
                }).join('')}
            </div>
        `;

        subview.appendChild(container);
        grid.style.display = 'none';
        const legalRow1 = document.getElementById('nativeMoreLegalRow');
        if (legalRow1) legalRow1.style.display = 'none';
        const vb1 = document.getElementById('nativeVolunteerBanner');
        if (vb1) vb1.style.display = 'none';
        subview.classList.add('active');
        this.updateTopBar('Festival Apps', true);
        this.tabHistory.more.push({ type: 'subview', key: 'festivalApps', title: 'Festival Apps' });
        window.scrollTo(0, 0);
    },

    showSettingsView() {
        const grid = document.getElementById('nativeMoreGrid');
        const subview = document.getElementById('nativeMoreSubview');
        if (!grid || !subview) return;

        subview.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'settings-page';
        container.style.cssText = 'padding:20px 16px 40px;';

        // --- Calendar Preference ---
        const calPref = localStorage.getItem('pi-calendar-preference');
        const isIOS = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';

        const calOptions = [];
        if (isIOS) calOptions.push({ value: 'apple', label: 'Apple Calendar', icon: '📅' });
        calOptions.push({ value: 'google', label: 'Google Calendar', icon: '📆' });
        calOptions.push({ value: 'outlook', label: 'Outlook Calendar', icon: '📧' });

        container.innerHTML = `
            <section style="margin-bottom:28px;">
                <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">About You</h3>
                <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Changes how the app looks and what's included in emails.</p>
                <div id="settingsUserType" style="display:flex;gap:8px;">
                    <button data-utype="deaf" class="settings-utype-btn" style="flex:1;padding:12px;border-radius:10px;border:2px solid #E5E7EB;background:#fff;font-size:14px;font-weight:600;text-align:center;color:#374151;cursor:pointer;">Deaf</button>
                    <button data-utype="deafblind" class="settings-utype-btn" style="flex:1;padding:12px;border-radius:10px;border:2px solid #E5E7EB;background:#fff;font-size:14px;font-weight:600;text-align:center;color:#374151;cursor:pointer;">🦯 Deafblind</button>

                </div>
                <div id="settingsDeafblindBanner" style="display:none;margin-top:12px;padding:12px 14px;border-radius:10px;background:#1a1a1a;border:2px solid #333;">
                    <p style="font-size:13px;font-weight:600;color:#DC2626;margin:0 0 6px;">Deafblind mode is active</p>
                    <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">High contrast and large text have been turned on. Emails will mention tactile BSL. Staff cards show deafblind support. You can still adjust individual settings below.</p>
                </div>
            </section>

            <section style="margin-bottom:28px;">
                <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">Calendar</h3>
                <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Choose which calendar app opens when you save an event.</p>
                <div id="settingsCalOptions" style="display:flex;flex-direction:column;gap:8px;">
                    ${calOptions.map(opt => `
                        <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid ${calPref === opt.value ? '#2563EB' : '#E5E7EB'};border-radius:10px;background:${calPref === opt.value ? '#EFF6FF' : '#fff'};cursor:pointer;transition:all 0.15s;">
                            <input type="radio" name="calPref" value="${opt.value}" ${calPref === opt.value ? 'checked' : ''} style="width:18px;height:18px;accent-color:#2563EB;">
                            <span style="font-size:20px;">${opt.icon}</span>
                            <span style="font-size:15px;font-weight:500;color:#1F2937;">${opt.label}</span>
                        </label>
                    `).join('')}
                    <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid ${!calPref ? '#2563EB' : '#E5E7EB'};border-radius:10px;background:${!calPref ? '#EFF6FF' : '#fff'};cursor:pointer;transition:all 0.15s;">
                        <input type="radio" name="calPref" value="" ${!calPref ? 'checked' : ''} style="width:18px;height:18px;accent-color:#2563EB;">
                        <span style="font-size:20px;">❓</span>
                        <span style="font-size:15px;font-weight:500;color:#1F2937;">Always ask</span>
                    </label>
                </div>
            </section>

            <section style="margin-bottom:28px;">
                <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">Accessibility</h3>
                <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Adjust the app to suit your needs.</p>

                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;">
                        <div>
                            <div style="font-size:15px;font-weight:500;color:#1F2937;">Text Size</div>
                            <div style="font-size:12px;color:#6B7280;">Make text larger or smaller</div>
                        </div>
                        <div id="settingsTextSize" style="display:flex;gap:4px;">
                            <button data-size="small" class="settings-size-btn" style="width:34px;height:34px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer;">A</button>
                            <button data-size="medium" class="settings-size-btn" style="width:34px;height:34px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:15px;font-weight:600;cursor:pointer;">A</button>
                            <button data-size="large" class="settings-size-btn" style="width:34px;height:34px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:19px;font-weight:600;cursor:pointer;">A</button>
                        </div>
                    </div>

                    <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;">
                        <div>
                            <div style="font-size:15px;font-weight:500;color:#1F2937;">Reduce Motion</div>
                            <div style="font-size:12px;color:#6B7280;">Limit animations and transitions</div>
                        </div>
                        <input type="checkbox" id="settingsReduceMotion" ${localStorage.getItem('pi-reduce-motion') === 'true' ? 'checked' : ''} style="width:20px;height:20px;accent-color:#2563EB;">
                    </label>

                    <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;">
                        <div>
                            <div style="font-size:15px;font-weight:500;color:#1F2937;">High Contrast</div>
                            <div style="font-size:12px;color:#6B7280;">Increase contrast for better readability</div>
                        </div>
                        <input type="checkbox" id="settingsHighContrast" ${localStorage.getItem('pi-high-contrast') === 'true' ? 'checked' : ''} style="width:20px;height:20px;accent-color:#2563EB;">
                    </label>

                    ${IS_NATIVE_APP ? `
                    <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;">
                        <div>
                            <div style="font-size:15px;font-weight:500;color:#1F2937;">Haptic Feedback</div>
                            <div style="font-size:12px;color:#6B7280;">Vibration when tapping buttons</div>
                        </div>
                        <input type="checkbox" id="settingsHaptics" ${localStorage.getItem('pi-haptics-enabled') !== 'false' ? 'checked' : ''} style="width:20px;height:20px;accent-color:#2563EB;">
                    </label>` : ''}
                </div>
            </section>

            <section style="margin-bottom:28px;">
                <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">Sign Language</h3>
                <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Choose your preferred sign language for videos.</p>
                <div id="settingsSignLang" style="display:flex;gap:8px;">
                    <button data-lang="bsl" class="settings-lang-btn" style="flex:1;padding:12px;border-radius:10px;border:1px solid #E5E7EB;background:#fff;font-size:15px;font-weight:600;cursor:pointer;">BSL</button>
                    <button data-lang="isl" class="settings-lang-btn" style="flex:1;padding:12px;border-radius:10px;border:1px solid #E5E7EB;background:#fff;font-size:15px;font-weight:600;cursor:pointer;">ISL</button>
                </div>
            </section>

            <section style="margin-bottom:28px;">
                <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">Notifications</h3>
                <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Choose which events you get notified about.</p>
                <button onclick="NativeShell.handleMoreAction('notifications')" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:20px;">🔔</span>
                        <span style="font-size:15px;font-weight:500;color:#1F2937;">${localStorage.getItem('pi-notification-subscribed') === 'true' ? 'Edit Preferences' : 'Set Up Notifications'}</span>
                    </div>
                    <span style="font-size:16px;color:#9CA3AF;">›</span>
                </button>
            </section>

            <p style="text-align:center;font-size:12px;color:#9CA3AF;margin-top:32px;">PI Events v${document.querySelector('meta[name="version"]')?.content || '1.0'}</p>
        `;

        subview.appendChild(container);

        // --- Wire up calendar preference ---
        container.querySelectorAll('input[name="calPref"]').forEach(radio => {
            radio.addEventListener('change', () => {
                nativeHaptic('light');
                const val = radio.value;
                if (val) {
                    localStorage.setItem('pi-calendar-preference', val);
                } else {
                    localStorage.removeItem('pi-calendar-preference');
                }
                // Update visual states
                container.querySelectorAll('#settingsCalOptions label').forEach(lbl => {
                    const inp = lbl.querySelector('input');
                    lbl.style.borderColor = inp.checked ? '#2563EB' : '#E5E7EB';
                    lbl.style.background = inp.checked ? '#EFF6FF' : '#fff';
                });
                if (typeof showToast === 'function') showToast(val ? 'Calendar set to ' + radio.closest('label').querySelector('span:nth-child(3)').textContent : 'Calendar will ask each time');
            });
        });

        // --- Wire up text size ---
        // In Deafblind mode the text-size buttons need a dark background to
        // match the DB theme. The default inline styles are white which looks
        // wrong in DB. This mirrors the pattern used by the language buttons
        // below — check DB state each time we paint button styles.
        const _paintSizeBtn = (b, isActive) => {
            const inDB = document.body.classList.contains('deafblind');
            if (inDB) {
                b.style.setProperty('background', '#1a1a1a', 'important');
                b.style.setProperty('color', '#fff', 'important');
                b.style.setProperty('border', isActive ? '3px solid #DC2626' : '1px solid #4B5563', 'important');
            } else {
                b.style.background = isActive ? '#EFF6FF' : '#fff';
                b.style.color = '';
                b.style.borderColor = isActive ? '#2563EB' : '#E5E7EB';
                b.style.borderWidth = '';
                b.style.borderStyle = '';
            }
        };
        const currentSize = localStorage.getItem('pi-text-size') || 'medium';
        container.querySelectorAll('.settings-size-btn').forEach(btn => {
            _paintSizeBtn(btn, btn.dataset.size === currentSize);
            btn.addEventListener('click', () => {
                nativeHaptic('light');
                const size = btn.dataset.size;
                localStorage.setItem('pi-text-size', size);
                _applyTextSize(size);
                container.querySelectorAll('.settings-size-btn').forEach(b => {
                    _paintSizeBtn(b, b.dataset.size === size);
                });
            });
        });

        // --- Wire up reduce motion ---
        document.getElementById('settingsReduceMotion').addEventListener('change', function() {
            nativeHaptic('light');
            localStorage.setItem('pi-reduce-motion', this.checked);
            _applyReduceMotion(this.checked);
        });

        // --- Wire up high contrast ---
        document.getElementById('settingsHighContrast').addEventListener('change', function() {
            nativeHaptic('light');
            localStorage.setItem('pi-high-contrast', this.checked);
            _applyHighContrast(this.checked);

            // Update settings page itself
            const sp = document.querySelector('.settings-page');
            if (sp) {
                sp.querySelectorAll('section h3').forEach(h => h.style.color = this.checked ? '#000' : '#374151');
                sp.querySelectorAll('section p').forEach(p => { if (!p.closest('label')) p.style.color = this.checked ? '#000' : '#6B7280'; });
                sp.querySelectorAll('label, div[style*="border"]').forEach(el => {
                    if (el.style.borderColor) el.style.borderColor = this.checked ? '#333' : '#E5E7EB';
                    if (el.style.background === '#fff' || el.style.background === 'rgb(255, 255, 255)') el.style.background = this.checked ? '#f5f5f5' : '#fff';
                });
                sp.querySelectorAll('div[style*="font-size:15px"]').forEach(el => el.style.color = this.checked ? '#000' : '#1F2937');
                sp.querySelectorAll('div[style*="font-size:12px"]').forEach(el => el.style.color = this.checked ? '#000' : '#6B7280');
            }
        });

        // --- Wire up haptic feedback toggle (native only) ---
        const hapticsCheckbox = document.getElementById('settingsHaptics');
        if (hapticsCheckbox) {
            hapticsCheckbox.addEventListener('change', function() {
                localStorage.setItem('pi-haptics-enabled', this.checked ? 'true' : 'false');
                if (this.checked) nativeHaptic('light'); // test pulse on enable
                if (typeof showToast === 'function') showToast(this.checked ? 'Haptic feedback on' : 'Haptic feedback off');
            });
        }

        // --- Wire up sign language ---
        const currentLang = (typeof getVideoLanguage === 'function') ? getVideoLanguage() : (localStorage.getItem('piVideoLanguage') || 'bsl');
        container.querySelectorAll('.settings-lang-btn').forEach(btn => {
            if (btn.dataset.lang === currentLang) {
                btn.style.borderColor = '#2563EB';
                btn.style.background = '#EFF6FF';
                btn.style.color = '#2563EB';
            }
            btn.addEventListener('click', () => {
                nativeHaptic('light');
                const lang = btn.dataset.lang;
                if (typeof setVideoLanguage === 'function') setVideoLanguage(lang);
                container.querySelectorAll('.settings-lang-btn').forEach(b => {
                    const active = b.dataset.lang === lang;
                    b.style.borderColor = active ? '#2563EB' : '#E5E7EB';
                    b.style.background = active ? '#EFF6FF' : '#fff';
                    b.style.color = active ? '#2563EB' : '#1F2937';
                });
            });
        });

        // --- Wire up user type ---
        const currentType = _getUserType();
        container.querySelectorAll('.settings-utype-btn').forEach(btn => {
            const isActive = btn.dataset.utype === currentType;
            const isDB = btn.dataset.utype === 'deafblind';
            if (isActive) {
                btn.style.borderColor = isDB ? '#DC2626' : '#2563EB';
                btn.style.background = isDB ? '#1a1a1a' : '#EFF6FF';
                btn.style.color = isDB ? '#FECACA' : '#2563EB';
                if (isDB) btn.style.borderWidth = '3px';
            }
            btn.addEventListener('click', () => {
                nativeHaptic('light');
                const type = btn.dataset.utype;
                const wasDeafblind = _isDeafblind();
                localStorage.setItem('pi-user-type', type);

                if (type === 'deafblind') {
                    _applyDeafblindMode(true);
                } else if (wasDeafblind) {
                    // Switching away from deafblind — reset to defaults
                    _applyDeafblindMode(false);
                    _applyTextSize('medium');
                    localStorage.setItem('pi-text-size', 'medium');
                }

                // Re-render settings page to reflect new state
                NativeShell.showSettingsView();
                if (typeof showToast === 'function') showToast('Updated to ' + type.charAt(0).toUpperCase() + type.slice(1) + ' mode');
            });
        });

        // Show deafblind banner if active
        const dbBanner = document.getElementById('settingsDeafblindBanner');
        if (dbBanner && _isDeafblind()) {
            dbBanner.style.display = 'block';
        }

        grid.style.display = 'none';
        const legalRow2 = document.getElementById('nativeMoreLegalRow');
        if (legalRow2) legalRow2.style.display = 'none';
        const vb2 = document.getElementById('nativeVolunteerBanner');
        if (vb2) vb2.style.display = 'none';
        subview.classList.add('active');
        this.updateTopBar('Settings', true);
        this.tabHistory.more.push({ type: 'subview', key: 'settings', title: 'Settings' });
        window.scrollTo(0, 0);
    },

    showFeedbackView() {
        const grid = document.getElementById('nativeMoreGrid');
        const subview = document.getElementById('nativeMoreSubview');
        if (!grid || !subview) return;

        subview.innerHTML = '';
        const container = document.createElement('div');
        container.style.cssText = 'padding:20px 16px 40px;';

        container.innerHTML = `
            <div class="bsl-video-link-center" style="margin:0 0 8px;">
                <button class="bsl-video-link" onclick="playBSLVideo('faqs')">
                    <span class="bsl-video-link-icon">▶</span> <span class="video-lang-label">BSL</span>
                </button>
            </div>
            <p style="font-size:15px;color:#374151;text-align:center;margin:0 0 6px;font-weight:600;">How would you like to share?</p>
            <p style="font-size:13px;color:#6B7280;text-align:center;margin:0 0 20px;line-height:1.5;">Please include: which event you attended, what went well, and what could be better.</p>

            <div id="feedbackChoiceInline">
                <button onclick="showInlineVideoFeedback()" style="display:flex;align-items:center;gap:14px;width:100%;padding:18px 16px;border:2px solid #7C3AED;border-radius:14px;background:#F5F3FF;cursor:pointer;text-align:left;margin-bottom:12px;">
                    <span style="font-size:32px;">🎥</span>
                    <div>
                        <p style="margin:0;font-size:16px;font-weight:700;color:#7C3AED;">Record in Sign Language</p>
                        <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">BSL or ISL — max 2 minutes</p>
                    </div>
                </button>

                <button onclick="showInlineWrittenFeedback()" style="display:flex;align-items:center;gap:14px;width:100%;padding:18px 16px;border:2px solid #2563EB;border-radius:14px;background:#EFF6FF;cursor:pointer;text-align:left;">
                    <span style="font-size:32px;">📝</span>
                    <div>
                        <p style="margin:0;font-size:16px;font-weight:700;color:#2563EB;">Write Feedback</p>
                        <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">Fill out a short form with your thoughts</p>
                    </div>
                </button>
            </div>

            <div id="feedbackVideoInline" style="display:none;">
                <button onclick="document.getElementById('feedbackVideoInline').style.display='none';document.getElementById('feedbackChoiceInline').style.display='';" style="background:none;border:none;color:#2563EB;font-size:14px;font-weight:600;cursor:pointer;padding:0 0 12px;display:flex;align-items:center;gap:4px;">← Back</button>
                <div style="text-align:center;padding:16px 0;">
                    <p style="font-size:15px;font-weight:600;color:#374151;margin:0 0 4px;">Record your feedback</p>
                    <p style="font-size:13px;color:#6B7280;margin:0 0 16px;">BSL or ISL. Maximum 2 minutes.</p>
                    <input type="file" id="feedbackVideoInputInline" accept="video/*" capture="user" style="display:none;" onchange="handleVideoFeedbackInline(this)">
                    <button onclick="document.getElementById('feedbackVideoInputInline').click()" style="display:inline-flex;align-items:center;gap:8px;padding:16px 32px;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">🎥 Open Camera</button>
                    <div id="feedbackUploadProgressInline" style="display:none;margin-top:16px;">
                        <div style="background:#E5E7EB;border-radius:8px;height:8px;overflow:hidden;">
                            <div id="feedbackUploadBarInline" style="background:#7C3AED;height:100%;width:0%;transition:width 0.3s;border-radius:8px;"></div>
                        </div>
                        <p id="feedbackUploadStatusInline" style="font-size:13px;color:#6B7280;margin:8px 0 0;">Uploading...</p>
                    </div>
                    <div id="feedbackUploadSuccessInline" style="display:none;margin-top:16px;padding:16px;background:#D1FAE5;border-radius:12px;">
                        <p style="margin:0;font-size:16px;font-weight:700;color:#065F46;">✅ Video sent!</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#065F46;">Thank you for your feedback. The PI team will review it.</p>
                    </div>
                    <p style="font-size:11px;color:#9CA3AF;margin:16px 0 0;line-height:1.4;">By submitting a video, you consent to Performance Interpreting Ltd storing and reviewing your recording to improve our services. Videos are stored securely, only accessible by the PI team, and will not be shared publicly. To request deletion, contact us. See our <a href="terms-of-use.html" onclick="if(typeof NativeShell!=='undefined'){NativeShell.handleMoreAction('terms');return false;}" style="color:#6B7280;text-decoration:underline;">Terms of Use</a> and <a href="privacy-policy.html" onclick="if(typeof NativeShell!=='undefined'){NativeShell.handleMoreAction('privacy');return false;}" style="color:#6B7280;text-decoration:underline;">Privacy Policy</a>.</p>
                </div>
            </div>

            <div id="feedbackWrittenInline" style="display:none;">
                <button onclick="document.getElementById('feedbackWrittenInline').style.display='none';document.getElementById('feedbackChoiceInline').style.display='';" style="background:none;border:none;color:#2563EB;font-size:14px;font-weight:600;cursor:pointer;padding:0 0 12px;display:flex;align-items:center;gap:4px;">← Back</button>
                <iframe
                    src="https://tally.so/embed/Y5Dd20?hideTitle=1&transparentBackground=1&dynamicHeight=1"
                    loading="lazy"
                    width="100%"
                    height="100%"
                    frameborder="0"
                    marginheight="0"
                    marginwidth="0"
                    title="Share Your Thoughts"
                    style="border:none;min-height:calc(100vh - 120px);flex:1;"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                ></iframe>
            </div>
        `;

        subview.appendChild(container);
        grid.style.display = 'none';
        const legalRow = document.getElementById('nativeMoreLegalRow');
        if (legalRow) legalRow.style.display = 'none';
        const vb3 = document.getElementById('nativeVolunteerBanner');
        if (vb3) vb3.style.display = 'none';
        subview.classList.add('active');
        this.updateTopBar('Share Your Thoughts', true);
        this.tabHistory.more.push({ type: 'subview', key: 'feedback', title: 'Share Your Thoughts' });
        window.scrollTo(0, 0);
    },

    switchTab(name) {
        // If tapping the already-active tab, reset to its home state
        if (name === this.activeTab) {
            if (name === 'more') {
                // Close any open subview and go back to More grid
                this.closeMoreSubView();
                this.tabHistory.more = [];
            } else if (name === 'events') {
                // Go back to categories
                if (typeof backToCategories === 'function') backToCategories();
                this.tabHistory.events = [];
                this.setSegment('browse');
                this.updateTopBar('Events', false);
            }
            window.scrollTo(0, 0);
            return;
        }

        // Save scroll position of current tab
        this.scrollPositions[this.activeTab] = window.scrollY;

        this.activeTab = name;

        // Update tab panels
        document.querySelectorAll('.native-tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('nativePanel_' + name);
        if (panel) panel.classList.add('active');

        // Update tab bar buttons
        document.querySelectorAll('.native-tab').forEach(t => t.classList.remove('active'));
        const activeBtn = document.querySelector(`.native-tab[data-tab="${name}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update top bar
        const titles = { events: 'Events', bsl: 'BSL & ISL Videos', atEvent: 'Support', more: 'More' };
        const hasBack = (name === 'more' && this.tabHistory.more.length > 0) ||
                        (name === 'events' && this.tabHistory.events.length > 0);
        this.updateTopBar(titles[name], hasBack);

        // Show correct content in Events tab
        if (name === 'events') {
            this.setSegment(this.activeSegment);
        }

        // Render staff cards when switching to Support tab
        if (name === 'atEvent') {
            _renderStaffCards();
        }

        // Restore scroll position
        window.scrollTo(0, this.scrollPositions[name] || 0);

        nativeHaptic('light');
    },

    setSegment(seg) {
        this.activeSegment = seg;

        // Update segment buttons
        document.querySelectorAll('.native-segment-btn').forEach(b => b.classList.remove('active'));
        const activeSegBtn = document.querySelector(`.native-segment-btn[data-seg="${seg}"]`);
        if (activeSegBtn) activeSegBtn.classList.add('active');

        // Hide ALL flow sections and sub-sections
        ['flow1Section', 'flow2Section', 'flow3Section', 'eventDetailSection', 'bookingGuideSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const segMap = { browse: 'flow1Section', search: 'flow2Section', request: 'flow3Section' };
        const target = document.getElementById(segMap[seg]);
        if (target) target.style.display = 'block';

        // If Browse and we're in event detail, show that instead
        if (seg === 'browse' && this.tabHistory.events.length > 0) {
            const last = this.tabHistory.events[this.tabHistory.events.length - 1];
            if (last && last.type === 'eventDetail') {
                if (target) target.style.display = 'none';
                const evDetail = document.getElementById('eventDetailSection');
                if (evDetail) evDetail.style.display = 'block';
            }
        }

        nativeHaptic('light');
    },

    showEventDetail() {
        // Called when an event card is tapped — show detail within Events tab
        const flow1 = document.getElementById('flow1Section');
        const detail = document.getElementById('eventDetailSection');
        if (flow1) flow1.style.display = 'none';
        if (detail) detail.style.display = 'block';

        this.tabHistory.events.push({ type: 'eventDetail' });
        this.updateTopBar('Event', true);
        window.scrollTo(0, 0);
    },

    handleBack() {
        const tab = this.activeTab;

        // Events tab — check flow-specific back logic first
        if (tab === 'events') {
            if (this.tabHistory.events.length > 0) {
                this.tabHistory.events.pop();
                // Return to browse segment
                const detail = document.getElementById('eventDetailSection');
                if (detail) detail.style.display = 'none';
                this.setSegment('browse');
                this.updateTopBar('Events', false);
                return true;
            }
            // Delegate to existing back logic (category drill-down)
            if (typeof handleBackNavigation === 'function') {
                const route = Router.currentRoute;
                const isInFlow1 = route === '/flow1' || (route && route.startsWith('/flow1/'));
                if (isInFlow1 && typeof AppState !== 'undefined' && AppState.viewMode === 'events') {
                    handleBackNavigation();
                    return true;
                }
            }
            return false;
        }

        // More tab — support nested navigation (e.g. How to Book > FAQ > back)
        if (tab === 'more' && this.tabHistory.more.length > 0) {
            this.tabHistory.more.pop();
            if (this.tabHistory.more.length > 0) {
                // Return to the previous subview (e.g. back to How to Book from FAQ)
                const prev = this.tabHistory.more.pop(); // pop so handleMoreAction re-pushes
                this.handleMoreAction(prev.key);
            } else {
                this.closeMoreSubView();
            }
            return true;
        }

        return false;
    },

    updateTopBar(title, showBack) {
        const titleEl = document.getElementById('nativeTopTitle');
        const backEl = document.getElementById('nativeBackBtn');
        if (titleEl) titleEl.textContent = title;
        if (backEl) {
            if (showBack) {
                backEl.classList.add('visible');
            } else {
                backEl.classList.remove('visible');
            }
        }
    }
};

// --- Haptic Feedback Utility (throttled to prevent spam) ---
let _lastHapticTime = 0;
function nativeHaptic(style) {
    if (!IS_NATIVE_APP) return;
    if (localStorage.getItem('pi-haptics-enabled') === 'false') return;
    const now = Date.now();
    if (now - _lastHapticTime < 80) return; // Throttle: max ~12/sec
    _lastHapticTime = now;
    const { Haptics } = (window.Capacitor && window.Capacitor.Plugins) || {};
    if (!Haptics) return;
    const styleMap = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
    Haptics.impact({ style: styleMap[style] || 'Light' }).catch(() => {});
}

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
    csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTVxv88y3c-1VMujoz2bupvSCnUkoC-r0W-QogbkhivAAvY-EBff7-vp76b7NxYeSQMK43rOb7PI830/pub?gid=57149695&single=true&output=csv',
    defaultImage: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=400&fit=crop',
    categoryImages: {
        'concert':    'https://media.performanceinterpreting.co.uk/defaults/default-concert.jpg',
        'music':      'https://media.performanceinterpreting.co.uk/defaults/default-concert.jpg',
        'sport':      'https://media.performanceinterpreting.co.uk/defaults/default-sport.png',
        'sports':     'https://media.performanceinterpreting.co.uk/defaults/default-sport.png',
        'festival':   'https://media.performanceinterpreting.co.uk/defaults/default-festival.png',
        'comedy':     'https://media.performanceinterpreting.co.uk/defaults/default-comedy.jpg',
        'theatre':    'https://media.performanceinterpreting.co.uk/defaults/default-theatre.jpg',
        'family':     'https://media.performanceinterpreting.co.uk/defaults/default-family.png',
        'dance':      'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&h=400&fit=crop',
        'conference': 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=400&fit=crop',
        'other':      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=400&fit=crop',
    },
    cacheDuration: 15 * 60 * 1000, // 15 minutes
    maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days - discard stale cache after this
    localStorageKey: 'pi-events-cache',
    localStorageTimestampKey: 'pi-events-cache-timestamp',
    piEmail: 'office@performanceinterpreting.co.uk'
};

// ========================================
// CATEGORY CONSTANTS
// ========================================
const CATEGORY_ICONS = {
    'All': '🎭',
    'Concert': '🎤',
    'Sports': '🏟️',
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

const CATEGORY_ORDER = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Talks & Discussions', 'Cultural', 'Other'];

// ========================================
// ACCESSIBILITY FEATURES
// ========================================
const ACCESS_FEATURE_DEFS = {
    assistiveListening: { icon: 'icons/assistive-listening.png', label: 'Assistive Listening', desc: 'Hearing assistance available in seating area' },
    captions:           { icon: 'icons/closed-captions.png',     label: 'Captions', desc: 'Regular captioned performances available' },
    visualAlarms:       { icon: 'icons/visual-alarms.png',       label: 'Visual Alarms', desc: 'Visual fire alarms and alerts' },
    wheelchair:         { icon: 'icons/wheelchair-access.png',   label: 'Wheelchair Access', desc: 'Wheelchair accessible seating' },
    companionTicket:    { icon: 'icons/PA-companion.png',        label: 'Companion Ticket', desc: 'Free companion or PA ticket available' },
    assistanceDogs:     { icon: 'icons/assist-dogs.png',         label: 'Assistance Dogs', desc: 'Assistance dogs welcome' },
    stepFree:           { icon: 'icons/step-free-access.png',    label: 'Step-Free', desc: 'Step-free access to seating' },
    changingPlaces:     { icon: 'icons/changing-places.png',     label: 'Changing Places', desc: 'Changing Places toilet on site' },
    viewingPlatform:    { icon: 'icons/access-viewing.png',      label: 'Viewing Platform', desc: 'Elevated viewing platform for wheelchair users' },
    accessibleToilets:  { icon: 'icons/access-toilets.png',      label: 'Accessible Toilets', desc: 'Accessible toilets available' },
    accessibleParking:  { icon: 'icons/access-parking.png',      label: 'Accessible Parking', desc: 'Blue Badge parking available' },
    quietRoom:          { icon: 'icons/quiet-rooms.png',         label: 'Quiet Room', desc: 'Sensory or quiet room available' },
};

// Venue access features — VERIFIED from official accessibility pages (Apr 2026).
// Only includes features explicitly stated. assistiveListening = in seating area, not just ticket office.
const VENUE_ACCESS_FEATURES = {
    // === LONDON — Entertainment Venues ===
    // The O2: ALDs at Customer Service desk for events. Nimbus Access Card. SignVideo BSL relay.
    'the o2':              ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets'],
    // Wembley: Loop at info desks for SPORT ONLY (not concerts). BSL free at every concert. 310 wheelchair places. 147 accessible toilets.
    'wembley stadium':     ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    // OVO Arena Wembley: IR system + loop in rows N4-N12, S4-S12, N3-N9, S3-S9, E3, E4. Visual+audible fire alarms confirmed.
    'ovo arena wembley':   ['assistiveListening', 'visualAlarms', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // Royal Albert Hall: IR hearing system in auditorium, Elgar Room, North Circle Bar.
    'royal albert hall':   ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],
    // Southbank Centre: Sound enhancement systems in all venues. Flashing beacon in Changing Places only (not venue-wide).
    'southbank centre':    ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // Barbican: Induction loop in Hall, Theatre, Cinemas 2&3. IR in Milton Court. Regular captioned cinema & theatre.
    'barbican centre':     ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // Alexandra Palace: Loop at service points + headsets at Theatre. Visual alarms in ALL public spaces. 25 Blue Badge spaces.
    'alexandra palace':    ['assistiveListening', 'visualAlarms', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    // Eventim Apollo: Loop covers most stalls + Blocks 8/9/10 circle. No lift to circle (40+ steps).
    'eventim apollo':      ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    // ABBA Arena: BSL interpreted performances on schedule. Limited accessibility info on page.
    'abba arena':          ['wheelchair', 'stepFree', 'accessibleParking'],
    // Roundhouse: Portable loops in foyer, IR in main space + studio, MobileConnect trial.
    'roundhouse':          ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],
    // O2 Academy Brixton: No hearing system mentioned. No lift to circle. Accessible viewing platform.
    'o2 academy brixton':  ['wheelchair', 'companionTicket', 'assistanceDogs', 'viewingPlatform', 'accessibleToilets'],

    // === LONDON — Stadiums ===
    // Arsenal: Loop at Box Office only (NOT in stadium bowl). Full BSL on pitchside show. SignVideo. Sensory room.
    'emirates stadium':    ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'quietRoom'],
    // London Stadium: Loop at ticket office windows only (NOT in bowl). BSL on request. 3 Changing Places. 49 Blue Badge spaces.
    'london stadium':      ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // Chelsea: Loop at reception + Window 7 only (NOT in bowl). BSL on big screens. 2 Changing Places. Sensory room.
    'stamford bridge':     ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    // Tottenham: Radio-based system covers ENTIRE stadium bowl + kiosks. Best hearing coverage of any stadium. Sensory suite.
    'tottenham hotspur stadium': ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'quietRoom'],

    // === MANCHESTER ===
    // AO Arena: Induction loop in Block 114 and AP 108/109 only. Staff have deaf awareness training.
    'ao arena':            ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],
    // Co-op Live: Hearing loop accessible from ANYWHERE in venue bowl. Visual+audible emergency warnings confirmed. 2 Changing Places.
    'co-op live':          ['assistiveListening', 'visualAlarms', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],
    // Old Trafford: Loop at reception/ticket office ONLY (not in bowl). 278 wheelchair positions. 2 Changing Places. Ability Suite lounge.
    'old trafford':        ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    // Etihad: Loop in reception/shop/kiosks ONLY (not in bowl). Sensory room. 42 accessible toilets.
    'etihad stadium':      ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // === REGIONAL ARENAS ===
    // Birmingham: RF analogue system, 100% bowl coverage. Neck loops for telecoil users.
    'utilita arena birmingham': ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],
    // Newcastle: Induction loop in Block 104 ONLY. Must book that location for loop.
    'utilita arena newcastle':  ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],
    // Sheffield: FM Sennheiser system. Assisted changing room under construction.
    'utilita arena sheffield':  ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets'],
    // Leeds: RF induction loop throughout arena. Stoma-friendly toilets. Dedicated accessible host.
    'first direct arena':  ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'quietRoom'],
    // Liverpool: Induction loops available + box office counters. Gold Attitude is Everything. Changing Places via sister venue.
    'm&s bank arena':      ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],
    // Glasgow: IR in blocks 204-206, 213-215 only (varies by event/production). Loop at box office.
    'ovo hydro':           ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // Nottingham: IR + loop in certain seating locations. Viewing platforms. Names PI as BSL provider.
    'motorpoint arena':    ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // === OTHER VENUES ===
    // Anfield: Loop at ticket office/kiosks ONLY (not in bowl). 2 Changing Places. Sensory room.
    'anfield':             ['wheelchair', 'stepFree', 'changingPlaces', 'accessibleToilets', 'quietRoom'],
    // Bournemouth: Sennheiser MobileConnect Wi-Fi system (app on own phone). Changing Places with hoist.
    'bournemouth international centre': ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    // BP Pulse LIVE: RF analogue system, 100% bowl coverage. Works with PI by name.
    'bp pulse live':       ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],

    // === VERIFIED ADDITIONS (Apr 2026) — from official venue accessibility pages ===

    // Indigo at The O2: Very sparse accessibility page. Only 3 features explicitly stated.
    // Source: theo2.co.uk/accessibility/indigo-at-the-o2-2
    'indigo at the o2':    ['wheelchair', 'stepFree', 'accessibleToilets'],
    'indigo at the o2 london': ['wheelchair', 'stepFree', 'accessibleToilets'],

    // Royal Festival Hall, Queen Elizabeth Hall, Clore Ballroom: All Southbank Centre venues.
    // Sound enhancement in all venues, captions at performances, Changing Places on Level 1, 3 Blue Badge spaces on QEH slip road.
    // Source: southbankcentre.co.uk/visit-us/access/
    'royal festival hall': ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    'queen elizabeth hall': ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],
    'clore ballroom':      ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],

    // Brighton Centre: Excellent accessibility. All 12 features confirmed. Sennheiser MobileConnect WiFi system.
    // Source: brightoncentre.co.uk/access/ (Access Statement Jan 2025)
    'brighton centre':     ['assistiveListening', 'visualAlarms', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // 3Arena Dublin: Very sparse official info. Only wheelchair seating explicitly stated.
    // Source: 3arena.ie/faqs
    '3arena':              ['wheelchair'],

    // O2 Apollo Manchester: NO hearing loop (explicitly stated). No lift to Circle (~40 steps). 1 accessible toilet.
    // Source: academymusicgroup.com/o2apollomanchester/accessibility
    'o2 apollo manchester': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    'o2 apollo':           ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    'apollo manchester':   ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // Shepherd's Bush Empire: NO hearing loop. Ramp at Stage Door by arrangement. RADAR key accessible toilet.
    // Source: academymusicgroup.com/o2shepherdsbushempire/accessibility
    "shepherd's bush empire": ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets'],
    'shepherds bush empire': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'viewingPlatform', 'accessibleToilets'],

    // Circus Starr: Touring accessible circus. First circus to tour with Changing Places (mobile unit).
    // All shows BSL interpreted. Relaxed environment. Free ear defenders. Touch tours for visually impaired.
    // Wheelchair spaces pre-booked by phone. No mention of assistance dogs.
    // Source: circus-starr.org.uk/access/
    'circus starr':        ['wheelchair', 'changingPlaces', 'companionTicket'],

    // === VERIFIED BATCH 2 (Apr 2026) — from official venue websites & accessibility guides ===

    // St James' Park: assistiveListening, wheelchair, companionTicket, changingPlaces, accessibleToilets, accessibleParking, quietRoom, stepFree
    // Source: newcastleunited.com/en/st-james-park/visitor-information/disabled-supporters
    'st james park':       ['assistiveListening', 'wheelchair', 'companionTicket', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom', 'stepFree'],
    "st james' park":      ['assistiveListening', 'wheelchair', 'companionTicket', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom', 'stepFree'],

    // Selhurst Park: assistiveListening, wheelchair, changingPlaces, assistanceDogs, accessibleToilets, accessibleParking, quietRoom, stepFree
    // Source: cpfc.co.uk/information/guide-visiting-selhurst-park/
    'selhurst park':       ['assistiveListening', 'wheelchair', 'changingPlaces', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'quietRoom', 'stepFree'],

    // Villa Park: wheelchair, accessibleParking, quietRoom, accessibleToilets
    // Source: avfc.co.uk/club/disability-accessibility/
    'villa park':          ['wheelchair', 'accessibleParking', 'quietRoom', 'accessibleToilets'],

    // Goodison Park: wheelchair, accessibleParking
    // Source: evertonfc.com/season-25-26/stadium-information/accessibility
    'goodison park':       ['wheelchair', 'accessibleParking'],

    // Elland Road: changingPlaces, accessibleParking
    // Source: leedsunited.com/en/ellandroad
    'elland road':         ['changingPlaces', 'accessibleParking'],

    // Bridgewater Hall: assistiveListening, wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets, accessibleParking, changingPlaces
    // Source: bridgewater-hall.co.uk/your-visit/access/
    'bridgewater hall':    ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking', 'changingPlaces'],

    // Symphony Hall Birmingham: assistiveListening, wheelchair, companionTicket, assistanceDogs, accessibleToilets, changingPlaces, accessibleParking
    // Source: cbso.co.uk/your-visit/access
    'symphony hall':       ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleToilets', 'changingPlaces', 'accessibleParking'],

    // Liverpool Philharmonic: assistiveListening, wheelchair, companionTicket, stepFree, accessibleToilets, changingPlaces, accessibleParking
    // Source: liverpoolphil.com/plan-your-visit/accessibility/
    'liverpool philharmonic hall': ['assistiveListening', 'wheelchair', 'companionTicket', 'stepFree', 'accessibleToilets', 'changingPlaces', 'accessibleParking'],
    'liverpool philharmonic': ['assistiveListening', 'wheelchair', 'companionTicket', 'stepFree', 'accessibleToilets', 'changingPlaces', 'accessibleParking'],

    // Glasgow Royal Concert Hall: assistiveListening, wheelchair, stepFree, accessibleToilets, assistanceDogs, accessibleParking
    // Source: glasgowlife.org.uk
    'glasgow royal concert hall': ['assistiveListening', 'wheelchair', 'stepFree', 'accessibleToilets', 'assistanceDogs', 'accessibleParking'],

    // Sheffield City Hall: assistiveListening, wheelchair, stepFree, accessibleToilets
    // Source: sheffieldcityhall.co.uk/venue-info/accessibility/
    'sheffield city hall': ['assistiveListening', 'wheelchair', 'stepFree', 'accessibleToilets'],

    // O2 Academy Glasgow: wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets, accessibleParking
    // Source: o2academyglasgow.com/accessibility
    'o2 academy glasgow':  ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // O2 City Hall Newcastle: wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets
    // Source: o2cityhallnewcastle.com/accessibility
    'o2 city hall newcastle': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets'],

    // O2 Forum Kentish Town: wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets, captions
    // Source: o2forumkentishtown.com/accessibility
    'o2 forum kentish town': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'captions'],

    // Plymouth Pavilions: assistiveListening, wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets, captions
    // Source: plymoutharena.com/accessibility
    'plymouth pavilions':  ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'captions'],

    // De Montfort Hall: wheelchair, companionTicket, assistanceDogs, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking
    // Source: demontforthall.co.uk/access/
    'de montfort hall':    ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // SEC Armadillo Glasgow: assistiveListening, captions, wheelchair, companionTicket, assistanceDogs, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking
    // Source: sec.co.uk
    'sec armadillo':       ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // P&J Live Aberdeen: assistiveListening, captions, wheelchair, companionTicket, assistanceDogs, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking
    // Source: pandjlive.com
    'p&j live':            ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // Copper Box Arena: wheelchair, stepFree, accessibleToilets, accessibleParking
    // Source: copperboxarena.org
    'copper box arena':    ['wheelchair', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // Craven Cottage (Fulham): assistiveListening, wheelchair, companionTicket, assistanceDogs, stepFree, accessibleToilets, accessibleParking, quietRoom
    // Source: fulhamfc.com
    'craven cottage':      ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // Scottish Gas Murrayfield: assistiveListening, wheelchair, companionTicket, assistanceDogs, stepFree, changingPlaces, accessibleToilets, accessibleParking
    // Source: euansguide.com/venues/bt-murrayfield-stadium-edinburgh-2028
    'scottish gas murrayfield': ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],
    'murrayfield':         ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],

    // Edinburgh Playhouse: assistiveListening, wheelchair, assistanceDogs, accessibleToilets
    // Source: accessscottishtheatre.com/venue/edinburgh-playhouse/
    'edinburgh playhouse': ['assistiveListening', 'wheelchair', 'assistanceDogs', 'accessibleToilets'],

    // London Palladium: wheelchair, assistanceDogs, stepFree, accessibleToilets
    // Source: seatplan.com/london/london-palladium-theatre/access/
    'london palladium':    ['wheelchair', 'assistanceDogs', 'stepFree', 'accessibleToilets'],

    // Bristol Hippodrome: wheelchair, companionTicket, stepFree, accessibleToilets
    // Source: seatplan.com/bristol/bristol-hippodrome-theatre/access/
    'bristol hippodrome':  ['wheelchair', 'companionTicket', 'stepFree', 'accessibleToilets'],

    // Royal Concert Hall Nottingham: captions, wheelchair, assistanceDogs, stepFree, changingPlaces, accessibleToilets
    // Source: trch.co.uk/access-visiting-yhdl
    'royal concert hall nottingham': ['captions', 'wheelchair', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],
    'royal concert hall':  ['captions', 'wheelchair', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],

    // Molineux (Wolves): assistiveListening, wheelchair, stepFree, changingPlaces, accessibleToilets, accessibleParking, quietRoom
    // Source: wolves.co.uk/fans/disabled-supporters/
    'molineux':            ['assistiveListening', 'wheelchair', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    'molineux stadium':    ['assistiveListening', 'wheelchair', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // King Power Stadium (Leicester): assistiveListening, wheelchair, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking, companionTicket, assistanceDogs
    // Source: levelplayingfield.org.uk/club/leicester-city/
    'king power stadium':  ['assistiveListening', 'wheelchair', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'companionTicket', 'assistanceDogs'],

    // Celtic Park: assistiveListening, wheelchair, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking, quietRoom
    // Source: euansguide.com/venues/celtic-park-stadium-glasgow-3318
    'celtic park':         ['assistiveListening', 'wheelchair', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // Ibrox Stadium (Rangers): wheelchair, viewingPlatform, accessibleToilets, accessibleParking
    // Source: rangers.co.uk
    'ibrox stadium':       ['wheelchair', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    'ibrox':               ['wheelchair', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // Hampden Park: wheelchair, stepFree, changingPlaces, viewingPlatform, accessibleToilets, accessibleParking, companionTicket
    // Source: euansguide.com/venues/hampden-park-stadium-glasgow-133
    'hampden park':        ['wheelchair', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'companionTicket'],

    // Southampton FC (St Mary's): assistiveListening, wheelchair, companionTicket, assistanceDogs, accessibleToilets, accessibleParking, quietRoom
    // Source: southamptonfc.com/en/accessibility
    "st mary's stadium":   ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    'st marys stadium':    ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // === VERIFIED BATCH 3 (Apr 2026) — from official venue websites & accessibility guides ===

    // Amex Stadium (Brighton): 7 features
    // Source: brightonandhovealbion.com/amex-accessibility
    'amex stadium':        ['wheelchair', 'changingPlaces', 'assistiveListening', 'accessibleToilets', 'accessibleParking', 'viewingPlatform', 'companionTicket'],

    // Bet365 Stadium (Stoke): 6 features
    // Source: stokecityfc.com/tickets/accessibility/
    'bet365 stadium':      ['wheelchair', 'accessibleToilets', 'assistiveListening', 'accessibleParking', 'companionTicket', 'viewingPlatform'],

    // City Ground (Nottingham Forest): 7 features
    // Source: nottinghamforest.co.uk/tickets/accessibility/accessibility-guide
    'city ground':         ['wheelchair', 'accessibleToilets', 'changingPlaces', 'assistiveListening', 'accessibleParking', 'companionTicket', 'viewingPlatform'],

    // Principality Stadium (Cardiff): 7 features
    // Source: principalitystadium.wales/information/accessible-facilities/
    'principality stadium': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    'principality stadium, cardiff': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // Cardiff City Stadium: 8 features
    // Source: cardiffcityfc.co.uk/club/accessibility-disabled-supporters
    'cardiff city stadium': ['wheelchair', 'accessibleToilets', 'changingPlaces', 'assistiveListening', 'accessibleParking', 'companionTicket', 'assistanceDogs', 'quietRoom'],

    // Stadium of Light (Sunderland): 8 features
    // Source: safc.com/matchday/accessibility
    'stadium of light':    ['wheelchair', 'accessibleToilets', 'changingPlaces', 'assistiveListening', 'accessibleParking', 'quietRoom', 'companionTicket', 'viewingPlatform'],

    // Turf Moor (Burnley): 7 features
    // Source: bfcdsa.com/stadium-accessibility
    'turf moor':           ['wheelchair', 'companionTicket', 'assistanceDogs', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'assistiveListening'],

    // Swansea.com Stadium: 7 features
    // Source: swanseacity.com/matchday/accessible-facilities-inside-swanseacom-stadium
    'swansea.com stadium': ['wheelchair', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking', 'quietRoom', 'assistiveListening'],

    // Riverside Stadium (Middlesbrough): 5 features
    // Source: mfc.co.uk/supporters/disabled-supporters
    'riverside stadium':   ['wheelchair', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'assistiveListening'],

    // Coventry Building Society Arena: 6 features
    // Source: coventrybuildingsocietyarena.co.uk/accessibility
    'coventry building society arena': ['wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleParking', 'quietRoom'],

    // GTech Community Stadium (Brentford): 6 features
    // Source: brentfordfc.com/en/stadium-accessibility
    'gtech community stadium': ['wheelchair', 'changingPlaces', 'accessibleToilets', 'accessibleParking', 'quietRoom', 'stepFree'],

    // The Glasshouse / Sage Gateshead: 10 features
    // Source: sagegateshead.com
    'the glasshouse':      ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],
    'sage gateshead':      ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'viewingPlatform', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // Usher Hall Edinburgh: 7 features
    // Source: cultureedinburgh.com/accessibility
    'usher hall':          ['assistiveListening', 'wheelchair', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking', 'quietRoom'],

    // Swansea Arena: 7 features
    // Source: swansea-arena.co.uk
    'swansea arena':       ['captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets'],

    // York Barbican: 7 features
    // Source: yorkbarbican.co.uk
    'york barbican':       ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // Wolverhampton Civic Hall: 5 features
    // Source: thehallswolverhampton.co.uk/venue-info/disability-access/
    'wolverhampton civic hall': ['wheelchair', 'companionTicket', 'stepFree', 'changingPlaces', 'accessibleToilets'],

    // Leeds Grand Theatre: 5 features
    // Source: leedsgrandtheatre.com
    'leeds grand theatre':  ['assistiveListening', 'captions', 'wheelchair', 'assistanceDogs', 'accessibleToilets'],

    // Norwich Theatre Royal: 7 features
    // Source: norwichtheatre.org
    'norwich theatre royal': ['assistiveListening', 'captions', 'wheelchair', 'assistanceDogs', 'stepFree', 'companionTicket', 'accessibleToilets'],

    // Milton Keynes Theatre: 7 features
    // Source: atgtickets.com/venues/milton-keynes-theatre
    'milton keynes theatre': ['assistiveListening', 'captions', 'wheelchair', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // Watford Colosseum: 5 features
    // Source: watfordcolosseum.co.uk
    'watford colosseum':   ['captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleParking'],

    // Utilita Arena Cardiff: 6 features
    // Source: utilitaarenacardiff.co.uk/accessibility
    'utilita arena cardiff': ['assistiveListening', 'wheelchair', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // === VERIFIED BATCH 4 (Apr 2026) ===

    // Connexin Live Hull: 5 features
    // Source: connexinlivehull.com
    'connexin live':       ['assistiveListening', 'companionTicket', 'wheelchair', 'accessibleToilets', 'accessibleParking'],

    // Derby Arena: 7 features
    // Source: derbyarena.co.uk
    'derby arena':         ['assistiveListening', 'wheelchair', 'assistanceDogs', 'stepFree', 'changingPlaces', 'accessibleToilets', 'accessibleParking'],

    // Allianz Stadium Twickenham: 8 features
    // Source: englandrugby.com
    'allianz stadium':     ['wheelchair', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'stepFree', 'quietRoom', 'captions', 'visualAlarms'],
    'allianz stadium twickenham': ['wheelchair', 'assistanceDogs', 'accessibleToilets', 'accessibleParking', 'stepFree', 'quietRoom', 'captions', 'visualAlarms'],

    // Victoria Hall Stoke-on-Trent: 5 features
    // Source: victoriahallstoke.co.uk
    'victoria hall':       ['wheelchair', 'assistanceDogs', 'accessibleToilets', 'stepFree', 'assistiveListening'],

    // Windsor Park Belfast: 6 features
    // Source: irishfa.com/national-football-stadium-at-windsor-park
    'windsor park':        ['wheelchair', 'companionTicket', 'stepFree', 'accessibleToilets', 'accessibleParking', 'assistiveListening'],

    // Blenheim Palace: 2 features
    // Source: blenheimpalace.com
    'blenheim palace':     ['quietRoom', 'assistanceDogs'],

    // === VERIFIED BATCH 5 (Apr 2026) ===

    // Bath Forum: 5 features. Source: bathforum.co.uk
    'bath forum':          ['wheelchair', 'assistiveListening', 'companionTicket', 'assistanceDogs', 'quietRoom'],

    // Blackpool Opera House / Winter Gardens: 4 features. Source: wintergardensblackpool.co.uk
    'blackpool opera house': ['wheelchair', 'accessibleToilets', 'stepFree', 'companionTicket'],

    // Caird Hall Dundee: 8 features. Source: leisureandculturedundee.com
    'caird hall':          ['wheelchair', 'accessibleToilets', 'assistiveListening', 'assistanceDogs', 'stepFree', 'accessibleParking', 'visualAlarms', 'changingPlaces'],

    // Cambridge Corn Exchange: 7 features. Source: cornex.co.uk
    'cambridge corn exchange': ['wheelchair', 'accessibleToilets', 'assistiveListening', 'assistanceDogs', 'stepFree', 'accessibleParking', 'companionTicket'],

    // Eden Court Theatre Inverness: 8 features. Source: eden-court.co.uk
    'eden court theatre':  ['wheelchair', 'accessibleToilets', 'assistiveListening', 'captions', 'assistanceDogs', 'stepFree', 'accessibleParking', 'companionTicket'],
    'eden court':          ['wheelchair', 'accessibleToilets', 'assistiveListening', 'captions', 'assistanceDogs', 'stepFree', 'accessibleParking', 'companionTicket'],

    // Epsom Playhouse: 6 features. Source: epsomplayhouse.co.uk
    'epsom playhouse':     ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets'],

    // Fairfield Halls Croydon: 9 features. Source: fairfield-halls.co.uk
    'fairfield halls':     ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'changingPlaces', 'visualAlarms', 'accessibleToilets', 'accessibleParking'],

    // Ipswich Regent Theatre: 9 features. Source: ipswichtheatres.co.uk
    'ipswich regent theatre': ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'quietRoom', 'accessibleToilets', 'accessibleParking'],
    'ipswich regent':      ['assistiveListening', 'captions', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'quietRoom', 'accessibleToilets', 'accessibleParking'],

    // Kingsholm Stadium Gloucester: 5 features. Source: gloucesterrugby.co.uk
    'kingsholm stadium':   ['wheelchair', 'companionTicket', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    'kingsholm':           ['wheelchair', 'companionTicket', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // Lincoln Engine Shed: 5 features. Source: engineshed.co.uk
    'lincoln engine shed': ['wheelchair', 'companionTicket', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],
    'engine shed':         ['wheelchair', 'companionTicket', 'viewingPlatform', 'accessibleToilets', 'accessibleParking'],

    // Reading Hexagon: 7 features. Source: readingarts.com
    'reading hexagon':     ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // Shoreditch Town Hall: 6 features. Source: shoreditchtownhall.com
    'shoreditch town hall': ['wheelchair', 'captions', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // Crystal Palace National Sports Centre: 4 features. Source: better.org.uk
    'crystal palace national sports centre': ['wheelchair', 'accessibleToilets', 'accessibleParking', 'stepFree'],

    // Westpoint Arena Exeter: 4 features. Source: westpointexeter.co.uk
    'westpoint arena':     ['wheelchair', 'accessibleToilets', 'accessibleParking', 'stepFree'],

    // New Theatre Oxford: 7 features. Source: atgtickets.com/venues/new-theatre-oxford
    'new theatre oxford':  ['assistiveListening', 'wheelchair', 'companionTicket', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking'],

    // New Theatre Peterborough: 5 features. Source: newtheatre-peterborough.com
    'new theatre peterborough': ['captions', 'assistanceDogs', 'stepFree', 'companionTicket', 'wheelchair'],

    // O2 Guildhall Southampton: 7 features. Source: o2guildhallsouthampton.co.uk
    'o2 guildhall southampton': ['wheelchair', 'viewingPlatform', 'assistanceDogs', 'stepFree', 'accessibleToilets', 'accessibleParking', 'captions'],

    // O2 Victoria Warehouse Manchester: 6 features. Source: o2victoriawarehouse.co.uk
    'o2 victoria warehouse': ['wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleToilets', 'quietRoom', 'captions'],

    // Preston Guild Hall: 5 features. Source: prestonguildhall.co.uk
    'preston guild hall':  ['wheelchair', 'stepFree', 'assistanceDogs', 'accessibleToilets', 'accessibleParking'],

    // === ALIASES for matching (event data uses variant names) ===
    'o2 victoria manchester': ['wheelchair', 'companionTicket', 'assistanceDogs', 'accessibleToilets', 'quietRoom', 'captions'],
    'edinburgh caste':     ['wheelchair', 'accessibleToilets', 'assistanceDogs'],
    'edinburgh castle':    ['wheelchair', 'accessibleToilets', 'assistanceDogs'],
    'knebworth park':      ['wheelchair', 'accessibleToilets', 'accessibleParking', 'assistanceDogs', 'viewingPlatform']
};

// Auto-generated by enrichment.py — venue address database
// Paste this into app.js below VENUE_ACCESS_FEATURES
const VENUE_DETAILS = {
    '3arena': {
        address: 'East Link Bridge',
        address2: 'Dublin Port',
        city: 'Dublin',
        postcode: 'D01 X9X0',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=3Arena%2C+East+Link+Bridge%2C+Dublin+Port%2C+Dublin+D01+X9X0%2C+Ireland',
    },
    'abba arena': {
        address: 'Pudding Mill Lane',
        address2: 'Queen Elizabeth Olympic Park',
        city: 'London',
        postcode: 'E15 2HB',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=ABBA+Arena%2C+Pudding+Mill+Lane%2C+London+E15+2HB',
    },
    'alexandra palace': {
        address: 'Alexandra Palace Way',
        city: 'London',
        postcode: 'N22 7AY',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Alexandra+Palace%2C+Alexandra+Palace+Way%2C+London+N22+7AY',
    },
    'allianz stadium': {
        address: 'Hotspurs Way',
        city: 'London',
        postcode: 'N17 0AP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Allianz+Stadium%2C+Hotspurs+Way%2C+London+N17+0AP',
    },
    'amex stadium': {
        address: 'Village Way',
        city: 'Falmer',
        postcode: 'BN1 9BL',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Amex+Stadium%2C+Village+Way%2C+Falmer%2C+East+Sussex+BN1+9BL',
    },
    'anfield': {
        address: 'Anfield Road',
        city: 'Liverpool',
        postcode: 'L4 0TH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Anfield+Stadium%2C+Anfield+Road%2C+Liverpool+L4+0TH',
    },
    'ao arena': {
        address: 'Victoria Station Approach',
        city: 'Manchester',
        postcode: 'M3 1AR',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=AO+Arena%2C+Victoria+Station+Approach%2C+Manchester+M3+1AR',
    },
    'barbican centre': {
        address: 'Silk Street',
        city: 'London',
        postcode: 'EC2Y 8DS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Barbican+Centre%2C+Silk+Street%2C+London+EC2Y+8DS',
    },
    'bournemouth international centre': {
        address: 'Bournemouth International Centre, Exeter Road',
        city: 'Bournemouth',
        postcode: 'BH2 5BH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bournemouth+International+Centre%2C+Exeter+Road%2C+Bournemouth+BH2+5BH',
    },
    'bp pulse live': {
        address: 'Perimeter Road, NEC',
        address2: 'Kings Edge, Pierhead',
        city: 'Birmingham',
        postcode: 'B40 1NT',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=BP+Pulse+LIVE%2C+Perimeter+Road%2C+NEC%2C+Birmingham+B40+1NT',
    },
    'bridgewater hall': {
        address: 'Lower Mosley Street',
        city: 'Manchester',
        postcode: 'M2 3WS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Bridgewater+Hall%2C+Lower+Mosley+Street%2C+Manchester+M2+3WS',
    },
    'brighton centre': {
        address: 'Kings Road',
        city: 'Brighton',
        postcode: 'BN1 2GR',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Brighton+Centre%2C+Kings+Road%2C+Brighton%2C+BN1+2GR',
    },
    'bristol hippodrome': {
        address: 'St Augustine\'s Parade',
        city: 'Bristol',
        postcode: 'BS1 4UZ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bristol+Hippodrome%2C+St+Augustine%27s+Parade%2C+Bristol+BS1+4UZ',
    },
    'cardiff city stadium': {
        address: 'Leckwith Road',
        city: 'Cardiff',
        postcode: 'CF11 8AW',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cardiff+City+Stadium%2C+Leckwith+Road%2C+Cardiff+CF11+8AW',
    },
    'celtic park': {
        address: 'Celtic Park',
        address2: 'Kerrydale Street',
        city: 'Glasgow',
        postcode: 'G40 3RE',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Celtic+Park%2C+Kerrydale+Street%2C+Glasgow+G40+3RE',
    },
    'city ground': {
        address: 'Pavilion Road',
        city: 'Nottingham',
        postcode: 'NG2 5FJ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=City+Ground%2C+Pavilion+Road%2C+West+Bridgford%2C+Nottingham+NG2+5FJ',
    },
    'co-op live': {
        address: 'Eastlands',
        city: 'Manchester',
        postcode: 'M11 3DU',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Co-op+Live%2C+Eastlands%2C+Manchester+M11+3DU',
    },
    'copper box arena': {
        address: 'Copper Box Arena, 5 Thornton Street',
        city: 'London',
        postcode: 'E20 1FE',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Copper+Box+Arena%2C+5+Thornton+Street%2C+London+E20+1FE',
    },
    'craven cottage': {
        address: 'Stevenage Road',
        city: 'London',
        postcode: 'SW6 6HH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Craven+Cottage%2C+Stevenage+Road%2C+London+SW6+6HH',
    },
    'crystal palace national sports centre': {
        address: 'Ledrington Road',
        address2: 'Crystal Palace',
        city: 'London',
        postcode: 'SE19 2BB',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Crystal+Palace+National+Sports+Centre%2C+Ledrington+Road%2C+Crystal+Palace%2C+London+SE19+2BB',
    },
    'de montfort hall': {
        address: 'Belgrave Road',
        city: 'Leicester',
        postcode: 'LE1 3TH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=De+Montfort+Hall%2C+Belgrave+Road%2C+Leicester+LE1+3TH',
    },
    'edinburgh playhouse': {
        address: '18-22 Greenside Place',
        city: 'Edinburgh',
        postcode: 'EH1 3AA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Edinburgh+Playhouse%2C+18-22+Greenside+Place%2C+Edinburgh+EH1+3AA',
    },
    'elland road': {
        address: 'Elland Road',
        city: 'Leeds',
        postcode: 'LS11 0ES',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Elland+Road%2C+Leeds%2C+LS11+0ES',
    },
    'emirates stadium': {
        address: 'Hornsey Road',
        city: 'London',
        postcode: 'N7 7AJ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Emirates+Stadium%2C+Hornsey+Road%2C+London+N7+7AJ',
    },
    'etihad stadium': {
        address: 'Etihad Campus',
        city: 'Manchester',
        postcode: 'M11 3FF',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Etihad+Stadium%2C+Etihad+Campus%2C+Manchester+M11+3FF',
    },
    'eventim apollo': {
        address: '45 Queen Caroline Street',
        city: 'London',
        postcode: 'W6 9QH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Eventim+Apollo%2C+45+Queen+Caroline+Street%2C+Hammersmith%2C+London+W6+9QH',
    },
    'fairfield halls': {
        address: 'Park Lane',
        city: 'Croydon',
        postcode: 'CR0 1JD',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fairfield+Halls%2C+Park+Lane%2C+Croydon+CR0+1JD',
    },
    'first direct arena': {
        address: 'Arena Way',
        city: 'Leeds',
        postcode: 'LS2 8BY',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=First+Direct+Arena%2C+Arena+Way%2C+Leeds+LS2+8BY',
    },
    'glasgow royal concert hall': {
        address: '2 Sauchiehall Street',
        city: 'Glasgow',
        postcode: 'G2 3NY',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Glasgow+Royal+Concert+Hall%2C+2+Sauchiehall+Street%2C+Glasgow+G2+3NY',
    },
    'goodison park': {
        address: 'Goodison Road',
        city: 'Liverpool',
        postcode: 'L4 4EL',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Goodison+Park%2C+Goodison+Road%2C+Liverpool+L4+4EL',
    },
    'gtech community stadium': {
        address: 'Great West Road',
        city: 'Brentford',
        postcode: 'W5 3BS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Gtech+Community+Stadium%2C+Great+West+Road%2C+Brentford%2C+London+W5+3BS',
    },
    'hampden park': {
        address: 'Letherby Drive',
        city: 'Glasgow',
        postcode: 'G42 9BA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Hampden+Park%2C+Letherby+Drive%2C+Glasgow+G42+9BA',
    },
    'ibrox stadium': {
        address: '150 Edmiston Drive',
        city: 'Glasgow',
        postcode: 'G51 2XD',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ibrox+Stadium%2C+150+Edmiston+Drive%2C+Glasgow+G51+2XD',
    },
    'king power stadium': {
        address: 'Harry Weston Road',
        city: 'Leicester',
        postcode: 'LE2 7FL',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=King+Power+Stadium%2C+Harry+Weston+Road%2C+Leicester+LE2+7FL',
    },
    'leeds grand theatre': {
        address: '46 New Briggate',
        city: 'Leeds',
        postcode: 'LS1 6NZ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Leeds+Grand+Theatre%2C+46+New+Briggate%2C+Leeds+LS1+6NZ',
    },
    'liverpool philharmonic hall': {
        address: 'Hope Street',
        city: 'Liverpool',
        postcode: 'L1 9BP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Liverpool+Philharmonic+Hall%2C+Hope+Street%2C+Liverpool+L1+9BP',
    },
    'london palladium': {
        address: '8 Argyll Street',
        city: 'London',
        postcode: 'W1F 7TF',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=London+Palladium%2C+8+Argyll+Street%2C+London+W1F+7TF',
    },
    'london stadium': {
        address: 'Queen Elizabeth Olympic Park',
        city: 'London',
        postcode: 'E20 2ST',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=London+Stadium%2C+Queen+Elizabeth+Olympic+Park%2C+London+E20+2ST',
    },
    'm&s bank arena': {
        address: 'King\'s Dock',
        city: 'Liverpool',
        postcode: 'L3 4FP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=M%26S+Bank+Arena%2C+King%27s+Dock%2C+Liverpool+L3+4FP',
    },
    'molineux stadium': {
        address: 'Waterloo Road',
        city: 'Wolverhampton',
        postcode: 'WV1 4QR',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Molineux+Stadium%2C+Waterloo+Road%2C+Wolverhampton+WV1+4QR',
    },
    'motorpoint arena': {
        address: 'Bolero Square',
        address2: 'The Lace Market',
        city: 'Nottingham',
        postcode: 'NG1 5AA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Motorpoint+Arena%2C+Bolero+Square%2C+Nottingham+NG1+5AA',
    },
    'o2 academy brixton': {
        address: '211 Stockwell Road',
        city: 'London',
        postcode: 'SW9 8LF',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Academy+Brixton%2C+211+Stockwell+Road%2C+London+SW9+8LF',
    },
    'o2 apollo manchester': {
        address: 'O2 Apollo Manchester, Stockport Road',
        address2: 'Ardwick Green',
        city: 'Manchester',
        postcode: 'M12 6AP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Apollo+Manchester%2C+Stockport+Road%2C+Ardwick+Green%2C+Manchester+M12+6AP',
    },
    'o2 city hall newcastle': {
        address: 'City Hall, Northumberland Street',
        city: 'Newcastle upon Tyne',
        postcode: 'NE1 7DE',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+City+Hall+Newcastle%2C+City+Hall%2C+Northumberland+Street%2C+Newcastle+upon+Tyne+NE1+7DE',
    },
    'o2 forum kentish town': {
        address: '17-19 High Street',
        city: 'London',
        postcode: 'NW5 1JT',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Forum+Kentish+Town%2C+17-19+High+Street%2C+London+NW5+1JT',
    },
    'o2 shepherds bush empire': {
        address: 'Shepherd\'s Bush Green',
        city: 'London',
        postcode: 'W12 8TT',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Shepherd%27s+Bush+Empire%2C+Shepherd%27s+Bush+Green%2C+London+W12+8TT',
    },
    'o2 victoria warehouse': {
        address: 'Trafford Wharf Road',
        address2: 'Bow Wharf',
        city: 'Manchester',
        postcode: 'M17 1AB',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Victoria+Warehouse%2C+Trafford+Wharf+Road%2C+Manchester+M17+1AB',
    },
    'old trafford': {
        address: 'Sir Matt Busby Way',
        city: 'Manchester',
        postcode: 'M16 0RA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Old+Trafford%2C+Sir+Matt+Busby+Way%2C+Manchester+M16+0RA',
    },
    'ovo arena wembley': {
        address: 'Arena Square',
        address2: 'Wembley Stadium',
        city: 'London',
        postcode: 'HA9 0AA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=OVO+Arena+Wembley%2C+Arena+Square%2C+Wembley+Stadium%2C+London+HA9+0AA',
    },
    'ovo hydro': {
        address: 'Exhibition Way',
        address2: 'Scottish Event Campus',
        city: 'Glasgow',
        postcode: 'G3 8YW',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=OVO+Hydro%2C+Exhibition+Way%2C+Scottish+Event+Campus%2C+Glasgow+G3+8YW',
    },
    'principality stadium': {
        address: 'Principality Stadium, Gate 3, Westgate Street',
        city: 'Cardiff',
        postcode: 'CF10 1NS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Principality+Stadium%2C+Gate+3%2C+Westgate+Street%2C+Cardiff+CF10+1NS',
    },
    'resorts world arena': {
        address: 'Arena Birmingham, King Edwards Road',
        city: 'Birmingham',
        postcode: 'B1 2AA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Resorts+World+Arena%2C+King+Edwards+Road%2C+Birmingham+B1+2AA',
    },
    'roundhouse': {
        address: 'Chalk Farm Road',
        city: 'London',
        postcode: 'NW1 8EH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Roundhouse%2C+Chalk+Farm+Road%2C+Camden%2C+London+NW1+8EH',
    },
    'royal albert hall': {
        address: 'Kensington Gore',
        city: 'London',
        postcode: 'SW7 2AP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Royal+Albert+Hall%2C+Kensington+Gore%2C+London+SW7+2AP',
    },
    'royal concert hall nottingham': {
        address: 'Theatre Royal & Royal Concert Hall, South Street',
        city: 'Nottingham',
        postcode: 'NG1 5ND',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Royal+Concert+Hall%2C+South+Street%2C+Nottingham+NG1+5ND',
    },
    'scottish gas murrayfield': {
        address: 'Roseburn Street',
        city: 'Edinburgh',
        postcode: 'EH12 5PJ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Scottish+Gas+Murrayfield%2C+Roseburn+Street%2C+Edinburgh+EH12+5PJ',
    },
    'sec armadillo': {
        address: 'Exhibition Way',
        city: 'Glasgow',
        postcode: 'G3 8YW',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=SEC+Armadillo%2C+Exhibition+Way%2C+Glasgow+G3+8YW',
    },
    'sheffield city hall': {
        address: 'Barker\'s Pool',
        city: 'Sheffield',
        postcode: 'S1 2AL',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sheffield+City+Hall%2C+Barker%27s+Pool%2C+Sheffield+S1+2AL',
    },
    'shoreditch town hall': {
        address: 'Old Street',
        address2: 'Clissold Park',
        city: 'London',
        postcode: 'EC2A 3NS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Shoreditch+Town+Hall%2C+Old+Street%2C+London+EC2A+3NS',
    },
    'southbank centre': {
        address: 'Belvedere Road',
        city: 'London',
        postcode: 'SE1 8XX',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Southbank+Centre%2C+Belvedere+Road%2C+London+SE1+8XX',
    },
    'sse arena belfast': {
        address: '2 Queen\'s Quay',
        city: 'Belfast',
        postcode: 'BT3 9QQ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=SSE+Arena+Belfast%2C+2+Queen%27s+Quay%2C+Belfast+BT3+9QQ',
    },
    'st james park': {
        address: 'Barrack Road',
        city: 'Newcastle upon Tyne',
        postcode: 'NE1 4ST',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=St+James+Park%2C+Barrack+Road%2C+Newcastle+upon+Tyne+NE1+4ST',
    },
    'stadium of light': {
        address: 'Monkwearmouth Stadium',
        address2: 'Monkwearmouth, Sunderland',
        city: 'Sunderland',
        postcode: 'SR5 1SU',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Stadium+of+Light%2C+Monkwearmouth%2C+Sunderland+SR5+1SU',
    },
    'stamford bridge': {
        address: 'Fulham Road',
        city: 'London',
        postcode: 'SW6 1HS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Stamford+Bridge%2C+Fulham+Road%2C+London+SW6+1HS',
    },
    'swansea arena': {
        address: 'North Road',
        city: 'Swansea',
        postcode: 'SA1 8QQ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Swansea+Arena%2C+North+Road%2C+Swansea+SA1+8QQ',
    },
    'swansea.com stadium': {
        address: 'Morfa Avenue',
        city: 'Swansea',
        postcode: 'SA1 2FA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Swansea.com+Stadium%2C+Morfa+Avenue%2C+Swansea+SA1+2FA',
    },
    'symphony hall': {
        address: 'Centenary Square',
        city: 'Birmingham',
        postcode: 'B1 2EA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Symphony+Hall%2C+Centenary+Square%2C+Birmingham+B1+2EA',
    },
    'the o2': {
        address: 'Peninsula Square',
        city: 'London',
        postcode: 'SE10 0DX',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+O2+Arena%2C+Peninsula+Square%2C+London+SE10+0DX',
    },
    'tottenham hotspur stadium': {
        address: '782 High Road',
        city: 'London',
        postcode: 'N17 0BJ',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Tottenham+Hotspur+Stadium%2C+782+High+Road%2C+Tottenham%2C+London+N17+0BJ',
    },
    'usher hall': {
        address: 'Lothian Road',
        city: 'Edinburgh',
        postcode: 'EH1 2EP',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Usher+Hall%2C+Lothian+Road%2C+Edinburgh+EH1+2EP',
    },
    'utilita arena birmingham': {
        address: 'King Edwards Road',
        city: 'Birmingham',
        postcode: 'B1 2AA',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Utilita+Arena+Birmingham%2C+King+Edwards+Road%2C+Birmingham+B1+2AA',
    },
    'utilita arena cardiff': {
        address: 'Mary Ann Street',
        city: 'Cardiff',
        postcode: 'CF10 2EY',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Utilita+Arena+Cardiff%2C+Mary+Ann+Street%2C+Cardiff+CF10+2EY',
    },
    'utilita arena newcastle': {
        address: 'Arena Way',
        city: 'Newcastle upon Tyne',
        postcode: 'NE1 8EN',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Utilita+Arena+Newcastle%2C+Arena+Way%2C+Newcastle+upon+Tyne+NE1+8EN',
    },
    'utilita arena sheffield': {
        address: 'Broughton Lane',
        city: 'Sheffield',
        postcode: 'S9 2DF',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Utilita+Arena+Sheffield%2C+Broughton+Lane%2C+Sheffield+S9+2DF',
    },
    'villa park': {
        address: 'Trinity Road',
        city: 'Birmingham',
        postcode: 'B6 6HE',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Villa+Park%2C+Trinity+Road%2C+Birmingham+B6+6HE',
    },
    'wembley stadium': {
        address: 'Empire Way',
        city: 'Wembley',
        postcode: 'HA9 0WS',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Wembley+Stadium%2C+Empire+Way%2C+Wembley%2C+Greater+London+HA9+0WS',
    },
    'windsor park': {
        address: '112 Donegall Avenue',
        city: 'Belfast',
        postcode: 'BT12 5GH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Windsor+Park%2C+112+Donegall+Avenue%2C+Belfast+BT12+5GH',
    },
    'wolverhampton civic hall': {
        address: 'Civic Hall, St. Peter\'s Square',
        city: 'Wolverhampton',
        postcode: 'WV1 1SH',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Wolverhampton+Civic+Hall%2C+St.+Peter%27s+Square%2C+Wolverhampton+WV1+1SH',
    },
    // === BATCH 5 ADDRESSES (Apr 2026) ===
    'bath forum': { address: '1a Forum Buildings, St James\'s Parade', city: 'Bath', postcode: 'BA1 1UG', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bath+Forum+Bath+BA1+1UG' },
    'bet365 stadium': { address: 'Stanley Matthews Way', city: 'Stoke-on-Trent', postcode: 'ST4 4EG', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bet365+Stadium+Stoke-on-Trent+ST4+4EG' },
    'blackpool opera house': { address: '97 Church Street', city: 'Blackpool', postcode: 'FY1 1HW', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Blackpool+Winter+Gardens+97+Church+Street+Blackpool+FY1+1HW' },
    'caird hall': { address: '6 City Square', city: 'Dundee', postcode: 'DD1 3BB', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Caird+Hall+Dundee+DD1+3BB' },
    'cambridge corn exchange': { address: '2 Wheeler Street', city: 'Cambridge', postcode: 'CB2 3QB', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cambridge+Corn+Exchange+CB2+3QB' },
    'connexin live': { address: 'Myton Street', city: 'Hull', postcode: 'HU1 2PS', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Connexin+Live+Hull+HU1+2PS' },
    'coventry building society arena': { address: 'Phoenix Way', city: 'Coventry', postcode: 'CV6 6GE', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Coventry+Building+Society+Arena+CV6+6GE' },
    'derby arena': { address: 'Royal Way, Pride Park', city: 'Derby', postcode: 'DE24 8JB', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Derby+Arena+Pride+Park+Derby+DE24+8JB' },
    'eden court theatre': { address: 'Bishop\'s Road', city: 'Inverness', postcode: 'IV3 5SA', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Eden+Court+Theatre+Inverness+IV3+5SA' },
    'eden court': { address: 'Bishop\'s Road', city: 'Inverness', postcode: 'IV3 5SA', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Eden+Court+Theatre+Inverness+IV3+5SA' },
    'epsom playhouse': { address: 'Ashley Avenue', city: 'Epsom', postcode: 'KT18 5AL', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Epsom+Playhouse+Epsom+KT18+5AL' },
    'ipswich regent theatre': { address: '3 St Helens Street', city: 'Ipswich', postcode: 'IP4 1HE', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ipswich+Regent+Theatre+IP4+1HE' },
    'ipswich regent': { address: '3 St Helens Street', city: 'Ipswich', postcode: 'IP4 1HE', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ipswich+Regent+Theatre+IP4+1HE' },
    'kingsholm stadium': { address: 'Kingsholm Road', city: 'Gloucester', postcode: 'GL1 3AX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kingsholm+Stadium+Gloucester+GL1+3AX' },
    'kingsholm': { address: 'Kingsholm Road', city: 'Gloucester', postcode: 'GL1 3AX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kingsholm+Stadium+Gloucester+GL1+3AX' },
    'lincoln engine shed': { address: 'Brayford Wharf', city: 'Lincoln', postcode: 'LN6 7TS', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Engine+Shed+Lincoln+LN6+7TS' },
    'engine shed': { address: 'Brayford Wharf', city: 'Lincoln', postcode: 'LN6 7TS', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Engine+Shed+Lincoln+LN6+7TS' },
    'milton keynes theatre': { address: '500 Marlborough Gate', city: 'Milton Keynes', postcode: 'MK9 3NZ', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Milton+Keynes+Theatre+MK9+3NZ' },
    'new theatre oxford': { address: '24-26 George Street', city: 'Oxford', postcode: 'OX1 2AG', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=New+Theatre+Oxford+OX1+2AG' },
    'new theatre peterborough': { address: '46 Broadway', city: 'Peterborough', postcode: 'PE1 1RS', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=New+Theatre+Peterborough+PE1+1RS' },
    'o2 academy glasgow': { address: '121 Eglinton Street', city: 'Glasgow', postcode: 'G5 9NT', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Academy+Glasgow+G5+9NT' },
    'o2 guildhall southampton': { address: 'West Marlands Road', city: 'Southampton', postcode: 'SO14 7LP', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=O2+Guildhall+Southampton+SO14+7LP' },
    'p&j live': { address: 'East Burn Road, Stoneywood', city: 'Aberdeen', postcode: 'AB21 9FX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=P%26J+Live+Aberdeen+AB21+9FX' },
    'plymouth pavilions': { address: 'Millbay Road', city: 'Plymouth', postcode: 'PL1 3LF', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Plymouth+Pavilions+PL1+3LF' },
    'preston guild hall': { address: 'Lancaster Road', city: 'Preston', postcode: 'PR1 1HT', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Preston+Guild+Hall+PR1+1HT' },
    'queen elizabeth hall': { address: 'Belvedere Road', city: 'London', postcode: 'SE1 8XX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Queen+Elizabeth+Hall+Southbank+Centre+London+SE1+8XX' },
    'clore ballroom': { address: 'Belvedere Road', city: 'London', postcode: 'SE1 8XX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Southbank+Centre+Belvedere+Road+London+SE1+8XX' },
    'royal festival hall': { address: 'Belvedere Road', city: 'London', postcode: 'SE1 8XX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Royal+Festival+Hall+Southbank+Centre+London+SE1+8XX' },
    'reading hexagon': { address: 'Queens Walk', city: 'Reading', postcode: 'RG1 7UA', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Reading+Hexagon+RG1+7UA' },
    'riverside stadium': { address: 'Middlehaven Way', city: 'Middlesbrough', postcode: 'TS3 6RS', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Riverside+Stadium+Middlesbrough+TS3+6RS' },
    'selhurst park': { address: 'Whitehorse Lane', city: 'London', postcode: 'SE25 6PU', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Selhurst+Park+SE25+6PU' },
    "st mary's stadium": { address: 'Britannia Road', city: 'Southampton', postcode: 'SO14 5FP', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=St+Marys+Stadium+Southampton+SO14+5FP' },
    'st marys stadium': { address: 'Britannia Road', city: 'Southampton', postcode: 'SO14 5FP', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=St+Marys+Stadium+Southampton+SO14+5FP' },
    'the glasshouse': { address: 'St Mary\'s Square, Gateshead Quays', city: 'Gateshead', postcode: 'NE8 2JR', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Glasshouse+Sage+Gateshead+NE8+2JR' },
    'sage gateshead': { address: 'St Mary\'s Square, Gateshead Quays', city: 'Gateshead', postcode: 'NE8 2JR', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sage+Gateshead+NE8+2JR' },
    'turf moor': { address: 'Harry Potts Way', city: 'Burnley', postcode: 'BB10 4BX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Turf+Moor+Burnley+BB10+4BX' },
    'victoria hall': { address: 'Bagnall Street', city: 'Stoke-on-Trent', postcode: 'ST1 3AD', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Victoria+Hall+Stoke-on-Trent+ST1+3AD' },
    'watford colosseum': { address: 'Rickmansworth Road', city: 'Watford', postcode: 'WD17 3JN', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Watford+Colosseum+WD17+3JN' },
    'westpoint arena': { address: 'Clyst St Mary', city: 'Exeter', postcode: 'EX5 1DJ', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Westpoint+Arena+Exeter+EX5+1DJ' },
    'york barbican': { address: 'Paragon Street', city: 'York', postcode: 'YO10 4AH', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=York+Barbican+York+YO10+4AH' },
    'norwich theatre royal': { address: 'Theatre Street', city: 'Norwich', postcode: 'NR2 1RL', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Norwich+Theatre+Royal+NR2+1RL' },
    'knebworth park': { address: 'Knebworth Park', city: 'Stevenage', postcode: 'SG1 2AX', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Knebworth+Park+Stevenage+SG1+2AX' },
    'blenheim palace': { address: 'Blenheim Palace', city: 'Woodstock', postcode: 'OX20 1UL', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Blenheim+Palace+Woodstock+OX20+1UL' },
};

function findVenueDetails(event) {
    if (!event) return null;
    function norm(s) { return s.toLowerCase().replace(/,/g, '').replace(/'/g, '').replace(/\s+/g, ' ').trim(); }
    function normKey(s) { return s.replace(/'/g, ''); }
    function matchDetails(name) {
        const n = norm(name);
        if (VENUE_DETAILS[n]) return VENUE_DETAILS[n];
        // Longest match wins (prevents sub-venue inheritance)
        let bestMatch = null;
        let bestLen = 0;
        for (const [canonical, details] of Object.entries(VENUE_DETAILS)) {
            const ck = normKey(canonical);
            if ((n.includes(ck) || ck.includes(n)) && ck.length > bestLen) {
                bestLen = ck.length;
                bestMatch = details;
            }
        }
        return bestMatch;
    }
    if (event['VENUE']) { const r = matchDetails(event['VENUE']); if (r) return r; }
    if (event['EVENT']) { const r = matchDetails(event['EVENT']); if (r) return r; }
    return null;
}
window.findVenueDetails = findVenueDetails;

/**
 * Find access features for an event (checks event name then venue name).
 * Returns array of feature keys or empty array.
 */
function findVenueAccessFeatures(event) {
    if (!event) return [];

    // Normalise: lowercase, strip commas and extra spaces
    function norm(s) { return s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim(); }

    // Helper: check a string against the access features map (longest match wins)
    function matchAccess(name) {
        const n = norm(name);
        if (VENUE_ACCESS_FEATURES[n]) return VENUE_ACCESS_FEATURES[n];
        let bestMatch = null;
        let bestLen = 0;
        for (const [canonical, features] of Object.entries(VENUE_ACCESS_FEATURES)) {
            if (n.includes(canonical) || canonical.includes(n)) {
                if (canonical.length > bestLen) {
                    bestLen = canonical.length;
                    bestMatch = features;
                }
            }
        }
        return bestMatch;
    }

    // 1. Try event name (touring shows like Circus Starr)
    if (event['EVENT']) {
        const result = matchAccess(event['EVENT']);
        if (result) return result;
    }

    // 2. Try venue name directly
    if (event['VENUE']) {
        const result = matchAccess(event['VENUE']);
        if (result) return result;
    }

    // 3. Resolve through VENUE_CONTACTS aliases (handles "O2 London", "Pudding Mill Lane", sub-venues etc.)
    var queries = [event['EVENT'] || '', event['VENUE'] || ''];
    for (var i = 0; i < queries.length; i++) {
        if (!queries[i]) continue;
        var matches = findMatchingVenues(queries[i]);
        if (matches.length > 0) {
            var result = matchAccess(matches[0].venueName);
            if (result) return result;
        }
    }

    return [];
}

/**
 * Render access feature icons as a centred row of icon pills (for event cards).
 * @param {Object} event - The event object
 * @param {number} [maxIcons] - Max icons to show before "+N" (0 or omit for all)
 * @param {string} [layout] - 'grid' for 2-column grid layout, default is inline row
 */
function renderAccessIcons(event, maxIcons, layout) {
    const features = findVenueAccessFeatures(event);
    if (features.length === 0) return '';

    const show = maxIcons ? features.slice(0, maxIcons) : features;
    const extra = maxIcons && features.length > maxIcons ? features.length - maxIcons : 0;

    const icons = show.map(f => {
        const def = ACCESS_FEATURE_DEFS[f];
        if (!def) return '';
        return `<span class="access-pill" title="${escapeHtml(def.label)}"><img src="${def.icon}" alt="${escapeHtml(def.label)}" class="access-pill-icon" width="20" height="20" loading="lazy"></span>`;
    }).join('');

    const moreTag = extra ? `<span class="access-pill access-pill-more">+${extra}</span>` : '';
    const cssClass = layout === 'grid' ? 'access-icons-row access-icons-grid' : 'access-icons-row';

    return `<div class="${cssClass}">${icons}${moreTag}</div>`;
}

/**
 * Render access features with icon + text labels (for modals).
 */
function renderAccessLabels(event) {
    const features = findVenueAccessFeatures(event);
    if (features.length === 0) return '';

    const labels = features.map(f => {
        const def = ACCESS_FEATURE_DEFS[f];
        if (!def) return '';
        return `<div class="access-label-pill"><img src="${def.icon}" alt="" class="access-label-icon" width="24" height="24"> ${escapeHtml(def.label)}</div>`;
    }).join('');

    return `<div class="access-labels-grid">${labels}</div>`;
}

// ========================================
// VENUE CONTACT DATABASE
// ========================================
// Venue contact details with VRS (Video Relay Service) as primary contact method
// BSL is users' main language, so VRS should be the default where available
const VENUE_CONTACTS = {
    // London - The O2
    'the o2': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'o2 arena': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'the o2 arena': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'the o2 arena, london': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'indigo at the o2': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'indigo at the o2, london': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },

    // London - Wembley (BSL interpretation provided at all events as standard)
    'wembley stadium': { email: 'accessforall@wembleystadium.com', vrs: 'https://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },
    'wembley': { email: 'accessforall@wembleystadium.com', vrs: 'https://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },
    'wembley stadium, london': { email: 'accessforall@wembleystadium.com', vrs: 'https://thefa.signvideo.net', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Wembley events as standard', bslGuaranteed: true },

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
    // Removed generic 'utilita arena' — use city-specific entries to avoid matching wrong venue

    // Newcastle
    'utilita arena newcastle': { email: 'access@utilitarena.co.uk' },

    // Leeds
    'first direct arena': { email: 'accessibility@firstdirectbankarena.com' },
    'first direct arena leeds': { email: 'accessibility@firstdirectbankarena.com' },

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
    'emirates stadium': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Arsenal home matches', bslGuaranteed: true },
    'emirates stadium, london': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Arsenal home matches', bslGuaranteed: true },
    'arsenal': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Arsenal home matches', bslGuaranteed: true },

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
    'ovo arena wembley': { email: 'customerservices@ovoarena.co.uk', paRefundEmail: 'boxoffice@ovoarena.co.uk', bookingSteps: [
        { step: 1, text: 'Purchase your tickets (including your PA ticket) from the event page or AXS box office.' },
        { step: 2, text: 'To get your PA ticket refunded, scan your proof of eligibility to boxoffice@ovoarena.co.uk with your order number and show name.' },
        { step: 3, text: 'Email customerservices@ovoarena.co.uk to let the Access Team know you need a BSL interpreter. Include your booking details and CC admin@performanceinterpreting.co.uk so we can follow up.' },
    ], note: 'OVO Arena requires you to buy your PA ticket and then apply for a refund separately. See booking steps below.' },
    'ovo arena, wembley': { email: 'customerservices@ovoarena.co.uk', paRefundEmail: 'boxoffice@ovoarena.co.uk', bookingSteps: [
        { step: 1, text: 'Purchase your tickets (including your PA ticket) from the event page or AXS box office.' },
        { step: 2, text: 'To get your PA ticket refunded, scan your proof of eligibility to boxoffice@ovoarena.co.uk with your order number and show name.' },
        { step: 3, text: 'Email customerservices@ovoarena.co.uk to let the Access Team know you need a BSL interpreter. Include your booking details and CC admin@performanceinterpreting.co.uk so we can follow up.' },
    ], note: 'OVO Arena requires you to buy your PA ticket and then apply for a refund separately. See booking steps below.' },
    'ovo arena, wembley, london': { email: 'customerservices@ovoarena.co.uk', paRefundEmail: 'boxoffice@ovoarena.co.uk', bookingSteps: [
        { step: 1, text: 'Purchase your tickets (including your PA ticket) from the event page or AXS box office.' },
        { step: 2, text: 'To get your PA ticket refunded, scan your proof of eligibility to boxoffice@ovoarena.co.uk with your order number and show name.' },
        { step: 3, text: 'Email customerservices@ovoarena.co.uk to let the Access Team know you need a BSL interpreter. Include your booking details and CC admin@performanceinterpreting.co.uk so we can follow up.' },
    ], note: 'OVO Arena requires you to buy your PA ticket and then apply for a refund separately. See booking steps below.' },
    'ovo wembley arena': { email: 'customerservices@ovoarena.co.uk', paRefundEmail: 'boxoffice@ovoarena.co.uk', bookingSteps: [
        { step: 1, text: 'Purchase your tickets (including your PA ticket) from the event page or AXS box office.' },
        { step: 2, text: 'To get your PA ticket refunded, scan your proof of eligibility to boxoffice@ovoarena.co.uk with your order number and show name.' },
        { step: 3, text: 'Email customerservices@ovoarena.co.uk to let the Access Team know you need a BSL interpreter. Include your booking details and CC admin@performanceinterpreting.co.uk so we can follow up.' },
    ], note: 'OVO Arena requires you to buy your PA ticket and then apply for a refund separately. See booking steps below.' },
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
    'london stadium': { email: 'accessibility@westhamunited.co.uk', note: 'BSL interpretation provided at all West Ham home matches', bslGuaranteed: true },
    'london stadium, london': { email: 'accessibility@westhamunited.co.uk', note: 'BSL interpretation provided at all West Ham home matches', bslGuaranteed: true },
    'west ham stadium': { email: 'accessibility@westhamunited.co.uk', note: 'BSL interpretation provided at all West Ham home matches', bslGuaranteed: true },

    // London - Stamford Bridge (Chelsea FC — PI provides BSL here)
    'stamford bridge': { email: 'access@chelseafc.com', note: 'BSL interpretation provided at all Chelsea home matches', bslGuaranteed: true },
    'stamford bridge, london': { email: 'access@chelseafc.com', note: 'BSL interpretation provided at all Chelsea home matches', bslGuaranteed: true },
    'chelsea': { email: 'access@chelseafc.com', note: 'BSL interpretation provided at all Chelsea home matches', bslGuaranteed: true },

    // London - O2 Academy Brixton
    // Touring Shows — Circus Starr (charity — FREE tickets for eligible families)
    'circus starr': { email: 'community@circus-starr.org.uk', note: 'Circus Starr provides FREE tickets for disabled, vulnerable, or additional-needs children and their families. You apply — you do not buy.', bookingSteps: [
        { step: 1, text: 'Visit circus-starr.org.uk/apply-for-tickets and fill in the application form.' },
        { step: 2, text: 'Tickets are allocated first-come first-served. You\'ll be contacted if successful.' },
        { step: 3, text: 'For group bookings (schools/organisations), email community@circus-starr.org.uk or call Jo on 01260 288690.' },
    ]},

    // London - O2 Shepherd's Bush Empire (Academy Music Group — Ticketmaster)
    "shepherd's bush empire": { email: 'access@o2shepherdsbushempire.co.uk' },
    "shepherds bush empire": { email: 'access@o2shepherdsbushempire.co.uk' },
    'o2 shepherds bush empire': { email: 'access@o2shepherdsbushempire.co.uk' },
    "o2 shepherd's bush empire": { email: 'access@o2shepherdsbushempire.co.uk' },
    "shepherd's bush empire, london": { email: 'access@o2shepherdsbushempire.co.uk' },
    "shepherds bush empire, london": { email: 'access@o2shepherdsbushempire.co.uk' },

    // London - Roundhouse (Camden)
    'roundhouse': { email: 'access@roundhouse.org.uk' },
    'roundhouse, london': { email: 'access@roundhouse.org.uk' },
    'the roundhouse': { email: 'access@roundhouse.org.uk' },
    'the roundhouse, london': { email: 'access@roundhouse.org.uk' },

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
    'emirates staduim': { email: '', vrs: 'https://arsenalfc.signvideo.net/', vrsLabel: 'SignVideo', note: 'BSL interpretation provided at all Arsenal home matches', bslGuaranteed: true },
    'london staduim': { email: 'accessibility@westhamunited.co.uk', note: 'BSL interpretation provided at all West Ham home matches', bslGuaranteed: true },
    'london staduim, london': { email: 'accessibility@westhamunited.co.uk', note: 'BSL interpretation provided at all West Ham home matches', bslGuaranteed: true },
    'copper cox arena': { email: 'copperboxarena@gll.org', note: 'Typo alias for Copper Box Arena' },
    'copper cox arena, london': { email: 'copperboxarena@gll.org', note: 'Typo alias for Copper Box Arena' },
    'man utd staduim old tafford manchester': { email: 'accessibility@manutd.co.uk', vrs: 'https://signvideo.co.uk/', vrsLabel: 'SignVideo', note: 'Typo alias for Old Trafford' },
    'o2 london': { email: 'access@theo2.co.uk', vrs: 'https://o2.signvideo.net', vrsLabel: 'SignVideo' },
    'edinburgh caste': { email: '' },
    'edinburgh caste, edinburgh': { email: '' },
    'knebworth park': { email: '' },
    'knebworth park, hertfordshire': { email: '' },
    'bournemouth pavilion': { email: 'access@bhlive.org.uk' },
    'victorious festival': { email: 'access@victoriousfestival.co.uk' },
    'portsmouth': { email: 'access@victoriousfestival.co.uk', note: 'Victorious Festival — contact their access team' },
    'leeds festival': { email: '', note: 'Leeds Festival uses a contact form — visit leedsfestival.com/info-category/accessibility' },
    'wetherby': { email: '', note: 'Leeds Festival — visit leedsfestival.com/info-category/accessibility' },
    'electric picnic': { email: '', note: 'Electric Picnic uses a contact form — visit electricpicnic.ie/accessibility-guide' },
    'laois': { email: '', note: 'Electric Picnic — visit electricpicnic.ie/accessibility-guide' },
    'gwr park': { email: '', note: 'GWR Park is a public space — contact the event organiser directly' },
    'gwr park swindon': { email: '', note: 'GWR Park — contact the event organiser directly' },

    // ---- Remaining venues from __VENUES database (auto-synced) ----

    // London
    'barbican centre': { email: 'access@barbican.org.uk' },
    'barbican centre, london': { email: 'access@barbican.org.uk' },
    'the barbican': { email: 'access@barbican.org.uk' },
    'london palladium': { email: 'access@lwtheatres.co.uk' },
    'london palladium, london': { email: 'access@lwtheatres.co.uk' },
    'the palladium': { email: 'access@lwtheatres.co.uk' },
    'tottenham hotspur stadium': { email: 'access@tottenhamhotspur.com', note: 'BSL interpretation provided at all Spurs home matches', bslGuaranteed: true },
    'tottenham hotspur stadium, london': { email: 'access@tottenhamhotspur.com', note: 'BSL interpretation provided at all Spurs home matches', bslGuaranteed: true },
    'spurs stadium': { email: 'access@tottenhamhotspur.com', note: 'BSL interpretation provided at all Spurs home matches', bslGuaranteed: true },
    'tottenham stadium': { email: 'access@tottenhamhotspur.com', note: 'BSL interpretation provided at all Spurs home matches', bslGuaranteed: true },
    'crystal palace national sports centre': { email: 'crystal.palace@gll.org' },
    'crystal palace national sports centre, london': { email: 'crystal.palace@gll.org' },
    'selhurst park': { email: 'dlo@cpfc.co.uk' },
    'selhurst park, london': { email: 'dlo@cpfc.co.uk' },
    'crystal palace fc': { email: 'dlo@cpfc.co.uk' },
    'craven cottage': { email: 'enquiries@fulhamfc.com', note: 'BSL interpretation provided at all Fulham home matches', bslGuaranteed: true },
    'craven cottage, london': { email: 'enquiries@fulhamfc.com', note: 'BSL interpretation provided at all Fulham home matches', bslGuaranteed: true },
    'fulham fc': { email: 'enquiries@fulhamfc.com', note: 'BSL interpretation provided at all Fulham home matches', bslGuaranteed: true },
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
    'anfield': { email: 'disability@liverpoolfc.com', note: 'BSL interpretation provided at all Liverpool home matches', bslGuaranteed: true },
    'anfield stadium': { email: 'disability@liverpoolfc.com', note: 'BSL interpretation provided at all Liverpool home matches', bslGuaranteed: true },
    'anfield, liverpool': { email: 'disability@liverpoolfc.com', note: 'BSL interpretation provided at all Liverpool home matches', bslGuaranteed: true },
    'liverpool fc': { email: 'disability@liverpoolfc.com', note: 'BSL interpretation provided at all Liverpool home matches', bslGuaranteed: true },
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

// ========================================
// SECURITY UTILITIES
// ========================================

/**
 * Escape HTML special characters to prevent XSS when inserting
 * external data (e.g. spreadsheet fields) into innerHTML templates.
 */
function isSafeUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch { return false; }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const VENUE_IMAGES = {
    // Football stadiums
    'emirates stadium': 'https://media.performanceinterpreting.co.uk/venues/emirates-stadium.png',
    'stamford bridge':  'https://media.performanceinterpreting.co.uk/venues/stamford-bridge.jpg',
    'london stadium':   'https://media.performanceinterpreting.co.uk/venues/london-stadium.jpg',
    'tottenham hotspur stadium': 'https://media.performanceinterpreting.co.uk/venues/tottenham-stadium.webp',
    'craven cottage':   'https://media.performanceinterpreting.co.uk/venues/craven-cottage.jpg',
    'wembley':          'https://images.unsplash.com/photo-1589459072535-7944dfd15820?w=800&h=400&fit=crop',
    'anfield':          'https://images.unsplash.com/photo-1622467931655-4ea35e6e547e?w=800&h=400&fit=crop',
    // Concert venues
    'the o2 arena':     'https://media.performanceinterpreting.co.uk/venues/o2-arena.jpg',
    'the o2,':          'https://media.performanceinterpreting.co.uk/venues/o2-arena.jpg',
    'indigo at the o2': 'https://media.performanceinterpreting.co.uk/venues/o2-arena.jpg',
    'o2 academy':       'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'o2 apollo':        'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'o2 victoria':      'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'roundhouse':       'https://media.performanceinterpreting.co.uk/venues/roundhouse.jpg',
    'royal albert hall': 'https://media.performanceinterpreting.co.uk/venues/royal-albert-hall.jpg',
    'eventim apollo':   'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'first direct arena': 'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'bp pulse live':    'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'utilita arena':    'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    '3arena':           'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    "shepherd's bush empire": 'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
    'southbank':        'https://media.performanceinterpreting.co.uk/venues/concert-arena.jpg',
};

function getDefaultImage(event) {
    var venue = (event['VENUE'] || '').toLowerCase().trim();
    for (var key in VENUE_IMAGES) {
        if (venue.indexOf(key) >= 0) return VENUE_IMAGES[key];
    }
    var cat = (event['CATEGORY'] || event['Category'] || event['category'] || '').toLowerCase().trim();
    return (CONFIG.categoryImages && CONFIG.categoryImages[cat]) || CONFIG.defaultImage;
}

/**
 * Image error handler for event cards.
 * Tries the fallback category/venue image first.
 * If that also fails (e.g. offline), replaces the img element with a
 * styled offline placeholder so users see a clear message instead of
 * a broken-image icon.
 */
function handleEventImageError(img, fallbackSrc) {
    img.onerror = function() {
        // Fallback also failed — show offline placeholder
        img.onerror = null;
        const placeholder = document.createElement('div');
        placeholder.className = 'event-img-offline';
        placeholder.innerHTML = '<span>🖼️</span><p>Image unavailable offline</p>';
        img.parentNode.replaceChild(placeholder, img);
    };
    img.src = fallbackSrc;
}
window.handleEventImageError = handleEventImageError;

/**
 * Escape ICS text values per RFC 5545 Section 3.3.11.
 * Backslash-escapes semicolons, commas, and backslashes;
 * replaces literal newlines with escaped \n.
 */
function escapeICS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Safely encode an object as a JSON string for use in an HTML attribute.
 * Escapes characters that could break out of the attribute or HTML context.
 */
function safeJsonAttr(obj) {
    return JSON.stringify(obj)
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function safeJsonDataAttr(obj) {
    return JSON.stringify(obj)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ========================================
// ACCESSIBILITY - MODAL FOCUS TRAP
// ========================================

let _focusTrapCleanup = null;

/**
 * Trap keyboard focus inside a modal element.
 * Call activateFocusTrap(modalEl) when opening, deactivateFocusTrap() when closing.
 */
function activateFocusTrap(modalEl) {
    deactivateFocusTrap();
    const focusable = modalEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    function trapHandler(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    modalEl.addEventListener('keydown', trapHandler);
    _focusTrapCleanup = () => modalEl.removeEventListener('keydown', trapHandler);
}

function deactivateFocusTrap() {
    if (_focusTrapCleanup) {
        _focusTrapCleanup();
        _focusTrapCleanup = null;
    }
}

// ========================================
// ACCESSIBILITY - MODAL FOCUS RESTORE (A11Y-03)
// ========================================

let _modalTriggerEl = null;

function storeModalTrigger() {
    _modalTriggerEl = document.activeElement;
}

function restoreModalFocus() {
    if (_modalTriggerEl && typeof _modalTriggerEl.focus === 'function') {
        _modalTriggerEl.focus();
        _modalTriggerEl = null;
    }
}

// ========================================
// ACCESSIBILITY - MODAL HISTORY STATE (A11Y-04)
// ========================================

let _activeModalId = null;
let _activeModalCloseFn = null;

function pushModalState(modalId, closeFn) {
    _activeModalId = modalId;
    _activeModalCloseFn = closeFn;
    history.pushState({ modal: modalId }, '');
}

function clearModalState() {
    _activeModalId = null;
    _activeModalCloseFn = null;
}

window.addEventListener('popstate', function(e) {
    if (_activeModalCloseFn) {
        const closeFn = _activeModalCloseFn;
        clearModalState();
        closeFn();
    }
});

// Expose accessibility helpers for inline scripts and notifications.js
window.activateFocusTrap = activateFocusTrap;
window.deactivateFocusTrap = deactivateFocusTrap;
window.storeModalTrigger = storeModalTrigger;
window.restoreModalFocus = restoreModalFocus;
window.pushModalState = pushModalState;
window.clearModalState = clearModalState;

/**
 * Find all matching venues from database
 * Returns array of { venueName, email, vrs, vrsLabel } objects
 */
function findMatchingVenues(query) {
    if (!query || query.trim() === '') return [];

    const queryLower = query.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
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
            return `<button type="button" class="venue-match-btn" data-email="${escapeHtml(m.email)}" data-venue="${escapeHtml(displayName)}" data-vrs="${escapeHtml(m.vrs || '')}" data-vrs-label="${escapeHtml(m.vrsLabel || '')}">${escapeHtml(displayName)}${vrsIndicator}</button>`;
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
                                <img src="signvideo-logo.png" alt="" style="height:28px;width:28px;border-radius:8px;object-fit:cover;"> Use ${vrsLabel} (Recommended for BSL users)
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
 * Store the search query so it can be used to pre-fill the request form
 */
function storeSearchQuery(query) {
    window._lastSearchQuery = query;
}

/**
 * Pre-fill the request form from URL parameters
 */
function prefillRequestForm() {
    const hash = window.location.hash;
    if (!hash.includes('/flow3')) return;

    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const params = queryString ? new URLSearchParams(queryString) : new URLSearchParams();

    const eventInput = document.getElementById('eventName');
    const venueInput = document.getElementById('venueName');
    const dateInput = document.getElementById('eventDate');

    // Pre-fill from URL params (from event card)
    if (eventInput && params.get('event')) eventInput.value = params.get('event');
    if (venueInput && params.get('venue')) {
        venueInput.value = params.get('venue');
        // Trigger venue lookup, then auto-select if single match
        if (typeof findMatchingVenues === 'function') {
            venueInput.dispatchEvent(new Event('input'));
            // After debounce (300ms), auto-click the first match if there's exactly one
            setTimeout(() => {
                const matchesEl = document.getElementById('venueMatches');
                if (matchesEl) {
                    const btns = matchesEl.querySelectorAll('.venue-match-btn');
                    if (btns.length === 1) {
                        btns[0].click();
                    }
                }
            }, 450);
        }
    }
    if (dateInput && params.get('date')) {
        const parts = params.get('date').split('.');
        if (parts.length === 3) {
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            dateInput.value = `${year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
    }

    // Fallback: if no event param but we have a stored search query, use that
    if (eventInput && !eventInput.value && window._lastSearchQuery) {
        eventInput.value = window._lastSearchQuery;
        window._lastSearchQuery = '';
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

// ========================================
// FESTIVAL ACCESS INFO
// ========================================
const FESTIVAL_ACCESS_INFO = {
    'download festival': {
        tickets: 'https://downloadfestival.co.uk/tickets/',
        accessInfo: 'https://downloadfestival.co.uk/info-category/accessibility/',
        accessForm: 'https://downloadfest.zendesk.com/hc/en-gb/requests/new?ticket_form_id=38261467547149',
        contact: 'accessibility@downloadfestival.co.uk',
    },
    'leeds festival': {
        tickets: 'https://leedsfestival.com/tickets/',
        accessInfo: 'https://leedsfestival.com/info-category/accessibility/',
        accessForm: 'https://leeds-festival.zendesk.com/hc/en-gb/requests/new?ticket_form_id=40758980446605',
    },
    'reading festival': {
        tickets: 'https://readingfestival.com/tickets/',
        accessInfo: 'https://readingfestival.com/info-category/accessibility/',
        accessForm: 'https://reading-festival.zendesk.com/hc/en-gb/requests/new?ticket_form_id=41017772334733',
    },
    'latitude festival': {
        tickets: 'https://www.latitudefestival.com/tickets/',
        accessInfo: 'https://www.latitudefestival.com/information-category/accessibility/',
        accessForm: 'https://latitude-festival.zendesk.com/hc/en-gb/requests/new?ticket_form_id=40579402755853',
    },
    'victorious festival': {
        tickets: 'https://www.victoriousfestival.co.uk/buy-tickets/',
        accessInfo: 'https://www.victoriousfestival.co.uk/accessibility-at-victorious/',
        accessForm: 'https://form.jotform.com/252823631518356',
        contact: 'access@victoriousfestival.co.uk',
    },
    'brighton pride': {
        tickets: 'https://prideonthepark.co.uk/tickets/',
        accessInfo: 'https://brighton-pride.org/access',
        accessForm: 'https://privacyportal.onetrust.com/webform/c7968fb5-dd42-4c76-8f79-3e5198bd1303/draft/c5e1b5e6-25e1-445a-a71d-4dc1d33252d4',
        contact: 'access@brighton-pride.org',
    },
    'electric picnic': {
        tickets: 'https://www.electricpicnic.ie/tickets/',
        accessInfo: 'https://www.electricpicnic.ie/information-category/accessibility',
        accessForm: 'https://electric-picnic.zendesk.com/hc/en-gb/requests/new?ticket_form_id=20424234745357',
    },
    'roundhay festival': {
        tickets: 'https://www.roundhayfestival.com/',
        accessInfo: 'https://roundhayfestival.com/info-details/accessibility',
        accessForm: 'https://privacyportal.onetrust.com/webform/c7968fb5-dd42-4c76-8f79-3e5198bd1303/e40f6641-25c7-43f6-8f3c-69c7197ab167',
        contact: 'access@roundhayfestival.com',
    },
    'reading pride': {
        tickets: 'https://readingpride.co.uk/',
        accessInfo: null,
        accessForm: null,
    },
    'swindon pride': {
        tickets: null,
        accessInfo: null,
        accessForm: null,
    },
};

function isFestivalEvent(event) {
    var cat = (event['CATEGORY'] || '').toLowerCase();
    return cat.includes('festival');
}

// ========================================
// "I'M GOING" — Festival tracking for deadline notifications
// ========================================

function getGoingFestivals() {
    return JSON.parse(localStorage.getItem('pi-going-festivals') || '[]');
}

function isGoingToFestival(eventName) {
    var key = normaliseFestivalKey(eventName);
    return getGoingFestivals().includes(key);
}

function toggleGoingFestival(eventName) {
    var key = normaliseFestivalKey(eventName);
    var going = getGoingFestivals();
    var idx = going.indexOf(key);
    if (idx >= 0) {
        going.splice(idx, 1);
    } else {
        going.push(key);
    }
    localStorage.setItem('pi-going-festivals', JSON.stringify(going));
    // Update push registration with new going list
    updatePushGoingList(going);
    return idx < 0; // returns true if now going
}

function normaliseFestivalKey(name) {
    return (name || '').toLowerCase()
        .replace(/\s*(20\d{2})\b/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function updatePushGoingList(going) {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
    var token = window._nativePushToken || localStorage.getItem('pi-push-token');
    if (!token) return;
    var platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'unknown';
    var prefs = JSON.parse(localStorage.getItem('pi-notification-preferences') || '{}');
    fetch(NOTIFICATION_CONFIG.apiBase + '/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: token,
            platform: platform,
            preferences: prefs,
            goingTo: going,
            appVersion: NOTIFICATION_CONFIG.appVersion,
            userType: localStorage.getItem('pi-user-type') || 'deaf'
        })
    }).catch(function(e) { console.log('Going list update failed:', e); });
}

function buildGoingButton(event, style) {
    var name = event['EVENT'] || '';
    var isGoing = isGoingToFestival(name);
    var btnClass = style === 'compact' ? 'compact-btn' : (style === 'list' ? 'list-btn' : 'btn-primary');
    var bg = isGoing ? '#059669' : 'transparent';
    var color = isGoing ? '#fff' : '#059669';
    var border = isGoing ? '#059669' : '#059669';
    var opacity = isGoing ? '1' : '0.7';
    var label = isGoing ? '✅ I\'m Going' : '🎟️ Going?';
    var safeEvent = escapeHtml(name).replace(/'/g, '&#39;');
    return '<button onclick="handleGoingToggle(this, \'' + safeEvent + '\')" class="' + btnClass + '" style="flex:1;margin-top:6px;background:' + bg + ';border:2px solid ' + border + ';color:' + color + ';opacity:' + opacity + ';">' + label + '</button>';
}

function handleGoingToggle(btn, eventName) {
    var decoded = eventName.replace(/&#39;/g, "'");
    var nowGoing = toggleGoingFestival(decoded);
    btn.style.background = nowGoing ? '#ECFDF5' : '#fff';
    btn.style.borderColor = nowGoing ? '#059669' : '#D1D5DB';
    btn.style.color = nowGoing ? '#059669' : '#6B7280';
    btn.style.opacity = nowGoing ? '1' : '0.7';
    btn.style.fontWeight = nowGoing ? '700' : '600';
    btn.textContent = nowGoing ? "✅ I'm Going" : "🎟️ Going?";
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
    if (typeof showToast === 'function') {
        showToast(nowGoing ? 'You\'ll get access form reminders for this festival' : 'Removed from your festivals');
    }
}

window.handleGoingToggle = handleGoingToggle;

// ========================================
// "INTERESTED" — Event tracking for all events
// ========================================

function getInterestedEvents() {
    return JSON.parse(localStorage.getItem('pi-interested-events') || '[]');
}

function isInterestedInEvent(eventName, eventDate) {
    var key = makeEventKey(eventName, eventDate);
    return getInterestedEvents().some(function(e) { return e.key === key; });
}

function toggleInterestedEvent(eventName, eventDate, eventVenue, eventCategory) {
    var key = makeEventKey(eventName, eventDate);
    var events = getInterestedEvents();
    var idx = events.findIndex(function(e) { return e.key === key; });
    if (idx >= 0) {
        events.splice(idx, 1);
    } else {
        events.push({ key: key, name: eventName, date: eventDate, venue: eventVenue, category: eventCategory, addedAt: new Date().toISOString() });
    }
    localStorage.setItem('pi-interested-events', JSON.stringify(events));
    return idx < 0; // true if now interested
}

function makeEventKey(name, date) {
    return ((name || '') + '|' + (date || '')).toLowerCase();
}

function handleInterestedToggle(btn, eventName, eventDate, eventVenue, eventCategory) {
    var decoded = { name: eventName.replace(/&#39;/g, "'"), date: eventDate, venue: eventVenue.replace(/&#39;/g, "'"), category: eventCategory };
    var nowInterested = toggleInterestedEvent(decoded.name, decoded.date, decoded.venue, decoded.category);
    btn.classList.toggle('interested-active', nowInterested);
    btn.querySelector('.interested-label').textContent = nowInterested ? 'Interested' : 'Interested?';
    btn.querySelector('.interested-icon').textContent = nowInterested ? '❤️' : '🤍';
    btn.style.opacity = nowInterested ? '1' : '0.7';
    btn.style.background = nowInterested ? '#FEF2F2' : '#fff';
    btn.style.borderColor = nowInterested ? '#EF4444' : '#D1D5DB';
    btn.style.color = nowInterested ? '#DC2626' : '#6B7280';
    btn.style.fontWeight = nowInterested ? '700' : '600';
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

window.handleInterestedToggle = handleInterestedToggle;

// ========================================
// "GOING" — for ALL events (extends festival going)
// ========================================

function getGoingEvents() {
    return JSON.parse(localStorage.getItem('pi-going-events') || '[]');
}

function isGoingToEvent(eventName, eventDate) {
    var key = makeEventKey(eventName, eventDate);
    return getGoingEvents().some(function(e) { return e.key === key; });
}

function toggleGoingEvent(eventName, eventDate, eventVenue, eventCategory) {
    var key = makeEventKey(eventName, eventDate);
    var events = getGoingEvents();
    var idx = events.findIndex(function(e) { return e.key === key; });
    if (idx >= 0) {
        events.splice(idx, 1);
    } else {
        events.push({ key: key, name: eventName, date: eventDate, venue: eventVenue, category: eventCategory, addedAt: new Date().toISOString() });
    }
    localStorage.setItem('pi-going-events', JSON.stringify(events));

    // Also update festival going list if this is a festival
    if ((eventCategory || '').toLowerCase().includes('festival')) {
        var festKey = normaliseFestivalKey(eventName);
        var festGoing = getGoingFestivals();
        var festIdx = festGoing.indexOf(festKey);
        if (idx >= 0 && festIdx >= 0) {
            festGoing.splice(festIdx, 1);
        } else if (idx < 0 && festIdx < 0) {
            festGoing.push(festKey);
        }
        localStorage.setItem('pi-going-festivals', JSON.stringify(festGoing));
        updatePushGoingList(festGoing);
    }

    return idx < 0;
}

function handleGoingToggleAll(btn, eventName, eventDate, eventVenue, eventCategory) {
    var name = eventName.replace(/&#39;/g, "'");
    var venue = eventVenue.replace(/&#39;/g, "'");
    var nowGoing = toggleGoingEvent(name, eventDate, venue, eventCategory);
    btn.style.background = nowGoing ? '#ECFDF5' : '#fff';
    btn.style.borderColor = nowGoing ? '#059669' : '#D1D5DB';
    btn.style.color = nowGoing ? '#059669' : '#6B7280';
    btn.style.opacity = nowGoing ? '1' : '0.7';
    btn.style.fontWeight = nowGoing ? '700' : '600';
    btn.textContent = nowGoing ? "✅ I'm Going" : "🎟️ Going?";
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

window.handleGoingToggleAll = handleGoingToggleAll;

/**
 * Handle Interested/Going from data attributes (avoids escaping issues).
 * Also syncs state between card and modal buttons.
 */
function handleInterestedFromData(btn) {
    var evt = JSON.parse(btn.dataset.eventJson || '{}');
    var nowInterested = toggleInterestedEvent(evt['EVENT'], evt['DATE'], evt['VENUE'], evt['CATEGORY']);
    updateInterestedUI(btn, nowInterested);
    syncAllInterestedButtons(evt['EVENT'], evt['DATE'], nowInterested);
    refreshMyEventsIfOpen();
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

function handleGoingFromData(btn) {
    var evt = JSON.parse(btn.dataset.eventJson || '{}');
    var nowGoing = toggleGoingEvent(evt['EVENT'], evt['DATE'], evt['VENUE'], evt['CATEGORY']);
    updateGoingUI(btn, nowGoing);
    syncAllGoingButtons(evt['EVENT'], evt['DATE'], nowGoing);
    refreshMyEventsIfOpen();
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

function updateInterestedUI(btn, active) {
    var icon = btn.querySelector('.interested-icon');
    var label = btn.querySelector('.interested-label');
    if (icon) icon.textContent = active ? '❤️' : '🤍';
    if (label) label.textContent = active ? 'Interested' : 'Interested?';
    btn.style.background = active ? '#FEF2F2' : 'transparent';
    btn.style.color = active ? '#DC2626' : '#9CA3AF';
    btn.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
    btn.style.borderColor = active ? '#FCA5A5' : 'transparent';
}

function updateGoingUI(btn, active) {
    var icon = btn.querySelector('.going-icon');
    var label = btn.querySelector('.going-label');
    if (icon) icon.textContent = active ? '✅' : '🎟️';
    if (label) label.textContent = active ? "I'm Going" : 'Going?';
    btn.style.background = active ? '#ECFDF5' : 'transparent';
    btn.style.color = active ? '#059669' : '#9CA3AF';
    btn.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
    btn.style.borderColor = active ? '#A7F3D0' : 'transparent';
}

function refreshMyEventsIfOpen() {
    var eventsContent = document.getElementById('myEventsDrawerContent');
    if (eventsContent && eventsContent.style.display !== 'none') {
        renderMyEvents();
    }
}

function syncAllInterestedButtons(eventName, eventDate, active) {
    document.querySelectorAll('[data-action="interested"]').forEach(function(b) {
        try {
            var d = JSON.parse(b.dataset.eventJson || '{}');
            if (d['EVENT'] === eventName && d['DATE'] === eventDate) updateInterestedUI(b, active);
        } catch(e) {}
    });
    // Also sync modal pill buttons
    var modalBtns = document.getElementById('accessFirstMyEventBtns');
    if (modalBtns) {
        var intBtn = modalBtns.querySelector('.interested-icon');
        if (intBtn) {
            var parent = intBtn.closest('button');
            if (parent) {
                var pIcon = parent.querySelector('.interested-icon');
                var pLabel = parent.querySelector('.interested-label');
                if (pIcon) pIcon.textContent = active ? '❤️' : '🤍';
                if (pLabel) pLabel.textContent = active ? 'Interested' : 'Interested?';
                parent.style.borderColor = active ? '#EF4444' : '#D1D5DB';
                parent.style.background = active ? '#FEF2F2' : '#fff';
                parent.style.color = active ? '#DC2626' : '#6B7280';
                parent.style.opacity = active ? '1' : '0.7';
            }
        }
    }
}

function syncAllGoingButtons(eventName, eventDate, active) {
    document.querySelectorAll('[data-action="going"]').forEach(function(b) {
        try {
            var d = JSON.parse(b.dataset.eventJson || '{}');
            if (d['EVENT'] === eventName && d['DATE'] === eventDate) updateGoingUI(b, active);
        } catch(e) {}
    });
}

window.handleInterestedFromData = handleInterestedFromData;
window.handleGoingFromData = handleGoingFromData;

function getFestivalAccessInfo(event) {
    var name = (event['EVENT'] || '').toLowerCase();
    for (var key in FESTIVAL_ACCESS_INFO) {
        if (name.indexOf(key) >= 0) {
            return FESTIVAL_ACCESS_INFO[key];
        }
    }
    return null;
}

function buildEventActionButton(event, badge, style) {
    var btnClass = style === 'compact' ? 'compact-btn' : (style === 'list' ? 'list-btn' : 'btn-primary');
    var btnClassOrange = style === 'compact' ? 'compact-btn compact-btn-orange' : (style === 'list' ? 'list-btn list-btn-orange' : 'btn-orange');
    var eventJson = safeJsonAttr(event);

    // Festival events get special treatment — BUT festivals at known venues (e.g. The O2)
    // should use the venue's access system instead of the generic festival path
    if (isFestivalEvent(event)) {
        var festInfo = getFestivalAccessInfo(event);

        if (festInfo) {
            // Festival has dedicated access info — use festival-specific buttons
            var ticketUrl = festInfo.tickets || event['EVENT URL'] || '#';
            var buttons = `<a href="${escapeHtml(ticketUrl)}" target="_blank" rel="noopener" class="${btnClass}" style="text-decoration:none;text-align:center;">🎟️ Book Tickets</a>`;

            if (festInfo.accessForm) {
                buttons += `<a href="${escapeHtml(festInfo.accessForm)}" target="_blank" rel="noopener" class="${btnClass}" style="text-decoration:none;text-align:center;margin-top:6px;background:#7C3AED;border-color:#7C3AED;">♿ Access Form</a>`;
            } else if (festInfo.accessInfo) {
                buttons += `<a href="${escapeHtml(festInfo.accessInfo)}" target="_blank" rel="noopener" class="${btnClass}" style="text-decoration:none;text-align:center;margin-top:6px;background:#7C3AED;border-color:#7C3AED;">♿ Accessibility Info</a>`;
            }

            return buttons;
        }

        // No festival-specific info — check if venue has contact info
        // If so, fall through to regular venue logic (e.g. O2, Wembley)
        var venueFallback = findMatchingVenues(event['VENUE'] || '');
        var venueHasContact = venueFallback.length > 0 && (venueFallback[0].vrs || venueFallback[0].email);
        if (!venueHasContact) {
            // Unknown venue festival — generic ticket button
            var ticketUrl = event['EVENT URL'] || '#';
            return `<a href="${escapeHtml(ticketUrl)}" target="_blank" rel="noopener" class="${btnClass}" style="text-decoration:none;text-align:center;">🎟️ Book Tickets</a>`;
        }
        // Venue has access info — fall through to regular badge-aware logic below
    }

    if (badge.canBook) {
        return `<button class="${btnClass}" onclick='openAccessFirstModal(${eventJson})' style="background:linear-gradient(135deg,#22C55E,#16A34A);border-color:#16A34A;color:#fff;">🎟️ Book Accessible Tickets</button>`;
    }

    // Check event name first (touring shows like Circus Starr), then venue
    var resolvedMatches = findMatchingVenues(event['EVENT'] || '');
    if (resolvedMatches.length === 0) resolvedMatches = findMatchingVenues(event['VENUE'] || '');
    var hasVenueInfo = resolvedMatches.length > 0 && (resolvedMatches[0].vrs || resolvedMatches[0].email);

    if (hasVenueInfo) {
        return `<button class="${btnClassOrange}" onclick='openRequestBSLModal(${eventJson})'>✉️ Request Interpreter</button>`;
    }
    return `<a href="${buildRequestInterpreterUrl(event)}" class="${btnClassOrange}">✉️ Request Interpreter</a>`;
}

/**
 * Open the appropriate booking modal for an event (used by tappable cards)
 */
function openEventModal(event) {
    var badge = calculateBadgeStatus(event);
    if (badge.canBook) {
        openAccessFirstModal(event);
    } else {
        var resolvedMatches = findMatchingVenues(event['EVENT'] || '');
        if (resolvedMatches.length === 0) resolvedMatches = findMatchingVenues(event['VENUE'] || '');
        var hasVenueInfo = resolvedMatches.length > 0 && (resolvedMatches[0].vrs || resolvedMatches[0].email);
        if (hasVenueInfo) {
            openRequestBSLModal(event);
        } else {
            openAccessFirstModal(event);
        }
    }
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

    // 🟢 GREEN: Festival team confirmed but not yet named
    const isTeamTBA = interpreterLower === 'bsl team tba' || interpreterLower === 'isl team tba';
    if (isTeamTBA) {
        return {
            badge: 'green',
            icon: '✅',
            label: `${language} Team TBA`,
            shortLabel: `${language} Team TBA`,
            action: 'book-tickets',
            message: `${language} interpretation confirmed for this event. Interpreting team to be announced.`,
            canBook: true,
            language: language
        };
    }

    // For multi-date grouped events, derive badge from all individual date statuses
    if (event.isGrouped && event.allDates && event.allDates.length > 1) {
        let confirmedCount = 0, tbcCount = 0;
        for (const d of event.allDates) {
            const interp = (d.interpreters || '').trim().toLowerCase();
            if (interp && interp !== 'tbc' && interp !== 'to be confirmed' && interp !== 'request interpreter') {
                confirmedCount++; // named interpreter, venue standard, team tba, etc.
            } else if (interp === 'tbc' || interp === 'to be confirmed') {
                tbcCount++;
            }
        }
        const total = event.allDates.length;
        if (confirmedCount === total) {
            return {
                badge: 'green', icon: '✅',
                label: 'All Dates Booked',
                shortLabel: `${language} Interpreted`,
                action: 'book-tickets',
                message: `${language} interpretation confirmed for all ${total} dates`,
                canBook: true, language: language
            };
        }
        if (confirmedCount > 0) {
            return {
                badge: 'orange', icon: '🟠',
                label: `${confirmedCount} of ${total} Dates`,
                shortLabel: `${language} Partial`,
                action: 'book-tickets',
                message: `${language} interpretation confirmed for ${confirmedCount} of ${total} dates — check individual dates`,
                canBook: true, language: language
            };
        }
        if (tbcCount > 0) {
            return {
                badge: 'orange', icon: '🟠',
                label: 'All Dates TBC',
                shortLabel: `${language} TBC`,
                action: 'request-interpreter',
                message: `${language} interpretation to be confirmed for all ${total} dates`,
                canBook: false, language: language
            };
        }
        // No interpreter on any date — fall through to red
    }

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
        selectedDate: '',
        interpretation: 'all',
        category: 'all',
        location: 'all',
        accessibility: []  // Array of required accessibility features
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
        datePicker: document.getElementById('datePicker'),
        dateFilter: document.getElementById('dateFilter'),
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

/**
 * Format a time string to 12hr am/pm (e.g. "7:30pm").
 * Handles: "19:00", "7pm", "3.00pm", "11:30", "4.45 & 7pm", "2 Days", etc.
 * Returns the original string if not parseable as a time.
 */
function formatTime(timeStr) {
    if (!timeStr) return '';
    const s = timeStr.trim();

    // Already has am/pm — just clean it up
    const ampmMatch = s.match(/^(\d{1,2})[.:]?(\d{2})?\s*(am|pm)$/i);
    if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = ampmMatch[2] || '00';
        const p = ampmMatch[3].toLowerCase();
        return m === '00' ? `${h}${p}` : `${h}:${m}${p}`;
    }

    // 24hr format like "19:00" or "11:30" or "18.30"
    const h24Match = s.match(/^(\d{1,2})[.:](\d{2})$/);
    if (h24Match) {
        let h = parseInt(h24Match[1], 10);
        const m = h24Match[2];
        let period;
        if (h === 0) { h = 12; period = 'am'; }
        else if (h >= 13 && h <= 23) { h -= 12; period = 'pm'; } // unambiguous 24hr
        else if (h === 12) { period = 'pm'; }
        else { period = 'pm'; } // 1-11 without am/pm — events default to pm
        return m === '00' ? `${h}${period}` : `${h}:${m}${period}`;
    }

    // Just a number like "7" — not enough info, return as-is
    return s;
}

/**
 * Extract and format the start time from an event's TIME field.
 * Splits ranges like "19:00 - 23:00" and formats the start time.
 */
function formatEventTime(event) {
    if (!event || !event['TIME']) return '';
    const raw = event['TIME'].split(' - ')[0].split('-')[0].trim();
    return formatTime(raw);
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
 * Handles DD.MM.YY, DD/MM/YY, DD-MM-YY and YYYY variants via formatDate
 */
function parseDateString(dateStr) {
    if (!dateStr) return null;
    // Handle date ranges - take first date
    if (dateStr.includes(' - ')) {
        dateStr = dateStr.split(' - ')[0];
    }
    const parsed = formatDate(dateStr.toString().trim());
    // formatDate returns day === '--' on failure
    if (parsed.day === '--') return null;
    return parsed.dateObj;
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

/**
 * Builds the "All Dates" block for multi-night events in modals.
 * Shows each date with its interpreter confirmation status.
 * scheme: 'green' | 'orange'
 */
function buildMultiDateHtml(allDates, scheme) {
    const isGreen = scheme !== 'orange';
    const bg     = isGreen ? '#F0FDF4' : '#FFF7ED';
    const border = isGreen ? '#BBF7D0' : '#FDBA74';
    const head   = isGreen ? '#065F46' : '#9A3412';
    const pillBg = isGreen ? '#ECFDF5' : '#FFFBEB';
    const pillFg = isGreen ? '#065F46' : '#92400E';

    const rows = allDates.map(function(d) {
        const interpText  = (d.interpreters || '').trim();
        const interpLower = interpText.toLowerCase();
        const isConfirmed = interpText &&
            interpLower !== 'tbc' &&
            interpLower !== 'to be confirmed' &&
            interpLower !== 'request interpreter';
        const isTbc = interpLower === 'tbc' || interpLower === 'to be confirmed';
        const interpLine = isConfirmed
            ? '<span style="font-size:11px;font-weight:600;color:#065F46;display:block;margin-top:2px;">✅ ' + escapeHtml(interpText) + '</span>'
            : isTbc
            ? '<span style="font-size:11px;font-weight:600;color:#92400E;display:block;margin-top:2px;">🟠 TBC</span>'
            : '<span style="font-size:11px;color:#9CA3AF;display:block;margin-top:2px;">Not yet booked</span>';
        return '<div style="padding:8px 12px;border-radius:8px;background:' + pillBg + ';border:1px solid ' + border + ';">' +
            '<span style="font-size:13px;font-weight:700;color:' + pillFg + ';">📅 ' + escapeHtml(d.day) + ' ' + escapeHtml(d.month) + '</span>' +
            (d.time ? '<span style="font-size:12px;color:' + pillFg + ';margin-left:6px;">· ' + escapeHtml(d.time) + '</span>' : '') +
            interpLine +
            '</div>';
    }).join('');

    return '<div style="margin:0 0 8px;padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;">' +
        '<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:' + head + ';text-transform:uppercase;letter-spacing:0.5px;text-align:center;">All Dates</p>' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' + rows + '</div>' +
        '</div>';
}

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

    // Action button - festivals get Book Tickets + Access Form, others get existing logic
    const primaryButton = buildEventActionButton(event, badge, 'full');

    // Build expandable dates section for multi-date events
    let expandableDates = '';
    if (isGrouped) {
        const datesList = event.allDates.map(d => `
            <div class="expandable-date-item">
                <span class="date-item-date">📅 ${escapeHtml(d.day)} ${escapeHtml(d.month)}</span>
                ${d.time ? `<span class="date-item-time">🕐 ${escapeHtml(d.time)}</span>` : ''}
                ${d.interpreters ? `<span class="date-item-interpreters">👥 ${escapeHtml(d.interpreters)}</span>` : ''}
            </div>
        `).join('');

        expandableDates = `
            <div class="multi-date-section">
                <button class="multi-date-toggle" onclick="event.stopPropagation();toggleDates('${eventId}')" aria-expanded="false">
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
        <article class="event-card ${isGrouped ? 'multi-date-card' : ''} ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${eventId}" data-event-json="${safeJsonDataAttr(event)}" style="cursor:pointer;">
            <div class="event-card-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;${
                isCancelled ? 'background:#FEE2E2;border-bottom:1px solid #FECACA;' :
                badge.badge === 'green' ? 'background:#D1FAE5;border-bottom:1px solid #A7F3D0;' :
                badge.badge === 'orange' ? 'background:#FEF3C7;border-bottom:1px solid #FDE68A;' :
                badge.badge === 'red' ? 'background:#FEE2E2;border-bottom:1px solid #FECACA;' :
                'background:#F8FAFC;border-bottom:1px solid #E5E7EB;'
            }">
                <span class="event-card-header-date" style="font-size:13px;font-weight:700;color:${isCancelled ? '#991B1B' : badge.badge === 'green' ? '#065F46' : badge.badge === 'orange' ? '#92400E' : badge.badge === 'red' ? '#991B1B' : '#1E40AF'};">
                    ${isGrouped ? (dateRange || event.allDates.length + ' dates') : date.day + ' ' + date.month}
                </span>
                ${isCancelled ? `
                <span style="font-size:12px;font-weight:700;color:#991B1B;">CANCELLED</span>
                ` : badge.badge === 'green' ? `
                <span style="font-size:12px;font-weight:700;color:#065F46;">✅ ${escapeHtml(badge.language || 'BSL')}</span>
                ` : badge.badge === 'orange' ? `
                <span style="font-size:12px;font-weight:700;color:#92400E;">🟠 Request</span>
                ` : badge.badge === 'red' ? `
                <span style="font-size:12px;font-weight:700;color:#991B1B;">🔴 Not Booked</span>
                ` : ''}
                ${!isGrouped && event['TIME'] ? `<span class="event-card-header-time" style="font-size:12px;font-weight:600;color:${isCancelled ? '#991B1B' : badge.badge === 'green' ? '#065F46' : badge.badge === 'orange' ? '#92400E' : badge.badge === 'red' ? '#991B1B' : '#6B7280'};">${formatEventTime(event)}</span>` : ''}
            </div>

            <div class="event-card-tappable" onclick='openEventModal(${safeJsonAttr(event)})' role="button" tabindex="0">
                <div class="event-image-container">
                    <img
                        src="${event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? escapeHtml(event['IMAGE URL']) : getDefaultImage(event)}"
                        alt="${escapeHtml(event['EVENT'] || 'Untitled Event')}"
                        class="event-image"
                        loading="lazy"
                        onerror="handleEventImageError(this,'${getDefaultImage(event)}')"
                    >
                </div>

                <div class="event-content-info">
                    <h3 class="event-title">${escapeHtml(event['EVENT'] || 'Untitled Event')}</h3>

                    <div class="event-meta-simple">
                        📍 ${escapeHtml(event['VENUE'] || 'Venue TBC')}
                    </div>
                    ${renderAccessIcons(event, 3)}

                    ${expandableDates}

                    ${!isGrouped && event['INTERPRETERS'] && badge.badge === 'green' ? `
                        <div class="event-interpreters-simple">
                            👥 ${escapeHtml(event['INTERPRETERS'])}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="event-content">
                <div class="event-actions">
                    ${primaryButton}
                </div>

                ${(() => { const f = getFestivalAppLink(event['EVENT']); return f ? `
                <div style="margin-top:10px;margin-bottom:8px;">
                    <button class="btn-secondary" onclick='openFestivalApp(${safeJsonAttr(f)})' style="width:100%;padding:10px;font-size:14px;font-weight:600;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
                        📱 ${f.ios || f.android ? 'Get ' + f.name + ' App' : f.name + ' Info'}
                    </button>
                    ${f.note ? '<p style="font-size:11px;color:#6B7280;text-align:center;margin:4px 0 0;">' + f.note + '</p>' : ''}
                </div>` : ''; })()}
                <div class="event-save-control" style="display:flex;margin:8px 0;padding:3px;background:#F9FAFB;border-radius:10px;gap:0;border:1px solid #E5E7EB;position:relative;">
                    <button class="event-save-btn" data-action="interested" data-event-json="${safeJsonDataAttr(event)}" onclick="event.stopPropagation();handleInterestedFromData(this)" style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;${isInterestedInEvent(event['EVENT'], event['DATE']) ? 'background:#FEF2F2;color:#DC2626;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;'}">
                        <span class="interested-icon">${isInterestedInEvent(event['EVENT'], event['DATE']) ? '❤️' : '🤍'}</span>
                        <span class="interested-label">${isInterestedInEvent(event['EVENT'], event['DATE']) ? 'Interested' : 'Interested?'}</span>
                    </button>
                    <div style="width:1px;background:#E5E7EB;margin:6px 0;flex-shrink:0;"></div>
                    <button class="event-save-btn" data-action="going" data-event-json="${safeJsonDataAttr(event)}" onclick="event.stopPropagation();handleGoingFromData(this)" style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;${isGoingToEvent(event['EVENT'], event['DATE']) ? 'background:#ECFDF5;color:#059669;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;'}">
                        <span class="going-icon">${isGoingToEvent(event['EVENT'], event['DATE']) ? '✅' : '🎟️'}</span>
                        <span class="going-label">${isGoingToEvent(event['EVENT'], event['DATE']) ? "I'm Going" : 'Going?'}</span>
                    </button>
                </div>
                <div class="event-utility-actions">
                    <button class="utility-btn" onclick='addToCalendar(${safeJsonAttr(event)})' aria-label="Add to calendar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Cal</span>
                    </button>
                    <button class="utility-btn" onclick='shareEvent(${safeJsonAttr(event)})' aria-label="Share event">
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
    const eventJson = safeJsonAttr(event);

    const actionButton = buildEventActionButton(event, badge, 'compact');

    const isCancelled = (event['STATUS'] || '').toLowerCase() === 'cancelled';
    let badgeIndicator = '';
    if (isCancelled) {
        badgeIndicator = `<div class="event-badge-indicator badge-cancelled"><span class="badge-label">CANCELLED</span></div>`;
    } else if (badge.badge === 'green') {
        badgeIndicator = `<div class="event-badge-indicator badge-green"><span class="badge-label">✅ BSL</span></div>`;
    }

    return `
        <article class="event-card-compact ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${Date.now()}-${Math.random()}" data-event-json="${safeJsonDataAttr(event)}" style="cursor:pointer;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#F8FAFC;border-bottom:1px solid #E5E7EB;">
                <span style="font-size:12px;font-weight:700;color:#1E40AF;">${escapeHtml(date.day)} ${escapeHtml(date.month)}</span>
                ${isCancelled ? `<span style="font-size:14px;" title="Cancelled">❌</span>`
                : badge.badge === 'green' ? `<span style="font-size:14px;" title="Interpreter booked">✅</span>`
                : badge.badge === 'orange' ? `<span style="font-size:14px;" title="Request interpreter">🟠</span>`
                : ''}
            </div>
            <div class="compact-image-container">
                <img
                    src="${event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? escapeHtml(event['IMAGE URL']) : getDefaultImage(event)}"
                    alt="${escapeHtml(event['EVENT'] || 'Untitled Event')}"
                    class="compact-image"
                    loading="lazy"
                    onerror="handleEventImageError(this,'${getDefaultImage(event)}')"
                >
            </div>

            <div class="compact-content">
                <h3 class="compact-title">${escapeHtml(event['EVENT'] || 'Untitled Event')}</h3>
                <div class="compact-venue">📍 ${escapeHtml(event['VENUE'] || 'Venue TBC')}</div>
                ${renderAccessIcons(event, 3)}
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
    const eventJson = safeJsonAttr(event);

    const actionButton = buildEventActionButton(event, badge, 'list');

    const isCancelled = (event['STATUS'] || '').toLowerCase() === 'cancelled';
    let statusBadge = '';
    if (isCancelled) {
        statusBadge = `<span style="padding:3px 8px;border-radius:10px;background:#FEE2E2;font-size:10px;font-weight:700;color:#991B1B;">CANCELLED</span>`;
    } else if (badge.badge === 'green') {
        statusBadge = `<span style="padding:3px 8px;border-radius:10px;background:#D1FAE5;font-size:10px;font-weight:700;color:#065F46;">✅ ${escapeHtml(badge.language || 'BSL')}</span>`;
    } else if (badge.badge === 'orange') {
        statusBadge = `<span style="padding:3px 8px;border-radius:10px;background:#FEF3C7;font-size:10px;font-weight:700;color:#92400E;">🟠 Request</span>`;
    } else if (badge.badge === 'red') {
        statusBadge = `<span style="padding:3px 8px;border-radius:10px;background:#FEE2E2;font-size:10px;font-weight:700;color:#991B1B;">🔴 Not Booked</span>`;
    }

    return `
        <article class="event-list-item ${isCancelled ? 'event-cancelled' : ''}" data-event-id="${Date.now()}-${Math.random()}" data-event-json="${safeJsonDataAttr(event)}" style="cursor:pointer;position:relative;">
            ${statusBadge ? `<div style="position:absolute;top:8px;right:8px;">${statusBadge}</div>` : ''}
            <div class="list-date">
                <span class="list-date-day">${escapeHtml(date.day)}</span>
                <span class="list-date-month">${escapeHtml(date.month)}</span>
            </div>

            <div class="list-content">
                <h3 class="list-title">${escapeHtml(event['EVENT'] || 'Untitled Event')}</h3>
                <div class="list-meta">
                    <span class="list-venue">📍 ${escapeHtml(event['VENUE'] || 'Venue TBC')} ${renderAccessIcons(event, 3)}</span>
                    ${event['TIME'] ? `<span class="list-time">🕐 ${formatEventTime(event)}</span>` : ''}
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
        // Insert legend ABOVE the results-header (its own full-width row)
        const resultsHeader = document.querySelector('.results-header');
        let legendEl = document.getElementById('badgeLegendRow');
        if (!legendEl && resultsHeader) {
            legendEl = document.createElement('div');
            legendEl.id = 'badgeLegendRow';
            legendEl.className = 'badge-legend';
            legendEl.innerHTML = `
                <span class="badge-legend-item badge-legend-green">✅ Interpreter Booked</span>
                <span class="badge-legend-item badge-legend-orange">🟠 Request Interpreter</span>
            `;
            resultsHeader.parentNode.insertBefore(legendEl, resultsHeader);
        }
        if (legendEl) legendEl.style.display = '';

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
                <h2 class="results-title">${categoryIcon} ${escapeHtml(categoryDisplay)}: ${events.length} ${events.length === 1 ? 'event' : 'events'}</h2>
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

        const hasAccessFilter = AppState.filters.accessibility && AppState.filters.accessibility.length > 0;
        const accessDisclaimer = hasAccessFilter
            ? '<p style="margin:6px 0 0;font-size:12px;color:#6B7280;line-height:1.4;">Only showing venues with confirmed access info. If you find out-of-date information, please let us know via the Support tab.</p>'
            : '';

        resultsHeaderContent.innerHTML = `<h2 class="results-title" id="resultsTitle">${titleText}</h2>${accessDisclaimer}`;
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
    const escaped = escapeHtml(category.replace(/'/g, "\\'"));
    return `
        <div class="category-card" role="button" tabindex="0"
             aria-label="${escapeHtml(category)}, ${count} ${count === 1 ? 'event' : 'events'}"
             onclick="openCategory('${escaped}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCategory('${escaped}')}">
            <div class="category-card-icon" aria-hidden="true">${icon}</div>
            <h3 class="category-card-title">${escapeHtml(category)}</h3>
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
    cardsContainer.classList.remove('festival-mode');

    if (AppState.allEvents.length === 0) {
        cardsContainer.innerHTML = '<p style="text-align: center; color: #64748B; padding: 40px 20px;">No events available at the moment. Pull down to refresh or check back later.</p>';
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

    // Sort categories in priority order
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // Build HTML using array join for better performance
    const cardsHtml = sortedCategories.map(category => {
        const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['Other'];
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

    // Switch views and show loading state before rendering
    switchToEventsView();
    setLoadingState(true);
    setTimeout(() => {
        applyFilters();
        setLoadingState(false);
    }, 0);
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
            <a onclick="backToCategorySelection()" class="festival-back-link">← Back to Categories</a>
            <h2 class="festival-title">🎪 Festival Events</h2>
            <p class="festival-subtitle">Choose a festival type to browse</p>
        </div>

        <div class="festival-subcategory-grid">
            <div class="category-card" role="button" tabindex="0" onclick="openFestivalSubcategory('camping')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFestivalSubcategory('camping')}">
                <div class="category-card-icon">⛺</div>
                <h3 class="category-card-title">Camping Festivals</h3>
                <p class="category-card-count">${campingCount} ${campingCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>

            <div class="category-card" role="button" tabindex="0" onclick="openFestivalSubcategory('non-camping')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFestivalSubcategory('non-camping')}">
                <div class="category-card-icon">🎵</div>
                <h3 class="category-card-title">Non-Camping Festivals</h3>
                <p class="category-card-count">${nonCampingCount} ${nonCampingCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>

            <div class="category-card festival-all-card" role="button" tabindex="0" onclick="openFestivalSubcategory('all')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFestivalSubcategory('all')}">
                <div class="category-card-icon">🎪</div>
                <h3 class="category-card-title">All Festivals</h3>
                <p class="category-card-count">${allFestivalsCount} ${allFestivalsCount === 1 ? 'event' : 'events'}</p>
                <div class="category-card-arrow">→</div>
            </div>
        </div>
    `;

    cardsContainer.innerHTML = cardsHtml;
    cardsContainer.classList.add('festival-mode');

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

    // Hide the "Browse Events" header and BSL button — festival has its own header
    const flowHeader = document.querySelector('#categorySelectionView .flow-header');
    if (flowHeader) flowHeader.style.display = 'none';
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

    // Restore the "Browse Events" header hidden by festival sub-categories
    const flowHeader = document.querySelector('#categorySelectionView .flow-header');
    if (flowHeader) flowHeader.style.display = '';

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

    // Hide badge legend when not viewing events
    const legendEl = document.getElementById('badgeLegendRow');
    if (legendEl) legendEl.style.display = 'none';

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
        if (IS_NATIVE_APP) {
            DOM.filtersSection.classList.remove('slide-in-left');
            DOM.filtersSection.classList.add('slide-in-right');
        }
    }
    if (DOM.eventsSection) {
        DOM.eventsSection.style.display = 'block';
        if (IS_NATIVE_APP) {
            DOM.eventsSection.classList.remove('slide-in-left');
            DOM.eventsSection.classList.add('slide-in-right');
        }
    }
    // Show "Back to Categories" button
    showBackToCategories(true);
}

function backToCategories() {
    AppState.viewMode = 'categories';
    AppState.selectedCategory = null;
    AppState.filters.category = 'all';
    if (DOM.categorySelectionView) {
        DOM.categorySelectionView.style.display = 'block';
        if (IS_NATIVE_APP) {
            DOM.categorySelectionView.classList.remove('slide-in-right');
            DOM.categorySelectionView.classList.add('slide-in-left');
        }
    }
    if (DOM.filtersSection) {
        DOM.filtersSection.style.display = 'none';
    }
    if (DOM.eventsSection) {
        DOM.eventsSection.style.display = 'none';
    }
    showBackToCategories(false);
    // In native app, update the top bar back button
    if (IS_NATIVE_APP && NativeShell) {
        NativeShell.updateTopBar('Events', false);
    }
}

function showBackToCategories(show) {
    let btn = document.getElementById('backToCategoriesBtn');
    if (show && !btn) {
        btn = document.createElement('button');
        btn.id = 'backToCategoriesBtn';
        btn.className = 'back-to-categories-btn';
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" style="flex-shrink:0"><path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z"></path></svg> All Categories';
        btn.onclick = backToCategories;
        const filtersSection = DOM.filtersSection;
        if (filtersSection) {
            filtersSection.insertBefore(btn, filtersSection.firstChild);
        }
    } else if (!show && btn) {
        btn.remove();
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
    return CATEGORY_ICONS[category] || '🎟️';
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
            const name = (event['EVENT'] || '').toLowerCase();
            const venue = (event['VENUE'] || '').toLowerCase();
            const city = (event['CITY'] || '').toLowerCase();
            if (name.includes(query)) matches.add(event['EVENT']);
            if (venue.includes(query)) matches.add(event['VENUE']);
            if (city.includes(query)) matches.add(event['CITY']);
        });

        // Show up to 5 suggestion pills
        const suggestions = [...matches].filter(Boolean).slice(0, 5);
        suggestionsContainer.innerHTML = suggestions.map(s =>
            `<button class="category-search-suggestion" onclick="executeCategorySearch('${escapeHtml(s.replace(/'/g, "\\'"))}')">${escapeHtml(s)}</button>`
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
        // Quota exceeded — clear oldest cache key and retry once
        try {
            const oldest = Object.keys(localStorage)
                .filter(k => k.startsWith('pi-events'))
                .sort((a, b) => {
                    const tA = parseInt(localStorage.getItem(a + '-timestamp') || '0', 10);
                    const tB = parseInt(localStorage.getItem(b + '-timestamp') || '0', 10);
                    return tA - tB;
                })[0];
            if (oldest && oldest !== CONFIG.localStorageKey) {
                localStorage.removeItem(oldest);
                localStorage.removeItem(oldest + '-timestamp');
            }
            localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(events));
            localStorage.setItem(CONFIG.localStorageTimestampKey, Date.now().toString());
        } catch (retryError) {
            console.error('Retry after clearing oldest cache also failed:', retryError);
        }
    }
}

let _fetchEventsPromise = null;
async function fetchEvents(skipCache = false) {
    // Dedup: if a fetch is already in flight, return the same promise
    if (_fetchEventsPromise) return _fetchEventsPromise;

    const now = Date.now();

    // Return in-memory cache if available and fresh
    if (!skipCache && AppState.lastFetch && (now - AppState.lastFetch) < CONFIG.cacheDuration) {
        return AppState.allEvents;
    }

    _fetchEventsPromise = _doFetchEvents(skipCache);
    try { return await _fetchEventsPromise; } finally { _fetchEventsPromise = null; }
}
async function _doFetchEvents(skipCache) {
    setLoadingState(true);
    const now = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(CONFIG.csvUrl, {
            cache: 'default',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('Event fetch timed out after 15 seconds');
        } else {
            console.error('Error fetching events:', error);
        }

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
                    ${errorMessage ? `<p style="color: #94A3B8; font-size: 14px; margin-top: 16px;">Error: ${escapeHtml(errorMessage)}</p>` : ''}
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
            } else if (AppState.filters.time === 'pick-a-date' && AppState.filters.selectedDate) {
                const eventDate = formatDate(event['DATE']).dateObj;
                const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
                return eventDateStr === AppState.filters.selectedDate;
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
    
    if (AppState.filters.accessibility && AppState.filters.accessibility.length > 0) {
        filtered = filtered.filter(event => {
            const venueAccess = findVenueAccessFeatures(event);
            if (!venueAccess || venueAccess.length === 0) return false;
            return AppState.filters.accessibility.every(f => venueAccess.includes(f));
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
        `<button class="suggestion-item" onclick="applySuggestion('${escapeHtml(term.replace(/'/g, "\\'"))}')">${escapeHtml(term)}</button>`
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
        locations.map(loc => `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`).join('');
    
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
    
    // Sort categories in priority order
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
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
            <span class="category-tab-icon">${CATEGORY_ICONS['All']}</span>
            <span>All Events</span>
            <span class="category-tab-count">${AppState.allEvents.length}</span>
        </button>
    `;

    sortedCategories.forEach(category => {
        const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['Other'];
        const count = categoryCounts[category];
        
        tabsHtml += `
            <button
                class="category-tab"
                data-category="${escapeHtml(category)}"
                onclick="selectCategory('${escapeHtml(category.replace(/'/g, "\\'"))}')"
            >
                <span class="category-tab-icon">${icon}</span>
                <span>${escapeHtml(category)}</span>
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
                Search: "${escapeHtml(AppState.filters.search)}"
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
        } else if (AppState.filters.time === 'pick-a-date' && AppState.filters.selectedDate) {
            timeLabel = AppState.filters.selectedDate;
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
                ${escapeHtml(AppState.filters.interpretation)}
                <button class="filter-pill-remove" onclick="clearFilter('interpretation')">×</button>
            </div>
        `);
    }

    if (AppState.filters.category !== 'all') {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                ${escapeHtml(AppState.filters.category)}
                <button class="filter-pill-remove" onclick="clearFilter('category')">×</button>
            </div>
        `);
    }

    if (AppState.filters.location !== 'all') {
        activeFiltersHtml.push(`
            <div class="filter-pill">
                ${escapeHtml(AppState.filters.location)}
                <button class="filter-pill-remove" onclick="clearFilter('location')">×</button>
            </div>
        `);
    }

    if (AppState.filters.accessibility && AppState.filters.accessibility.length > 0) {
        AppState.filters.accessibility.forEach(feature => {
            const f = ACCESS_FEATURE_DEFS[feature];
            if (f) {
                activeFiltersHtml.push(`
                    <div class="filter-pill">
                        <img src="${f.icon}" alt="" width="16" height="16" style="vertical-align:middle;"> ${escapeHtml(f.label)}
                        <button class="filter-pill-remove" onclick="clearAccessibilityFilter('${feature}')">×</button>
                    </div>
                `);
            }
        });
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
        AppState.filters.selectedDate = '';
        DOM.timeFilter.value = 'all';
        DOM.monthSelector.style.display = 'none';
        DOM.datePicker.style.display = 'none';
        if (DOM.dateFilter) DOM.dateFilter.value = '';
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

window.clearAccessibilityFilter = function(feature) {
    AppState.filters.accessibility = AppState.filters.accessibility.filter(f => f !== feature);
    // Update checkbox if panel is open
    const cb = document.getElementById('access-filter-' + feature);
    if (cb) cb.checked = false;
    applyFilters();
};

window.toggleAccessibilityFilter = function(feature, checked) {
    if (!AppState.filters.accessibility) AppState.filters.accessibility = [];
    if (checked) {
        if (!AppState.filters.accessibility.includes(feature)) {
            AppState.filters.accessibility.push(feature);
        }
    } else {
        AppState.filters.accessibility = AppState.filters.accessibility.filter(f => f !== feature);
    }
    applyFilters();
};

window.toggleAccessibilityPanel = function() {
    const panel = document.getElementById('accessibilityFilterPanel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        // Populate checkboxes
        const features = ACCESS_FEATURE_DEFS;
        panel.innerHTML = `<div style="padding:12px 16px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:12px;margin:8px 0;">
            <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">Filter by accessibility</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${Object.entries(features).map(([key, f]) => {
                    const checked = AppState.filters.accessibility && AppState.filters.accessibility.includes(key) ? 'checked' : '';
                    return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:white;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;cursor:pointer;">
                        <input type="checkbox" id="access-filter-${key}" ${checked} onchange="toggleAccessibilityFilter('${key}', this.checked)" style="margin:0;">
                        <img src="${f.icon}" alt="" width="16" height="16" style="vertical-align:middle;"> ${escapeHtml(f.label)}
                    </label>`;
                }).join('')}
            </div>
        </div>`;
    }
};

// ========================================
// GLOBAL EVENT HANDLERS
// ========================================


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
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
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
            DOM.mobileMenuBtn.setAttribute('aria-expanded', DOM.mobileNav.classList.contains('active'));
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (DOM.mobileNav.classList.contains('active')) {
                if (!DOM.mobileNav.contains(e.target) && !DOM.mobileMenuBtn.contains(e.target)) {
                    DOM.mobileMenuBtn.classList.remove('active');
                    DOM.mobileNav.classList.remove('active');
                    DOM.mobileMenuBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }
    
    // Event card tap — whole card opens access modal (except buttons/links)
    DOM.eventsGrid.addEventListener('click', (e) => {
        if (e.target.closest('button, a, .utility-btn')) return;
        const card = e.target.closest('.event-card[data-event-json], .event-card-compact[data-event-json], .event-list-item[data-event-json]');
        if (!card) return;
        try {
            const eventData = JSON.parse(card.dataset.eventJson);
            if (!eventData) return;
            // Route to correct modal based on event status
            const badge = calculateBadgeStatus(eventData);
            if (badge.badge === 'orange' && typeof openRequestBSLModal === 'function') {
                openRequestBSLModal(eventData);
            } else if (typeof openAccessFirstModal === 'function') {
                openAccessFirstModal(eventData);
            }
        } catch (err) { console.warn('[Card tap] Parse error:', err); }
    });

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
            DOM.datePicker.style.display = 'none';
            AppState.filters.selectedDate = '';
            if (DOM.dateFilter) DOM.dateFilter.value = '';
        } else if (e.target.value === 'pick-a-date') {
            DOM.datePicker.style.display = 'block';
            DOM.monthSelector.style.display = 'none';
            AppState.filters.selectedMonth = '';
        } else {
            DOM.monthSelector.style.display = 'none';
            DOM.datePicker.style.display = 'none';
            AppState.filters.selectedMonth = '';
            AppState.filters.selectedDate = '';
            if (DOM.dateFilter) DOM.dateFilter.value = '';
        }

        applyFilters();
    });

    DOM.monthFilter.addEventListener('change', (e) => {
        AppState.filters.selectedMonth = e.target.value;
        applyFilters();
    });

    DOM.dateFilter.addEventListener('change', (e) => {
        AppState.filters.selectedDate = e.target.value;
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
        const viewToggleBtns = DOM.viewToggle.querySelectorAll('.view-toggle-btn');

        viewToggleBtns.forEach((btn) => {
            // Clone to remove all existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            const handleViewChange = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const viewMode = newBtn.getAttribute('data-view');
                changeDisplayMode(viewMode);
            };

            newBtn.addEventListener('click', handleViewChange, { passive: false });
            newBtn.addEventListener('touchend', handleViewChange, { passive: false });
        });

        // Set initial active state
        updateViewToggleButtons();
    }

    // Header scroll shadow and scroll-to-top button visibility
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    const moreDropdownMenu = document.getElementById('moreDropdownMenu');

    window.addEventListener('scroll', () => {
        const header = document.querySelector('.app-header');
        if (!header) return;
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
            const dBtn = document.getElementById('moreDropdownBtn');
            if (dBtn) dBtn.setAttribute('aria-expanded', 'false');
        }
        if (DOM.mobileNav && DOM.mobileNav.classList.contains('active')) {
            DOM.mobileNav.classList.remove('active');
            if (DOM.mobileMenuBtn) {
                DOM.mobileMenuBtn.classList.remove('active');
                DOM.mobileMenuBtn.setAttribute('aria-expanded', 'false');
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
            moreDropdownBtn.setAttribute('aria-expanded', moreDropdownMenu.classList.contains('active'));
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (moreDropdownMenu.classList.contains('active')) {
                if (!moreDropdownMenu.contains(e.target) && !moreDropdownBtn.contains(e.target)) {
                    moreDropdownMenu.classList.remove('active');
                    moreDropdownBtn.setAttribute('aria-expanded', 'false');
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
            mobileMoreBtn.setAttribute('aria-expanded', mobileMoreMenu.classList.contains('active'));

            // Rotate the arrow
            mobileMoreBtn.textContent = mobileMoreMenu.classList.contains('active') ? 'More ▴' : 'More ▾';
        });
    }
}

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    try {
        // Clear stale app badge on launch
        navigator.clearAppBadge?.();

        // Apply native app adjustments
        if (IS_NATIVE_APP) {
            document.body.classList.add('native-app');
        }

        // Initialize DOM references FIRST
        initDOMReferences();

        // Initialize event listeners
        initEventListeners();

        // Set video language labels to match stored preference
        updateVideoLangLabels();

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

        // Initialize native shell AFTER everything else is set up
        if (IS_NATIVE_APP) {
            NativeShell.init();
        }

    } catch (error) {
        console.error('App initialization error:', error);
        alert('Failed to initialize app. Please refresh the page.');
    }
}

// ========================================
// SERVICE WORKER REGISTRATION & UPDATE DETECTION
// ========================================

// Service worker: only register in PWA/browser context, not native apps
if ('serviceWorker' in navigator && !IS_NATIVE_APP) {
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
            // Only reload if we're not already reloading and no form input is focused
            if (!window.isReloading) {
                if (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
                    window.isReloading = true;
                    window.location.reload();
                }
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

// Listen for app installed event (PWA only)
if (!IS_NATIVE_APP) {
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
}

// ========================================
// INSTALL PROMPT FUNCTIONS
// ========================================

/**
 * Open install guide modal
 */
function openInstallPrompt() {
    storeModalTrigger();
    // On mobile web, redirect to app stores if available
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    // Placeholder URLs — update when apps are published
    const appStoreUrl = 'https://apps.apple.com/app/pi-events/id000000000';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=uk.co.performanceinterpreting.app';

    if (isIOS && appStoreUrl.includes('id000000000') === false) {
        window.open(appStoreUrl, '_blank');
        return;
    }
    if (isAndroid && playStoreUrl.includes('id000000000') === false) {
        window.open(playStoreUrl, '_blank');
        return;
    }

    // Fallback: show existing PWA install guide
    const prompt = document.getElementById('installPrompt');
    prompt.classList.add('show');
    document.body.classList.add('modal-open');
    activateFocusTrap(prompt);
    pushModalState('installPrompt', closeInstallPrompt);
}

/**
 * Close install guide modal
 */
function closeInstallPrompt() {
    deactivateFocusTrap();
    const prompt = document.getElementById('installPrompt');
    prompt.classList.remove('show');
    document.body.classList.remove('modal-open');

    // Remember that user has seen this
    localStorage.setItem('pi-install-prompt-seen', 'true');
    restoreModalFocus();
    clearModalState();
}

/**
 * Check if app should show install prompt automatically
 */
function checkInstallPrompt() {
    // Never show in native app
    if (IS_NATIVE_APP) {
        return;
    }

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

// ========================================
// PWA: BEFORE INSTALL PROMPT (Android one-tap install)
// ========================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
});

// Override openInstallPrompt to use native prompt when available
const _originalOpenInstallPrompt = openInstallPrompt;
function openInstallPromptEnhanced() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
                showToast('App installed!');
            }
            deferredInstallPrompt = null;
        });
        return;
    }
    _originalOpenInstallPrompt();
}

// ========================================
// PWA: CONNECTIVITY INDICATOR
// ========================================
window.addEventListener('offline', () => {
    showToast('You are offline. Cached events are still available.');
});

window.addEventListener('online', () => {
    showToast('Back online — refreshing events...');
    fetchEvents(true).then(events => {
        if (events && events.length > 0) {
            renderEvents(events);
        }
    }).catch(() => {});
});

// ========================================
// PWA: VAPID KEY VALIDATION
// ========================================
function isValidVapidKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.includes('YOUR_') || key.includes('PLACEHOLDER') || key.length < 20) return false;
    return true;
}

// Make functions available globally
window.openInstallPrompt = openInstallPromptEnhanced;
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

Under equality legislation, I am requesting a reasonable adjustment in the form of BSL interpretation for this event.

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
Will there be an interpreter?

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
        const accessNeedsSelect = document.getElementById('requestAccessNeeds');
        const accessNeeds = accessNeedsSelect ? accessNeedsSelect.value : '';

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
        // Append access needs to generated message if selected
        let message = MessageTemplates.friendly.generate(eventName, venueName, eventDate, hasVenueEmail);
        if (accessNeeds && accessNeeds !== '') {
            const needsLabels = {
                'wheelchair': 'Wheelchair accessible seating',
                'hearing-loop': 'Hearing loop',
                'step-free': 'Step-free access',
                'assistance-dog': 'Assistance dog space',
                'quiet-room': 'Quiet room',
                'changing-places': 'Changing Places toilet',
                'other': 'Other access needs (please contact me to discuss)'
            };
            const needLabel = needsLabels[accessNeeds] || accessNeeds;
            message += '\n\nAdditional access need: ' + needLabel;
        }

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

    let link;
    if (window.currentMessage.hasVenueEmail) {
        link = 'mailto:' + window.currentMessage.venueEmail + '?cc=' + CONFIG.piEmail + '&subject=' + subject + '&body=' + body;
    } else {
        link = 'mailto:' + CONFIG.piEmail + '?subject=' + subject + '&body=' + body;
    }
    var a2 = document.createElement('a');
    a2.href = link;
    a2.style.display = 'none';
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
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
                        `<button class="suggestion-item" onclick="applyFlow2Suggestion('${escapeHtml(term.replace(/'/g, "\\'"))}')">${escapeHtml(term)}</button>`
                    ).join('')}
                </div>
            </div>
        ` : '';

        resultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">🔴</div>
                <h3>No events found for "${escapeHtml(query)}"</h3>
                ${suggestionsHTML}
                <p>We couldn't find any events matching your search.</p>
                <p><strong>But you can still request an interpreter!</strong></p>
                <a href="#/flow3?event=${encodeURIComponent(query)}" class="btn-orange" onclick="storeSearchQuery('${escapeHtml(query.replace(/'/g, "\\'"))}')">Request Interpreter for This Event →</a>
            </div>
        `;
        return;
    }

    // Group multi-date events (same as Browse view)
    const grouped = groupEventsByNameAndVenue(results);
    const resultsHTML = grouped.map(event => createEventCard(event)).join('');

    resultsContainer.innerHTML = `
        <div class="search-results-header">
            <h3>Found ${grouped.length} event${grouped.length === 1 ? '' : 's'} (${results.length} date${results.length === 1 ? '' : 's'})</h3>
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
    const searchClear = document.getElementById('flow2SearchClear');

    if (!searchInput || !searchBtn) return;

    // Show/hide clear X based on input
    if (searchClear) {
        searchInput.addEventListener('input', () => {
            searchClear.style.display = searchInput.value.trim() ? '' : 'none';
        });
    }

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
// KNOW YOUR RIGHTS MODAL & TICKER
// ========================================

// Know Your Rights modal functions removed — defined in index.html inline script
// (app.js versions were dead duplicates using style.display instead of classList)

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
    clearInterval(rightsTickerInterval);
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
    // Trigger notification prompt on first event tap
    maybeShowNotificationPrompt();

    storeModalTrigger();
    currentAccessEvent = event;
    const modal = document.getElementById('accessFirstModal');
    if (!modal) return;

    // Reset to booking mode (in case previously opened in request mode)
    event._isRequestMode = false;

    const titleEl = document.getElementById('accessFirstModalTitle');
    if (titleEl) titleEl.textContent = 'Book BSL Tickets';

    // Update event name + details in a clean info bar
    const eventNameEl = document.getElementById('accessFirstEventName');
    if (eventNameEl && event['EVENT']) {
        const dateInfo = event['DATE'] ? formatDate(event['DATE']) : null;
        const timeStr = formatEventTime(event);
        const venue = event['VENUE'] || '';
        const infoParts = [];
        if (dateInfo && dateInfo.day !== '--') infoParts.push(dateInfo.day + ' ' + dateInfo.month);
        if (timeStr) infoParts.push(timeStr);
        const imgSrc = event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? escapeHtml(event['IMAGE URL']) : getDefaultImage(event);
        const accessFeatures = findVenueAccessFeatures(event);
        // Header: image + title + date (above CTA buttons)
        const headerEl = document.getElementById('accessFirstEventHeader');
        if (headerEl) {
            // Build multi-date display if this is a grouped event
            let multiDateHtml = '';
            if (event.isGrouped && event.allDates && event.allDates.length > 1) {
                multiDateHtml = buildMultiDateHtml(event.allDates, 'green');
            }
            headerEl.innerHTML = `
                <img src="${imgSrc}" alt="${escapeHtml(event['EVENT'])}" style="width:calc(100% + 32px);margin:-12px -16px 12px;height:200px;object-fit:cover;object-position:center top;border-radius:0;" onerror="this.style.display='none'">
                <div style="font-size:20px;font-weight:800;color:#1F2937;margin-bottom:6px;text-align:center;line-height:1.3;">${escapeHtml(event['EVENT'])}</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    ${infoParts.length ? `<span style="padding:8px 20px;border-radius:12px;background:#EFF6FF;font-size:18px;font-weight:800;color:#1E40AF;">${escapeHtml(infoParts.join(' · '))}</span>` : ''}
                </div>
                ${multiDateHtml}
            `;
        }
        // Details: location + access + interpreters (below CTA buttons)
        eventNameEl.innerHTML = `
            ${event['DESCRIPTION'] && event['DESCRIPTION'].trim() ? `<div style="margin:8px 0;padding:10px 14px;background:#F0F4FF;border-radius:10px;border-left:3px solid #2563EB;font-size:13px;color:#374151;line-height:1.4;text-align:left;">${escapeHtml(event['DESCRIPTION'])}</div>` : ''}
            ${event['INTERPRETERS'] && event['INTERPRETERS'].trim() ? `
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #E5E7EB;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:0.8px;">Interpreters</p>
                <div style="padding:10px 16px;background:linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%);border:1px solid #A7F3D0;border-radius:10px;text-align:center;font-size:15px;font-weight:700;color:#065F46;">✅ ${escapeHtml(event['INTERPRETERS'])}</div>
            </div>` : ''}
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #E5E7EB;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:0.8px;">Location</p>
                ${venue ? `<div style="font-size:14px;font-weight:600;color:#1F2937;text-align:center;">📍 ${escapeHtml(venue)}</div>` : ''}
                ${(() => {
                    const vd = findVenueDetails(event);
                    if (!vd) return '';
                    const addrParts = [vd.address, vd.address2, vd.city, vd.postcode].filter(Boolean);
                    return '<div style="font-size:13px;color:#6B7280;text-align:center;margin-top:2px;">' + escapeHtml(addrParts.join(', ')) + '</div>' +
                        (vd.mapsUrl ? '<div style="text-align:center;"><a href="' + escapeHtml(vd.mapsUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;padding:6px 14px;background:#F87171;border:1px solid #F87171;border-radius:8px;font-size:13px;font-weight:600;color:#fff;text-decoration:none;">📍 Open in Maps</a></div>' : '');
                })()}
            </div>
            ${accessFeatures.length > 0 ? `
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #E5E7EB;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:0.8px;">Access Facilities</p>
                ${renderAccessLabels(event)}
                <p style="margin:8px 0 0;font-size:11px;color:#6B7280;text-align:center;line-height:1.4;">These are the venue's general access features. When you contact the venue, please let them know about all of your access needs — including if you are deafblind, a wheelchair user, or need to sit close to the interpreter.</p>
            </div>` : ''}
        `;
    }

    // Handle VRS button - VRS is primary contact method for BSL users
    const vrsButton = document.getElementById('vrsButton');
    const vrsButtonText = document.getElementById('vrsButtonText');
    const emailButton = document.getElementById('generateEmailBtn');

    // Check for VRS: first from spreadsheet, then from VENUE_CONTACTS lookup
    let vrsUrl = event['VRS_URL'] && event['VRS_URL'].trim();
    let vrsProvider = event['VRS_PROVIDER'] && event['VRS_PROVIDER'].trim();
    let venueNote = '';

    // Try event name first (touring shows like Circus Starr where venue = city name)
    if (!vrsUrl && event['EVENT']) {
        const eventMatches = findMatchingVenues(event['EVENT']);
        if (eventMatches.length > 0) {
            if (eventMatches[0].vrs) {
                vrsUrl = eventMatches[0].vrs;
                vrsProvider = eventMatches[0].vrsLabel || 'SignVideo';
            }
            if (eventMatches[0].note) {
                venueNote = eventMatches[0].note;
            }
        }
    }
    // Then try venue name
    if (!vrsUrl && !venueNote && event['VENUE']) {
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
            noteEl.innerHTML = `<strong>✅ ${escapeHtml(venueNote)}</strong>`;
        } else {
            noteEl.innerHTML = '<strong>💡 Tip:</strong><br>Contact venue before buying tickets<br>Ask for BSL accessible seating';
        }
    }

    // Show booking steps — check event name first (touring shows), then venue
    let bookingSteps = null;
    if (event['EVENT']) {
        const eventMatches = findMatchingVenues(event['EVENT']);
        if (eventMatches.length > 0 && eventMatches[0].bookingSteps) {
            bookingSteps = eventMatches[0].bookingSteps;
        }
    }
    if (!bookingSteps && event['VENUE']) {
        const venueMatches = findMatchingVenues(event['VENUE']);
        if (venueMatches.length > 0 && venueMatches[0].bookingSteps) {
            bookingSteps = venueMatches[0].bookingSteps;
        }
    }

    // Remove any existing booking steps container
    const existingSteps = modal.querySelector('.access-booking-steps');
    if (existingSteps) existingSteps.remove();

    if (bookingSteps && noteEl) {
        const stepsHtml = document.createElement('div');
        stepsHtml.className = 'access-booking-steps';
        stepsHtml.style.cssText = 'margin-top:16px;padding:16px;background:#FEF3C7;border-radius:12px;border:1px solid #FDE68A;';
        stepsHtml.innerHTML = `
            <p style="font-weight:600;font-size:15px;margin:0 0 12px;color:#92400E;">📋 How to book at this venue</p>
            ${bookingSteps.map(s => `
                <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
                    <span style="flex-shrink:0;width:24px;height:24px;margin-top:1px;background:#2563EB;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;line-height:1;">${s.step}</span>
                    <p style="margin:0;padding-top:3px;font-size:14px;color:#1F2937;line-height:1.4;">${escapeHtml(s.text)}</p>
                </div>
            `).join('')}
            <p style="margin:12px 0 0;font-size:13px;color:#6B7280;line-height:1.4;">We appreciate this is not straightforward and are working with the venue to streamline this. If you need support, please let us know.</p>
        `;
        noteEl.parentNode.insertBefore(stepsHtml, noteEl.nextSibling);
    }

    const hasVRS = !!vrsUrl;

    if (vrsButton && hasVRS) {
        vrsButton.style.display = 'flex';
        vrsButton.style.alignItems = 'center';
        vrsButton.style.justifyContent = 'center';
        vrsButton.style.gap = '8px';
        vrsButton.className = 'btn-primary btn-large'; // VRS is primary when available

        // Store VRS URL for openVRSLink function
        vrsButton.dataset.vrsUrl = vrsUrl;

        // Update button text with provider name
        if (vrsButtonText && vrsProvider) {
            vrsButtonText.innerHTML = `<img src="signvideo-logo.png" alt="" style="height:28px;width:28px;border-radius:8px;object-fit:cover;"> Use ${vrsProvider} (Recommended)`;
        } else if (vrsButtonText) {
            vrsButtonText.innerHTML = '<img src="signvideo-logo.png" alt="" style="height:28px;width:28px;border-radius:8px;object-fit:cover;"> Use SignVideo (Recommended)';
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

    // Resolve email: event name first (touring shows), then venue, then PI fallback
    let resolvedEmail = event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';
    if (!resolvedEmail && event['EVENT']) {
        const eventMatches = findMatchingVenues(event['EVENT']);
        if (eventMatches.length > 0 && eventMatches[0].email) {
            resolvedEmail = eventMatches[0].email;
        }
    }
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
            emailButton.innerHTML = '✉️ Email Venue (PI CC\'d for support)';
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

    // Populate Interested / I'm Going buttons
    const myEventBtns = document.getElementById('accessFirstMyEventBtns');
    if (myEventBtns && event['EVENT']) {
        const eName = escapeHtml(event['EVENT'] || '').replace(/'/g, '&#39;');
        const eDate = escapeHtml(event['DATE'] || '');
        const eVenue = escapeHtml(event['VENUE'] || '').replace(/'/g, '&#39;');
        const eCat = escapeHtml(event['CATEGORY'] || '');
        const interested = isInterestedInEvent(event['EVENT'], event['DATE']);

        let btnsHtml = '';

        // Access form for festivals (so it's accessible from My Events route)
        if (isFestivalEvent(event)) {
            const festInfo = getFestivalAccessInfo(event);
            if (festInfo && festInfo.accessForm) {
                btnsHtml += '<a href="' + escapeHtml(festInfo.accessForm) + '" target="_blank" rel="noopener" class="btn-primary btn-large" style="text-decoration:none;text-align:center;background:#7C3AED;border-color:#7C3AED;margin-bottom:8px;display:block;">♿ Access Form</a>';
            }
        }

        var isGoing = isGoingToEvent(event['EVENT'], event['DATE']);
        var safeJson = escapeHtml(JSON.stringify(event)).replace(/'/g, '&#39;');

        btnsHtml += '<div style="display:flex;padding:3px;background:#F9FAFB;border-radius:10px;gap:0;border:1px solid #E5E7EB;width:100%;">';
        btnsHtml += '<button data-action="interested" data-event-json=\'' + safeJson + '\' onclick="handleInterestedFromData(this)" style="flex:1;padding:10px 8px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;' + (interested ? 'background:#FEF2F2;color:#DC2626;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;') + '">' +
            '<span class="interested-icon">' + (interested ? '❤️' : '🤍') + '</span> <span class="interested-label">' + (interested ? 'Interested' : 'Interested?') + '</span></button>';

        btnsHtml += '<div style="width:1px;background:#E5E7EB;margin:6px 0;flex-shrink:0;"></div>';

        btnsHtml += '<button data-action="going" data-event-json=\'' + safeJson + '\' onclick="handleGoingFromData(this)" style="flex:1;padding:10px 8px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;' + (isGoing ? 'background:#ECFDF5;color:#059669;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;') + '">' +
            '<span class="going-icon">' + (isGoing ? '✅' : '🎟️') + '</span> <span class="going-label">' + (isGoing ? 'I\'m Going' : 'Going?') + '</span></button>';

        btnsHtml += '</div>';

        myEventBtns.innerHTML = btnsHtml;
    }

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activateFocusTrap(modal);
    pushModalState('accessFirstModal', closeAccessFirstModal);
}

/**
 * Close Access First Modal
 */
function closeAccessFirstModal() {
    deactivateFocusTrap();
    const modal = document.getElementById('accessFirstModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    restoreModalFocus();
    clearModalState();
}

// ========================================
// EVENT INFO MODAL
// ========================================

let currentInfoEvent = null;

function openEventInfoModal(event) {
    currentInfoEvent = event;
    const modal = document.getElementById('eventInfoModal');
    if (!modal) return;

    document.getElementById('eventInfoModalTitle').textContent = event['EVENT'] || '';
    const date = formatDate(event['DATE']);
    const timeStr = event['TIME'] ? (' \u00b7 ' + event['TIME']) : '';
    document.getElementById('eventInfoDate').textContent = '\ud83d\udcc5 ' + date.day + ' ' + date.month + timeStr;

    const descEl = document.getElementById('eventInfoDescription');
    if (event['DESCRIPTION'] && event['DESCRIPTION'].trim()) {
        descEl.textContent = event['DESCRIPTION'];
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    document.getElementById('eventInfoVenueName').textContent = event['VENUE'] || '';

    const venueDetails = findVenueDetails(event);
    const addressEl = document.getElementById('eventInfoAddress');
    const mapsBtn = document.getElementById('eventInfoMapsBtn');

    if (venueDetails) {
        var parts = [venueDetails.address];
        if (venueDetails.address2) parts.push(venueDetails.address2);
        parts.push(venueDetails.city || '');
        parts.push(venueDetails.postcode || '');
        addressEl.textContent = parts.filter(Boolean).join(', ');
        addressEl.style.display = 'block';
        if (venueDetails.mapsUrl) {
            mapsBtn.href = venueDetails.mapsUrl;
            mapsBtn.style.display = 'inline-flex';
        } else {
            mapsBtn.style.display = 'none';
        }
    } else {
        var city = event['CITY'] || '';
        addressEl.textContent = city;
        addressEl.style.display = city ? 'block' : 'none';
        mapsBtn.style.display = 'none';
    }

    var interpSection = document.getElementById('eventInfoInterpreters');
    var interpText = document.getElementById('eventInfoInterpretersText');
    if (event['INTERPRETERS'] && event['INTERPRETERS'].trim()) {
        interpText.textContent = event['INTERPRETERS'];
        interpSection.style.display = 'block';
    } else {
        interpSection.style.display = 'none';
    }

    var accessSection = document.getElementById('eventInfoAccessSection');
    var accessGrid = document.getElementById('eventInfoAccessFeatures');
    var features = findVenueAccessFeatures(event);
    if (features && features.length > 0) {
        accessGrid.innerHTML = features.map(function(key) {
            var def = ACCESS_FEATURE_DEFS[key];
            if (!def) return '';
            return '<div class="access-feature-item"><img src="' + def.icon + '" alt="" width="24" height="24"><span>' + escapeHtml(def.label) + '</span></div>';
        }).join('');
        accessSection.style.display = 'block';
    } else {
        accessSection.style.display = 'none';
    }

    var priceBlock = document.getElementById('eventInfoPriceBlock');
    var priceText = document.getElementById('eventInfoPriceText');
    if (event['PRICE'] && event['PRICE'].trim()) {
        priceText.textContent = event['PRICE'];
        priceBlock.style.display = 'block';
    } else {
        priceBlock.style.display = 'none';
    }

    var eventLink = document.getElementById('eventInfoEventLink');
    var eventUrl = event['EVENT URL'] || '';
    if (eventUrl && eventUrl.startsWith('http')) {
        eventLink.href = eventUrl;
        eventLink.style.display = 'block';
    } else {
        eventLink.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEventInfoModal() {
    var modal = document.getElementById('eventInfoModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function eventInfoToBooking() {
    if (!currentInfoEvent) return;
    var event = currentInfoEvent;
    closeEventInfoModal();
    var badge = calculateBadgeStatus(event);
    if (badge.badge === 'green') {
        openAccessFirstModal(event);
    } else {
        openGetTicketsModal(event);
    }
}

/**
 * Generate Access Email
 * Creates a pre-written email asking for BSL & ISL accessible seating
 */
function generateAccessEmail(accessNeeds) {
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
    const userType = _getUserType();

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
    } catch (e) {}

    // Build opening line based on user type
    let opener;
    if (userType === 'deafblind') {
        opener = `I am Deafblind and use tactile ${language}`;
    } else if (userType === 'companion') {
        opener = `I am writing on behalf of a Deaf person I support. They use ${language}`;
    } else {
        opener = `I am a Deaf ${language} user`;
    }

    // Build subject and body based on mode
    let subject, body;
    if (isRequestMode) {
        subject = `${language} Interpreter Request - ${eventName}`;
        body = `Hi,\n\n${opener}. ${userType === 'companion' ? 'They' : 'I'} would like to attend ${eventName} at ${venue} on ${formattedDate}.\n\nWill there be a ${language} interpreter at this event? If not, is it possible to arrange one?`;
    } else {
        subject = `${language} Access Request - ${eventName}`;
        body = `Hi,\n\n${opener} and would like to attend ${eventName} at ${venue} on ${formattedDate}.\n\nPlease can you advise how ${userType === 'companion' ? 'they' : 'I'} can book tickets with a clear view of the interpreter/${language} area?`;
    }

    // Append access needs if provided
    if (accessNeeds) {
        const needsSentences = [];
        if (accessNeeds.deafblind) {
            needsSentences.push(`${userType === 'companion' ? 'They' : 'I'} will need to sit directly next to the interpreter so they can sign into ${userType === 'companion' ? 'their' : 'my'} hands.`);
        }
        if (accessNeeds.wheelchair) {
            needsSentences.push(`${userType === 'companion' ? 'They use' : 'I use'} a wheelchair and will need accessible seating in the interpreter viewing area.`);
        }
        if (accessNeeds.companion) {
            needsSentences.push(`${userType === 'companion' ? 'They' : 'I'} will be attending with a companion/PA and will need an additional seat next to ${userType === 'companion' ? 'theirs' : 'mine'}.`);
        }
        if (accessNeeds.dog) {
            needsSentences.push(`${userType === 'companion' ? 'They have' : 'I have'} an assistance dog and will need space for them beside ${userType === 'companion' ? 'them' : 'me'}.`);
        }
        if (needsSentences.length > 0) {
            body += '\n\n' + needsSentences.join(' ');
        }
        if (accessNeeds.otherText) {
            // Most users will list items rather than write full sentences
            // (e.g. "ramp, large print menu, quiet space"). Prefix with a
            // natural opener so the email reads coherently. Match the
            // self/companion voice used throughout the rest of the email.
            const needsOpener = userType === 'companion' ? 'Their needs include' : 'My needs include';
            body += '\n\n' + needsOpener + ': ' + accessNeeds.otherText.trim();
        }
    }

    body += '\n\nThank you.';

    // Get email address: resolved venue email or fall back to PI
    const venueEmail = event._resolvedEmail || event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';

    let mailtoLink;
    if (venueEmail) {
        mailtoLink = `mailto:${venueEmail}?cc=${CONFIG.piEmail}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
        // No venue email — redirect to PI
        const piBody = `Hi PI,\n\n${opener}. ${userType === 'companion' ? 'They' : 'I'} would like to attend ${eventName} at ${venue} on ${formattedDate}.\n\n${userType === 'companion' ? 'We' : 'I'} couldn't find the venue's access email. Could you help ${userType === 'companion' ? 'us' : 'me'} contact them${isRequestMode ? ' about arranging a ' + language + ' interpreter' : ' about booking tickets with a view of the ' + language + ' interpreter area'}?\n\nThank you.`;
        mailtoLink = `mailto:${CONFIG.piEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(piBody)}`;
    }

    // Open email — temporary link click (works in Capacitor WebView)
    var a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => { closeAccessFirstModal(); }, 500);
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
    if (eventNameEl && event['EVENT']) {
        const dateInfo = event['DATE'] ? formatDate(event['DATE']) : null;
        const timeStr = formatEventTime(event);
        const venue = event['VENUE'] || '';
        const infoParts = [];
        if (dateInfo && dateInfo.day !== '--') infoParts.push(dateInfo.day + ' ' + dateInfo.month);
        if (timeStr) infoParts.push(timeStr);
        const imgSrc2 = event['IMAGE URL'] && event['IMAGE URL'].trim() !== '' ? escapeHtml(event['IMAGE URL']) : getDefaultImage(event);
        const accessFeatures2 = findVenueAccessFeatures(event);
        // Header: image + title + date + request pill (above CTA buttons)
        const headerEl2 = document.getElementById('accessFirstEventHeader');
        if (headerEl2) {
            // Build multi-date display if this is a grouped event
            let multiDateHtml2 = '';
            if (event.isGrouped && event.allDates && event.allDates.length > 1) {
                multiDateHtml2 = buildMultiDateHtml(event.allDates, 'orange');
            }
            headerEl2.innerHTML = `
                <img src="${imgSrc2}" alt="${escapeHtml(event['EVENT'])}" style="width:calc(100% + 32px);margin:-12px -16px 12px;height:200px;object-fit:cover;object-position:center top;border-radius:0;" onerror="this.style.display='none'">
                <div style="font-size:20px;font-weight:800;color:#1F2937;margin-bottom:6px;text-align:center;line-height:1.3;">${escapeHtml(event['EVENT'])}</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    ${infoParts.length ? `<span style="padding:8px 20px;border-radius:12px;background:#EFF6FF;font-size:18px;font-weight:800;color:#1E40AF;">${escapeHtml(infoParts.join(' · '))}</span>` : ''}
                </div>
                ${multiDateHtml2}
                <div style="margin-bottom:8px;padding:8px 16px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;text-align:center;font-size:14px;font-weight:700;color:#9A3412;">✉️ Request Interpreter</div>
            `;
        }
        // Details: location + access (below CTA buttons)
        eventNameEl.innerHTML = `
            ${event['DESCRIPTION'] && event['DESCRIPTION'].trim() ? `<div style="margin:8px 0;padding:10px 14px;background:#F0F4FF;border-radius:10px;border-left:3px solid #F59E0B;font-size:13px;color:#374151;line-height:1.4;text-align:left;">${escapeHtml(event['DESCRIPTION'])}</div>` : ''}
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #E5E7EB;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:0.8px;">Location</p>
                ${venue ? `<div style="font-size:14px;font-weight:600;color:#1F2937;text-align:center;">📍 ${escapeHtml(venue)}</div>` : ''}
                ${(() => {
                    const vd = findVenueDetails(event);
                    if (!vd) return '';
                    const addrParts = [vd.address, vd.address2, vd.city, vd.postcode].filter(Boolean);
                    return '<div style="font-size:13px;color:#6B7280;text-align:center;margin-top:2px;">' + escapeHtml(addrParts.join(', ')) + '</div>' +
                        (vd.mapsUrl ? '<div style="text-align:center;"><a href="' + escapeHtml(vd.mapsUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;padding:6px 14px;background:#F87171;border:1px solid #F87171;border-radius:8px;font-size:13px;font-weight:600;color:#fff;text-decoration:none;">📍 Open in Maps</a></div>' : '');
                })()}
            </div>
            ${accessFeatures2.length > 0 ? `
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #E5E7EB;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:0.8px;">Access Facilities</p>
                ${renderAccessLabels(event)}
                <p style="margin:8px 0 0;font-size:11px;color:#6B7280;text-align:center;line-height:1.4;">These are the venue's general access features. When you contact the venue, please let them know about all of your access needs — including if you are deafblind, a wheelchair user, or need to sit close to the interpreter.</p>
            </div>` : ''}
        `;
    }

    // Resolve VRS and email — event name first (touring shows), then venue
    let vrsUrl = event['VRS_URL'] || '';
    let vrsProvider = event['VRS_PROVIDER'] || '';
    let resolvedEmail = event['ACCESS_EMAIL'] || event['VENUE_CONTACT_EMAIL'] || '';

    // Try event name first (handles Circus Starr etc.)
    const eventNameMatches = findMatchingVenues(event['EVENT'] || '');
    if (eventNameMatches.length > 0) {
        if (!vrsUrl && eventNameMatches[0].vrs) {
            vrsUrl = eventNameMatches[0].vrs;
            vrsProvider = eventNameMatches[0].vrsLabel || 'SignVideo';
        }
        if (!resolvedEmail && eventNameMatches[0].email) {
            resolvedEmail = eventNameMatches[0].email;
        }
    }
    // Then try venue name
    const venueMatches = findMatchingVenues(event['VENUE'] || '');
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
        vrsButton.style.display = 'flex';
        vrsButton.style.alignItems = 'center';
        vrsButton.style.justifyContent = 'center';
        vrsButton.style.gap = '8px';
        vrsButton.className = 'btn-primary btn-large';
        vrsButton.dataset.vrsUrl = vrsUrl;
        if (vrsButtonText) vrsButtonText.innerHTML = `<img src="signvideo-logo.png" alt="" style="height:28px;width:28px;border-radius:8px;object-fit:cover;"> Use ${vrsProvider || 'SignVideo'} (Recommended)`;
        if (emailButton) emailButton.className = 'btn-secondary btn-large';
    } else {
        if (vrsButton) vrsButton.style.display = 'none';
        if (emailButton) emailButton.className = 'btn-primary btn-large';
    }

    // Email button label
    if (emailButton) {
        if (resolvedEmail) {
            emailButton.innerHTML = '✉️ Email Venue (PI CC\'d for support)';
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

    // Populate Interested / I'm Going buttons
    const myEventBtns2 = document.getElementById('accessFirstMyEventBtns');
    if (myEventBtns2 && event['EVENT']) {
        const eName = escapeHtml(event['EVENT'] || '').replace(/'/g, '&#39;');
        const eDate = escapeHtml(event['DATE'] || '');
        const eVenue = escapeHtml(event['VENUE'] || '').replace(/'/g, '&#39;');
        const eCat = escapeHtml(event['CATEGORY'] || '');
        const interested = isInterestedInEvent(event['EVENT'], event['DATE']);

        let btnsHtml = '';

        // Access form for festivals (so it's accessible from My Events route)
        if (isFestivalEvent(event)) {
            const festInfo = getFestivalAccessInfo(event);
            if (festInfo && festInfo.accessForm) {
                btnsHtml += '<a href="' + escapeHtml(festInfo.accessForm) + '" target="_blank" rel="noopener" class="btn-primary btn-large" style="text-decoration:none;text-align:center;background:#7C3AED;border-color:#7C3AED;margin-bottom:8px;display:block;">♿ Access Form</a>';
            }
        }

        var isGoing = isGoingToEvent(event['EVENT'], event['DATE']);
        var safeJson = escapeHtml(JSON.stringify(event)).replace(/'/g, '&#39;');

        btnsHtml += '<div style="display:flex;padding:3px;background:#F9FAFB;border-radius:10px;gap:0;border:1px solid #E5E7EB;width:100%;">';
        btnsHtml += '<button data-action="interested" data-event-json=\'' + safeJson + '\' onclick="handleInterestedFromData(this)" style="flex:1;padding:10px 8px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;' + (interested ? 'background:#FEF2F2;color:#DC2626;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;') + '">' +
            '<span class="interested-icon">' + (interested ? '❤️' : '🤍') + '</span> <span class="interested-label">' + (interested ? 'Interested' : 'Interested?') + '</span></button>';

        btnsHtml += '<div style="width:1px;background:#E5E7EB;margin:6px 0;flex-shrink:0;"></div>';

        btnsHtml += '<button data-action="going" data-event-json=\'' + safeJson + '\' onclick="handleGoingFromData(this)" style="flex:1;padding:10px 8px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;' + (isGoing ? 'background:#ECFDF5;color:#059669;box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent;color:#9CA3AF;') + '">' +
            '<span class="going-icon">' + (isGoing ? '✅' : '🎟️') + '</span> <span class="going-label">' + (isGoing ? 'I\'m Going' : 'Going?') + '</span></button>';

        btnsHtml += '</div>';

        myEventBtns2.innerHTML = btnsHtml;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activateFocusTrap(modal);
}
window.openRequestBSLModal = openRequestBSLModal;

// ========================================
// CALENDAR & SHARE FUNCTIONS
// ========================================

/**
 * Add event to calendar (generates ICS file download)
 */
function addToCalendar(event) {
    console.log('[Calendar] addToCalendar called', event ? event['EVENT'] : 'no event');
    try {
    const eventName = event['EVENT'] || 'BSL Interpreted Event';
    const venue = event['VENUE'] || '';
    const dateStr = event['DATE'] || '';
    const timeStr = event['TIME'] || '';
    const interpretation = event['INTERPRETATION'] || 'BSL';

    // Parse date via formatDate (handles DD.MM.YY, DD/MM/YY, DD-MM-YY and YYYY variants)
    const parsed = formatDate(dateStr);
    if (parsed.day === '--') {
        console.warn('[Calendar] Could not parse event date:', dateStr);
        if (typeof showToast === 'function') showToast('Could not parse event date');
        return;
    }
    const day = parsed.dateObj.getDate().toString().padStart(2, '0');
    const month = (parsed.dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.dateObj.getFullYear().toString();

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
        `SUMMARY:${escapeICS(eventName)} (${escapeICS(interpretation)} Interpreted)`,
        `LOCATION:${escapeICS(venue)}`,
        `DESCRIPTION:${escapeICS(interpretation)} interpreted event.\\n\\nVenue: ${escapeICS(venue)}${event['EVENT URL'] ? '\\n\\nEvent info: ' + escapeICS(event['EVENT URL']) : ''}\\n\\nFor accessible booking info visit: https://app.performanceinterpreting.co.uk/#/how-to-book`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    // Download/share ICS file
    const fileName = `${eventName.replace(/[^a-z0-9]/gi, '_')}.ics`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

    // Build calendar URLs
    const calStart = `${year}${month}${day}T${pad(startHour)}${pad(startMin)}00`;
    const calEnd = `${year}${month}${day}T${pad(endHour)}${pad(endMin)}00`;
    const calTitle = encodeURIComponent(eventName + ' (' + interpretation + ' Interpreted)');
    const calLocation = encodeURIComponent(venue);
    const calDetails = encodeURIComponent(interpretation + ' interpreted event. ' + (event['EVENT URL'] || ''));

    const calendarUrls = {
        google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&location=${calLocation}&details=${calDetails}`,
        outlook: `https://outlook.live.com/calendar/0/action/compose?subject=${calTitle}&startdt=${year}-${month}-${day}T${pad(startHour)}:${pad(startMin)}:00&enddt=${year}-${month}-${day}T${pad(endHour)}:${pad(endMin)}:00&location=${calLocation}&body=${calDetails}`,
    };

    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        const savedPref = localStorage.getItem('pi-calendar-preference');

        if (savedPref === 'apple') {
            _addToAppleCalendar(event);
            console.log('[Calendar] Using saved preference: apple');
        } else if (savedPref && calendarUrls[savedPref]) {
            window.open(calendarUrls[savedPref], '_blank');
            console.log('[Calendar] Using saved preference:', savedPref);
        } else {
            // Show choice modal
            _showCalendarChoice(calendarUrls, event);
        }
    } else {
        // Web: standard blob download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    } catch (err) {
        console.error('[Calendar] Error:', err);
        if (typeof showToast === 'function') showToast('Could not add to calendar');
    }
}

function _showCalendarChoice(urls, event) {
    // Remove existing choice modal if any
    const existing = document.getElementById('calendarChoiceModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'calendarChoiceModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.4);padding:0 0 env(safe-area-inset-bottom,20px) 0;';
    const isIOS = window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:400px;padding:24px 20px calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 24px rgba(0,0,0,0.15);">
            <h3 style="text-align:center;font-size:17px;font-weight:600;margin:0 0 4px;">Add to Calendar</h3>
            <p style="text-align:center;font-size:13px;color:#6B7280;margin:0 0 20px;">Choose your calendar app</p>
            ${isIOS ? `<button id="calChoice-apple" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:15px;font-weight:500;margin-bottom:8px;cursor:pointer;">
                <span style="font-size:24px;">📅</span> Apple Calendar
            </button>` : ''}
            <button id="calChoice-google" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:15px;font-weight:500;margin-bottom:8px;cursor:pointer;">
                <span style="font-size:24px;">📆</span> Google Calendar
            </button>
            <button id="calChoice-outlook" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:15px;font-weight:500;margin-bottom:16px;cursor:pointer;">
                <span style="font-size:24px;">📧</span> Outlook Calendar
            </button>
            <label style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#6B7280;cursor:pointer;">
                <input type="checkbox" id="calRememberChoice" checked style="width:16px;height:16px;accent-color:#2563EB;"> Remember my choice
            </label>
            <button id="calChoice-cancel" style="display:block;width:100%;padding:12px;border:none;background:none;color:#6B7280;font-size:15px;margin-top:8px;cursor:pointer;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on backdrop tap
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });

    document.getElementById('calChoice-cancel').addEventListener('click', () => modal.remove());

    const appleBtn = document.getElementById('calChoice-apple');
    if (appleBtn) {
        appleBtn.addEventListener('click', () => {
            const remember = document.getElementById('calRememberChoice').checked;
            if (remember) localStorage.setItem('pi-calendar-preference', 'apple');
            modal.remove();
            _addToAppleCalendar(event);
        });
    }

    document.getElementById('calChoice-google').addEventListener('click', () => {
        const remember = document.getElementById('calRememberChoice').checked;
        if (remember) localStorage.setItem('pi-calendar-preference', 'google');
        modal.remove();
        window.open(urls.google, '_blank');
    });

    document.getElementById('calChoice-outlook').addEventListener('click', () => {
        const remember = document.getElementById('calRememberChoice').checked;
        if (remember) localStorage.setItem('pi-calendar-preference', 'outlook');
        modal.remove();
        window.open(urls.outlook, '_blank');
    });
}

async function _addToAppleCalendar(event) {
    try {
        const CapacitorCalendar = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorCalendar;
        if (!CapacitorCalendar) {
            console.warn('[Calendar] Native calendar plugin not available, falling back to ICS share');
            _shareICSFallback(event);
            return;
        }

        // Request calendar permission
        const perm = await CapacitorCalendar.checkAllPermissions();
        if (perm.readCalendar !== 'granted' || perm.writeCalendar !== 'granted') {
            await CapacitorCalendar.requestFullCalendarAccess();
        }

        // Parse event date/time
        const eventName = event['EVENT'] || 'BSL Interpreted Event';
        const venue = event['VENUE'] || '';
        const dateStr = event['DATE'] || '';
        const timeStr = event['TIME'] || '';
        const interpretation = event['INTERPRETATION'] || 'BSL';

        const parsed = formatDate(dateStr);
        if (parsed.day === '--') {
            if (typeof showToast === 'function') showToast('Could not parse event date');
            return;
        }

        let startHour = 19, startMin = 0, endHour = 22, endMin = 0;
        if (timeStr && timeStr !== 'TBC') {
            const timeParts = timeStr.split(' - ');
            const startMatch = timeParts[0].match(/(\d{1,2}):(\d{2})/);
            if (startMatch) { startHour = parseInt(startMatch[1]); startMin = parseInt(startMatch[2]); }
            if (timeParts[1]) {
                const endMatch = timeParts[1].match(/(\d{1,2}):(\d{2})/);
                if (endMatch) { endHour = parseInt(endMatch[1]); endMin = parseInt(endMatch[2]); }
            } else { endHour = startHour + 3; endMin = startMin; }
        }

        const startDate = new Date(parsed.dateObj);
        startDate.setHours(startHour, startMin, 0, 0);
        const endDate = new Date(parsed.dateObj);
        endDate.setHours(endHour, endMin, 0, 0);

        const description = `${interpretation} interpreted event.\n\nVenue: ${venue}${event['EVENT URL'] ? '\n\nEvent info: ' + event['EVENT URL'] : ''}\n\nFor accessible booking info visit: https://app.performanceinterpreting.co.uk/#/how-to-book`;

        await CapacitorCalendar.createEventWithPrompt({
            title: `${eventName} (${interpretation} Interpreted)`,
            startDate: startDate.getTime(),
            endDate: endDate.getTime(),
            location: venue,
            description: description,
            url: event['EVENT URL'] || 'https://app.performanceinterpreting.co.uk'
        });

        console.log('[Calendar] Apple Calendar event created via native plugin');
        if (typeof showToast === 'function') showToast('Event added to calendar');
    } catch (err) {
        if (err.message && err.message.includes('denied')) {
            if (typeof showToast === 'function') showToast('Calendar access denied — check Settings');
        } else {
            console.warn('[Calendar] Native calendar failed:', err);
            _shareICSFallback(event);
        }
    }
}

function _shareICSFallback(event) {
    try {
        const eventName = event['EVENT'] || 'BSL Interpreted Event';
        const fileName = `${eventName.replace(/[^a-z0-9]/gi, '_')}.ics`;
        // Re-generate ICS content for fallback
        const dateStr = event['DATE'] || '';
        const timeStr = event['TIME'] || '';
        const interpretation = event['INTERPRETATION'] || 'BSL';
        const venue = event['VENUE'] || '';
        const parsed = formatDate(dateStr);
        if (parsed.day === '--') { if (typeof showToast === 'function') showToast('Could not parse event date'); return; }
        const pad = n => n.toString().padStart(2, '0');
        const day = parsed.dateObj.getDate().toString().padStart(2, '0');
        const month = (parsed.dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = parsed.dateObj.getFullYear().toString();
        let startHour = 19, startMin = 0, endHour = 22, endMin = 0;
        if (timeStr && timeStr !== 'TBC') {
            const timeParts = timeStr.split(' - ');
            const sm = timeParts[0].match(/(\d{1,2}):(\d{2})/);
            if (sm) { startHour = parseInt(sm[1]); startMin = parseInt(sm[2]); }
            if (timeParts[1]) { const em = timeParts[1].match(/(\d{1,2}):(\d{2})/); if (em) { endHour = parseInt(em[1]); endMin = parseInt(em[2]); } }
            else { endHour = startHour + 3; endMin = startMin; }
        }
        const startDate = `${year}${pad(month)}${pad(day)}T${pad(startHour)}${pad(startMin)}00`;
        const endDate = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(endMin)}00`;
        const now = new Date();
        const created = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const icsContent = [
            'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Performance Interpreting//Events App//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
            `DTSTART:${startDate}`,`DTEND:${endDate}`,`DTSTAMP:${created}`,`UID:${Date.now()}@performanceinterpreting.co.uk`,
            `SUMMARY:${escapeICS(eventName)} (${escapeICS(interpretation)} Interpreted)`,`LOCATION:${escapeICS(venue)}`,
            `DESCRIPTION:${escapeICS(interpretation)} interpreted event.\\n\\nVenue: ${escapeICS(venue)}${event['EVENT URL'] ? '\\n\\nEvent info: ' + escapeICS(event['EVENT URL']) : ''}\\n\\nFor accessible booking info visit: https://app.performanceinterpreting.co.uk/#/how-to-book`,
            'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'
        ].join('\r\n');
        const file = new File([icsContent], fileName, { type: 'text/calendar' });
        if (navigator.share) {
            navigator.share({ files: [file] })
                .then(() => console.log('[Calendar] ICS share fallback complete'))
                .catch(err => { if (err.name !== 'AbortError') console.warn('[Calendar] Share error:', err); });
        } else {
            if (typeof showToast === 'function') showToast('Share not available — try Google Calendar');
        }
    } catch (err) {
        console.warn('[Calendar] ICS share fallback failed:', err);
        if (typeof showToast === 'function') showToast('Could not open calendar');
    }
}

// Allow resetting calendar preference
window.resetCalendarPreference = function() {
    localStorage.removeItem('pi-calendar-preference');
    if (typeof showToast === 'function') showToast('Calendar preference cleared');
};

// ========================================
// FESTIVAL APP LINKS
const FESTIVAL_APPS = {
    'reading festival': { name: 'Reading Festival', ios: 'https://apps.apple.com/gb/app/reading-festival/id1024718630', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.reading', web: 'https://www.readingfestival.com/info' },
    'leeds festival': { name: 'Leeds Festival', ios: 'https://apps.apple.com/gb/app/leeds-festival/id6755237536', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.leeds', web: 'https://www.leedsfestival.com/info' },
    'download festival': { name: 'Download Festival', ios: 'https://apps.apple.com/gb/app/download-festival/id439568471', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.downloadfestival', web: 'https://downloadfestival.co.uk/info-category/the-essentials/' },
    'download': { name: 'Download Festival', ios: 'https://apps.apple.com/gb/app/download-festival/id439568471', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.downloadfestival', web: 'https://downloadfestival.co.uk/info-category/the-essentials/' },
    'creamfields': { name: 'Creamfields', ios: 'https://apps.apple.com/gb/app/creamfields/id1578659813', android: 'https://play.google.com/store/apps/details?id=com.greencopper.creamfields', web: 'https://creamfields.com/app/' },
    'bst hyde park': { name: 'BST Hyde Park', ios: 'https://apps.apple.com/gb/app/bst-hyde-park/id892502483', android: 'https://play.google.com/store/apps/details?id=com.aeg.bst', web: 'https://www.bst-hydepark.com/info-details/app/', note: 'App required for entry (digital tickets)' },
    'wireless': { name: 'Wireless Festival', ios: 'https://apps.apple.com/gb/app/wireless-festival-2025/id1628130853', android: 'https://play.google.com/store/apps/details?id=com.greencopper.wirelessfinsburypark', web: 'https://wirelessfestival.co.uk/' },
    'wireless festival': { name: 'Wireless Festival', ios: 'https://apps.apple.com/gb/app/wireless-festival-2025/id1628130853', android: 'https://play.google.com/store/apps/details?id=com.greencopper.wirelessfinsburypark', web: 'https://wirelessfestival.co.uk/' },
    'latitude': { name: 'Latitude Festival', ios: 'https://apps.apple.com/gb/app/latitude-festival/id448178779', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.latitude', web: 'https://www.latitudefestival.com/app/' },
    'latitude festival': { name: 'Latitude Festival', ios: 'https://apps.apple.com/gb/app/latitude-festival/id448178779', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.latitude', web: 'https://www.latitudefestival.com/app/' },
    'isle of wight festival': { name: 'Isle of Wight Festival', ios: 'https://apps.apple.com/gb/app/isle-of-wight-festival-2025/id1363277827', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.isleofwightfestival', web: 'https://isleofwightfestival.com/info/' },
    'isle of wight': { name: 'Isle of Wight Festival', ios: 'https://apps.apple.com/gb/app/isle-of-wight-festival-2025/id1363277827', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.isleofwightfestival', web: 'https://isleofwightfestival.com/info/' },
    'camp bestival': { name: 'Camp Bestival', ios: 'https://apps.apple.com/gb/app/camp-bestival/id6451139832', android: 'https://play.google.com/store/apps/details?id=com.appmiral.campbestival', web: 'https://dorset.campbestival.net/info/' },
    'boardmasters': { name: 'Boardmasters', ios: 'https://apps.apple.com/gb/app/boardmasters-festival/id6450421154', android: 'https://play.google.com/store/apps/details?id=com.clarifimedia.festyvent.boardmasters', web: 'https://boardmasters.com/faqs/' },
    'electric picnic': { name: 'Electric Picnic', ios: 'https://apps.apple.com/gb/app/electric-picnic/id1145983673', android: 'https://play.google.com/store/apps/details?id=com.greencopper.android.electricpicnic', web: 'https://www.electricpicnic.ie/' },
    'wilderness': { name: 'Wilderness Festival', ios: 'https://apps.apple.com/gb/app/wilderness-2025/id1576208052', android: 'https://play.google.com/store/apps/details?id=com.greencopper.wilderness', web: 'https://www.wildernessfestival.com/info/the-wilderness-app/' },
    'wilderness festival': { name: 'Wilderness Festival', ios: 'https://apps.apple.com/gb/app/wilderness-2025/id1576208052', android: 'https://play.google.com/store/apps/details?id=com.greencopper.wilderness', web: 'https://www.wildernessfestival.com/info/the-wilderness-app/' },
    'victorious': { name: 'Victorious Festival', ios: 'https://apps.apple.com/gb/app/victorious-festival/id6445993026', android: 'https://play.google.com/store/apps/details?id=com.clarifimedia.festyvent.victorious', web: 'https://www.victoriousfestival.co.uk/' },
    'victorious festival': { name: 'Victorious Festival', ios: 'https://apps.apple.com/gb/app/victorious-festival/id6445993026', android: 'https://play.google.com/store/apps/details?id=com.clarifimedia.festyvent.victorious', web: 'https://www.victoriousfestival.co.uk/' },
    'silverstone festival': { name: 'Silverstone Festival', ios: 'https://apps.apple.com/gb/app/silverstone-events/id6448953849', android: 'https://play.google.com/store/apps/details?id=com.f1ss.venue.app', web: 'https://www.silverstone.co.uk/events/silverstone-festival/your-festival-checklist' },
    'big weekend': { name: 'BBC Radio 1 Big Weekend', ios: 'https://apps.apple.com/gb/app/bbc-radio-1s-big-weekend-2026/id6742843167', android: 'https://play.google.com/store/apps/details?id=com.appmiral.bbcradio1', web: 'https://www.bbc.com/backstage/bigweekend/' },
    'radio 2 in the park': { name: 'BBC Radio 2 in the Park', ios: 'https://apps.apple.com/gb/app/bbc-radio-2-in-the-park-2025/id6749952058', android: 'https://play.google.com/store/apps/details?id=com.appmiral.bbcradio2', web: 'https://www.bbc.co.uk/backstage/radio2inthepark/' },
    'brighton pride': { name: 'Brighton Pride', web: 'https://www.brighton-pride.org/access/' },
    'splendour': { name: 'Splendour Festival', web: 'https://www.splendourfestival.com/about/festival-map/' },
    'splendour festival': { name: 'Splendour Festival', web: 'https://www.splendourfestival.com/about/festival-map/' },
    'field day': { name: 'Field Day', web: 'https://fielddayfestivals.com/' },
};

function getFestivalAppLink(eventName) {
    if (!eventName) return null;
    const lower = eventName.toLowerCase();
    for (const [key, data] of Object.entries(FESTIVAL_APPS)) {
        if (lower.includes(key)) return data;
    }
    return null;
}

function openFestivalApp(festival) {
    const isIOS = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';
    let url;
    if (isIOS && festival.ios) url = festival.ios;
    else if (!isIOS && festival.android) url = festival.android;
    else url = festival.web;
    if (!url) return;
    openExternalLink(url);
}

function openExternalLink(url) {
    if (!isSafeUrl(url)) return;
    // For App Store links, open directly in App Store app (not SFSafariViewController)
    // This prevents WKWebView layout corruption on return
    const isAppStoreLink = url.includes('apps.apple.com') || url.includes('itunes.apple.com') || url.includes('play.google.com');
    if (isAppStoreLink && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        const isIOS = window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';
        if (isIOS) {
            // itms-apps:// opens App Store directly, no in-app browser
            window.location.href = url.replace('https://', 'itms-apps://');
        } else {
            // market:// opens Google Play directly on Android
            const playId = url.match(/id=([^&]+)/);
            if (playId) {
                window.location.href = 'market://details?id=' + playId[1];
            } else {
                window.location.href = url.replace('https://', 'intent://');
            }
        }
        return;
    }

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        window.Capacitor.Plugins.Browser.open({ url: url });
    } else {
        window.open(url, '_system');
    }
}
window.openExternalLink = openExternalLink;

window.openFestivalApp = openFestivalApp;
window.getFestivalAppLink = getFestivalAppLink;

// ACCESSIBILITY SETTINGS
// ========================================

function _applyTextSize(size) {
    if (size && size !== 'medium') {
        document.body.dataset.textSize = size;
    } else {
        delete document.body.dataset.textSize;
    }
    // Scale ALL text globally (works with px values on iOS WebKit)
    const scales = { small: '90%', medium: '100%', large: '115%' };
    document.body.style.webkitTextSizeAdjust = scales[size] || '100%';
}

function _applyReduceMotion(enabled) {
    if (enabled) {
        document.body.classList.add('reduce-motion');
    } else {
        document.body.classList.remove('reduce-motion');
    }
}

function _applyHighContrast(enabled) {
    if (enabled) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }
}

function _getUserType() {
    return localStorage.getItem('pi-user-type') || 'deaf';
}

function _isDeafblind() {
    return _getUserType() === 'deafblind';
}

function _isCompanion() {
    return _getUserType() === 'companion';
}

function _applyDeafblindMode(enabled) {
    if (enabled) {
        document.body.classList.add('deafblind');
        _applyTextSize('large');
        localStorage.setItem('pi-text-size', 'large');
        _applyHighContrast(true);
        localStorage.setItem('pi-high-contrast', 'true');
        _applyReduceMotion(true);
        localStorage.setItem('pi-reduce-motion', 'true');
    } else {
        document.body.classList.remove('deafblind');
        _applyHighContrast(false);
        localStorage.setItem('pi-high-contrast', 'false');
        _applyReduceMotion(false);
        localStorage.setItem('pi-reduce-motion', 'false');
    }
}

function _renderStaffCards() {
    const container = document.getElementById('commCardTab');
    if (!container) return;
    const type = _getUserType();

    if (type === 'deafblind') {
        container.innerHTML = `
            <div class="staff-card staff-card-large" style="border:3px solid #DC2626;">
                <div class="staff-card-header" style="background:#DC2626;font-size:16px;display:flex;align-items:center;gap:8px;">🦯 I Am Deafblind</div>
                <div class="staff-card-body" style="background:#1a1a1a;">
                    <p class="staff-card-line staff-card-primary" style="font-size:22px;font-weight:800;color:#fff;">I am Deafblind</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">I use tactile BSL — please sign into my hands</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">I need to sit next to the interpreter</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">Please guide me to my seat</p>
                </div>
            </div>
            <div class="staff-card staff-card-large" style="margin-top:1rem;border:3px solid #DC2626;">
                <div class="staff-card-header" style="background:#991B1B;font-size:16px;">🧑‍🤝‍🧑🧍 In a Queue</div>
                <div class="staff-card-body" style="background:#1a1a1a;">
                    <p class="staff-card-line staff-card-primary" style="font-size:22px;font-weight:800;color:#fff;">I am Deafblind</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">I cannot hear or see when it is my turn</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">Please tap my shoulder or hand</p>
                </div>
            </div>
            <div class="staff-card staff-card-large" style="margin-top:1rem;border:3px solid #fff;">
                <div class="staff-card-header" style="background:#374151;font-size:16px;">🐕‍🦺 Assistance Dog</div>
                <div class="staff-card-body" style="background:#1a1a1a;">
                    <p class="staff-card-line staff-card-primary" style="font-size:22px;font-weight:800;color:#fff;">I have an assistance dog</p>
                    <p class="staff-card-line" style="font-size:17px;font-weight:600;color:#E0E0E0;">Please show me where they can sit with me</p>
                </div>
            </div>`;
    } else {
        // Default: Deaf
        container.innerHTML = `
            <div class="staff-card staff-card-large" style="border-color:#475569;">
                <div class="staff-card-header" style="background:#475569;">👋 Show This to Staff</div>
                <div class="staff-card-body">
                    <p class="staff-card-line staff-card-primary">I am Deaf</p>
                    <p class="staff-card-line">Please face me when you talk</p>
                    <p class="staff-card-line">Speak clearly, normal speed</p>
                    <p class="staff-card-line">If possible, don't stand with light behind you</p>
                    <p class="staff-card-line">Please type or write for me</p>
                </div>
            </div>
            <div class="staff-card staff-card-large" style="margin-top: 1rem;border-color:#475569;">
                <div class="staff-card-header" style="background:#475569;">🧑‍🤝‍🧑🧍 In a Queue</div>
                <div class="staff-card-body">
                    <p class="staff-card-line staff-card-primary">I am Deaf</p>
                    <p class="staff-card-line">I cannot hear when it is my turn</p>
                    <p class="staff-card-line">Please tap my shoulder or wave</p>
                </div>
            </div>`;
    }
}

function showAccessNeedsChecklist() {
    if (!currentAccessEvent) {
        generateAccessEmail(null);
        return;
    }
    const isDB = _isDeafblind();
    const bg = isDB ? '#111' : '#fff';
    const textColor = isDB ? '#fff' : '#1F2937';
    const subtextColor = isDB ? '#ccc' : '#6B7280';
    const borderColor = isDB ? '#333' : '#E5E7EB';
    const cardBg = isDB ? '#1a1a1a' : '#fff';
    const accentColor = isDB ? '#DC2626' : '#2563EB';
    const checkSize = isDB ? '24px' : '22px';
    const labelSize = isDB ? '18px' : '16px';
    const descSize = isDB ? '14px' : '13px';
    const borderWidth = isDB ? '3px' : '2px';

    const options = [];
    if (isDB) {
        options.push({
            id: 'deafblind',
            label: '🦯 I am Deafblind',
            desc: 'I need tactile interpreting — sign into my hands',
            checked: true,
            highlight: true
        });
    }
    options.push(
        { id: 'wheelchair', label: 'I use a wheelchair', desc: 'I need accessible seating near the interpreter' },
        { id: 'companion', label: 'I need a companion or PA seat', desc: 'A seat next to mine for my support person' },
        { id: 'dog', label: isDB ? '🐕‍🦺 I have an assistance dog' : 'I have an assistance dog', desc: 'Space needed for my dog beside me' },
        { id: 'other', label: 'Other needs', desc: 'Add your own details below' }
    );

    const overlay = document.createElement('div');
    overlay.id = 'accessNeedsOverlay';
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:${bg};overflow-y:auto;-webkit-overflow-scrolling:touch;`;

    overlay.innerHTML = `
        <div style="padding:24px 20px;text-align:center;border-bottom:${borderWidth} solid ${borderColor};position:relative;">
            <button onclick="document.getElementById('accessNeedsOverlay').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;color:${subtextColor};cursor:pointer;padding:8px;line-height:1;" aria-label="Close">✕</button>
            <p style="margin:0 0 4px;font-size:${isDB ? '22px' : '20px'};font-weight:${isDB ? '800' : '700'};color:${textColor};">Your access needs</p>
            <p style="margin:0;font-size:${isDB ? '15px' : '14px'};font-weight:${isDB ? '600' : '400'};color:${subtextColor};">Select any that apply. These will be included in your email.</p>
        </div>
        <div style="padding:16px 20px;flex:1;">
            ${options.map(opt => `
                <label style="display:flex;align-items:center;gap:14px;padding:${isDB ? '16px' : '14px 16px'};border:${borderWidth} solid ${opt.highlight ? accentColor : borderColor};border-radius:12px;margin-bottom:10px;cursor:pointer;background:${cardBg};">
                    <input type="checkbox" data-need="${opt.id}" ${opt.checked ? 'checked' : ''} style="width:${checkSize};height:${checkSize};accent-color:${accentColor};flex-shrink:0;">
                    <div>
                        <div style="font-size:${labelSize};font-weight:${isDB ? '700' : '600'};color:${textColor};">${opt.label}</div>
                        <div style="font-size:${descSize};font-weight:${isDB ? '600' : '400'};color:${subtextColor};">${opt.desc}</div>
                    </div>
                </label>
            `).join('')}
            <textarea id="accessNeedsOther" maxlength="500" placeholder="Anything else the venue should know..." style="width:100%;box-sizing:border-box;padding:${isDB ? '14px' : '12px 14px'};border:${borderWidth} solid ${borderColor};border-radius:10px;font-size:${isDB ? '15px' : '14px'};font-weight:${isDB ? '600' : '400'};resize:vertical;min-height:60px;font-family:inherit;background:${cardBg};color:${textColor};display:none;"></textarea>
        </div>
        <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:8px;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));">
            <button id="accessNeedsSend" style="width:100%;padding:${isDB ? '18px' : '16px'};border:none;border-radius:12px;background:${accentColor};color:#fff;font-size:${isDB ? '18px' : '16px'};font-weight:${isDB ? '800' : '700'};cursor:pointer;">✉️ Send Email</button>
            <button id="accessNeedsSkip" style="width:100%;padding:${isDB ? '14px' : '12px'};border:${isDB ? '2px solid #444' : 'none'};border-radius:12px;background:${isDB ? cardBg : '#F3F4F6'};color:${isDB ? '#aaa' : '#6B7280'};font-size:${isDB ? '15px' : '14px'};font-weight:${isDB ? '600' : '400'};cursor:pointer;">Skip — send without access needs</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Ensure textarea stays visible when keyboard opens on iOS
    const otherTA = document.getElementById('accessNeedsOther');
    if (otherTA) {
        otherTA.addEventListener('focus', () => {
            // Add bottom padding so content can scroll above keyboard
            overlay.style.paddingBottom = '320px';
            setTimeout(() => {
                otherTA.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 400);
        });
        otherTA.addEventListener('blur', () => {
            overlay.style.paddingBottom = '';
        });
    }

    // Show/hide "Other" textarea when "Other needs" is checked
    const otherCheckbox = overlay.querySelector('[data-need="other"]');
    const otherTextarea = document.getElementById('accessNeedsOther');
    if (otherCheckbox) {
        otherCheckbox.addEventListener('change', () => {
            otherTextarea.style.display = otherCheckbox.checked ? 'block' : 'none';
            if (otherCheckbox.checked) otherTextarea.focus();
        });
    }

    // Haptic on checkbox toggle
    overlay.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => nativeHaptic('light'));
    });

    // Send button
    document.getElementById('accessNeedsSend').addEventListener('click', () => {
        const needs = {};
        overlay.querySelectorAll('input[data-need]:checked').forEach(cb => {
            needs[cb.dataset.need] = true;
        });
        needs.otherText = (otherTextarea.value || '').trim().slice(0, 500);
        overlay.remove();
        generateAccessEmail(needs);
    });

    // Skip button
    document.getElementById('accessNeedsSkip').addEventListener('click', () => {
        overlay.remove();
        generateAccessEmail(null);
    });
}

// Apply saved accessibility settings on load
(function _initAccessibilitySettings() {
    const size = localStorage.getItem('pi-text-size');
    if (size) {
        _applyTextSize(size);
    } else if (window.innerWidth >= 768) {
        // Tablet: default to medium (middle setting) so user can go up or down in Settings
        _applyTextSize('medium');
        localStorage.setItem('pi-text-size', 'medium');
    }

    if (localStorage.getItem('pi-reduce-motion') === 'true') _applyReduceMotion(true);
    if (localStorage.getItem('pi-high-contrast') === 'true') _applyHighContrast(true);

    // Apply deafblind body class if user type is deafblind
    if (_isDeafblind()) {
        document.body.classList.add('deafblind');
    }
})();

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
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
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
window.showAccessNeedsChecklist = showAccessNeedsChecklist;
window.openVRSLink = openVRSLink;
window.openOfficialSite = openOfficialSite;
// KYR window assignments handled by index.html inline script

// ========================================
// COMMUNICATION SUPPORT MODAL
// ========================================

let sttRecognition = null;
let sttIsListening = false;

function openVideoModal() {
    storeModalTrigger();
    const video = document.getElementById('bslVideo');
    if (!video) return;

    video.currentTime = 0;

    // Start play and request PiP together — both need user gesture
    const playPromise = video.play();
    const canPiP = document.pictureInPictureEnabled && !document.pictureInPictureElement;

    const offline = !navigator.onLine;
    if (canPiP && !offline) {
        // Request PiP synchronously in the same gesture tick
        video.requestPictureInPicture().then(() => {
            video.addEventListener('leavepictureinpicture', () => {
                video.pause();
            }, { once: true });
        }).catch(() => {
            // PiP failed — show modal instead
            showVideoModal(false);
        });
    } else {
        showVideoModal(offline);
    }
}

function showVideoModal(isOffline) {
    const modal = document.getElementById('bslVideoModal');
    if (!modal) return;
    const video = document.getElementById('bslVideo');
    const offlinePlaceholder = document.getElementById('bslVideoOffline');

    if (isOffline) {
        if (video) video.style.display = 'none';
        if (offlinePlaceholder) offlinePlaceholder.style.display = '';
    } else {
        if (video) video.style.display = '';
        if (offlinePlaceholder) offlinePlaceholder.style.display = 'none';
        // Show offline message if video fails to load
        if (video && offlinePlaceholder) {
            video.onerror = () => {
                video.style.display = 'none';
                offlinePlaceholder.style.display = '';
            };
        }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activateFocusTrap(modal);
    pushModalState('bslVideoModal', closeVideoModal);
}

function closeVideoModal() {
    deactivateFocusTrap();
    const modal = document.getElementById('bslVideoModal');
    const video = document.getElementById('bslVideo');
    if (video) video.pause();
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
    }
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    restoreModalFocus();
    clearModalState();
}

window.openVideoModal = openVideoModal;
window.closeVideoModal = closeVideoModal;

// iOS WKWebView: force top bar to re-evaluate safe-area-inset-top after native fullscreen exit.
// The video element's fullscreen button triggers webkit fullscreen (separate from our modal),
// and WKWebView doesn't always repaint env(safe-area-inset-top) correctly when exiting.
if (IS_NATIVE_APP) {
    ['webkitfullscreenchange', 'fullscreenchange'].forEach(evt => {
        document.addEventListener(evt, () => {
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFullscreen) {
                // Exited fullscreen — force top bar to recalculate safe area padding
                setTimeout(() => {
                    const topBar = document.querySelector('.native-top-bar');
                    if (topBar) {
                        topBar.style.paddingTop = '0';
                        requestAnimationFrame(() => { topBar.style.paddingTop = ''; });
                    }
                }, 50);
            }
        });
    });
}

// BSL Video metadata: src, captions track, optional chapter markers
// Real recordings from Radha (April 2026), uploaded to Cloudflare R2 (pi-events-media)
const MEDIA_BASE = 'https://media.performanceinterpreting.co.uk';
const bslVideos = {
    'how-to-book':   {
        src: MEDIA_BASE + '/bsl-how-to-book.mp4',
        vtt: MEDIA_BASE + '/bsl-how-to-book.vtt',
        chapters: [
            { time: 0,    label: 'Intro' },
            { time: 10,   label: '1. Find your event' },
            { time: 23,   label: '2. Check venues list' },
            { time: 37,   label: '3. Contact the venue' },
            { time: 53,   label: '4. Tell them what you need' },
            { time: 70,   label: '5. Get email confirmation' },
            { time: 83,   label: '6. Enjoy the event' },
            { time: 103,  label: 'Venues & Ticket Vendors' }
        ]
    },
    'know-rights':   {
        src: MEDIA_BASE + '/bsl-know-rights.mp4',
        vtt: MEDIA_BASE + '/bsl-know-rights.vtt',
        chapters: [
            { time: 0,    label: 'Disclaimer' },
            { time: 7,    label: 'Your rights' },
            { time: 16,   label: 'England, Wales, Scotland' },
            { time: 56,   label: 'Northern Ireland' },
            { time: 80,   label: 'No extra cost' },
            { time: 91,   label: 'Companion tickets' },
            { time: 101,  label: 'Nimbus Access Card' },
            { time: 121,  label: 'Getting help' }
        ]
    },
    'orientation':   {
        src: MEDIA_BASE + '/bsl-orientation.mp4',
        vtt: MEDIA_BASE + '/bsl-orientation.vtt',
        chapters: [
            { time: 0,    label: 'Welcome' },
            { time: 15,   label: 'Events tab' },
            { time: 75,   label: 'Support tab' },
            { time: 110,  label: 'BSL & ISL tab' },
            { time: 133,  label: 'Notifications' },
            { time: 159,  label: 'More tab' },
            { time: 200,  label: 'Get in touch' }
        ]
    },
    'categories':    { src: MEDIA_BASE + '/bsl-categories.mp4',    vtt: MEDIA_BASE + '/bsl-categories.vtt' },
    'search':        { src: MEDIA_BASE + '/bsl-search.mp4',        vtt: MEDIA_BASE + '/bsl-search.vtt' },
    'request':       { src: MEDIA_BASE + '/bsl-request.mp4',       vtt: MEDIA_BASE + '/bsl-request.vtt' },
    'booking':       { src: MEDIA_BASE + '/bsl-booking.mp4',       vtt: MEDIA_BASE + '/bsl-booking.vtt' },
    'faqs':          {
        src: MEDIA_BASE + '/bsl-faqs.mp4',
        vtt: MEDIA_BASE + '/bsl-faqs.vtt',
        chapters: [
            { time: 0,      label: 'Q1: Need to ask first?' },
            { time: 31.32,  label: 'Q2: How early to book?' },
            { time: 54.56,  label: 'Q3: Cost more?' },
            { time: 76.44,  label: 'Q4: Bring someone?' },
            { time: 94.36,  label: 'Q5: BSL vs ISL?' },
            { time: 121.12, label: 'Q7: Where is interpreter?' }
        ]
    },
    'tips':          {
        src: MEDIA_BASE + '/bsl-tips.mp4',
        vtt: MEDIA_BASE + '/bsl-tips.vtt',
        chapters: [
            { time: 0,    label: 'Intro' },
            { time: 9,    label: 'Tip 1: Access booking line' },
            { time: 24,   label: 'Tip 2: Best seats' },
            { time: 41,   label: 'Tip 3: Email confirmation' },
            { time: 53,   label: 'Tip 4: Arrive early' },
            { time: 63.5, label: 'Tip 5: Tell us how it went' }
        ]
    },
    'at-event':      {
        src: MEDIA_BASE + '/bsl-at-event.mp4',
        vtt: MEDIA_BASE + '/bsl-at-event.vtt',
        chapters: [
            { time: 0,    label: 'Intro' },
            { time: 6,    label: 'Show Staff' },
            { time: 22,   label: 'Order' },
            { time: 33,   label: 'Emergency' },
            { time: 50,   label: 'Speech to Text' }
        ]
    },
    'notifications': { src: MEDIA_BASE + '/bsl-notifications.mp4', vtt: MEDIA_BASE + '/bsl-notifications.vtt' },
    'volunteer':     { src: MEDIA_BASE + '/bsl-volunteer.mp4',     vtt: MEDIA_BASE + '/bsl-volunteer.vtt' }
};

// ISL Video metadata — Sarah's recordings still pending. Placeholders until processed.
// ISL Video metadata — Sarah's recordings, rendered 9 Apr 2026
const islVideos = {
    'how-to-book':   {
        src: MEDIA_BASE + '/isl-how-to-book.mp4',
        vtt: MEDIA_BASE + '/isl-how-to-book.vtt',
        chapters: [
            { time: 0.1,  label: 'Intro' },
            { time: 11.6, label: '1. Find your event' },
            { time: 23.4, label: '2. Check venues list' },
            { time: 37.6, label: '3. Contact the venue' },
            { time: 47.6, label: '4. Get confirmation' },
            { time: 61.0, label: '5. Book your ticket' },
            { time: 73.3, label: '6. Enjoy the event' },
            { time: 86.0, label: 'Venues & Ticket Vendors' }
        ]
    },
    'know-rights':   {
        src: MEDIA_BASE + '/isl-know-rights.mp4',
        vtt: MEDIA_BASE + '/isl-know-rights.vtt',
        chapters: [
            { time: 0.1,  label: 'Disclaimer' },
            { time: 14.6, label: 'Your rights in Ireland' },
            { time: 41.5, label: 'Northern Ireland' },
            { time: 64.0, label: 'No extra cost' },
            { time: 71.7, label: 'Getting help' }
        ]
    },
    'orientation':   {
        src: MEDIA_BASE + '/isl-orientation.mp4',
        vtt: MEDIA_BASE + '/isl-orientation.vtt',
        chapters: [
            { time: 0.8,   label: 'Welcome' },
            { time: 19.9,  label: 'Events tab' },
            { time: 88.5,  label: 'Support tab' },
            { time: 127.2, label: 'ISL & BSL tab' },
            { time: 146.6, label: 'Notifications' },
            { time: 169.4, label: 'More tab' },
            { time: 203.5, label: 'Get in touch' }
        ]
    },
    'categories':    { src: MEDIA_BASE + '/isl-categories.mp4',    vtt: MEDIA_BASE + '/isl-categories.vtt' },
    'search':        { src: MEDIA_BASE + '/isl-search.mp4',        vtt: MEDIA_BASE + '/isl-search.vtt' },
    'request':       { src: MEDIA_BASE + '/isl-request.mp4',       vtt: MEDIA_BASE + '/isl-request.vtt' },
    'booking':       { src: MEDIA_BASE + '/isl-booking.mp4',       vtt: MEDIA_BASE + '/isl-booking.vtt' },
    'faqs':          {
        src: MEDIA_BASE + '/isl-faqs.mp4',
        vtt: MEDIA_BASE + '/isl-faqs.vtt',
        chapters: [
            { time: 0.4,    label: 'Q1: Need to ask first?' },
            { time: 27.1,   label: 'Q2: How early to book?' },
            { time: 50.62,  label: 'Q3: Cost more?' },
            { time: 70.22,  label: 'Q4: Bring someone?' },
            { time: 126.32, label: 'Q5: ISL & BSL' },
            { time: 158.32, label: 'Q6: Choose my interpreter?' }
        ]
    },
    'tips':          {
        src: MEDIA_BASE + '/isl-tips.mp4',
        vtt: MEDIA_BASE + '/isl-tips.vtt',
        chapters: [
            { time: 0,    label: 'Intro' },
            { time: 12.8, label: 'Tip 1: Access booking line' },
            { time: 23.6, label: 'Tip 2: Best seats' },
            { time: 37.2, label: 'Tip 3: Email confirmation' },
            { time: 48.5, label: 'Tip 4: Arrive early' },
            { time: 56.4, label: 'Tip 5: Tell us how it went' }
        ]
    },
    'at-event':      {
        src: MEDIA_BASE + '/isl-at-event.mp4',
        vtt: MEDIA_BASE + '/isl-at-event.vtt',
        chapters: [
            { time: 0.5,  label: 'Intro' },
            { time: 8.0,  label: 'Show Staff' },
            { time: 29.7, label: 'Order' },
            { time: 40.5, label: 'Emergency' },
            { time: 56.4, label: 'Speech to Text' }
        ]
    },
    'notifications': { src: MEDIA_BASE + '/isl-notifications.mp4', vtt: MEDIA_BASE + '/isl-notifications.vtt' },
    'volunteer':     { src: MEDIA_BASE + '/isl-volunteer.mp4',     vtt: MEDIA_BASE + '/isl-volunteer.vtt' }
};

// Backward-compatibility alias — keeps any external references working
const bslVideoUrls = Object.fromEntries(Object.entries(bslVideos).map(([k, v]) => [k, v.src]));
const islVideoUrls = Object.fromEntries(Object.entries(islVideos).map(([k, v]) => [k, v.src]));

function getVideoLanguage() {
    return localStorage.getItem('piVideoLanguage') || 'bsl';
}

function setVideoLanguage(lang) {
    localStorage.setItem('piVideoLanguage', lang);
    // Update the toggle UI if it exists
    document.querySelectorAll('.bsl-lang-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Hide the first-launch prompt if visible
    const prompt = document.getElementById('bslLangPrompt');
    if (prompt) prompt.style.display = 'none';
    // Update all video button labels across the app
    updateVideoLangLabels(lang);
}

function updateVideoLangLabels(lang) {
    const label = (lang || getVideoLanguage()).toUpperCase();
    document.querySelectorAll('.video-lang-label').forEach(el => {
        el.textContent = label;
    });
}

// Render the chapter "jump to section" buttons in the modal for the current video.
// Hides the container if the video has no chapters.
function _renderBSLChapters(video, chapters) {
    const container = document.getElementById('bslVideoChapters');
    if (!container) return;
    if (!chapters || chapters.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
    };
    container.innerHTML = '<div class="bsl-chapter-title">Jump to section</div>' +
        '<div class="bsl-chapter-list">' +
        chapters.map((ch, i) =>
            '<button type="button" class="bsl-chapter-btn" data-time="' + ch.time + '" data-idx="' + i + '">' +
                '<span class="bsl-chapter-label">' + ch.label + '</span>' +
                '<span class="bsl-chapter-time">' + fmt(ch.time) + '</span>' +
            '</button>'
        ).join('') +
        '</div>';
    container.style.display = 'block';
    // Wire click handlers
    container.querySelectorAll('.bsl-chapter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = parseFloat(btn.dataset.time);
            video.currentTime = t;
            video.play().catch(() => {});
        });
    });
    // Highlight active chapter as the video plays
    const highlight = () => {
        const t = video.currentTime;
        let active = -1;
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (t >= chapters[i].time) { active = i; break; }
        }
        container.querySelectorAll('.bsl-chapter-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === active);
        });
    };
    // Avoid stacking listeners across switches
    if (video._bslChapterHighlight) {
        video.removeEventListener('timeupdate', video._bslChapterHighlight);
    }
    video._bslChapterHighlight = highlight;
    video.addEventListener('timeupdate', highlight);
    highlight();
}

function playBSLVideo(name) {
    storeModalTrigger();
    const lang = getVideoLanguage();
    const video = document.getElementById('bslVideo');
    if (!video) return;
    const videoMap = lang === 'isl' ? islVideos : bslVideos;
    const meta = videoMap[name] || videoMap['orientation'];
    const source = video.querySelector('source');
    const track = video.querySelector('track');
    // ?v=2 bust the pre-wildcard-CORS edge cache. Bump if we ever need to re-bust.
    const versionedSrc = meta.src + '?v=2';
    if (source && source.src !== versionedSrc) {
        source.src = versionedSrc;
        if (track) {
            // Cache-bust captions during dev so updates show without HTTP cache delay
            track.src = meta.vtt ? (meta.vtt + '?_t=' + Date.now()) : '';
            track.track && (track.track.mode = 'showing');
        }
        video.load();
    }
    _renderBSLChapters(video, meta.chapters);
    video.currentTime = 0;
    const offline = !navigator.onLine;
    showVideoModal(offline);
    if (!offline) video.play().catch(() => {});
}

window.playBSLVideo = playBSLVideo;
window.getVideoLanguage = getVideoLanguage;
window.setVideoLanguage = setVideoLanguage;

function openCommSupportModal() {
    storeModalTrigger();
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
    _renderStaffCards();

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activateFocusTrap(modal);
    pushModalState('commSupportModal', closeCommSupportModal);
}

function closeCommSupportModal() {
    deactivateFocusTrap();
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
    restoreModalFocus();
    clearModalState();
}

function switchCommTab(tab) {
    const tabMap = {
        card: 'commCardTab',
        order: 'commOrderTab',
        emergency: 'commEmergencyTab',
        stt: 'commSTTTab',
        ftm: 'commFTMTab'
    };
    const inactiveColors = {
        '#475569': { bg: '#F1F5F9', text: '#475569' },
        '#0891B2': { bg: '#CFFAFE', text: '#0E7490' },
        '#EF4444': { bg: '#FEE2E2', text: '#EF4444' },
        '#7C3AED': { bg: '#EDE9FE', text: '#7C3AED' },
        '#8B5CF6': { bg: '#EDE9FE', text: '#8B5CF6' }
    };
    const tabKeys = Object.keys(tabMap);
    const tabs = document.querySelectorAll('.comm-tab');

    tabs.forEach((t, i) => {
        const isActive = tabKeys[i] === tab;
        t.classList.toggle('active', isActive);
        const color = t.dataset.color || '#2563EB';
        if (isActive) {
            t.style.background = color;
            t.style.color = 'white';
            t.style.borderColor = color;
        } else {
            const ic = inactiveColors[color] || { bg: 'rgba(37,99,235,0.08)', text: color };
            t.style.background = ic.bg;
            t.style.color = ic.text;
            t.style.borderColor = color;
        }
    });

    tabKeys.forEach(key => {
        const el = document.getElementById(tabMap[key]);
        if (el) el.style.display = key === tab ? 'block' : 'none';
    });
}

// Order builder functions
let currentOrder = [];
let orderShown = false;

// Order sub-selection modal
let _orderAskCheese = false;

function openOrderSubModal(category, options, askCheese) {
    const modal = document.getElementById('orderSubModal');
    const title = document.getElementById('orderSubTitle');
    const optionsContainer = document.getElementById('orderSubOptions');
    if (!modal || !title || !optionsContainer) return;

    _orderAskCheese = !!askCheese;
    title.textContent = category;
    optionsContainer.innerHTML = options.map(opt =>
        `<button onclick="addOrderFromSub('${escapeHtml(category)}', '${escapeHtml(opt)}')" style="padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:16px;font-weight:500;color:#1F2937;cursor:pointer;text-align:left;transition:background 0.15s;">${escapeHtml(opt)}</button>`
    ).join('');

    modal.style.display = 'flex';
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

function showCheeseModal(itemText) {
    const modal = document.getElementById('orderSubModal');
    const title = document.getElementById('orderSubTitle');
    const optionsContainer = document.getElementById('orderSubOptions');
    if (!modal || !title || !optionsContainer) return;

    _orderAskCheese = false;
    title.textContent = '🧀 With cheese?';
    optionsContainer.innerHTML = `
        <button onclick="confirmCheese('${escapeHtml(itemText)}', true)" style="padding:14px 16px;border:1px solid #0891B2;border-radius:12px;background:#CFFAFE;font-size:16px;font-weight:600;color:#0E7490;cursor:pointer;text-align:center;">Yes</button>
        <button onclick="confirmCheese('${escapeHtml(itemText)}', false)" style="padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:16px;font-weight:500;color:#1F2937;cursor:pointer;text-align:center;">No</button>
    `;
}

function confirmCheese(itemText, withCheese) {
    const finalItem = withCheese ? itemText + ' with Cheese' : itemText;
    currentOrder.push(finalItem);
    renderOrderItems();
    updateOrderButton();
    updateOrderBadges();
    closeOrderSubModal();
    if (typeof nativeHaptic === 'function') nativeHaptic('medium');
}
window.showCheeseModal = showCheeseModal;
window.confirmCheese = confirmCheese;

function closeOrderSubModal() {
    const modal = document.getElementById('orderSubModal');
    if (modal) modal.style.display = 'none';
}

function addOrderFromSub(category, option) {
    // Build a natural-sounding order item
    // e.g. "Still Water", "Pint of Beer", "Small Red Wine", "Vodka (Single)"
    const sizeFirst = ['Small', 'Medium', 'Large', 'Bottle', 'Half Pint', 'Pint'];
    const spiritTypes = ['Vodka', 'Rum', 'Whiskey', 'Tequila', 'Gin', 'Brandy'];
    let itemText;

    if (category === 'Water') {
        itemText = option + ' Water';
    } else if (category === 'Soft Drink') {
        itemText = option;
    } else if (category === 'Beer / Lager') {
        itemText = option === 'Shandy' ? 'Shandy' : option + ' of Beer';
    } else if (category === 'Cider') {
        itemText = option === 'Normal' ? 'Cider' : option + ' Cider';
    } else if (sizeFirst.includes(option) && (category.includes('Wine'))) {
        itemText = option + ' ' + category;
    } else if (category === 'Sparkling Wine') {
        itemText = option;
    } else if (category === 'Single Spirit') {
        itemText = option + ' (Single)';
    } else if (category === 'Double Spirit') {
        itemText = option + ' (Double)';
    } else if (category === 'Cocktail') {
        itemText = option;
    } else if (category === 'Tea' || category === 'Coffee') {
        itemText = option === 'Normal' ? category : option + ' ' + category;
    } else if (category === 'Hot Chocolate') {
        itemText = option === 'Normal' ? 'Hot Chocolate' : option + ' Hot Chocolate';
    } else if (option === 'Regular' || option === 'Normal') {
        itemText = category;
    } else if (option.startsWith('+ ')) {
        // Addon like "+ Cheese" — append to category
        itemText = category + ' ' + option;
    } else {
        itemText = option + ' ' + category;
    }

    // If this category asks about cheese, show follow-up
    if (_orderAskCheese) {
        showCheeseModal(itemText);
        return;
    }

    currentOrder.push(itemText);
    renderOrderItems();
    updateOrderButton();
    updateOrderBadges();
    closeOrderSubModal();
    if (typeof nativeHaptic === 'function') nativeHaptic('medium');
}

// Update red counter badges on order-pick buttons
function updateOrderBadges() {
    document.querySelectorAll('.order-pick').forEach(btn => {
        // Get category from the onclick attribute
        const onclickAttr = btn.getAttribute('onclick') || '';
        const match = onclickAttr.match(/openOrderSubModal\('([^']+)'/);
        if (!match) return;
        const category = match[1];

        // Count items in this category
        const count = currentOrder.filter(item => {
            // Match items that were generated from this category
            if (category === 'Water') return item.includes('Water');
            if (category === 'Soft Drink') return ['Coke', 'Pepsi', 'Lemonade', 'Fanta', 'Dr Pepper', 'Red Bull', 'Monster', 'Prime'].some(s => item.includes(s));
            if (category === 'Beer / Lager') return item.includes('Beer') || item === 'Shandy';
            if (category === 'Cider') return item.includes('Cider');
            if (category === 'Tea') return item.includes('Tea');
            if (category === 'Coffee') return item.includes('Coffee');
            if (category === 'Hot Chocolate') return item.includes('Hot Chocolate');
            if (category === 'Red Wine') return item.includes('Red Wine');
            if (category === 'White Wine') return item.includes('White Wine') && !item.includes('Sparkling');
            if (category === 'Sparkling Wine') return ['Spritzer', 'Prosecco', 'Champagne'].some(s => item.includes(s));
            if (category === 'Single Spirit') return item.includes('(Single)');
            if (category === 'Double Spirit') return item.includes('(Double)');
            if (category === 'Cocktail') return ['Margarita', 'Martini', 'Mojito', 'Negroni', 'Whiskey Sour'].some(s => item.includes(s));
            if (category === 'Burger') return item.includes('Burger');
            if (category === 'Pizza') return item.includes('Pizza');
            if (category === 'Chips') return item.includes('Chips');
            if (category === 'Hot Dog') return item.includes('Hot Dog');
            if (category === 'Wrap / Burrito') return item.includes('Wrap');
            if (category === 'Nachos') return item.includes('Nachos');
            return false;
        }).length;

        // Remove existing badge
        const existing = btn.querySelector('.order-badge');
        if (existing) existing.remove();

        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'order-badge';
            badge.textContent = count;
            badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;background:#DC2626;color:white;font-size:11px;font-weight:700;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 5px;';
            btn.style.position = 'relative';
            btn.appendChild(badge);
        }
    });
}

window.openOrderSubModal = openOrderSubModal;
window.closeOrderSubModal = closeOrderSubModal;
window.addOrderFromSub = addOrderFromSub;

// Inline feedback navigation (More tab subview)
function showInlineVideoFeedback() {
    document.getElementById('feedbackChoiceInline').style.display = 'none';
    document.getElementById('feedbackVideoInline').style.display = '';
    document.getElementById('feedbackWrittenInline').style.display = 'none';
}
function showInlineWrittenFeedback() {
    document.getElementById('feedbackChoiceInline').style.display = 'none';
    document.getElementById('feedbackVideoInline').style.display = 'none';
    document.getElementById('feedbackWrittenInline').style.display = '';
}
async function handleVideoFeedbackInline(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        alert('Video is too large (max 50MB). Please record a shorter video.');
        input.value = '';
        return;
    }
    var progress = document.getElementById('feedbackUploadProgressInline');
    var bar = document.getElementById('feedbackUploadBarInline');
    var status = document.getElementById('feedbackUploadStatusInline');
    var success = document.getElementById('feedbackUploadSuccessInline');
    progress.style.display = '';
    bar.style.width = '10%';
    status.textContent = 'Uploading video...';
    status.style.color = '#6B7280';
    try {
        var response = await fetch('https://pi-feedback-uploads.vercel.app/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'video/mp4',
            },
            body: file,
        });
        bar.style.width = '80%';
        if (!response.ok) {
            var errData = await response.json().catch(function() { return {}; });
            throw new Error(errData.error || 'Upload failed');
        }
        bar.style.width = '100%';
        status.textContent = 'Done!';
        progress.style.display = 'none';
        success.style.display = '';
        input.value = '';
    } catch (err) {
        console.error('Upload error:', err);
        bar.style.width = '0%';
        status.textContent = err.message || 'Upload failed. Please try again.';
        status.style.color = '#DC2626';
        input.value = '';
    }
}
window.showInlineVideoFeedback = showInlineVideoFeedback;
window.showInlineWrittenFeedback = showInlineWrittenFeedback;
window.handleVideoFeedbackInline = handleVideoFeedbackInline;

function addOrderItem(btn) {
    const itemText = btn.dataset.item || btn.textContent.trim().replace(/\s*×\s*\d+$/, '');
    btn.dataset.item = itemText;
    currentOrder.push(itemText);
    // Show count on the button itself
    const count = currentOrder.filter(i => i === itemText).length;
    btn.textContent = count > 1 ? itemText + ' × ' + count : itemText;
    btn.style.background = '#CFFAFE';
    btn.style.borderColor = '#0891B2';
    // Brief pulse animation
    btn.style.transform = 'scale(1.05)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
    renderOrderItems();
    updateOrderButton();
}

function addCustomOrderItem() {
    const input = document.getElementById('orderCustomInput');
    if (input && input.value.trim()) {
        currentOrder.push(input.value.trim());
        input.value = '';
        renderOrderItems();
        updateOrderButton();
    }
}

function removeOrderItem(index) {
    currentOrder.splice(index, 1);
    renderOrderItems();
    updateOrderButton();
    updateOrderBadges();
}

function renderOrderItems() {
    const container = document.getElementById('orderItems');
    if (!container) return;
    if (currentOrder.length === 0) {
        container.innerHTML = '';
    } else {
        container.innerHTML = currentOrder.map((item, i) =>
            `<span class="order-item-tag">${escapeHtml(item)} <button onclick="removeOrderItem(${i})" aria-label="Remove">&times;</button></span>`
        ).join('');
    }
    // Update count badge
    const badge = document.getElementById('orderCountBadge');
    if (badge) {
        if (currentOrder.length > 0) {
            badge.textContent = currentOrder.length + (currentOrder.length === 1 ? ' item added ↓' : ' items added ↓');
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }
}

function updateOrderButton() {
    const btn = document.getElementById('showOrderBtn');
    if (!btn) return;
    if (orderShown && currentOrder.length > 0) {
        btn.textContent = '📋 Update Order';
    } else {
        btn.textContent = '📋 Create Order';
    }
    // Ensure shimmer class is always present
    if (!btn.classList.contains('btn-shimmer')) {
        btn.classList.add('btn-shimmer');
    }
    // Enable/disable Ready button and update its label
    const readyBtn = document.getElementById('orderReadyBtn');
    if (readyBtn) {
        readyBtn.disabled = currentOrder.length === 0;
        if (orderShown && currentOrder.length > 0) {
            readyBtn.textContent = 'Update ✓';
        } else {
            readyBtn.textContent = 'Ready ✓';
        }
    }
}

function groupOrderItems(items) {
    const counts = {};
    items.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).map(([item, count]) =>
        count > 1 ? `${item} x${count}` : item
    );
}

function showOrderCard() {
    const displayList = document.getElementById('orderDisplayList');
    if (!displayList) return;
    if (currentOrder.length === 0) {
        displayList.innerHTML = '<p class="staff-card-line order-empty-hint" style="color: #9CA3AF; font-style: italic;">Press \u2018📋 Create Order\u2019 for your items to show here</p>';
        orderShown = false;
        updateOrderButton();
        return;
    }
    const grouped = groupOrderItems(currentOrder);
    displayList.innerHTML = grouped.map(item =>
        `<p class="staff-card-line order-item-line">${escapeHtml(item)}</p>`
    ).join('');
    displayList.closest('.staff-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    orderShown = true;
    updateOrderButton();
}

function clearOrder() {
    currentOrder = [];
    orderShown = false;
    renderOrderItems();
    updateOrderButton();
    updateOrderBadges();
    const displayList = document.getElementById('orderDisplayList');
    if (displayList) {
        displayList.innerHTML = '<p class="staff-card-line order-empty-hint" style="color: #9CA3AF; font-style: italic;">Press \u2018📋 Create Order\u2019 for your items to show here</p>';
    }
    // Reset all button states
    document.querySelectorAll('.order-pick').forEach(btn => {
        if (btn.dataset.item) {
            btn.textContent = btn.dataset.item;
            delete btn.dataset.item;
        }
        btn.style.background = '';
        btn.style.borderColor = '';
    });
}

function toggleSTT() {
    if (sttIsListening) {
        stopSTT();
    } else {
        startSTT();
    }
}

function startSTT() {
    const display = document.getElementById('sttDisplay');
    const textEl = document.getElementById('sttText');
    const placeholder = document.getElementById('sttPlaceholder');
    const toggleBtn = document.getElementById('sttToggleBtn');

    const isAndroid = IS_NATIVE_APP && window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android';

    // Android native: use custom NativeSpeechRecognition plugin
    if (isAndroid && window.Capacitor.Plugins.NativeSpeechRecognition) {
        const plugin = window.Capacitor.Plugins.NativeSpeechRecognition;
        let finalTranscript = textEl ? (textEl.textContent || '') : '';

        plugin.addListener('onState', (data) => {
            if (data.status === 'listening') {
                sttIsListening = true;
                if (display) display.classList.add('listening');
                if (placeholder) placeholder.style.display = 'none';
                if (toggleBtn) { toggleBtn.textContent = '🛑 Stop Listening'; toggleBtn.classList.add('listening'); }
            } else if (data.status === 'stopped') {
                sttIsListening = false;
                if (display) display.classList.remove('listening');
                if (toggleBtn) { toggleBtn.textContent = '🎙️ Start Listening'; toggleBtn.classList.remove('listening'); }
            }
        });

        plugin.addListener('onResult', (data) => {
            if (data.isFinal) {
                finalTranscript += data.transcript + ' ';
            }
            if (textEl) { textEl.textContent = finalTranscript + (data.isFinal ? '' : data.transcript); }
        });

        plugin.start({ language: 'en-GB' }).catch(err => {
            if (typeof showToast === 'function') showToast('Speech recognition failed: ' + (err.message || err));
        });
        return;
    }

    // iOS / Web: use Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (typeof showToast === 'function') showToast('Speech-to-text is not available on this device.');
        return;
    }

    // Web Speech API path
    function initRecognition() {
        sttRecognition = new SpeechRecognition();
        sttRecognition.continuous = true;
        sttRecognition.interimResults = true;
        sttRecognition.lang = 'en-GB';

        let finalTranscript = textEl ? (textEl.textContent || '') : '';

        sttRecognition.onstart = () => {
            sttIsListening = true;
            if (display) display.classList.add('listening');
            if (placeholder) placeholder.style.display = 'none';
            if (toggleBtn) { toggleBtn.textContent = '🛑 Stop Listening'; toggleBtn.classList.add('listening'); }
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
            if (textEl) { textEl.textContent = finalTranscript + interim; }
        };

        sttRecognition.onerror = (event) => {
            if (event.error !== 'no-speech') console.error('STT error:', event.error);
        };

        sttRecognition.onend = () => {
            sttIsListening = false;
            if (display) display.classList.remove('listening');
            if (toggleBtn) { toggleBtn.textContent = '🎙️ Start Listening'; toggleBtn.classList.remove('listening'); }
            try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.close(); } catch (e) {}
        };

        sttRecognition.start();
    }

    // Try getUserMedia first for permission prompt, fall back to direct start
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            stream.getTracks().forEach(t => t.stop());
            initRecognition();
        }).catch(() => {
            // getUserMedia failed — try starting recognition directly anyway
            // (Android WebView sometimes blocks getUserMedia but allows SpeechRecognition)
            try {
                initRecognition();
            } catch (e) {
                if (typeof showToast === 'function') showToast('Microphone access is required for speech-to-text. Check Settings > Apps > PI Events > Permissions.');
            }
        });
    } else {
        // No getUserMedia available — try recognition directly
        try {
            initRecognition();
        } catch (e) {
            if (typeof showToast === 'function') showToast('Microphone access is not available on this device.');
        }
    }
}

function stopSTT() {
    const isAndroid = IS_NATIVE_APP && window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android';
    if (isAndroid && window.Capacitor.Plugins.NativeSpeechRecognition) {
        window.Capacitor.Plugins.NativeSpeechRecognition.stop();
        sttIsListening = false;
        var display = document.getElementById('sttDisplay');
        var toggleBtn = document.getElementById('sttToggleBtn');
        if (display) display.classList.remove('listening');
        if (toggleBtn) { toggleBtn.textContent = '🎙️ Start Listening'; toggleBtn.classList.remove('listening'); }
    } else if (sttRecognition) {
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
// FEEL THE MUSIC (Sound-to-Haptic) v6
// AudioContext.currentTime precision + rAF loop + proper grid catchup
// ========================================

let ftmActive = false;
let ftmAudioCtx = null;
let ftmAnalyser = null;
let ftmStream = null;
let ftmRAF = null; // requestAnimationFrame ID
let ftmFreqData = null;    // Pre-allocated frequency data array
let ftmBarsCache = null;   // Cached .ftm-bar DOM elements
let ftmBeatDecay = 0;
let ftmPrevKick = 0;
let ftmFrameCount = 0;

// Onset detection — Patin adaptive threshold
const FTM_HISTORY_SIZE = 43;
const ftmKickHistory = new Float32Array(FTM_HISTORY_SIZE);
let ftmHistoryIdx = 0;

// Tempo locking — all times in SECONDS (AudioContext.currentTime)
const FTM_CALIBRATION_S = 3.5;
let ftmCalibStartTime = 0;
let ftmOnsets = [];
let ftmBeatInterval = 0;
let ftmNextBeat = 0;
let ftmLocked = false;
let ftmBPM = 0;
const FTM_PHASE_CORRECTION = 0.15;
const FTM_BEAT_WINDOW = 0.06;
const FTM_MIN_BPM = 70;
const FTM_MAX_BPM = 180;

// Auto-recalibration
let ftmMissCount = 0;
const FTM_MISS_LIMIT = 12;
let ftmLastOnsetTime = 0;

// Subdivision grid
let ftmSubNextBeat = 0;

// FFT config
const FTM_FFT_SIZE = 2048;
const FTM_KICK_START = 3;
const FTM_KICK_END = 5;
const FTM_NUM_BARS = 16;
const FTM_VIS_BINS = 186;

function ftmGetIntensity() {
    const slider = document.getElementById('ftmIntensity');
    return slider ? parseInt(slider.value) : 1;
}

function ftmGetSubdivision() {
    const level = ftmGetIntensity();
    return [1, 2, 2, 3, 4][level - 1];
}

function ftmAdaptiveThreshold() {
    let sum = 0;
    for (let i = 0; i < FTM_HISTORY_SIZE; i++) sum += ftmKickHistory[i];
    const mean = sum / FTM_HISTORY_SIZE;
    let varSum = 0;
    for (let i = 0; i < FTM_HISTORY_SIZE; i++) {
        const d = ftmKickHistory[i] - mean;
        varSum += d * d;
    }
    const variance = varSum / FTM_HISTORY_SIZE;
    const C = Math.max(1.3, Math.min(-15 * variance + 1.55, 2.0));
    return C * mean;
}

function ftmEstimateTempo(onsets) {
    if (onsets.length < 4) return 0;
    const iois = [];
    for (let i = 1; i < onsets.length; i++) {
        const gap = onsets[i] - onsets[i - 1];
        if (gap >= 60 / FTM_MAX_BPM && gap <= 60 / FTM_MIN_BPM) iois.push(gap);
    }
    if (iois.length < 3) return 0;
    for (let i = 2; i < onsets.length; i++) {
        const gap = (onsets[i] - onsets[i - 2]) / 2;
        if (gap >= 60 / FTM_MAX_BPM && gap <= 60 / FTM_MIN_BPM) iois.push(gap);
    }
    iois.sort((a, b) => a - b);
    const median = iois[Math.floor(iois.length / 2)];
    const cluster = iois.filter(v => Math.abs(v - median) / median < 0.15);
    if (cluster.length < 2) return median;
    return cluster.reduce((s, v) => s + v, 0) / cluster.length;
}

function ftmRecalibrate() {
    if (!ftmActive) return;
    ftmLocked = false;
    ftmOnsets = [];
    ftmMissCount = 0;
    ftmHistoryIdx = 0;
    ftmKickHistory.fill(0);
    ftmCalibStartTime = ftmAudioCtx ? ftmAudioCtx.currentTime : 0;
    const status = document.getElementById('ftmStatus');
    if (status) status.textContent = 'Re-syncing...';
}

function ftmAnalyseLoop() {
    if (!ftmActive || !ftmAnalyser || !ftmAudioCtx) return;
    ftmRAF = requestAnimationFrame(ftmAnalyseLoop);

    const now = ftmAudioCtx.currentTime;
    ftmAnalyser.getByteFrequencyData(ftmFreqData);

    let kickEnergy = 0;
    for (let i = FTM_KICK_START; i <= FTM_KICK_END; i++) kickEnergy += ftmFreqData[i] / 255;
    kickEnergy /= (FTM_KICK_END - FTM_KICK_START + 1);

    const kickFlux = kickEnergy > 0.02 ? Math.max(0, kickEnergy - ftmPrevKick) : 0;
    ftmPrevKick = kickEnergy;

    ftmKickHistory[ftmHistoryIdx] = kickFlux;
    ftmHistoryIdx = (ftmHistoryIdx + 1) % FTM_HISTORY_SIZE;
    ftmFrameCount++;

    const threshold = ftmAdaptiveThreshold();
    let isBeat = false;
    const isOnset = kickFlux > threshold && kickFlux > 0.003;

    if (isOnset) ftmLastOnsetTime = now;

    if (!ftmLocked) {
        if (isOnset) {
            const lastOnset = ftmOnsets.length > 0 ? ftmOnsets[ftmOnsets.length - 1] : 0;
            if (now - lastOnset > 0.15) ftmOnsets.push(now);
        }
        if (!document.hidden) {
            const status = document.getElementById('ftmStatus');
            if (status) {
                const elapsed = now - ftmCalibStartTime;
                const pct = Math.min(100, Math.round(elapsed / FTM_CALIBRATION_S * 100));
                status.textContent = `Finding the beat... ${pct}% (${ftmOnsets.length} hits)`;
            }
        }
        if (now - ftmCalibStartTime >= FTM_CALIBRATION_S) {
            ftmBeatInterval = ftmEstimateTempo(ftmOnsets);
            if (ftmBeatInterval > 0) {
                ftmLocked = true;
                ftmBPM = Math.round(60 / ftmBeatInterval);
                ftmMissCount = 0;
                const lastOnset = ftmOnsets[ftmOnsets.length - 1];
                ftmNextBeat = lastOnset + ftmBeatInterval;
                ftmSubNextBeat = ftmNextBeat;
            } else {
                ftmCalibStartTime = now - FTM_CALIBRATION_S + 1.5;
                ftmOnsets = [];
            }
        }
    } else {
        const subdivisions = ftmGetSubdivision();
        const subInterval = ftmBeatInterval / subdivisions;

        if (isOnset) {
            const distToNext = ftmNextBeat - now;
            const distToPrev = now - (ftmNextBeat - ftmBeatInterval);
            if (Math.min(Math.abs(distToNext), Math.abs(distToPrev)) < FTM_BEAT_WINDOW) {
                const error = Math.abs(distToNext) < Math.abs(distToPrev) ? -distToNext : distToPrev;
                ftmNextBeat += error * FTM_PHASE_CORRECTION;
            }
        }

        if (now >= ftmNextBeat) {
            while (ftmNextBeat + ftmBeatInterval <= now) {
                ftmNextBeat += ftmBeatInterval;
                ftmMissCount++;
            }
            ftmNextBeat += ftmBeatInterval;
            ftmSubNextBeat = now + subInterval;

            const hadRecentOnset = (now - ftmLastOnsetTime) < ftmBeatInterval * 1.5;
            if (hadRecentOnset) ftmMissCount = Math.max(0, ftmMissCount - 1);
            else ftmMissCount++;

            if (ftmMissCount >= FTM_MISS_LIMIT) {
                ftmRecalibrate();
                return;
            }

            ftmBeatDecay = 1.0;
            isBeat = true;
            ftmFireHaptic('HEAVY');
        }

        if (subdivisions > 1 && now >= ftmSubNextBeat && !isBeat) {
            ftmSubNextBeat += subInterval;
            if (ftmSubNextBeat > ftmNextBeat) ftmSubNextBeat = ftmNextBeat;
            ftmBeatDecay = 0.6;
            isBeat = true;
            ftmFireHaptic('HEAVY');
        }
    }

    ftmBeatDecay = Math.max(0, ftmBeatDecay - 0.03);

    if (!document.hidden) {
        ftmUpdateBars(ftmFreqData);
        ftmUpdateGlow(isBeat, kickEnergy);
    }
}

function ftmUpdateBars(raw) {
    const bars = ftmBarsCache;
    if (!bars || !bars.length) return;
    const binsPerBar = Math.floor(FTM_VIS_BINS / FTM_NUM_BARS);
    for (let i = 0; i < bars.length; i++) {
        let sum = 0;
        const start = i * binsPerBar;
        for (let j = start; j < start + binsPerBar && j < raw.length; j++) sum += raw[j];
        const avg = sum / binsPerBar / 255;
        bars[i].style.setProperty('--bar-scale', Math.max(0.03, Math.pow(avg, 1.5)).toFixed(3));
    }
}

function ftmUpdateGlow(isBeat, energy) {
    const vis = document.getElementById('ftmVisualiser');
    const status = document.getElementById('ftmStatus');
    if (!vis) return;

    const glow = Math.min(1, energy * 2.5);
    vis.style.setProperty('--glow-opacity', glow.toFixed(3));
    vis.style.setProperty('--glow-scale', (0.3 + glow * 0.7).toFixed(3));

    if (isBeat) {
        vis.style.setProperty('--beat-flash', '1');
        setTimeout(() => vis.style.setProperty('--beat-flash', '0'), 80);
    }

    if (status) {
        if (ftmLocked) {
            const labels = ['Quarter', '& beats', '8ths', 'Triplets', '16ths'];
            const label = labels[ftmGetIntensity() - 1];
            if (ftmBeatDecay > 0.2) status.textContent = `${ftmBPM} BPM - ${label}`;
            else status.textContent = `Locked: ${ftmBPM} BPM`;
        } else {
            status.textContent = 'Finding the beat...';
        }
    }
}

function ftmFireHaptic(intensity) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        const Haptics = window.Capacitor.Plugins.Haptics;
        try { Haptics.impact({ style: intensity }); } catch (e) { ftmVibrateNative(intensity); }
        return;
    }
    ftmVibrateNative(intensity);
}

function ftmVibrateNative(intensity) {
    if (!navigator.vibrate) return;
    navigator.vibrate({ HEAVY: 50, MEDIUM: 30, LIGHT: 15 }[intensity] || 30);
}

async function startFTM() {
    const errorEl = document.getElementById('ftmError');
    const btn = document.getElementById('ftmToggleBtn');
    const status = document.getElementById('ftmStatus');

    if (errorEl) errorEl.style.display = 'none';

    try {
        ftmStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        if (errorEl) errorEl.style.display = 'block';
        return;
    }

    // Warn if Vibration API not supported (Safari, some browsers)
    if (!navigator.vibrate) {
        if (status) {
            status.textContent = 'Haptic feedback not available in this browser. You will see visual feedback only.';
        }
        const vis = document.getElementById('ftmVisualiser');
        if (vis) vis.setAttribute('data-visual-only', 'true');
    }

    try {
        ftmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (audioErr) {
        if (errorEl) {
            errorEl.textContent = 'Unable to start audio processing. Your browser may not support this feature.';
            errorEl.style.display = 'block';
        }
        if (ftmStream) { ftmStream.getTracks().forEach(t => t.stop()); ftmStream = null; }
        return;
    }
    ftmAnalyser = ftmAudioCtx.createAnalyser();
    ftmAnalyser.fftSize = FTM_FFT_SIZE;
    ftmAnalyser.smoothingTimeConstant = 0.2;
    ftmAnalyser.minDecibels = -90;
    ftmAnalyser.maxDecibels = -10;

    const source = ftmAudioCtx.createMediaStreamSource(ftmStream);
    source.connect(ftmAnalyser);

    ftmFreqData = new Uint8Array(ftmAnalyser.frequencyBinCount);
    ftmBarsCache = document.querySelectorAll('.ftm-bar');

    ftmActive = true;
    ftmPrevKick = 0;
    ftmBeatDecay = 0;
    ftmHistoryIdx = 0;
    ftmFrameCount = 0;
    ftmKickHistory.fill(0);
    ftmOnsets = [];
    ftmBeatInterval = 0;
    ftmNextBeat = 0;
    ftmSubNextBeat = 0;
    ftmLocked = false;
    ftmBPM = 0;
    ftmMissCount = 0;
    ftmLastOnsetTime = 0;
    ftmCalibStartTime = ftmAudioCtx.currentTime;

    if (btn) { btn.textContent = 'Stop'; btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
    if (status) { status.textContent = 'Finding the beat...'; status.classList.add('active'); }
    const recalBtn = document.getElementById('ftmRecalibrateBtn');
    if (recalBtn) recalBtn.style.display = '';

    ftmRAF = requestAnimationFrame(ftmAnalyseLoop);
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
    if (ftmWakeLock) { ftmWakeLock.release().catch(() => {}); ftmWakeLock = null; }
}

function stopFTM() {
    ftmActive = false;
    if (ftmRAF) { cancelAnimationFrame(ftmRAF); ftmRAF = null; }
    if (ftmStream) { ftmStream.getTracks().forEach(t => t.stop()); ftmStream = null; }
    if (ftmAudioCtx) { ftmAudioCtx.close().catch(() => {}); ftmAudioCtx = null; ftmAnalyser = null; }
    ftmFreqData = null;
    ftmBarsCache = null;
    ftmReleaseWakeLock();

    const btn = document.getElementById('ftmToggleBtn');
    const status = document.getElementById('ftmStatus');
    const vis = document.getElementById('ftmVisualiser');
    document.querySelectorAll('.ftm-bar').forEach(b => b.style.setProperty('--bar-scale', '0.03'));
    if (vis) { vis.style.setProperty('--glow-opacity', '0'); vis.style.setProperty('--beat-flash', '0'); }
    if (btn) { btn.textContent = 'Start Feeling'; btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); btn.onclick = function() { toggleFTM(); }; }
    if (status) { status.textContent = 'Feel the bass through your phone'; status.classList.remove('active'); }
    const recalBtn = document.getElementById('ftmRecalibrateBtn');
    if (recalBtn) recalBtn.style.display = 'none';
}

let ftmHasConsented = false;

function ftmShowPreRequest() {
    const errorEl = document.getElementById('ftmError');
    if (errorEl) errorEl.style.display = 'none';

    const status = document.getElementById('ftmStatus');
    if (status) {
        status.innerHTML =
            '<strong>How Feel the Music works:</strong><br>' +
            'Your microphone listens for the beat of the music. ' +
            'Your phone vibrates in sync with the bass.<br><br>' +
            '<em>Audio is processed on your device only — nothing is recorded or sent anywhere.</em>';
    }

    const btn = document.getElementById('ftmToggleBtn');
    if (btn) {
        btn.textContent = 'Allow Microphone & Start';
        btn.onclick = function() {
            btn.onclick = function() { toggleFTM(); };
            startFTM();
        };
    }
}

function toggleFTM() {
    if (ftmActive) {
        stopFTM();
    } else if (!ftmHasConsented) {
        ftmShowPreRequest();
        ftmHasConsented = true;
    } else {
        startFTM();
    }
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && ftmActive && !ftmWakeLock) ftmRequestWakeLock();
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
    storeModalTrigger();
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('bg-modal-open');
    activateFocusTrap(modal);
    pushModalState(id, function() { closeBgModal(id); });
    // If opening venues modal, load content if not yet loaded
    if (id === 'bgVenuesModal' && !bgVenuesLoaded) {
        loadBgVenues();
    }
}

function closeBgModal(id) {
    deactivateFocusTrap();
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('bg-modal-open');
    restoreModalFocus();
    clearModalState();
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
    // Scope to the nearest container (modal body or subview), not the whole document
    const scope = btn.closest('.bg-modal-body') || btn.closest('#nativeMoreSubview') || document;
    scope.querySelectorAll('.bg-faq-button').forEach(b => b.classList.remove('active'));
    scope.querySelectorAll('.bg-faq-answer-container').forEach(a => a.classList.remove('show'));
    if (!isActive) {
        btn.classList.add('active');
        answerContainer.classList.add('show');
    }
}

function toggleBgCountry(event, button) {
    event.stopPropagation();
    const countryRegions = button.nextElementSibling;
    const isActive = button.classList.contains('active');
    const modal = button.closest('.bg-modal-body') || button.closest('#nativeMoreSubview') || button.closest('#bgVenueContent');
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
    const modal = button.closest('.bg-modal-body') || button.closest('#nativeMoreSubview') || button.closest('#bgVenueContent');
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
            // Inject access icons into venue details
            container.querySelectorAll('.venue-button[data-venue]').forEach(btn => {
                var venueName = btn.getAttribute('data-venue').split(',')[0].replace(/\s*\([^)]*\)/g, '').trim();
                var fakeEvent = { 'VENUE': venueName, 'EVENT': '' };
                var features = findVenueAccessFeatures(fakeEvent);
                if (features.length > 0) {
                    var details = btn.nextElementSibling;
                    if (details && details.classList.contains('venue-details')) {
                        var iconsHtml = renderAccessLabels(fakeEvent);
                        if (iconsHtml) {
                            var div = document.createElement('div');
                            div.style.cssText = 'padding:8px 12px 4px;';
                            div.innerHTML = iconsHtml;
                            details.appendChild(div);
                        }
                    }
                }
            });
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

// Unified ESC key handler for all modals (A11Y-01)
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;

    // Booking guide sub-modals (checked first as they layer on top)
    const activeBgModal = document.querySelector('.bg-modal-overlay.active');
    if (activeBgModal) { closeBgModal(activeBgModal.id); return; }

    // Access First modal
    const accessFirst = document.getElementById('accessFirstModal');
    if (accessFirst && accessFirst.style.display === 'flex') { closeAccessFirstModal(); return; }

    // BSL Video modal
    const videoModal = document.getElementById('bslVideoModal');
    if (videoModal && videoModal.style.display === 'flex') { closeVideoModal(); return; }

    // Comm Support modal
    const commSupport = document.getElementById('commSupportModal');
    if (commSupport && commSupport.style.display === 'flex') { closeCommSupportModal(); return; }

    // Install Prompt
    const installPromptEl = document.getElementById('installPrompt');
    if (installPromptEl && installPromptEl.classList.contains('show')) { closeInstallPrompt(); return; }

    // Feedback modal (defined in index.html inline script)
    const feedback = document.getElementById('feedbackModal');
    if (feedback && feedback.classList.contains('active')) { closeFeedbackModal(); return; }

    // Festival Checklist modal (defined in index.html inline script)
    const festivalChecklist = document.getElementById('festivalChecklistModal');
    if (festivalChecklist && festivalChecklist.classList.contains('active')) { closeFestivalChecklistModal(); return; }

    // Know Your Rights modal (defined in index.html inline script)
    const knowRights = document.getElementById('knowYourRightsModal');
    if (knowRights && knowRights.classList.contains('active')) { closeKnowYourRightsModal(); return; }

    // Notification Preferences modal (defined in notifications.js)
    const notifPrefs = document.getElementById('notificationPreferencesModal');
    if (notifPrefs && notifPrefs.classList.contains('active')) { closeNotificationPreferences(); return; }
});

// ========================================
// NOTIFICATION PROMPT (one-time, after 60s or first event tap)
// ========================================

let _notifPromptShown = false;

function maybeShowNotificationPrompt() {
    if (_notifPromptShown) return;
    if (localStorage.getItem('pi-notification-prompt-dismissed')) return;
    if (localStorage.getItem('pi-notification-subscribed')) return;
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;

    _notifPromptShown = true;

    const prompt = document.createElement('div');
    prompt.id = 'notifPromptBanner';
    prompt.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;z-index:9999;background:linear-gradient(135deg,#1E40AF 0%,#2563EB 100%);border-radius:12px;padding:10px 12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);animation:slideUp 0.3s ease;';
    prompt.innerHTML = `
        <div onclick="dismissNotifPrompt(true)" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;flex-shrink:0;">🔔</span>
            <p style="margin:0;font-size:13px;font-weight:600;color:#fff;flex:1;min-width:0;">Never miss an interpreted event</p>
            <div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;flex-shrink:0;">
                <span style="font-size:12px;font-weight:700;color:#fff;">Set Up →</span>
            </div>
            <button id="notifPromptClose" onclick="event.stopPropagation();dismissNotifPrompt(false)" style="background:none;border:none;font-size:16px;color:rgba(255,255,255,0.6);cursor:pointer;padding:4px;flex-shrink:0;opacity:0;transition:opacity 0.3s;">✕</button>
        </div>
    `;
    document.body.appendChild(prompt);
    // Delay showing the dismiss button so users engage with the CTA first
    setTimeout(() => {
        const closeBtn = document.getElementById('notifPromptClose');
        if (closeBtn) closeBtn.style.opacity = '1';
    }, 3000);
}

function dismissNotifPrompt(goToSettings) {
    const prompt = document.getElementById('notifPromptBanner');
    if (prompt) prompt.remove();
    localStorage.setItem('pi-notification-prompt-dismissed', '1');
    if (goToSettings && typeof NativeShell !== 'undefined') {
        NativeShell.switchTab('more');
        setTimeout(() => NativeShell.handleMoreAction('notifications'), 100);
    }
}
window.maybeShowNotificationPrompt = maybeShowNotificationPrompt;
window.dismissNotifPrompt = dismissNotifPrompt;

// Trigger after 60 seconds if not already shown
setTimeout(maybeShowNotificationPrompt, 60000);

// ========================================
// NOTIFICATIONS DRAWER
// ========================================

function storeNotification(notif) {
    const stored = JSON.parse(localStorage.getItem('pi-notif-history') || '[]');
    stored.unshift(notif);
    // Keep max 50
    localStorage.setItem('pi-notif-history', JSON.stringify(stored.slice(0, 50)));
    localStorage.setItem('pi-notif-unread', 'true');
    updateNotifDot();
}

function getNotifications() {
    return JSON.parse(localStorage.getItem('pi-notif-history') || '[]');
}

function updateNotifDot() {
    const dot = document.getElementById('nativeLogoDot');
    if (!dot) return;
    const hasUnread = localStorage.getItem('pi-notif-unread') === 'true';
    const notSubscribed = !localStorage.getItem('pi-notification-subscribed');
    dot.style.display = (hasUnread || notSubscribed) ? '' : 'none';
}

function toggleNotificationsDrawer() {
    const drawer = document.getElementById('notificationsDrawer');
    if (!drawer) return;
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
        closeNotificationsDrawer();
    } else {
        openNotificationsDrawer();
    }
}

function openNotificationsDrawer() {
    const drawer = document.getElementById('notificationsDrawer');
    const content = document.getElementById('notifDrawerContent');
    if (!drawer || !content) return;

    // Mark as read
    localStorage.removeItem('pi-notif-unread');
    updateNotifDot();

    const notifications = getNotifications();
    const isSubscribed = localStorage.getItem('pi-notification-subscribed') === 'true';

    if (notifications.length === 0) {
        if (!isSubscribed) {
            content.innerHTML = `
                <div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:12px;">🔔</div>
                    <p style="font-size:16px;font-weight:600;color:#1F2937;margin:0 0 6px;">No notifications yet</p>
                    <p style="font-size:14px;color:#6B7280;margin:0 0 20px;line-height:1.5;">Choose your favourite event types and locations to be notified when new interpreted events are added.</p>
                    <button onclick="closeNotificationsDrawer();NativeShell.switchTab('more');setTimeout(function(){NativeShell.handleMoreAction('notifications')},100);" style="padding:12px 24px;background:#2563EB;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Set Up Preferences</button>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:12px;">✅</div>
                    <p style="font-size:16px;font-weight:600;color:#1F2937;margin:0 0 6px;">You're all set</p>
                    <p style="font-size:14px;color:#6B7280;margin:0 0 8px;">We'll notify you when new events match your preferences.</p>
                    <button onclick="closeNotificationsDrawer();NativeShell.switchTab('more');setTimeout(function(){NativeShell.handleMoreAction('notifications')},100);" style="padding:10px 20px;background:#F3F4F6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;">Edit Preferences</button>
                </div>
            `;
        }
    } else {
        content.innerHTML = notifications.map((n, idx) => {
            const time = n.time ? timeAgo(n.time) : '';
            return `
                <div class="notif-item" data-idx="${idx}" style="position:relative;overflow:hidden;cursor:pointer;">
                    <div class="notif-item-inner" style="display:flex;align-items:flex-start;gap:12px;padding:0;transition:transform 0.2s;">
                        <div class="notif-item-icon">🎟️</div>
                        <div class="notif-item-body" style="flex:1;min-width:0;">
                            <p class="notif-item-title">${escapeHtml(n.title)}</p>
                            <p class="notif-item-text">${escapeHtml(n.body)}</p>
                            ${time ? `<p class="notif-item-time">${time}</p>` : ''}
                        </div>
                    </div>
                    <button onclick="deleteNotification(${idx})" class="notif-delete-btn" style="position:absolute;right:0;top:0;bottom:0;width:70px;background:#EF4444;color:white;border:none;font-size:13px;font-weight:600;cursor:pointer;display:none;align-items:center;justify-content:center;">Delete</button>
                </div>
            `;
        }).join('') + `
            <div style="margin:12px 0 8px;padding:10px 14px;background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;text-align:center;">
                <p style="font-size:13px;font-weight:600;color:#0369A1;margin:0;">👆 Tap to view event · Slide ← to <span style="color:#EF4444;">delete</span></p>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="clearNotifications()" style="flex:1;padding:12px;background:none;border:1px solid #E5E7EB;border-radius:10px;color:#6B7280;font-size:13px;cursor:pointer;">Clear All</button>
                <button onclick="closeNotificationsDrawer();NativeShell.switchTab('more');setTimeout(function(){NativeShell.handleMoreAction('notifications')},100);" style="flex:1;padding:12px;background:#F3F4F6;border:none;border-radius:10px;color:#374151;font-size:13px;font-weight:500;cursor:pointer;">⚙️ Preferences</button>
            </div>
        `;
    }

    drawer.classList.add('open');
    if (typeof activateFocusTrap === 'function') activateFocusTrap(document.getElementById('notificationsDrawer'));
    // Enable swipe-to-delete on notification items
    setTimeout(initNotifSwipe, 50);
}

function closeNotificationsDrawer() {
    const drawer = document.getElementById('notificationsDrawer');
    if (!drawer) return;
    if (typeof deactivateFocusTrap === 'function') deactivateFocusTrap();
    drawer.classList.add('closing');
    drawer.classList.remove('open');
    setTimeout(() => drawer.classList.remove('closing'), 300);
}

function clearNotifications() {
    localStorage.removeItem('pi-notif-history');
    localStorage.removeItem('pi-notif-unread');
    updateNotifDot();
    openNotificationsDrawer(); // Refresh content
}

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
}

/**
 * Open event modal from a notification tap.
 * Tries data fields first, then parses event info from the body text.
 * Body format: "Event Name at Venue — Date"
 */
function openNotifEvent(idx) {
    const notifications = getNotifications();
    const notif = notifications[idx];
    if (!notif) return;

    // Try data fields first (from real cron notifications)
    let name = '', date = '', venue = '';
    if (notif.data) {
        name = (notif.data.eventName || '').toLowerCase();
        date = notif.data.eventDate || '';
        venue = (notif.data.eventVenue || '').toLowerCase();
    }

    // Fallback: parse from body text ("Event Name at Venue — Date")
    if (!name && notif.body) {
        const bodyMatch = notif.body.match(/^(.+?)\s+at\s+(.+?)(?:\s+—\s+(.+))?$/);
        if (bodyMatch) {
            name = bodyMatch[1].toLowerCase();
            venue = bodyMatch[2].toLowerCase();
            date = bodyMatch[3] || '';
        }
    }

    if (!name) return;

    // Find matching event in loaded data
    const match = (AppState.allEvents || []).find(e => {
        const eName = (e['EVENT'] || '').toLowerCase();
        const eVenue = (e['VENUE'] || '').toLowerCase();
        const eDate = e['DATE'] || '';
        return (eName.includes(name) || name.includes(eName)) &&
               (eDate === date || eVenue.includes(venue) || venue.includes(eVenue));
    });

    closeNotificationsDrawer();

    if (match) {
        setTimeout(() => openEventModal(match), 300);
    } else {
        if (typeof showToast === 'function') {
            showToast('Event not found — try refreshing events');
        }
    }
}

/**
 * Delete a single notification by index.
 */
function deleteNotification(idx) {
    const stored = JSON.parse(localStorage.getItem('pi-notif-history') || '[]');
    stored.splice(idx, 1);
    localStorage.setItem('pi-notif-history', JSON.stringify(stored));
    if (stored.length === 0) {
        localStorage.removeItem('pi-notif-unread');
    }
    updateNotifDot();
    openNotificationsDrawer(); // Refresh pane
}

/**
 * Enable swipe-to-delete on notification items.
 * Called after the pane renders.
 */
function initNotifSwipe() {
    const items = document.querySelectorAll('.notif-item');
    items.forEach(item => {
        const inner = item.querySelector('.notif-item-inner');
        const deleteBtn = item.querySelector('.notif-delete-btn');
        if (!inner || !deleteBtn) return;

        let startX = 0, startY = 0, currentX = 0, isDragging = false, isHorizontal = null, deleteShowing = false;

        inner.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            isDragging = false;
            isHorizontal = null;
            inner.style.transition = 'none';
        }, { passive: true });

        inner.addEventListener('touchmove', e => {
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            const diffY = e.touches[0].clientY - startY;

            if (isHorizontal === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
                isHorizontal = Math.abs(diffX) > Math.abs(diffY);
            }

            if (isHorizontal) {
                isDragging = true;
                if (deleteShowing) {
                    // Already showing delete — allow sliding back
                    const offset = Math.max(Math.min(diffX - 70, 0), -70);
                    inner.style.transform = `translateX(${offset}px)`;
                } else if (diffX < -10) {
                    inner.style.transform = `translateX(${Math.max(diffX, -70)}px)`;
                    deleteBtn.style.display = 'flex';
                }
            }
        }, { passive: true });

        inner.addEventListener('touchend', () => {
            inner.style.transition = 'transform 0.2s';
            if (isDragging) {
                const diff = currentX - startX;
                if (deleteShowing) {
                    // Was showing — if swiped right enough, hide
                    if (diff > 30) {
                        inner.style.transform = 'translateX(0)';
                        deleteBtn.style.display = 'none';
                        deleteShowing = false;
                    } else {
                        inner.style.transform = 'translateX(-70px)';
                    }
                } else {
                    if (diff < -40) {
                        inner.style.transform = 'translateX(-70px)';
                        deleteShowing = true;
                    } else {
                        inner.style.transform = 'translateX(0)';
                        deleteBtn.style.display = 'none';
                    }
                }
            } else if (!isDragging && deleteShowing) {
                // Pure tap while delete is showing — reset
                inner.style.transition = 'transform 0.2s';
                inner.style.transform = 'translateX(0)';
                deleteBtn.style.display = 'none';
                deleteShowing = false;
            } else if (!isDragging && !deleteShowing) {
                // Pure tap — open event modal
                const idx = parseInt(item.dataset.idx);
                if (!isNaN(idx)) openNotifEvent(idx);
            }
            isDragging = false;
            isHorizontal = null;
        });
    });
}

/**
 * Show a blue in-app banner when a push notification arrives while the app is open.
 * Tapping anywhere opens the notification pane. Auto-dismisses after 5 seconds.
 */
function showPushBanner(title, body) {
    // Remove existing banner if any
    const existing = document.getElementById('pushAlertBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'pushAlertBanner';
    banner.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;z-index:9999;background:linear-gradient(135deg,#1E40AF 0%,#2563EB 100%);border-radius:12px;padding:12px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.25);cursor:pointer;animation:slideUp 0.3s ease;';
    banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;flex-shrink:0;">🔔</span>
            <div style="flex:1;min-width:0;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title || 'New Event Alert')}</p>
                <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(body || '')}</p>
            </div>
            <div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;flex-shrink:0;">
                <span style="font-size:12px;font-weight:700;color:#fff;">View →</span>
            </div>
        </div>
    `;
    banner.addEventListener('click', () => {
        banner.remove();
        if (typeof openNotificationsDrawer === 'function') openNotificationsDrawer();
    });
    document.body.appendChild(banner);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (banner.parentNode) {
            banner.style.transition = 'opacity 0.3s, transform 0.3s';
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(20px)';
            setTimeout(() => banner.remove(), 300);
        }
    }, 5000);
}

/**
 * Switch between Notifications and My Events tabs in the drawer.
 */
function switchDrawerTab(tab) {
    var notifTab = document.getElementById('drawerTabNotifs');
    var eventsTab = document.getElementById('drawerTabMyEvents');
    var notifContent = document.getElementById('notifDrawerContent');
    var eventsContent = document.getElementById('myEventsDrawerContent');
    if (!notifTab || !eventsTab || !notifContent || !eventsContent) return;

    if (tab === 'myevents') {
        notifTab.style.color = '#9CA3AF';
        notifTab.style.borderBottomColor = 'transparent';
        notifTab.style.fontWeight = '600';
        eventsTab.style.color = '#2563EB';
        eventsTab.style.borderBottomColor = '#2563EB';
        eventsTab.style.fontWeight = '700';
        notifContent.style.display = 'none';
        eventsContent.style.display = 'block';
        renderMyEvents();
    } else {
        notifTab.style.color = '#2563EB';
        notifTab.style.borderBottomColor = '#2563EB';
        notifTab.style.fontWeight = '700';
        eventsTab.style.color = '#9CA3AF';
        eventsTab.style.borderBottomColor = 'transparent';
        eventsTab.style.fontWeight = '600';
        notifContent.style.display = 'block';
        eventsContent.style.display = 'none';
    }
}

/**
 * Render the My Events panel — Going (festivals) + Interested (all events)
 */
function renderMyEvents() {
    var content = document.getElementById('myEventsDrawerContent');
    if (!content) return;

    var going = getGoingEvents();
    var interested = getInterestedEvents();

    if (going.length === 0 && interested.length === 0) {
        content.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
            '<div style="font-size:48px;margin-bottom:12px;">❤️</div>' +
            '<p style="font-size:16px;font-weight:600;color:#1F2937;margin:0 0 6px;">No saved events</p>' +
            '<p style="font-size:14px;color:#6B7280;margin:0;line-height:1.5;">Tap \'Interested?\' on any event or \'I\'m Going\' on festivals to save them here.</p>' +
            '</div>';
        return;
    }

    var html = '';

    // Going section (all events)
    if (going.length > 0) {
        html += '<div style="padding:4px 0 8px;"><p style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">✅ Going</p>';
        going.forEach(function(evt, idx) {
            html += '<div class="notif-item" style="cursor:pointer;" onclick="openGoingEventModal(' + idx + ')">' +
                '<div style="display:flex;align-items:center;gap:12px;width:100%;">' +
                '<div style="font-size:20px;flex-shrink:0;">' + getCategoryEmojiLocal(evt.category) + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                '<p class="notif-item-title">' + escapeHtml(evt.name) + '</p>' +
                (evt.venue ? '<p class="notif-item-text">📍 ' + escapeHtml(evt.venue) + '</p>' : '') +
                (evt.date ? '<p class="notif-item-time">📅 ' + escapeHtml(evt.date) + '</p>' : '') +
                '</div>' +
                '<button onclick="event.stopPropagation();removeGoingEvent(' + idx + ')" style="background:none;border:none;font-size:16px;color:#EF4444;cursor:pointer;padding:4px;">✕</button>' +
                '</div></div>';
        });
        html += '</div>';
    }

    // Interested section
    if (interested.length > 0) {
        html += '<div style="padding:4px 0 8px;"><p style="font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">❤️ Interested</p>';
        interested.forEach(function(evt, idx) {
            html += '<div class="notif-item" style="cursor:pointer;" onclick="openInterestedEventModal(' + idx + ')">' +
                '<div style="display:flex;align-items:center;gap:12px;width:100%;">' +
                '<div style="font-size:20px;flex-shrink:0;">' + getCategoryEmojiLocal(evt.category) + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                '<p class="notif-item-title">' + escapeHtml(evt.name) + '</p>' +
                (evt.venue ? '<p class="notif-item-text">📍 ' + escapeHtml(evt.venue) + '</p>' : '') +
                (evt.date ? '<p class="notif-item-time">📅 ' + escapeHtml(evt.date) + '</p>' : '') +
                '</div>' +
                '<button onclick="event.stopPropagation();removeInterested(' + idx + ')" style="background:none;border:none;font-size:16px;color:#EF4444;cursor:pointer;padding:4px;">✕</button>' +
                '</div></div>';
        });
        html += '</div>';
    }

    content.innerHTML = html;
}

function getCategoryEmojiLocal(cat) {
    var c = (cat || '').toLowerCase();
    if (c.includes('concert') || c.includes('music')) return '🎵';
    if (c.includes('festival')) return '🎪';
    if (c.includes('comedy')) return '😂';
    if (c.includes('theatre')) return '🎭';
    if (c.includes('sport')) return '⚽';
    if (c.includes('family')) return '👨‍👩‍👧‍👦';
    if (c.includes('dance')) return '💃';
    if (c.includes('literature')) return '📚';
    return '🎟️';
}

function removeGoingEvent(idx) {
    var events = getGoingEvents();
    var removed = events[idx];
    events.splice(idx, 1);
    localStorage.setItem('pi-going-events', JSON.stringify(events));
    if (removed && (removed.category || '').toLowerCase().includes('festival')) {
        var festKey = normaliseFestivalKey(removed.name);
        var festGoing = getGoingFestivals();
        var festIdx = festGoing.indexOf(festKey);
        if (festIdx >= 0) {
            festGoing.splice(festIdx, 1);
            localStorage.setItem('pi-going-festivals', JSON.stringify(festGoing));
            updatePushGoingList(festGoing);
        }
    }
    if (removed) syncAllGoingButtons(removed.name, removed.date, false);
    renderMyEvents();
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

function openGoingEventModal(idx) {
    var events = getGoingEvents();
    var evt = events[idx];
    if (!evt) return;
    var match = (AppState.allEvents || []).find(function(e) {
        return (e['EVENT'] || '').toLowerCase() === evt.name.toLowerCase() &&
               (e['DATE'] || '') === evt.date;
    });
    closeNotificationsDrawer();
    if (match) {
        setTimeout(function() { openEventModal(match); }, 300);
    } else if (typeof showToast === 'function') {
        showToast('Event not found — try refreshing events');
    }
}

function removeInterested(idx) {
    var events = getInterestedEvents();
    var removed = events[idx];
    events.splice(idx, 1);
    localStorage.setItem('pi-interested-events', JSON.stringify(events));
    if (removed) syncAllInterestedButtons(removed.name, removed.date, false);
    renderMyEvents();
    if (typeof nativeHaptic === 'function') nativeHaptic('light');
}

function openMyEventModal(festKey, isFestival) {
    var match = (AppState.allEvents || []).find(function(e) {
        return normaliseFestivalKey(e['EVENT'] || '') === festKey;
    });
    closeNotificationsDrawer();
    if (match) {
        setTimeout(function() { openEventModal(match); }, 300);
    }
}

function openInterestedEventModal(idx) {
    var interested = getInterestedEvents();
    var evt = interested[idx];
    if (!evt) return;
    var match = (AppState.allEvents || []).find(function(e) {
        return (e['EVENT'] || '').toLowerCase() === evt.name.toLowerCase() &&
               (e['DATE'] || '') === evt.date;
    });
    closeNotificationsDrawer();
    if (match) {
        setTimeout(function() { openEventModal(match); }, 300);
    } else if (typeof showToast === 'function') {
        showToast('Event not found — try refreshing events');
    }
}

window.switchDrawerTab = switchDrawerTab;
window.removeGoingEvent = removeGoingEvent;
window.removeInterested = removeInterested;
window.openGoingEventModal = openGoingEventModal;
window.openInterestedEventModal = openInterestedEventModal;
window.showPushBanner = showPushBanner;
window.toggleNotificationsDrawer = toggleNotificationsDrawer;
window.openNotificationsDrawer = openNotificationsDrawer;
window.closeNotificationsDrawer = closeNotificationsDrawer;
window.clearNotifications = clearNotifications;
window.deleteNotification = deleteNotification;
window.openNotifEvent = openNotifEvent;
window.storeNotification = storeNotification;
window.updateNotifDot = updateNotifDot;

// ========================================
// START THE APP
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ========================================
// CARD TAP → MODAL (document-level delegation, always works)
// ========================================
document.addEventListener('click', function(e) {
    // Skip if tapping a button, link, or utility action
    if (e.target.closest('button, a, .utility-btn')) return;
    var card = e.target.closest('.event-card[data-event-json], .event-card-compact[data-event-json], .event-list-item[data-event-json]');
    if (!card) return;
    try {
        var eventData = JSON.parse(card.getAttribute('data-event-json'));
        if (!eventData) return;
        var badge = calculateBadgeStatus(eventData);
        if (badge.badge === 'orange') {
            openRequestBSLModal(eventData);
        } else {
            openAccessFirstModal(eventData);
        }
    } catch (err) {
        console.warn('[Card tap] Error:', err);
    }
});
