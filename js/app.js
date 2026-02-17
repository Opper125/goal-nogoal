/* ===== MAIN APP INITIALIZATION ===== */

// ========================================
// CONFIGURATION - Set your image URLs here
// ========================================
const APP_CONFIG = {
    // Dashboard background image (GitHub hosted)
    BACKGROUND_IMAGE: '',  // <-- Put your GitHub image URL here

    // Website logo/icon (GitHub hosted)
    LOGO_IMAGE: '',        // <-- Put your GitHub image URL here
};

// ========================================
// APP INITIALIZATION
// ========================================
(async function initApp() {
    try {
        // Set images
        if (APP_CONFIG.BACKGROUND_IMAGE) {
            setBackgroundImage(APP_CONFIG.BACKGROUND_IMAGE);
        }
        if (APP_CONFIG.LOGO_IMAGE) {
            setLogoImage(APP_CONFIG.LOGO_IMAGE);
        }

        // Check device ban first
        const deviceBan = checkDeviceBan();
        if (deviceBan.banned) {
            handleBan(deviceBan.reason);
            hideLoadingScreen();
            return;
        }

        // Check server ban
        const serverBanned = await checkServerBan();
        if (serverBanned) {
            hideLoadingScreen();
            return;
        }

        // Check existing session
        const savedUser = getSession();
        if (savedUser && savedUser.id) {
            // Verify session is still valid
            const result = await apiGet('auth', 'get-user', { userId: savedUser.id });

            if (result.success && result.user) {
                // Session valid, go to dashboard
                hideLoadingScreen();
                showDashboard(result.user);
                return;
            } else if (result.error && result.error.includes('banned')) {
                handleBan(result.error);
                hideLoadingScreen();
                return;
            } else {
                // Session invalid
                clearSession();
            }
        }

        // No valid session, show auth screen
        hideLoadingScreen();
        showScreen('authScreen');

    } catch (err) {
        console.error('App init error:', err);
        hideLoadingScreen();
        showScreen('authScreen');
    }
})();

// Hide loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

// ========================================
// GLOBAL ERROR HANDLER
// ========================================
window.onerror = function (msg, url, line, col, error) {
    console.error('Global error:', msg, url, line);
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise:', event.reason);
});

// ========================================
// SERVICE WORKER (optional for PWA)
// ========================================
if ('serviceWorker' in navigator) {
    // Can register service worker for offline support
    // navigator.serviceWorker.register('/sw.js');
}

// ========================================
// PREVENT ZOOM ON MOBILE
// ========================================
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

let lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);
