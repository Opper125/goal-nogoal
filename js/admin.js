/* ===== ADMIN PANEL ===== */

let adminData = {
    stats: null,
    users: [],
    deposits: [],
    withdrawals: [],
    payments: { MMK: [], USD: [], CNY: [] },
    videos: { goal: [], nogoal: [] },
    controls: { enabled: false, rules: [] },
    contacts: [],
    bannedUsers: []
};

let currentAdminSection = 'dashboard';
let currentPayTab = 'MMK';
let currentVideoTab = 'goal';
let currentDepositFilter = 'pending';
let currentWithdrawalFilter = 'pending';
let adminPollInterval = null;

// ========================================
// INITIALIZATION
// ========================================
(async function initAdmin() {
    showAdminSection('dashboard');
    await loadAllAdminData();
    startAdminPolling();
})();

// Start admin polling
function startAdminPolling() {
    if (adminPollInterval) clearInterval(adminPollInterval);
    adminPollInterval = setInterval(async () => {
        await refreshCurrentSection();
    }, 8000);
}

// Refresh current section data
async function refreshCurrentSection() {
    switch (currentAdminSection) {
        case 'dashboard': await loadStats(); break;
        case 'deposits': await loadDeposits(); break;
        case 'withdrawals': await loadWithdrawals(); break;
        case 'users': await loadUsers(); break;
        case 'banned': await loadBannedUsers(); break;
    }
}

// Load all admin data
async function loadAllAdminData() {
    await Promise.all([
        loadStats(),
        loadDeposits(),
        loadWithdrawals(),
        loadUsers(),
        loadPayments(),
        loadVideosAdmin(),
        loadControlsAdmin(),
        loadContactsAdmin(),
        loadBannedUsers()
    ]);
}

// ========================================
// SECTION NAVIGATION
// ========================================
function showAdminSection(section) {
    currentAdminSection = section;

    document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));

    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) sectionEl.style.display = 'block';

    const navBtns = document.querySelectorAll('.admin-nav-btn');
    navBtns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(section) ||
            btn.getAttribute('onclick')?.includes(section)) {
            btn.classList.add('active');
        }
    });

    // Refresh data for section
    switch (section) {
        case 'dashboard': loadStats(); break;
        case 'deposits': loadDeposits(); break;
        case 'withdrawals': loadWithdrawals(); break;
        case 'users': loadUsers(); break;
        case 'payments': loadPayments(); break;
        case 'game': loadVideosAdmin(); loadControlsAdmin(); break;
        case 'contacts': loadContactsAdmin(); break;
        case 'banned': loadBannedUsers(); break;
    }
}

// Admin toast
function adminToast(message, type = 'info') {
    showToast(message, type);
}

// ========================================
// STATISTICS
// ========================================
async function loadStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const result = await adminApiCall('get-stats', 'GET');
    if (!result || !result.success) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load stats</p></div>';
        return;
    }

    const s = result.stats;
    adminData.stats = s;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total Users</div>
            <div class="stat-value">${formatNumber(s.totalUsers)}</div>
            <div class="stat-sub">Today: ${s.todayNewUsers} | Month: ${s.monthNewUsers}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Banned Users</div>
            <div class="stat-value" style="color:#ef5350;">${formatNumber(s.bannedUsers)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Games</div>
            <div class="stat-value">${formatNumber(s.games.totalPlayed)}</div>
            <div class="stat-sub">W: ${s.games.totalWins} | L: ${s.games.totalLosses}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Pending</div>
            <div class="stat-value" style="color:#ffc107;">${s.deposits.pendingCount + s.withdrawals.pendingCount}</div>
            <div class="stat-sub">Dep: ${s.deposits.pendingCount} | Wd: ${s.withdrawals.pendingCount}</div>
        </div>

        <div class="stat-card wide">
            <div class="stat-label">Deposits (Today / Month / Year)</div>
            <div class="stat-breakdown">
                <div class="breakdown-item">
                    <div class="breakdown-label">MMK</div>
                    <div class="breakdown-value">${formatNumber(s.deposits.today.MMK)} / ${formatNumber(s.deposits.month.MMK)} / ${formatNumber(s.deposits.year.MMK)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">USD</div>
                    <div class="breakdown-value">$${formatNumber(s.deposits.today.USD)} / $${formatNumber(s.deposits.month.USD)} / $${formatNumber(s.deposits.year.USD)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">CNY</div>
                    <div class="breakdown-value">¥${formatNumber(s.deposits.today.CNY)} / ¥${formatNumber(s.deposits.month.CNY)} / ¥${formatNumber(s.deposits.year.CNY)}</div>
                </div>
            </div>
        </div>

        <div class="stat-card wide">
            <div class="stat-label">Withdrawals (Today / Month / Year)</div>
            <div class="stat-breakdown">
                <div class="breakdown-item">
                    <div class="breakdown-label">MMK</div>
                    <div class="breakdown-value">${formatNumber(s.withdrawals.today.MMK)} / ${formatNumber(s.withdrawals.month.MMK)} / ${formatNumber(s.withdrawals.year.MMK)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">USD</div>
                    <div class="breakdown-value">$${formatNumber(s.withdrawals.today.USD)} / $${formatNumber(s.withdrawals.month.USD)} / $${formatNumber(s.withdrawals.year.USD)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">CNY</div>
                    <div class="breakdown-value">¥${formatNumber(s.withdrawals.today.CNY)} / ¥${formatNumber(s.withdrawals.month.CNY)} / ¥${formatNumber(s.withdrawals.year.CNY)}</div>
                </div>
            </div>
        </div>

        <div class="stat-card wide">
            <div class="stat-label">Revenue (Profit/Loss)</div>
            <div class="stat-breakdown">
                <div class="breakdown-item">
                    <div class="breakdown-label">MMK</div>
                    <div class="breakdown-value" style="color:${s.revenue.MMK >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.MMK >= 0 ? '+' : ''}${formatNumber(s.revenue.MMK)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">USD</div>
                    <div class="breakdown-value" style="color:${s.revenue.USD >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.USD >= 0 ? '+$' : '-$'}${formatNumber(Math.abs(s.revenue.USD))}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">CNY</div>
                    <div class="breakdown-value" style="color:${s.revenue.CNY >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.CNY >= 0 ? '+¥' : '-¥'}${formatNumber(Math.abs(s.revenue.CNY))}</div>
                </div>
            </div>
        </div>

        <div class="stat-card wide">
            <div class="stat-label">Game Win/Loss Amounts</div>
            <div class="stat-breakdown">
                <div class="breakdown-item">
                    <div class="breakdown-label">Win (MMK/USD/CNY)</div>
                    <div class="breakdown-value" style="color:#4caf50">${formatNumber(s.games.winAmount.MMK)} / $${formatNumber(s.games.winAmount.USD)} / ¥${formatNumber(s.games.winAmount.CNY)}</div>
                </div>
                <div class="breakdown-item">
                    <div class="breakdown-label">Loss (MMK/USD/CNY)</div>
                    <div class="breakdown-value" style="color:#f44336">${formatNumber(s.games.lossAmount.MMK)} / $${formatNumber(s.games.lossAmount.USD)} / ¥${formatNumber(s.games.lossAmount.CNY)}</div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// DEPOSITS MANAGEMENT
// ========================================
async function loadDeposits() {
    const result = await adminApiCall('get-deposits', 'GET');
    if (result && result.success) {
        adminData.deposits = result.deposits || [];
        renderDepositsAdmin();
    }
}

function filterDeposits(filter) {
    currentDepositFilter = filter;
    document.querySelectorAll('#section-deposits .filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderDepositsAdmin();
}

function renderDepositsAdmin() {
    const container = document.getElementById('depositsListAdmin');
    if (!container) return;

    let deps = adminData.deposits || [];
    if (currentDepositFilter !== 'all') {
        deps = deps.filter(d => d.status === currentDepositFilter);
    }
    deps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (deps.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No deposits found</p></div>';
        return;
    }

    container.innerHTML = deps.map(dep => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${dep.username}</div>
                <span class="item-badge ${dep.status}">${dep.status.toUpperCase()}</span>
            </div>
            <div class="item-details">
                <div>Amount: <span>${formatNumber(dep.amount)} ${dep.currency}</span></div>
                <div>Payment: <span>${dep.paymentName || '-'}</span></div>
                <div>TXN ID: <span>${dep.transactionId || '-'}</span></div>
                <div>Time: <span>${formatDate(dep.createdAt)}</span></div>
                ${dep.adminNote ? `<div>Note: <span style="color:#ffc107;">${dep.adminNote}</span></div>` : ''}
            </div>
            ${dep.status === 'pending' ? `
                <div class="item-actions">
                    <button class="btn-approve" onclick="approveDeposit('${dep.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-reject" onclick="rejectDeposit('${dep.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function approveDeposit(depositId) {
    if (!confirm('Approve this deposit?')) return;

    adminToast('Approving deposit...', 'info');
    const result = await adminApiCall('approve-deposit', 'POST', { depositId });

    if (result.success) {
        adminToast('Deposit approved!', 'success');
        await loadDeposits();
        await loadStats();
    } else {
        adminToast(result.error || 'Failed to approve', 'error');
    }
}

async function rejectDeposit(depositId) {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;

    adminToast('Rejecting deposit...', 'info');
    const result = await adminApiCall('reject-deposit', 'POST', { depositId, reason: reason || 'Rejected by admin' });

    if (result.success) {
        adminToast('Deposit rejected', 'success');
        await loadDeposits();
    } else {
        adminToast(result.error || 'Failed to reject', 'error');
    }
}

// ========================================
// WITHDRAWALS MANAGEMENT
// ========================================
async function loadWithdrawals() {
    const result = await adminApiCall('get-withdrawals', 'GET');
    if (result && result.success) {
        adminData.withdrawals = result.withdrawals || [];
        renderWithdrawalsAdmin();
    }
}

function filterWithdrawals(filter) {
    currentWithdrawalFilter = filter;
    document.querySelectorAll('#section-withdrawals .filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderWithdrawalsAdmin();
}

function renderWithdrawalsAdmin() {
    const container = document.getElementById('withdrawalsListAdmin');
    if (!container) return;

    let wds = adminData.withdrawals || [];
    if (currentWithdrawalFilter !== 'all') {
        wds = wds.filter(w => w.status === currentWithdrawalFilter);
    }
    wds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (wds.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No withdrawals found</p></div>';
        return;
    }

    container.innerHTML = wds.map(wd => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${wd.username}</div>
                <span class="item-badge ${wd.status}">${wd.status.toUpperCase()}</span>
            </div>
            <div class="item-details">
                <div>Amount: <span>${formatNumber(wd.amount)} ${wd.currency}</span></div>
                <div>Time: <span>${formatDate(wd.createdAt)}</span></div>
                ${wd.adminNote ? `<div>Note: <span style="color:#ffc107;">${wd.adminNote}</span></div>` : ''}
            </div>
            ${wd.status === 'pending' ? `
                <div class="item-actions">
                    <button class="btn-approve" onclick="approveWithdraw('${wd.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-reject" onclick="rejectWithdraw('${wd.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function approveWithdraw(withdrawalId) {
    if (!confirm('Approve this withdrawal?')) return;

    adminToast('Approving withdrawal...', 'info');
    const result = await adminApiCall('approve-withdraw', 'POST', { withdrawalId });

    if (result.success) {
        adminToast('Withdrawal approved!', 'success');
        await loadWithdrawals();
        await loadStats();
    } else {
        adminToast(result.error || 'Failed to approve', 'error');
    }
}

async function rejectWithdraw(withdrawalId) {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;

    adminToast('Rejecting withdrawal...', 'info');
    const result = await adminApiCall('reject-withdraw', 'POST', { withdrawalId, reason: reason || 'Rejected by admin' });

    if (result.success) {
        adminToast('Withdrawal rejected and balance refunded', 'success');
        await loadWithdrawals();
    } else {
        adminToast(result.error || 'Failed to reject', 'error');
    }
}

// ========================================
// USERS MANAGEMENT
// ========================================
async function loadUsers() {
    const result = await adminApiCall('get-users', 'GET');
    if (result && result.success) {
        adminData.users = result.users || [];
        renderUsersAdmin();
    }
}

function searchUsers() {
    renderUsersAdmin();
}

function renderUsersAdmin() {
    const container = document.getElementById('usersListAdmin');
    if (!container) return;

    let users = adminData.users || [];
    const searchVal = document.getElementById('userSearchInput')?.value?.toLowerCase() || '';

    if (searchVal) {
        users = users.filter(u =>
            u.username.toLowerCase().includes(searchVal) ||
            u.phone.includes(searchVal) ||
            u.email.toLowerCase().includes(searchVal)
        );
    }

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No users found</p></div>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">
                    ${user.username}
                    <span style="font-size:11px;color:#555;margin-left:6px;">${user.vipLevel || 'VIP'}</span>
                </div>
                <span class="item-badge ${user.bannedStatus?.isBanned ? 'rejected' : 'approved'}">
                    ${user.bannedStatus?.isBanned ? 'BANNED' : 'ACTIVE'}
                </span>
            </div>
            <div class="item-details">
                <div>Phone: <span>${user.phone}</span></div>
                <div>Email: <span>${user.email}</span></div>
                <div>Balance: <span>MMK: ${formatNumber(user.balance?.MMK || 0)} | USD: $${formatNumber(user.balance?.USD || 0)} | CNY: ¥${formatNumber(user.balance?.CNY || 0)}</span></div>
                <div>Games: <span>${user.totalGamesPlayed || 0} (W:${user.totalGamesWon || 0} L:${user.totalGamesLost || 0})</span></div>
                <div>Joined: <span>${formatDate(user.createdAt)}</span></div>
            </div>
            <div class="item-actions" style="flex-wrap:wrap;">
                <button class="btn-action" onclick="openUserDetail('${user.id}')">
                    <i class="fas fa-eye"></i> Details
                </button>
                <button class="btn-action" onclick="openAdjustBalance('${user.id}', '${user.username}')">
                    <i class="fas fa-coins"></i> Balance
                </button>
                <button class="btn-action" onclick="setUserVip('${user.id}')">
                    <i class="fas fa-crown"></i> VIP
                </button>
                ${user.bannedStatus?.isBanned
                    ? `<button class="btn-action" style="color:#4caf50;border-color:rgba(76,175,80,0.2);" onclick="unbanUser('${user.id}')"><i class="fas fa-unlock"></i> Unban</button>`
                    : `<button class="btn-action danger" onclick="banUser('${user.id}')"><i class="fas fa-ban"></i> Ban</button>`
                }
            </div>
        </div>
    `).join('');
}

// Open user detail
function openUserDetail(userId) {
    const user = adminData.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('adminModalTitle').textContent = `User: ${user.username}`;
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <div style="margin-bottom:20px;">
                <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">ACCOUNT INFO</h4>
                <div class="item-details">
                    <div>ID: <span style="font-size:11px;">${user.id}</span></div>
                    <div>Username: <span>${user.username}</span></div>
                    <div>Phone: <span>${user.phone}</span></div>
                    <div>Email: <span>${user.email}</span></div>
                    <div>VIP Level: <span>${user.vipLevel || 'VIP'}</span></div>
                    <div>Device ID: <span style="font-size:10px;">${user.deviceId || '-'}</span></div>
                    <div>IP: <span>${user.ipAddress || '-'}</span></div>
                    <div>Joined: <span>${formatDate(user.createdAt)}</span></div>
                    <div>Last Login: <span>${formatDate(user.lastLogin)}</span></div>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">BALANCES</h4>
                <div class="item-details">
                    <div>MMK: <span>${formatNumber(user.balance?.MMK || 0)}</span></div>
                    <div>USD: <span>$${formatNumber(user.balance?.USD || 0)}</span></div>
                    <div>CNY: <span>¥${formatNumber(user.balance?.CNY || 0)}</span></div>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">TOTALS</h4>
                <div class="item-details">
                    <div>Total Deposits: <span>MMK:${formatNumber(user.totalDeposits?.MMK||0)} | USD:$${formatNumber(user.totalDeposits?.USD||0)} | CNY:¥${formatNumber(user.totalDeposits?.CNY||0)}</span></div>
                    <div>Total Withdrawals: <span>MMK:${formatNumber(user.totalWithdrawals?.MMK||0)} | USD:$${formatNumber(user.totalWithdrawals?.USD||0)} | CNY:¥${formatNumber(user.totalWithdrawals?.CNY||0)}</span></div>
                    <div>Total Winnings: <span>MMK:${formatNumber(user.totalWinnings?.MMK||0)} | USD:$${formatNumber(user.totalWinnings?.USD||0)} | CNY:¥${formatNumber(user.totalWinnings?.CNY||0)}</span></div>
                    <div>Total Losses: <span>MMK:${formatNumber(user.totalLosses?.MMK||0)} | USD:$${formatNumber(user.totalLosses?.USD||0)} | CNY:¥${formatNumber(user.totalLosses?.CNY||0)}</span></div>
                    <div>Turnover: <span>MMK:${formatNumber(user.totalTurnover?.MMK||0)} | USD:$${formatNumber(user.totalTurnover?.USD||0)} | CNY:¥${formatNumber(user.totalTurnover?.CNY||0)}</span></div>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">GAMES</h4>
                <div class="item-details">
                    <div>Total Played: <span>${user.totalGamesPlayed || 0}</span></div>
                    <div>Won: <span style="color:#4caf50;">${user.totalGamesWon || 0}</span></div>
                    <div>Lost: <span style="color:#f44336;">${user.totalGamesLost || 0}</span></div>
                    <div>Withdraw Count Today: <span>${user.todayWithdrawCount || 0}</span></div>
                </div>
            </div>
            ${user.bannedStatus?.isBanned ? `
                <div style="padding:14px;background:rgba(244,67,54,0.05);border:1px solid rgba(244,67,54,0.1);border-radius:12px;">
                    <h4 style="color:#f44336;font-size:13px;margin-bottom:6px;">BANNED</h4>
                    <div class="item-details">
                        <div>Reason: <span>${user.bannedStatus.reason}</span></div>
                        <div>Banned At: <span>${formatDate(user.bannedStatus.bannedAt)}</span></div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('adminModal').style.display = 'flex';
}

function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
}

// Adjust balance
function openAdjustBalance(userId, username) {
    document.getElementById('adminModalTitle').textContent = `Adjust Balance: ${username}`;
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <select id="adjCurrency" class="admin-input">
                <option value="MMK">MMK</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
            </select>
            <input type="number" id="adjAmount" placeholder="Amount" class="admin-input">
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn-approve" style="flex:1;" onclick="adjustBalance('${userId}', 'add')">
                    <i class="fas fa-plus"></i> Add Balance
                </button>
                <button class="btn-reject" style="flex:1;" onclick="adjustBalance('${userId}', 'subtract')">
                    <i class="fas fa-minus"></i> Subtract Balance
                </button>
            </div>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function adjustBalance(userId, type) {
    const currency = document.getElementById('adjCurrency').value;
    const amount = parseFloat(document.getElementById('adjAmount').value);

    if (!amount || amount <= 0) {
        adminToast('Enter a valid amount', 'error');
        return;
    }

    const result = await adminApiCall('adjust-balance', 'POST', { userId, currency, amount, type });

    if (result.success) {
        adminToast(result.message, 'success');
        closeAdminModal();
        await loadUsers();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// Set VIP level
async function setUserVip(userId) {
    const level = prompt('Enter VIP level (VIP, VVIP, VVIP_KING):');
    if (!level) return;

    if (!['VIP', 'VVIP', 'VVIP_KING'].includes(level.toUpperCase())) {
        adminToast('Invalid VIP level', 'error');
        return;
    }

    const result = await adminApiCall('set-vip', 'POST', { userId, vipLevel: level.toUpperCase() });

    if (result.success) {
        adminToast(result.message, 'success');
        await loadUsers();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// Ban user
async function banUser(userId) {
    const reason = prompt('Enter ban reason:');
    if (reason === null) return;

    const result = await adminApiCall('ban-user', 'POST', { userId, reason: reason || 'Banned by admin' });

    if (result.success) {
        adminToast(result.message, 'success');
        await loadUsers();
        await loadBannedUsers();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// Unban user
async function unbanUser(userId) {
    if (!confirm('Unban this user?')) return;

    const result = await adminApiCall('unban-user', 'POST', { userId });

    if (result.success) {
        adminToast(result.message, 'success');
        await loadUsers();
        await loadBannedUsers();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// PAYMENTS MANAGEMENT
// ========================================
async function loadPayments() {
    const result = await adminApiCall('get-payments', 'GET');
    if (result && result.success) {
        adminData.payments = result.payments || { MMK: [], USD: [], CNY: [] };
        renderPaymentsAdmin();
    }
}

function switchPayTab(currency) {
    currentPayTab = currency;
    document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderPaymentsAdmin();
}

function renderPaymentsAdmin() {
    const container = document.getElementById('paymentListAdmin');
    if (!container) return;

    const methods = adminData.payments[currentPayTab] || [];

    if (methods.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No payment methods for ' + currentPayTab + '</p></div>';
        return;
    }

    container.innerHTML = methods.map(pay => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title" style="display:flex;align-items:center;gap:8px;">
                    ${pay.iconUrl ? `<img src="${pay.iconUrl}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
                    ${pay.name}
                </div>
                <span class="item-badge approved">${currentPayTab}</span>
            </div>
            <div class="item-details">
                <div>Address: <span>${pay.address || '-'}</span></div>
                <div>Note: <span>${pay.note || '-'}</span></div>
                ${pay.qrCodeUrl ? '<div>QR Code: <span>✓ Set</span></div>' : ''}
            </div>
            <div class="item-actions">
                <button class="btn-action" onclick="editPayment('${pay.id}', '${currentPayTab}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-action danger" onclick="deletePayment('${pay.id}', '${currentPayTab}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openCreatePayment() {
    document.getElementById('createPaymentForm').style.display = 'block';
    document.getElementById('paymentCurrencySelect').value = currentPayTab;
    document.getElementById('paymentName').value = '';
    document.getElementById('paymentAddress').value = '';
    document.getElementById('paymentNote').value = '';
    document.getElementById('paymentIconUrl').value = '';
    document.getElementById('paymentQrUrl').value = '';
}

function closeCreatePayment() {
    document.getElementById('createPaymentForm').style.display = 'none';
}

async function createPayment() {
    const currency = document.getElementById('paymentCurrencySelect').value;
    const name = document.getElementById('paymentName').value.trim();
    const address = document.getElementById('paymentAddress').value.trim();
    const note = document.getElementById('paymentNote').value.trim();
    const iconUrl = document.getElementById('paymentIconUrl').value.trim();
    const qrCodeUrl = document.getElementById('paymentQrUrl').value.trim();

    if (!name) {
        adminToast('Payment name is required', 'error');
        return;
    }

    const result = await adminApiCall('create-payment', 'POST', { currency, name, address, note, iconUrl, qrCodeUrl });

    if (result.success) {
        adminToast('Payment method created!', 'success');
        closeCreatePayment();
        await loadPayments();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

function editPayment(paymentId, currency) {
    const pay = adminData.payments[currency]?.find(p => p.id === paymentId);
    if (!pay) return;

    document.getElementById('adminModalTitle').textContent = 'Edit Payment';
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <input type="text" id="editPayName" value="${pay.name}" placeholder="Name" class="admin-input">
            <input type="text" id="editPayAddress" value="${pay.address || ''}" placeholder="Address" class="admin-input">
            <input type="text" id="editPayNote" value="${pay.note || ''}" placeholder="Note" class="admin-input">
            <input type="text" id="editPayIcon" value="${pay.iconUrl || ''}" placeholder="Icon URL" class="admin-input">
            <input type="text" id="editPayQr" value="${pay.qrCodeUrl || ''}" placeholder="QR Code URL" class="admin-input">
            <button class="btn-primary" onclick="savePaymentEdit('${paymentId}','${currency}')" style="margin-top:12px;">Save Changes</button>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function savePaymentEdit(paymentId, currency) {
    const updates = {
        name: document.getElementById('editPayName').value.trim(),
        address: document.getElementById('editPayAddress').value.trim(),
        note: document.getElementById('editPayNote').value.trim(),
        iconUrl: document.getElementById('editPayIcon').value.trim(),
        qrCodeUrl: document.getElementById('editPayQr').value.trim()
    };

    const result = await adminApiCall('update-payment', 'POST', { paymentId, currency, updates });

    if (result.success) {
        adminToast('Payment updated!', 'success');
        closeAdminModal();
        await loadPayments();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

async function deletePayment(paymentId, currency) {
    if (!confirm('Delete this payment method?')) return;

    const result = await adminApiCall('delete-payment', 'POST', { paymentId, currency });

    if (result.success) {
        adminToast('Payment deleted', 'success');
        await loadPayments();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// GAME VIDEOS MANAGEMENT
// ========================================
async function loadVideosAdmin() {
    const result = await adminApiCall('get-videos', 'GET');
    if (result && result.success) {
        adminData.videos = result.videos || { goal: [], nogoal: [] };
        renderVideosAdmin();
    }
}

function switchVideoTab(type) {
    currentVideoTab = type;
    document.querySelectorAll('.vid-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderVideosAdmin();
}

function renderVideosAdmin() {
    const container = document.getElementById('videoListAdmin');
    if (!container) return;

    const videos = adminData.videos[currentVideoTab] || [];

    if (videos.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-video"></i><p>No ${currentVideoTab} videos</p></div>`;
        return;
    }

    container.innerHTML = videos.map(vid => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${vid.name || 'Unnamed'}</div>
                <span class="item-badge ${currentVideoTab === 'goal' ? 'approved' : 'rejected'}">${vid.type.toUpperCase()}</span>
            </div>
            <div class="item-details">
                <div>URL: <span style="font-size:11px;word-break:break-all;">${vid.url}</span></div>
                <div>Created: <span>${formatDate(vid.createdAt)}</span></div>
            </div>
            <div class="item-actions">
                <button class="btn-action" onclick="window.open('${vid.url}','_blank')">
                    <i class="fas fa-play"></i> Preview
                </button>
                <button class="btn-action danger" onclick="deleteVideo('${vid.id}','${vid.type}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openAddVideo() {
    document.getElementById('addVideoForm').style.display = 'block';
    document.getElementById('videoTypeSelect').value = currentVideoTab;
    document.getElementById('videoName').value = '';
    document.getElementById('videoUrl').value = '';
}

function closeAddVideo() {
    document.getElementById('addVideoForm').style.display = 'none';
}

async function addVideo() {
    const type = document.getElementById('videoTypeSelect').value;
    const name = document.getElementById('videoName').value.trim();
    const url = document.getElementById('videoUrl').value.trim();

    if (!url) {
        adminToast('Video URL is required', 'error');
        return;
    }

    const result = await adminApiCall('upload-video', 'POST', { type, name, url });

    if (result.success) {
        adminToast('Video added!', 'success');
        closeAddVideo();
        await loadVideosAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

async function deleteVideo(videoId, type) {
    if (!confirm('Delete this video?')) return;

    const result = await adminApiCall('delete-video', 'POST', { videoId, type });

    if (result.success) {
        adminToast('Video deleted', 'success');
        await loadVideosAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// GAME CONTROLS MANAGEMENT
// ========================================
async function loadControlsAdmin() {
    const result = await adminApiCall('get-controls', 'GET');
    if (result && result.success) {
        adminData.controls = result.controls || { enabled: false, rules: [] };
        renderControlsAdmin();
    }
}

function renderControlsAdmin() {
    const toggle = document.getElementById('controlToggle');
    const status = document.getElementById('controlStatus');

    if (toggle) toggle.checked = adminData.controls.enabled;
    if (status) {
        status.textContent = adminData.controls.enabled ? 'ON' : 'OFF';
        status.className = `control-status ${adminData.controls.enabled ? 'on' : 'off'}`;
    }

    renderRulesAdmin();
}

async function toggleGameControl() {
    const enabled = document.getElementById('controlToggle').checked;

    const result = await adminApiCall('toggle-controls', 'POST', { enabled });

    if (result.success) {
        adminData.controls.enabled = enabled;
        const status = document.getElementById('controlStatus');
        status.textContent = enabled ? 'ON' : 'OFF';
        status.className = `control-status ${enabled ? 'on' : 'off'}`;
        adminToast(`Game control ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } else {
        adminToast(result.error || 'Failed', 'error');
        document.getElementById('controlToggle').checked = !enabled;
    }
}

function renderRulesAdmin() {
    const container = document.getElementById('rulesListAdmin');
    if (!container) return;

    const rules = adminData.controls.rules || [];

    if (rules.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-sliders"></i><p>No control rules set</p></div>';
        return;
    }

    container.innerHTML = rules.map(rule => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">
                    ${rule.type === 'exact' ? 'Exact' : 'Range'} | ${rule.currency} | ${rule.betChoice === 'any' ? 'Any Choice' : rule.betChoice.toUpperCase()}
                </div>
                <span class="item-badge ${rule.action === 'lose' ? 'rejected' : 'approved'}">
                    ${rule.action === 'lose' ? 'FORCE LOSE' : 'FORCE WIN'}
                </span>
            </div>
            <div class="item-details">
                ${rule.type === 'exact'
                    ? `<div>Amount: <span>${formatNumber(rule.betAmount)} ${rule.currency}</span></div>`
                    : `<div>Range: <span>${formatNumber(rule.minAmount)} - ${formatNumber(rule.maxAmount)} ${rule.currency}</span></div>`
                }
                <div>Status: <span>${rule.active ? 'Active' : 'Inactive'}</span></div>
            </div>
            <div class="item-actions">
                <button class="btn-action danger" onclick="deleteControlRule('${rule.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openAddRule() {
    document.getElementById('addRuleForm').style.display = 'block';
    document.getElementById('ruleType').value = 'exact';
    document.getElementById('exactAmountField').style.display = 'block';
    document.getElementById('rangeAmountFields').style.display = 'none';

    document.getElementById('ruleType').onchange = function () {
        if (this.value === 'exact') {
            document.getElementById('exactAmountField').style.display = 'block';
            document.getElementById('rangeAmountFields').style.display = 'none';
        } else {
            document.getElementById('exactAmountField').style.display = 'none';
            document.getElementById('rangeAmountFields').style.display = 'block';
        }
    };
}

function closeAddRule() {
    document.getElementById('addRuleForm').style.display = 'none';
}

async function addControlRule() {
    const type = document.getElementById('ruleType').value;
    const currency = document.getElementById('ruleCurrency').value;
    const betChoice = document.getElementById('ruleBetChoice').value;
    const action = document.getElementById('ruleAction').value;

    let rule = { type, currency, betChoice, action };

    if (type === 'exact') {
        const betAmount = parseFloat(document.getElementById('ruleExactAmount').value);
        if (!betAmount || betAmount <= 0) {
            adminToast('Enter a valid amount', 'error');
            return;
        }
        rule.betAmount = betAmount;
    } else {
        const minAmount = parseFloat(document.getElementById('ruleMinAmount').value);
        const maxAmount = parseFloat(document.getElementById('ruleMaxAmount').value);
        if (!minAmount || !maxAmount || minAmount <= 0 || maxAmount <= 0 || minAmount >= maxAmount) {
            adminToast('Enter valid min and max amounts', 'error');
            return;
        }
        rule.minAmount = minAmount;
        rule.maxAmount = maxAmount;
    }

    const result = await adminApiCall('add-control-rule', 'POST', { rule });

    if (result.success) {
        adminToast('Control rule added!', 'success');
        closeAddRule();
        await loadControlsAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

async function deleteControlRule(ruleId) {
    if (!confirm('Delete this control rule?')) return;

    const result = await adminApiCall('delete-control-rule', 'POST', { ruleId });

    if (result.success) {
        adminToast('Rule deleted', 'success');
        await loadControlsAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// CONTACTS MANAGEMENT
// ========================================
async function loadContactsAdmin() {
    const result = await adminApiCall('get-contacts', 'GET');
    if (result && result.success) {
        adminData.contacts = result.contacts || [];
        renderContactsAdmin();
    }
}

function renderContactsAdmin() {
    const container = document.getElementById('contactsListAdmin');
    if (!container) return;

    const contacts = adminData.contacts;

    if (contacts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-address-book"></i><p>No contacts</p></div>';
        return;
    }

    container.innerHTML = contacts.map(c => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title" style="display:flex;align-items:center;gap:8px;">
                    ${c.imgUrl ? `<img src="${c.imgUrl}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
                    ${c.name}
                </div>
                <span class="item-badge approved">${c.type || 'link'}</span>
            </div>
            <div class="item-details">
                ${c.link ? `<div>Link: <span style="word-break:break-all;">${c.link}</span></div>` : ''}
                ${c.address ? `<div>Address: <span>${c.address}</span></div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn-action" onclick="editContact('${c.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-action danger" onclick="deleteContact('${c.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openCreateContact() {
    document.getElementById('createContactForm').style.display = 'block';
    document.getElementById('contactName').value = '';
    document.getElementById('contactImgUrl').value = '';
    document.getElementById('contactType').value = 'link';
    document.getElementById('contactLinkOrAddress').value = '';
}

function closeCreateContact() {
    document.getElementById('createContactForm').style.display = 'none';
}

async function createContact() {
    const name = document.getElementById('contactName').value.trim();
    const imgUrl = document.getElementById('contactImgUrl').value.trim();
    const type = document.getElementById('contactType').value;
    const linkOrAddress = document.getElementById('contactLinkOrAddress').value.trim();

    if (!name) {
        adminToast('Contact name is required', 'error');
        return;
    }

    const payload = { name, imgUrl, type };
    if (type === 'link') {
        payload.link = linkOrAddress;
    } else {
        payload.address = linkOrAddress;
    }

    const result = await adminApiCall('create-contact', 'POST', payload);

    if (result.success) {
        adminToast('Contact created!', 'success');
        closeCreateContact();
        await loadContactsAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

function editContact(contactId) {
    const contact = adminData.contacts.find(c => c.id === contactId);
    if (!contact) return;

    document.getElementById('adminModalTitle').textContent = 'Edit Contact';
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <input type="text" id="editContactName" value="${contact.name}" placeholder="Name" class="admin-input">
            <input type="text" id="editContactImg" value="${contact.imgUrl || ''}" placeholder="Image URL" class="admin-input">
            <select id="editContactType" class="admin-input">
                <option value="link" ${contact.type === 'link' ? 'selected' : ''}>Link</option>
                <option value="address" ${contact.type === 'address' ? 'selected' : ''}>Address</option>
            </select>
            <input type="text" id="editContactValue" value="${contact.link || contact.address || ''}" placeholder="Link or Address" class="admin-input">
            <button class="btn-primary" onclick="saveContactEdit('${contactId}')" style="margin-top:12px;">Save Changes</button>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function saveContactEdit(contactId) {
    const type = document.getElementById('editContactType').value;
    const updates = {
        name: document.getElementById('editContactName').value.trim(),
        imgUrl: document.getElementById('editContactImg').value.trim(),
        type: type
    };

    const value = document.getElementById('editContactValue').value.trim();
    if (type === 'link') {
        updates.link = value;
        updates.address = '';
    } else {
        updates.address = value;
        updates.link = '';
    }

    const result = await adminApiCall('update-contact', 'POST', { contactId, updates });

    if (result.success) {
        adminToast('Contact updated!', 'success');
        closeAdminModal();
        await loadContactsAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

async function deleteContact(contactId) {
    if (!confirm('Delete this contact?')) return;

    const result = await adminApiCall('delete-contact', 'POST', { contactId });

    if (result.success) {
        adminToast('Contact deleted', 'success');
        await loadContactsAdmin();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// BANNED USERS
// ========================================
async function loadBannedUsers() {
    const result = await adminApiCall('get-banned-users', 'GET');
    if (result && result.success) {
        adminData.bannedUsers = result.bannedUsers || [];
        renderBannedUsers();
    }
}

function renderBannedUsers() {
    const container = document.getElementById('bannedListAdmin');
    if (!container) return;

    const banned = adminData.bannedUsers;

    if (banned.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-ban"></i><p>No banned users</p></div>';
        return;
    }

    container.innerHTML = banned.map(user => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${user.username}</div>
                <span class="item-badge rejected">BANNED</span>
            </div>
            <div class="item-details">
                <div>Phone: <span>${user.phone}</span></div>
                <div>Email: <span>${user.email}</span></div>
                <div>Reason: <span style="color:#ffc107;">${user.reason}</span></div>
                <div>Banned At: <span>${formatDate(user.bannedAt)}</span></div>
                <div>IP: <span>${user.ipAddress || '-'}</span></div>
            </div>
            <div class="item-actions">
                <button class="btn-action" style="color:#4caf50;border-color:rgba(76,175,80,0.2);" onclick="unbanUser('${user.id}')">
                    <i class="fas fa-unlock"></i> Unban User
                </button>
            </div>
        </div>
    `).join('');
}

// ========================================
// ADMIN API HELPER (override for database endpoints)
// ========================================
async function adminApiCall(action, method = 'GET', body = null) {
    const tgUserId = window.ADMIN_TG_USER_ID || '';

    // Route to correct API endpoint
    let endpoint = 'admin';

    const dbActions = ['get-users', 'get-deposits', 'get-withdrawals', 'get-payments', 'get-videos', 'get-controls', 'get-contacts', 'get-stats'];
    if (dbActions.includes(action)) {
        endpoint = 'database';
        // Map action names
        const actionMap = {
            'get-users': 'get-users',
            'get-deposits': 'get-deposits',
            'get-withdrawals': 'get-withdrawals',
            'get-payments': 'get-payments',
            'get-videos': 'get-videos',
            'get-controls': 'get-controls',
            'get-contacts': 'get-contacts',
            'get-stats': 'get-stats'
        };
        action = actionMap[action] || action;
    }

    try {
        const url = `${API_BASE}/${endpoint}?action=${action}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': tgUserId
            }
        };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(url, options);
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Admin API error:', err);
        return { success: false, error: 'Network error' };
    }
}
