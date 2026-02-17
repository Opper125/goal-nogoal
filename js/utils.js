/* ===== UTILITIES ===== */

const API_BASE = '/api';
const API_TIMEOUT = 15000;
const API_RETRY_COUNT = 2;
const API_RETRY_DELAY = 1000;

// Simple in-memory cache
const apiCache = {};
const CACHE_TTL = 3000; // 3 seconds cache

// Device fingerprint
function getDeviceId() {
    let deviceId = localStorage.getItem('gng_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
        localStorage.setItem('gng_device_id', deviceId);
    }
    return deviceId;
}

// Get IP address with cache
let cachedIP = null;
let ipFetchTime = 0;
async function getIPAddress() {
    if (cachedIP && Date.now() - ipFetchTime < 300000) return cachedIP;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        cachedIP = data.ip;
        ipFetchTime = Date.now();
        return data.ip;
    } catch (e) {
        return cachedIP || 'unknown';
    }
}

// Fetch with timeout
function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Request timeout'));
        }, timeout);

        fetch(url, { ...options, signal: controller.signal })
            .then(response => {
                clearTimeout(timer);
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// Retry wrapper
async function fetchWithRetry(url, options, retries = API_RETRY_COUNT) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetchWithTimeout(url, options);
            return res;
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, API_RETRY_DELAY * (i + 1)));
        }
    }
}

// API call helper with retry and timeout
async function apiCall(endpoint, action, method = 'GET', body = null, headers = {}) {
    try {
        const url = `${API_BASE}/${endpoint}?action=${action}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const res = await fetchWithRetry(url, options);

        if (!res.ok) {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return { success: false, error: `Server error: ${res.status}` };
            }
        }

        const data = await res.json();
        return data;
    } catch (err) {
        console.error('API call error:', err);
        if (err.message === 'Request timeout') {
            return { success: false, error: 'Request timed out. Please try again.' };
        }
        return { success: false, error: 'Network error. Please check your connection.' };
    }
}

// API GET with cache support
async function apiGet(endpoint, action, params = {}, useCache = false) {
    let url = `${API_BASE}/${endpoint}?action=${action}`;
    Object.keys(params).forEach(key => {
        url += `&${key}=${encodeURIComponent(params[key])}`;
    });

    // Check cache
    if (useCache && apiCache[url] && Date.now() - apiCache[url].time < CACHE_TTL) {
        return apiCache[url].data;
    }

    try {
        const res = await fetchWithRetry(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return { success: false, error: `Server error: ${res.status}` };
            }
        }

        const data = await res.json();

        // Store in cache
        if (useCache) {
            apiCache[url] = { data: data, time: Date.now() };
        }

        return data;
    } catch (err) {
        console.error('API GET error:', err);

        // Return cached data if available on error
        if (apiCache[url]) {
            return apiCache[url].data;
        }

        if (err.message === 'Request timeout') {
            return { success: false, error: 'Request timed out.' };
        }
        return { success: false, error: 'Network error.' };
    }
}

// Admin API call
async function adminApiCall(action, method = 'GET', body = null) {
    const tgUserId = window.ADMIN_TG_USER_ID || '';
    return apiCall('admin', action, method, body, {
        'X-Telegram-User-Id': tgUserId
    });
}

// Clear cache
function clearApiCache() {
    Object.keys(apiCache).forEach(key => delete apiCache[key]);
}

// Toast notification
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer') || document.getElementById('adminToast');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    toast.style.animationDuration = '0.4s, 0.4s';
    toast.style.animationDelay = `0s, ${duration / 1000}s`;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, duration + 500);
}

// Format number with commas
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-US');
}

// Format currency
function formatCurrency(amount, currency) {
    const formatted = formatNumber(amount);
    switch (currency) {
        case 'USD': return `$${formatted}`;
        case 'CNY': return `¥${formatted}`;
        case 'MMK': return `${formatted} Ks`;
        default: return formatted;
    }
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}`;
}

// Format relative time
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
}

// Session management
function saveSession(user) {
    localStorage.setItem('gng_user_id', user.id);
    localStorage.setItem('gng_user', JSON.stringify(user));
}

function getSession() {
    const userId = localStorage.getItem('gng_user_id');
    const userData = localStorage.getItem('gng_user');
    if (userId && userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function clearSession() {
    localStorage.removeItem('gng_user_id');
    localStorage.removeItem('gng_user');
}

function getUserId() {
    return localStorage.getItem('gng_user_id');
}

// Modal helpers
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = '';
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.style.display = 'none');
    document.body.style.overflow = '';
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// VIP level display
function getVipDisplay(level) {
    switch (level) {
        case 'VVIP_KING':
            return '<i class="fas fa-crown vip-crown"></i> VVIP KING';
        case 'VVIP':
            return '<i class="fas fa-gem"></i> VVIP';
        default:
            return '<i class="fas fa-star"></i> VIP';
    }
}

function getVipBadgeClass(level) {
    return `vip-${level}`;
}

// Status badge
function getStatusBadge(status) {
    return `<span class="hist-status ${status}">${status.toUpperCase()}</span>`;
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied!', 'success');
    }
}

// Animate balance counting
function animateBalance(element, from, to, duration = 2000) {
    const startTime = performance.now();
    const diff = to - from;

    element.classList.add('animating');

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + diff * eased);
        element.textContent = formatNumber(current);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = formatNumber(to);
            setTimeout(() => {
                element.classList.remove('animating');
            }, 500);
        }
    }

    requestAnimationFrame(update);
}

// Money rain animation
function showMoneyRain(currency) {
    const container = document.getElementById('balanceAnimation');
    const rain = document.getElementById('moneyRain');
    if (!container || !rain) return;

    container.style.display = 'block';
    rain.innerHTML = '';

    const symbols = { MMK: 'Ks', USD: '$', CNY: '¥' };
    const symbol = symbols[currency] || '$';

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'money-particle';
        particle.textContent = symbol;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 1.5 + 's';
        particle.style.fontSize = (16 + Math.random() * 20) + 'px';
        particle.style.color = currency === 'MMK' ? '#81c784' : currency === 'USD' ? '#64b5f6' : '#ffb74d';
        rain.appendChild(particle);
    }

    setTimeout(() => {
        container.style.display = 'none';
        rain.innerHTML = '';
    }, 3500);
}

// Limits config (client side)
const LIMITS = {
    MMK: { DEPOSIT_MIN: 10000, DEPOSIT_MAX: 1000000, WITHDRAW_MIN: 10000, WITHDRAW_MAX: 1000000, BET_MIN: 1000, BET_MAX: 24681098 },
    USD: { DEPOSIT_MIN: 10, DEPOSIT_MAX: 10000, WITHDRAW_MIN: 10, WITHDRAW_MAX: 10000, BET_MIN: 1, BET_MAX: 28038 },
    CNY: { DEPOSIT_MIN: 50, DEPOSIT_MAX: 10000, WITHDRAW_MIN: 100, WITHDRAW_MAX: 100000, BET_MIN: 5, BET_MAX: 2890300 }
};

function getLimits(currency) {
    return LIMITS[currency] || LIMITS.MMK;
}
