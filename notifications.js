/*==========================================================================
  PERFORMANCE INTERPRETING - ANONYMOUS PUSH NOTIFICATIONS
  100% Privacy-First Notification System
  ==========================================================================*/

const NOTIFICATION_CONFIG = {
    // IMPORTANT: Replace this with your actual VAPID public key
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY_HERE',

    // Replace with your actual notification server endpoint
    subscriptionEndpoint: 'https://api.performanceinterpreting.co.uk/api/subscribe',

    storageKeys: {
        preferences: 'pi-notification-preferences',
        subscribed: 'pi-notification-subscribed',
        subscription: 'pi-notification-subscription'
    }
};

/**
 * Open notification preferences modal
 */
function openNotificationPreferences() {
    const modal = document.getElementById('notificationPreferencesModal');
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Close mobile menu if open
    if (window.closeMobileMenu) {
        window.closeMobileMenu();
    }

    // Initialize the modal
    initializeNotificationModal();
}

/**
 * Close notification preferences modal
 */
function closeNotificationPreferences() {
    const modal = document.getElementById('notificationPreferencesModal');
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
}

/**
 * Close on overlay click
 */
function closeNotificationPreferencesOnOverlay(event) {
    if (event.target.id === 'notificationPreferencesModal') {
        closeNotificationPreferences();
    }
}

/**
 * Initialize notification modal
 */
async function initializeNotificationModal() {
    const statusDiv = document.getElementById('notificationStatus');
    const formDiv = document.getElementById('notificationForm');
    const subscribedDiv = document.getElementById('notificationSubscribed');

    // Check if already subscribed
    const isSubscribed = localStorage.getItem(NOTIFICATION_CONFIG.storageKeys.subscribed) === 'true';

    if (isSubscribed) {
        statusDiv.style.display = 'none';
        formDiv.style.display = 'none';
        subscribedDiv.style.display = 'block';
        return;
    }

    // Check if browser supports notifications
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

    // Check notification permission
    if (Notification.permission === 'denied') {
        statusDiv.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
                <h3 style="color: var(--gray-900); margin-bottom: 8px;">Notifications Blocked</h3>
                <p style="color: var(--gray-600); margin-bottom: 16px;">
                    You've blocked notifications for this site. To enable them, please update your browser settings.
                </p>
                <p style="font-size: 13px; color: var(--gray-500);">
                    <strong>How to enable:</strong><br>
                    Click the lock icon in your browser's address bar and allow notifications.
                </p>
            </div>
        `;
        statusDiv.style.display = 'block';
        formDiv.style.display = 'none';
        return;
    }

    // Show the form
    statusDiv.style.display = 'none';
    formDiv.style.display = 'block';
    subscribedDiv.style.display = 'none';

    // Populate checkboxes
    await populateNotificationOptions();
}

/**
 * Populate category and location checkboxes
 */
async function populateNotificationOptions() {
    const categoryContainer = document.getElementById('categoryCheckboxes');
    const locationContainer = document.getElementById('locationCheckboxes');

    // Get saved preferences if any
    const savedPrefs = JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG.storageKeys.preferences) || '{}');

    // Get categories from current events
    const categories = ['Concert', 'Sports', 'Festival', 'Comedy', 'Family', 'Literature', 'Theatre', 'Dance', 'Other'];
    const categoryIcons = {
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

    categoryContainer.innerHTML = categories.map(cat => {
        const icon = categoryIcons[cat] || '❓';
        const checked = savedPrefs.categories?.includes(cat) ? 'checked' : '';
        return `
            <label class="notification-checkbox-label">
                <input type="checkbox" name="category" value="${cat}" ${checked}>
                <span>${icon} ${cat}</span>
            </label>
        `;
    }).join('');

    // Get locations
    const locations = ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Dublin', 'Belfast', 'Leeds', 'Liverpool', 'Newcastle', 'Nottingham'];

    locationContainer.innerHTML = locations.map(loc => {
        const checked = savedPrefs.locations?.includes(loc) ? 'checked' : '';
        return `
            <label class="notification-checkbox-label">
                <input type="checkbox" name="location" value="${loc}" ${checked}>
                <span>📍 ${loc}</span>
            </label>
        `;
    }).join('');
}

/**
 * Subscribe to notifications
 */
async function subscribeToNotifications() {
    try {
        // Get selected preferences
        const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked'))
            .map(cb => cb.value);
        const selectedLocations = Array.from(document.querySelectorAll('input[name="location"]:checked'))
            .map(cb => cb.value);

        if (selectedCategories.length === 0 && selectedLocations.length === 0) {
            alert('Please select at least one category or location to get notifications.');
            return;
        }

        // Save preferences locally
        const preferences = {
            categories: selectedCategories,
            locations: selectedLocations
        };
        localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.preferences, JSON.stringify(preferences));

        // Request notification permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            alert('Notification permission was denied. Please allow notifications to continue.');
            return;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(NOTIFICATION_CONFIG.vapidPublicKey)
        });

        // Send subscription to server
        const response = await fetch(NOTIFICATION_CONFIG.subscriptionEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscription: subscription,
                preferences: preferences
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save subscription on server');
        }

        // Save subscription locally
        localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscription, JSON.stringify(subscription));
        localStorage.setItem(NOTIFICATION_CONFIG.storageKeys.subscribed, 'true');

        // Show success message
        document.getElementById('notificationForm').style.display = 'none';
        document.getElementById('notificationSubscribed').style.display = 'block';

        // Show a test notification
        new Notification('🎉 Notifications Enabled!', {
            body: 'You\'ll now receive updates about new BSL & ISL interpreted events.',
            icon: 'PI Favicon.png',
            badge: 'PI Favicon.png'
        });

    } catch (error) {
        console.error('Failed to subscribe to notifications:', error);
        alert('Failed to enable notifications. Please try again or check your browser settings.');
    }
}

/**
 * Unsubscribe from notifications
 */
async function unsubscribeFromNotifications() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Unsubscribe from push
            await subscription.unsubscribe();

            // Notify server to remove subscription
            await fetch(NOTIFICATION_CONFIG.subscriptionEndpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription: subscription })
            });
        }

        // Clear local storage
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.preferences);
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscribed);
        localStorage.removeItem(NOTIFICATION_CONFIG.storageKeys.subscription);

        // Refresh modal
        initializeNotificationModal();

    } catch (error) {
        console.error('Failed to unsubscribe:', error);
        alert('Failed to unsubscribe. Please try again.');
    }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Make functions available globally
window.openNotificationPreferences = openNotificationPreferences;
window.closeNotificationPreferences = closeNotificationPreferences;
window.closeNotificationPreferencesOnOverlay = closeNotificationPreferencesOnOverlay;
window.subscribeToNotifications = subscribeToNotifications;
window.unsubscribeFromNotifications = unsubscribeFromNotifications;
