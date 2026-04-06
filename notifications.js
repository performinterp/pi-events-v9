/*==========================================================================
  PERFORMANCE INTERPRETING - PUSH NOTIFICATIONS
  Supports both Web Push (PWA) and Native Push (iOS/Android via Capacitor)
  ==========================================================================*/

const NOTIFICATION_CONFIG = {
    vapidPublicKey: 'BM2RT5yhuUgW5KU6VZDVa_3nrgzX73csyiRjkRpIfzmmRBsMHWni6bZC6f34bdyKwxlwc8FWpxSZcvz7o7oVOSs',
    apiBase: 'https://pi-events-push-worker.lucky-shadow-d3f3.workers.dev/api/push',
    appVersion: '1.9.74',
    storageKeys: {
        preferences: 'pi-notification-preferences',
        subscribed: 'pi-notification-subscribed',
        subscription: 'pi-notification-subscription'
    }
};

// Scoped root for DOM queries — native shell sets this to the cloned subview
let _notifRoot = document;

function _notifEl(id) {
    return _notifRoot === document ? document.getElementById(id) : _notifRoot.querySelector('#' + id);
}

/**
 * Open notification preferences modal
 */
function openNotificationPreferences() {
    _notifRoot = document; // Reset scope for web modal
    navigator.clearAppBadge?.();
    if (window.storeModalTrigger) window.storeModalTrigger();
    const modal = document.getElementById('notificationPreferencesModal');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    if (window.closeMobileMenu) window.closeMobileMenu();
    initializeNotificationModal();
    if (window.activateFocusTrap) window.activateFocusTrap(modal);
    if (window.pushModalState) window.pushModalState('notificationPreferencesModal', closeNotificationPreferences);
}

function closeNotificationPreferences() {
    if (window.deactivateFocusTrap) window.deactivateFocusTrap();
    const modal = document.getElementById('notificationPreferencesModal');
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    if (window.restoreModalFocus) window.restoreModalFocus();
    if (window.clearModalState) window.clearModalState();
}

function closeNotificationPreferencesOnOverlay(event) {
    if (event.target.id === 'notificationPreferencesModal') {
        closeNotificationPreferences();
    }
}

/**
 * Detect if running in native Capacitor app
 */
function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/**
 * Initialize notification modal
 */
async function initializeNotificationModal() {
    const statusDiv = _notifEl('notificationStatus');
    const formDiv = _notifEl('notificationForm');
    const subscribedDiv = _notifEl('notificationSubscribed');

    const isSubscribed = localStorage.getItem(NOTIFICATION_CONFIG.storageKeys.subscribed) === 'true';

    // Detect if permission was revoked after subscribing
    if (isSubscribed && !isNativeApp() && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscribed);
        // Fall through to show the subscribe form
    } else if (isSubscribed) {
        statusDiv.style.display = 'none';
        formDiv.style.display = 'none';
        subscribedDiv.style.display = 'block';
        populateSubscribedDisplay();
        return;
    }

    if (isNativeApp()) {
        // Native app — use Capacitor push
        statusDiv.style.display = 'none';
        formDiv.style.display = 'block';
        subscribedDiv.style.display = 'none';
        await populateNotificationOptions();
        return;
    }

    // Web — check browser support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        statusDiv.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: var(--gray-900); margin-bottom: 8px;">Notifications Not Supported</h3>
                <p style="color: var(--gray-600);">
                    Your browser doesn't support push notifications. Please try using a modern browser like Chrome, Firefox, or Safari.
                </p>
            </div>
        `;
        statusDiv.style.display = 'block';
        formDiv.style.display = 'none';
        return;
    }

    if (Notification.permission === 'denied') {
        statusDiv.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
                <h3 style="color: var(--gray-900); margin-bottom: 8px;">Notifications Blocked</h3>
                <p style="color: var(--gray-600); margin-bottom: 16px;">
                    You've blocked notifications for this site. To enable them, please update your browser settings.
                </p>
            </div>
        `;
        statusDiv.style.display = 'block';
        formDiv.style.display = 'none';
        return;
    }

    statusDiv.style.display = 'none';
    formDiv.style.display = 'block';
    subscribedDiv.style.display = 'none';
    await populateNotificationOptions();
}

/**
 * Populate category and location checkboxes
 */
async function populateNotificationOptions() {
    const categoryContainer = _notifEl('categoryCheckboxes');
    const locationContainer = _notifEl('locationCheckboxes');
    const savedPrefs = JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG.storageKeys.preferences) || '{}');

    const categories = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Theatre', 'Dance', 'Other'];
    const categoryIcons = {
        'Concert': '🎤', 'Sports': '🏟️', 'Festival': '🎪', 'Comedy': '😂',
        'Family': '👨‍👩‍👧‍👦', 'Theatre': '🎭', 'Dance': '💃', 'Other': '🎟️'
    };

    const allCatsSelected = savedPrefs.categories?.length === categories.length;
    categoryContainer.innerHTML =
        `<label class="notification-checkbox-label notification-select-all">
            <input type="checkbox" id="selectAllCategories" ${allCatsSelected ? 'checked' : ''} onchange="toggleAllCheckboxes('category', this.checked)">
            <span>Select all</span>
        </label>` +
        categories.map(cat => {
        const icon = categoryIcons[cat] || '❓';
        const checked = savedPrefs.categories?.includes(cat) ? 'checked' : '';
        return `<label class="notification-checkbox-label">
            <input type="checkbox" name="category" value="${cat}" ${checked} onchange="updateSelectAll('category')">
            <span>${icon} ${cat}</span>
        </label>`;
    }).join('');

    const locations = ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Edinburgh', 'Dublin', 'Belfast', 'Cardiff', 'Leeds', 'Liverpool', 'Newcastle', 'Nottingham', 'Sheffield', 'Bristol', 'Brighton', 'Swindon'];

    const allLocsSelected = savedPrefs.locations?.length === locations.length;
    locationContainer.innerHTML =
        `<label class="notification-checkbox-label notification-select-all">
            <input type="checkbox" id="selectAllLocations" ${allLocsSelected ? 'checked' : ''} onchange="toggleAllCheckboxes('location', this.checked)">
            <span>Select all</span>
        </label>` +
        locations.map(loc => {
        const checked = savedPrefs.locations?.includes(loc) ? 'checked' : '';
        return `<label class="notification-checkbox-label">
            <input type="checkbox" name="location" value="${loc}" ${checked} onchange="updateSelectAll('location')">
            <span>📍 ${loc}</span>
        </label>`;
    }).join('');
}

/**
 * Toggle all checkboxes in a group
 */
function toggleAllCheckboxes(name, checked) {
    const checkboxes = _notifRoot.querySelectorAll('input[name="' + name + '"]');
    checkboxes.forEach(cb => { cb.checked = checked; });
}

/**
 * Update "Select all" checkbox state based on individual checkboxes
 */
function updateSelectAll(name) {
    const all = _notifRoot.querySelectorAll('input[name="' + name + '"]');
    const checked = _notifRoot.querySelectorAll('input[name="' + name + '"]:checked');
    const selectAllId = name === 'category' ? 'selectAllCategories' : 'selectAllLocations';
    const selectAll = _notifRoot.querySelector('#' + selectAllId) || document.getElementById(selectAllId);
    if (selectAll) selectAll.checked = all.length === checked.length;
}

/**
 * Subscribe to notifications (handles both native and web)
 */
async function subscribeToNotifications() {
    try {
        const selectedCategories = Array.from(_notifRoot.querySelectorAll('input[name="category"]:checked'))
            .map(cb => cb.value);
        const selectedLocations = Array.from(_notifRoot.querySelectorAll('input[name="location"]:checked'))
            .map(cb => cb.value);

        if (selectedCategories.length === 0 && selectedLocations.length === 0) {
            alert('Please select at least one category or location to get notifications.');
            return;
        }

        // Infer interpretation type from locations
        const irishLocations = ['dublin', 'belfast'];
        const hasIreland = selectedLocations.some(l => irishLocations.includes(l.toLowerCase()));
        const hasBritain = selectedLocations.some(l => !irishLocations.includes(l.toLowerCase()));
        const interpretationType = hasIreland && hasBritain ? 'both' : hasIreland ? 'ISL' : 'BSL';

        const preferences = {
            categories: selectedCategories,
            locations: selectedLocations,
            interpretationType: interpretationType
        };
        localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.preferences, JSON.stringify(preferences));

        if (isNativeApp()) {
            // Native push via Capacitor
            await subscribeNativePush(preferences);
        } else {
            // Web push via service worker
            await subscribeWebPush(preferences);
        }
    } catch (error) {
        console.error('Failed to subscribe to notifications:', error);
        alert('Failed to enable notifications. Please try again or check your settings.');
    }
}

/**
 * Native push subscription (iOS/Android)
 */
async function subscribeNativePush(preferences) {
    if (!window.requestNativePush) {
        alert('Push notifications are not available on this device.');
        return;
    }

    const granted = await window.requestNativePush();
    if (!granted) {
        alert('Notification permission was denied. Please allow notifications in your device settings.');
        return;
    }

    // Wait for registration callback to fire and set token
    // Retry up to 5 seconds (token can take time on first registration)
    let token = null;
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (window._nativePushToken) {
            token = window._nativePushToken;
            break;
        }
    }

    if (!token) {
        // Detect simulator — APNs doesn't work in simulators
        var isSimulator = false;
        try {
            var info = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device;
            if (info && info.getInfo) {
                var devInfo = await info.getInfo();
                isSimulator = devInfo.isVirtual === true;
            }
        } catch(e) {}

        if (isSimulator) {
            alert('Push notifications are not supported in the iOS Simulator. Please test on a real device.');
        } else {
            alert('Failed to get push token. Please check your notification settings and try again.');
        }
        return;
    }

    // Register device with backend
    const platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'unknown';
    const userType = localStorage.getItem('pi-user-type') || 'deaf';
    const goingTo = JSON.parse(localStorage.getItem('pi-going-festivals') || '[]');
    const response = await fetch(`${NOTIFICATION_CONFIG.apiBase}/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform, preferences, goingTo, appVersion: NOTIFICATION_CONFIG.appVersion, userType })
    });

    if (!response.ok) {
        throw new Error('Failed to register device on server');
    }

    localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscribed, 'true');

    _notifEl('notificationForm').style.display = 'none';
    _notifEl('notificationSubscribed').style.display = 'block';
    populateSubscribedDisplay();

    // Hide red dot on logo (always in main document, not scoped)
    const dot = document.getElementById('nativeLogoDot');
    if (dot) dot.style.display = 'none';
}

/**
 * Web push subscription (browsers)
 */
async function subscribeWebPush(preferences) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        alert('Notification permission was denied. Please allow notifications to continue.');
        return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(NOTIFICATION_CONFIG.vapidPublicKey)
    });

    const response = await fetch(`${NOTIFICATION_CONFIG.apiBase}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, preferences })
    });

    if (!response.ok) {
        throw new Error('Failed to save subscription on server');
    }

    localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscription, JSON.stringify(subscription));
    localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscribed, 'true');

    _notifEl('notificationForm').style.display = 'none';
    _notifEl('notificationSubscribed').style.display = 'block';
    populateSubscribedDisplay();

    // Hide red dot on logo (always in main document, not scoped)
    const dot2 = document.getElementById('nativeLogoDot');
    if (dot2) dot2.style.display = 'none';

    new Notification('🎉 Notifications Enabled!', {
        body: 'You\'ll now receive updates about new BSL & ISL interpreted events.',
        icon: 'PI Favicon.png',
        badge: 'PI Favicon.png'
    });
}

/**
 * Unsubscribe from notifications
 */
async function unsubscribeFromNotifications() {
    try {
        if (isNativeApp()) {
            // Unregister native device
            const token = window._nativePushToken;
            const platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'unknown';
            if (token) {
                await fetch(`${NOTIFICATION_CONFIG.apiBase}/unregister-device`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, platform })
                }).catch(() => {});
            }
        } else {
            // Unsubscribe web push
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                await fetch(`${NOTIFICATION_CONFIG.apiBase}/unsubscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription })
                }).catch(() => {});
            }
        }

        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.preferences);
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscribed);
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscription);

        initializeNotificationModal();
    } catch (error) {
        console.error('Failed to unsubscribe:', error);
        alert('Failed to unsubscribe. Please try again.');
    }
}

/**
 * Convert VAPID key
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Check subscription status on page load (web only)
 */
async function checkSubscriptionStatus() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            const response = await fetch(`${NOTIFICATION_CONFIG.apiBase}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.subscribed) {
                    localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscribed, 'true');
                    localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscription, JSON.stringify(subscription));
                    if (data.preferences) {
                        localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.preferences, JSON.stringify(data.preferences));
                    }
                } else {
                    localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscribed);
                    localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscription);
                }
            }
        } else {
            localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscribed);
            localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscription);
        }
    } catch (error) {
        console.warn('Failed to check subscription status:', error);
    }
}

// Check subscription status on page load (web only)
if ('serviceWorker' in navigator && !isNativeApp()) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkSubscriptionStatus, 2000);
    });
}

/**
 * Show saved preferences in the subscribed view (greyed out)
 */
function populateSubscribedDisplay() {
    const container = _notifRoot === document
        ? document.getElementById('subscribedPrefsDisplay')
        : _notifRoot.querySelector('#subscribedPrefsDisplay');
    if (!container) return;

    const savedPrefs = JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG.storageKeys.preferences) || '{}');
    const categories = savedPrefs.categories || [];
    const locations = savedPrefs.locations || [];

    const categoryIcons = {
        'Concert': '🏟️', 'Sport': '🏆', 'Festival': '🎪', 'Comedy': '😂',
        'Family': '👨‍👩‍👧‍👦', 'Theatre': '🎭', 'Dance': '💃', 'Other': '❓'
    };

    var html = '';
    if (categories.length > 0) {
        html += '<div class="festival-section festival-section-1"><h3 class="festival-section-title">Event types</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        categories.forEach(function(cat) {
            html += '<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#F3F4F6;border-radius:10px;font-size:14px;color:#374151;">' + (categoryIcons[cat] || '❓') + ' ' + cat + '</span>';
        });
        html += '</div></div>';
    }
    if (locations.length > 0) {
        html += '<div class="festival-section festival-section-2"><h3 class="festival-section-title">Locations</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        locations.forEach(function(loc) {
            html += '<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#F3F4F6;border-radius:10px;font-size:14px;color:#374151;">📍 ' + loc + '</span>';
        });
        html += '</div></div>';
    }
    container.innerHTML = html;
}

/**
 * Switch from subscribed view back to editable form
 */
function editNotificationPreferences() {
    var subscribedDiv = _notifEl('notificationSubscribed');
    var formDiv = _notifEl('notificationForm');
    if (subscribedDiv) subscribedDiv.style.display = 'none';
    if (formDiv) formDiv.style.display = 'block';
    populateNotificationOptions();
}

// Global exports
window.openNotificationPreferences = openNotificationPreferences;
window.closeNotificationPreferences = closeNotificationPreferences;
window.closeNotificationPreferencesOnOverlay = closeNotificationPreferencesOnOverlay;
window.subscribeToNotifications = subscribeToNotifications;
window.unsubscribeFromNotifications = unsubscribeFromNotifications;
window.checkSubscriptionStatus = checkSubscriptionStatus;
window.editNotificationPreferences = editNotificationPreferences;
window.toggleAllCheckboxes = toggleAllCheckboxes;
window.updateSelectAll = updateSelectAll;
window.setNotificationRoot = function(el) { _notifRoot = el || document; };
