/* ===== DASHBOARD ===== */

let pollInterval = null;
let backgroundImageUrl = '';
let logoImageUrl = '';

// Show dashboard
function showDashboard(user) {
    currentUser = user;

    showScreen('dashboardScreen');

    // Set username
    const usernameEl = document.getElementById('usernameDisplay');
    if (usernameEl) usernameEl.textContent = user.username;

    // Set VIP badge
    updateVipBadge();

    // Set background image
    if (backgroundImageUrl) {
        const bgEl = document.getElementById('dashboardBg');
        if (bgEl) bgEl.style.backgroundImage = `url('${backgroundImageUrl}')`;
    }

    // Set logo image
    if (logoImageUrl) {
        const barLogo = document.getElementById('barLogoImg');
        const authLogo = document.getElementById('authLogoImg');
        if (barLogo) barLogo.src = logoImageUrl;
        if (authLogo) authLogo.src = logoImageUrl;
    }

    // Set initial currency and balance
    switchCurrency(user.activeCurrency || 'MMK');
    updateBalanceDisplay();

    // Start polling for realtime updates
    startPolling();

    // Check for VVIP KING reward
    if (user.vipLevel === 'VVIP_KING' && (!user.claimedRewards || user.claimedRewards.length === 0)) {
        setTimeout(() => {
            showVvipKingRewardNotification();
        }, 3000);
    }
}

// Set background image URL (call from app.js)
function setBackgroundImage(url) {
    backgroundImageUrl = url;
    const bgEl = document.getElementById('dashboardBg');
    if (bgEl && url) {
        bgEl.style.backgroundImage = `url('${url}')`;
    }
}

// Set logo image URL (call from app.js)
function setLogoImage(url) {
    logoImageUrl = url;
    const barLogo = document.getElementById('barLogoImg');
    const authLogo = document.getElementById('authLogoImg');
    if (barLogo && url) barLogo.src = url;
    if (authLogo && url) authLogo.src = url;
}

// Start polling for realtime updates
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        await pollUserData();
    }, 5000); // Poll every 5 seconds
}

// Stop polling
function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Poll user data for realtime updates
async function pollUserData() {
    const userId = getUserId();
    if (!userId) return;

    try {
        const result = await apiGet('database', 'poll-user', { userId: userId });

        if (!result.success) return;

        // Check if banned
        if (result.banned) {
            handleBan(result.reason);
            return;
        }

        if (!result.user) return;

        const newUser = result.user;

        // Check balance changes and animate
        if (currentUser) {
            ['MMK', 'USD', 'CNY'].forEach(curr => {
                const oldBal = currentUser.balance[curr] || 0;
                const newBal = newUser.balance[curr] || 0;

                if (newBal !== oldBal) {
                    if (curr === currentCurrency) {
                        const amountEl = document.getElementById('balanceAmount');
                        if (amountEl) {
                            if (newBal > oldBal) {
                                showMoneyRain(curr);
                                showToast(`+${formatNumber(newBal - oldBal)} ${curr} received!`, 'success');
                            }
                            animateBalance(amountEl, oldBal, newBal, 2000);
                        }
                    }
                }
            });

            // Check VIP level change
            if (newUser.vipLevel !== currentUser.vipLevel) {
                if (newUser.vipLevel === 'VVIP_KING' && currentUser.vipLevel !== 'VVIP_KING') {
                    showToast('👑 You have been promoted to VVIP KING!', 'success', 5000);
                    setTimeout(() => {
                        if (!newUser.claimedRewards || newUser.claimedRewards.length === 0) {
                            showVvipKingRewardNotification();
                        }
                    }, 2000);
                } else if (newUser.vipLevel === 'VVIP' && currentUser.vipLevel === 'VIP') {
                    showToast('💎 You have been promoted to VVIP!', 'success', 4000);
                }
            }

            // Check deposit history for status changes
            if (newUser.depositHistory && currentUser.depositHistory) {
                newUser.depositHistory.forEach(newDep => {
                    const oldDep = currentUser.depositHistory.find(d => d.depositId === newDep.depositId);
                    if (oldDep && oldDep.status !== newDep.status) {
                        if (newDep.status === 'approved') {
                            showToast(`Deposit of ${formatNumber(newDep.amount)} ${newDep.currency} approved!`, 'success', 4000);
                        } else if (newDep.status === 'rejected') {
                            showToast(`Deposit rejected: ${newDep.reason || 'Contact admin'}`, 'error', 5000);
                        }
                    }
                });
            }

            // Check withdraw history for status changes
            if (newUser.withdrawHistory && currentUser.withdrawHistory) {
                newUser.withdrawHistory.forEach(newWd => {
                    const oldWd = currentUser.withdrawHistory.find(w => w.withdrawId === newWd.withdrawId);
                    if (oldWd && oldWd.status !== newWd.status) {
                        if (newWd.status === 'approved') {
                            showToast(`Withdrawal of ${formatNumber(newWd.amount)} ${newWd.currency} approved!`, 'success', 4000);
                        } else if (newWd.status === 'rejected') {
                            showToast(`Withdrawal rejected: ${newWd.reason || 'Contact admin'}`, 'error', 5000);
                        }
                    }
                });
            }
        }

        // Update current user
        currentUser = newUser;
        saveSession(currentUser);
        updateBalanceDisplay();
        updateVipBadge();

    } catch (err) {
        console.error('Poll error:', err);
    }
}

// Handle ban
function handleBan(reason) {
    stopPolling();
    clearSession();

    // Store ban info
    localStorage.setItem('gng_banned', 'true');
    localStorage.setItem('gng_ban_reason', reason || 'Account banned');

    // Show ban screen
    const banScreen = document.getElementById('banScreen');
    const banReason = document.getElementById('banReason');

    if (banReason) banReason.textContent = reason || 'Your account has been suspended due to policy violation.';

    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    banScreen.style.display = 'flex';

    // Set ban cookie/storage for device ban
    try {
        document.cookie = `gng_banned=true;max-age=${365 * 24 * 60 * 60};path=/`;
    } catch (e) { }
}

// Check if device is banned
function checkDeviceBan() {
    const localBan = localStorage.getItem('gng_banned');
    const cookieBan = document.cookie.includes('gng_banned=true');

    if (localBan === 'true' || cookieBan) {
        const reason = localStorage.getItem('gng_ban_reason') || 'Your account has been suspended.';
        return { banned: true, reason: reason };
    }
    return { banned: false };
}

// Check ban from server
async function checkServerBan() {
    const userId = getUserId();
    const deviceId = getDeviceId();
    const ip = await getIPAddress();

    const params = {};
    if (userId) params.userId = userId;
    if (deviceId) params.deviceId = deviceId;
    if (ip) params.ip = ip;

    const result = await apiGet('auth', 'check-ban', params);

    if (result.success && result.banned) {
        handleBan(result.reason);
        return true;
    }
    return false;
}

// Logout
function logout() {
    stopPolling();
    clearSession();
    currentUser = null;

    showScreen('authScreen');

    // Clear form fields
    document.getElementById('loginPhone').value = '';
    document.getElementById('loginPassword').value = '';

    showToast('Logged out successfully', 'info');
}

// Handle visibility change (pause/resume polling)
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
        if (currentUser && getUserId()) {
            pollUserData(); // Immediate poll
            startPolling();
        }
    } else {
        stopPolling();
    }
});

// Handle online/offline
window.addEventListener('online', function () {
    if (currentUser && getUserId()) {
        showToast('Back online', 'success');
        pollUserData();
        startPolling();
    }
});

window.addEventListener('offline', function () {
    showToast('You are offline', 'warning');
    stopPolling();
});
