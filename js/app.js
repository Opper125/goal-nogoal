/* ===== MAIN APP INITIALIZATION ===== */

// ========================================
// CONFIGURATION - Set your image URLs here
// ========================================
const APP_CONFIG = {
    // Dashboard background image (GitHub hosted)
    BACKGROUND_IMAGE: 'https://dkyfjllrltquwndlitru.supabase.co/storage/v1/object/public/Video/20260218_020724.jpg',  // <-- Put your GitHub image URL here

    // Website logo/icon (GitHub hosted)
    LOGO_IMAGE: 'https://dkyfjllrltquwndlitru.supabase.co/storage/v1/object/public/Video/20260218_020459.png',        // <-- Put your GitHub image URL here
};

// ========================================
// APP INITIALIZATION
// ========================================
/* ===== MAIN APP INITIALIZATION ===== */
(async function initApp() {
    try {
        // Set images
        if (APP_CONFIG.BACKGROUND_IMAGE) {
            setBackgroundImage(APP_CONFIG.BACKGROUND_IMAGE);
        }
        if (APP_CONFIG.LOGO_IMAGE) {
            setLogoImage(APP_CONFIG.LOGO_IMAGE);
        }

        // Check existing session first
        const savedUser = getSession();

        if (savedUser && savedUser.id) {
            // Have a session - check server ban status (this also clears local ban if unbanned)
            const serverBanned = await checkServerBan();

            if (serverBanned) {
                hideLoadingScreen();
                return;
            }

            // Not banned - verify session is still valid
            const result = await apiGet('auth', 'get-user', { userId: savedUser.id });

            if (result.success && result.user) {
                hideLoadingScreen();
                showDashboard(result.user);
                return;
            } else if (result.error && result.error.includes('banned')) {
                handleBan(result.error);
                hideLoadingScreen();
                return;
            } else {
                clearSession();
                clearBanData();
            }
        } else {
            // No session - check device ban but also verify with server
            const deviceBan = checkDeviceBan();

            if (deviceBan.banned) {
                // Device thinks it's banned - verify with server
                const serverBanned = await checkServerBan();

                if (serverBanned) {
                    hideLoadingScreen();
                    return;
                }
                // Server says not banned - clearBanData already called in checkServerBan
            }
        }

        // No valid session and not banned, show auth screen
        hideLoadingScreen();
        showScreen('authScreen');

    } catch (err) {
        console.error('App init error:', err);
        // On error, clear ban data and show auth
        clearBanData();
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

// Global error handler
window.onerror = function (msg, url, line, col, error) {
    console.error('Global error:', msg, url, line);
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise:', event.reason);
});

// Prevent zoom on mobile
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
