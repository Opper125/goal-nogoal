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
    bannedUsers: [],
    agents: []
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

function startAdminPolling() {
    if (adminPollInterval) clearInterval(adminPollInterval);
    adminPollInterval = setInterval(async () => {
        await refreshCurrentSection();
    }, 8000);
}

async function refreshCurrentSection() {
    switch (currentAdminSection) {
        case 'dashboard': await loadStats(); break;
        case 'deposits': await loadDeposits(); break;
        case 'withdrawals': await loadWithdrawals(); break;
        case 'users': await loadUsers(); break;
        case 'agents': await loadAgents(); break;
        case 'banned': await loadBannedUsers(); break;
    }
}

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
        loadBannedUsers(),
        loadAgents()
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
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`'${section}'`)) {
            btn.classList.add('active');
        }
    });

    switch (section) {
        case 'dashboard': loadStats(); break;
        case 'deposits': loadDeposits(); break;
        case 'withdrawals': loadWithdrawals(); break;
        case 'users': loadUsers(); break;
        case 'agents': loadAgents(); break;
        case 'payments': loadPayments(); break;
        case 'game': loadVideosAdmin(); loadControlsAdmin(); break;
        case 'contacts': loadContactsAdmin(); break;
        case 'banned': loadBannedUsers(); break;
    }
}

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
                <div class="breakdown-item"><div class="breakdown-label">MMK</div><div class="breakdown-value">${formatNumber(s.deposits.today.MMK)} / ${formatNumber(s.deposits.month.MMK)} / ${formatNumber(s.deposits.year.MMK)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">USD</div><div class="breakdown-value">$${formatNumber(s.deposits.today.USD)} / $${formatNumber(s.deposits.month.USD)} / $${formatNumber(s.deposits.year.USD)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">CNY</div><div class="breakdown-value">¥${formatNumber(s.deposits.today.CNY)} / ¥${formatNumber(s.deposits.month.CNY)} / ¥${formatNumber(s.deposits.year.CNY)}</div></div>
            </div>
        </div>
        <div class="stat-card wide">
            <div class="stat-label">Withdrawals (Today / Month / Year)</div>
            <div class="stat-breakdown">
                <div class="breakdown-item"><div class="breakdown-label">MMK</div><div class="breakdown-value">${formatNumber(s.withdrawals.today.MMK)} / ${formatNumber(s.withdrawals.month.MMK)} / ${formatNumber(s.withdrawals.year.MMK)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">USD</div><div class="breakdown-value">$${formatNumber(s.withdrawals.today.USD)} / $${formatNumber(s.withdrawals.month.USD)} / $${formatNumber(s.withdrawals.year.USD)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">CNY</div><div class="breakdown-value">¥${formatNumber(s.withdrawals.today.CNY)} / ¥${formatNumber(s.withdrawals.month.CNY)} / ¥${formatNumber(s.withdrawals.year.CNY)}</div></div>
            </div>
        </div>
        <div class="stat-card wide">
            <div class="stat-label">Revenue (Profit/Loss)</div>
            <div class="stat-breakdown">
                <div class="breakdown-item"><div class="breakdown-label">MMK</div><div class="breakdown-value" style="color:${s.revenue.MMK >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.MMK >= 0 ? '+' : ''}${formatNumber(s.revenue.MMK)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">USD</div><div class="breakdown-value" style="color:${s.revenue.USD >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.USD >= 0 ? '+$' : '-$'}${formatNumber(Math.abs(s.revenue.USD))}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">CNY</div><div class="breakdown-value" style="color:${s.revenue.CNY >= 0 ? '#4caf50' : '#f44336'}">${s.revenue.CNY >= 0 ? '+¥' : '-¥'}${formatNumber(Math.abs(s.revenue.CNY))}</div></div>
            </div>
        </div>
        <div class="stat-card wide">
            <div class="stat-label">Game Win/Loss Amounts</div>
            <div class="stat-breakdown">
                <div class="breakdown-item"><div class="breakdown-label">Win</div><div class="breakdown-value" style="color:#4caf50">${formatNumber(s.games.winAmount.MMK)} / $${formatNumber(s.games.winAmount.USD)} / ¥${formatNumber(s.games.winAmount.CNY)}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">Loss</div><div class="breakdown-value" style="color:#f44336">${formatNumber(s.games.lossAmount.MMK)} / $${formatNumber(s.games.lossAmount.USD)} / ¥${formatNumber(s.games.lossAmount.CNY)}</div></div>
            </div>
        </div>
    `;
}

// ========================================
// DEPOSITS
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
    if (currentDepositFilter !== 'all') deps = deps.filter(d => d.status === currentDepositFilter);
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
                    <button class="btn-approve" onclick="approveDeposit('${dep.id}')"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn-reject" onclick="rejectDeposit('${dep.id}')"><i class="fas fa-times"></i> Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function approveDeposit(depositId) {
    if (!confirm('Approve this deposit?')) return;
    adminToast('Approving...', 'info');
    const result = await adminApiCall('approve-deposit', 'POST', { depositId });
    if (result.success) { adminToast('Deposit approved!', 'success'); await loadDeposits(); await loadStats(); }
    else adminToast(result.error || 'Failed', 'error');
}

async function rejectDeposit(depositId) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    adminToast('Rejecting...', 'info');
    const result = await adminApiCall('reject-deposit', 'POST', { depositId, reason: reason || 'Rejected' });
    if (result.success) { adminToast('Rejected', 'success'); await loadDeposits(); }
    else adminToast(result.error || 'Failed', 'error');
}

// ========================================
// WITHDRAWALS
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
    if (currentWithdrawalFilter !== 'all') wds = wds.filter(w => w.status === currentWithdrawalFilter);
    wds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (wds.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No withdrawals found</p></div>';
        return;
    }

    container.innerHTML = wds.map(wd => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${wd.username}${wd.routedToAgent ? ' <span style="font-size:10px;color:#42a5f5;">[AGENT]</span>' : ''}</div>
                <span class="item-badge ${wd.status}">${wd.status.toUpperCase()}</span>
            </div>
            <div class="item-details">
                <div>Amount: <span>${formatNumber(wd.amount)} ${wd.currency}</span></div>
                <div>Time: <span>${formatDate(wd.createdAt)}</span></div>
                ${wd.routedToAgent ? `<div>Agent: <span style="color:#42a5f5;">Routed to Agent</span></div>` : ''}
                ${wd.adminNote ? `<div>Note: <span style="color:#ffc107;">${wd.adminNote}</span></div>` : ''}
            </div>
            ${wd.status === 'pending' && !wd.routedToAgent ? `
                <div class="item-actions">
                    <button class="btn-approve" onclick="approveWithdraw('${wd.id}')"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn-reject" onclick="rejectWithdraw('${wd.id}')"><i class="fas fa-times"></i> Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function approveWithdraw(withdrawalId) {
    if (!confirm('Approve this withdrawal?')) return;
    adminToast('Approving...', 'info');
    const result = await adminApiCall('approve-withdraw', 'POST', { withdrawalId });
    if (result.success) { adminToast('Approved!', 'success'); await loadWithdrawals(); await loadStats(); }
    else adminToast(result.error || 'Failed', 'error');
}

async function rejectWithdraw(withdrawalId) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    adminToast('Rejecting...', 'info');
    const result = await adminApiCall('reject-withdraw', 'POST', { withdrawalId, reason: reason || 'Rejected' });
    if (result.success) { adminToast('Rejected & refunded', 'success'); await loadWithdrawals(); }
    else adminToast(result.error || 'Failed', 'error');
}

// ========================================
// USERS
// ========================================
async function loadUsers() {
    const result = await adminApiCall('get-users', 'GET');
    if (result && result.success) {
        adminData.users = result.users || [];
        renderUsersAdmin();
    }
}

function searchUsers() { renderUsersAdmin(); }

function renderUsersAdmin() {
    const container = document.getElementById('usersListAdmin');
    if (!container) return;

    let users = adminData.users || [];
    const searchVal = (document.getElementById('userSearchInput')?.value || '').toLowerCase();

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
                <div class="item-title">${user.username} <span style="font-size:11px;color:#555;">${user.vipLevel || 'VIP'}</span></div>
                <span class="item-badge ${user.bannedStatus?.isBanned ? 'rejected' : 'approved'}">${user.bannedStatus?.isBanned ? 'BANNED' : 'ACTIVE'}</span>
            </div>
            <div class="item-details">
                <div>Phone: <span>${user.phone}</span></div>
                <div>Email: <span>${user.email}</span></div>
                <div>Balance: <span>MMK:${formatNumber(user.balance?.MMK||0)} | $${formatNumber(user.balance?.USD||0)} | ¥${formatNumber(user.balance?.CNY||0)}</span></div>
                <div>Games: <span>${user.totalGamesPlayed||0} (W:${user.totalGamesWon||0} L:${user.totalGamesLost||0})</span></div>
            </div>
            <div class="item-actions" style="flex-wrap:wrap;">
                <button class="btn-action" onclick="openUserDetail('${user.id}')"><i class="fas fa-eye"></i> Details</button>
                <button class="btn-action" onclick="openAdjustBalance('${user.id}','${user.username}')"><i class="fas fa-coins"></i> Balance</button>
                <button class="btn-action" onclick="setUserVip('${user.id}')"><i class="fas fa-crown"></i> VIP</button>
                ${user.bannedStatus?.isBanned
                    ? `<button class="btn-action" style="color:#4caf50;border-color:rgba(76,175,80,0.2);" onclick="unbanUser('${user.id}')"><i class="fas fa-unlock"></i> Unban</button>`
                    : `<button class="btn-action danger" onclick="banUser('${user.id}')"><i class="fas fa-ban"></i> Ban</button>`
                }
            </div>
        </div>
    `).join('');
}

function openUserDetail(userId) {
    const user = adminData.users.find(u => u.id === userId);
    if (!user) return;
    document.getElementById('adminModalTitle').textContent = `User: ${user.username}`;
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">ACCOUNT INFO</h4>
            <div class="item-details">
                <div>ID: <span style="font-size:11px;">${user.id}</span></div>
                <div>Username: <span>${user.username}</span></div>
                <div>Phone: <span>${user.phone}</span></div>
                <div>Email: <span>${user.email}</span></div>
                <div>VIP: <span>${user.vipLevel||'VIP'}</span></div>
                <div>IP: <span>${user.ipAddress||'-'}</span></div>
                <div>Joined: <span>${formatDate(user.createdAt)}</span></div>
            </div>
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">BALANCES</h4>
            <div class="item-details">
                <div>MMK: <span>${formatNumber(user.balance?.MMK||0)}</span></div>
                <div>USD: <span>$${formatNumber(user.balance?.USD||0)}</span></div>
                <div>CNY: <span>¥${formatNumber(user.balance?.CNY||0)}</span></div>
            </div>
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">TOTALS</h4>
            <div class="item-details">
                <div>Deposits: <span>${formatNumber(user.totalDeposits?.MMK||0)} | $${formatNumber(user.totalDeposits?.USD||0)} | ¥${formatNumber(user.totalDeposits?.CNY||0)}</span></div>
                <div>Withdrawals: <span>${formatNumber(user.totalWithdrawals?.MMK||0)} | $${formatNumber(user.totalWithdrawals?.USD||0)} | ¥${formatNumber(user.totalWithdrawals?.CNY||0)}</span></div>
                <div>Winnings: <span>${formatNumber(user.totalWinnings?.MMK||0)} | $${formatNumber(user.totalWinnings?.USD||0)} | ¥${formatNumber(user.totalWinnings?.CNY||0)}</span></div>
                <div>Losses: <span>${formatNumber(user.totalLosses?.MMK||0)} | $${formatNumber(user.totalLosses?.USD||0)} | ¥${formatNumber(user.totalLosses?.CNY||0)}</span></div>
                <div>Turnover: <span>${formatNumber(user.totalTurnover?.MMK||0)} | $${formatNumber(user.totalTurnover?.USD||0)} | ¥${formatNumber(user.totalTurnover?.CNY||0)}</span></div>
                <div>Games: <span>Played:${user.totalGamesPlayed||0} W:${user.totalGamesWon||0} L:${user.totalGamesLost||0}</span></div>
            </div>
            ${user.depositedByAgent ? `
                <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">AGENT DEPOSITS</h4>
                <div class="item-details">
                    ${Object.entries(user.depositedByAgent).map(([c,info]) => `<div>${c}: <span>Agent: ${info.agentUsername} (${formatDate(info.lastDeposit)})</span></div>`).join('')}
                </div>
            ` : ''}
            ${user.bannedStatus?.isBanned ? `
                <div style="padding:14px;background:rgba(244,67,54,0.05);border:1px solid rgba(244,67,54,0.1);border-radius:12px;margin-top:16px;">
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

function closeAdminModal() { document.getElementById('adminModal').style.display = 'none'; }

function openAdjustBalance(userId, username) {
    document.getElementById('adminModalTitle').textContent = `Adjust Balance: ${username}`;
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <select id="adjCurrency" class="admin-input"><option value="MMK">MMK</option><option value="USD">USD</option><option value="CNY">CNY</option></select>
            <input type="number" id="adjAmount" placeholder="Amount" class="admin-input">
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn-approve" style="flex:1;" onclick="adjustBalance('${userId}','add')"><i class="fas fa-plus"></i> Add</button>
                <button class="btn-reject" style="flex:1;" onclick="adjustBalance('${userId}','subtract')"><i class="fas fa-minus"></i> Subtract</button>
            </div>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function adjustBalance(userId, type) {
    const currency = document.getElementById('adjCurrency').value;
    const amount = parseFloat(document.getElementById('adjAmount').value);
    if (!amount || amount <= 0) { adminToast('Enter valid amount', 'error'); return; }
    const result = await adminApiCall('adjust-balance', 'POST', { userId, currency, amount, type });
    if (result.success) { adminToast(result.message, 'success'); closeAdminModal(); await loadUsers(); }
    else adminToast(result.error || 'Failed', 'error');
}

async function setUserVip(userId) {
    const level = prompt('Enter VIP level (VIP, VVIP, VVIP_KING):');
    if (!level) return;
    if (!['VIP','VVIP','VVIP_KING'].includes(level.toUpperCase())) { adminToast('Invalid level', 'error'); return; }
    const result = await adminApiCall('set-vip', 'POST', { userId, vipLevel: level.toUpperCase() });
    if (result.success) { adminToast(result.message, 'success'); await loadUsers(); }
    else adminToast(result.error, 'error');
}

async function banUser(userId) {
    const reason = prompt('Ban reason:');
    if (reason === null) return;
    const result = await adminApiCall('ban-user', 'POST', { userId, reason: reason || 'Banned by admin' });
    if (result.success) { adminToast(result.message, 'success'); await loadUsers(); await loadBannedUsers(); }
    else adminToast(result.error, 'error');
}

async function unbanUser(userId) {
    if (!confirm('Unban this user?')) return;
    const result = await adminApiCall('unban-user', 'POST', { userId });
    if (result.success) { adminToast(result.message, 'success'); await loadUsers(); await loadBannedUsers(); }
    else adminToast(result.error, 'error');
}

// ========================================
// AGENTS MANAGEMENT
// ========================================
async function loadAgents() {
    const result = await apiCall('agent', 'get-agents', 'GET', null, { 'X-Telegram-User-Id': window.ADMIN_TG_USER_ID || '' });
    if (result && result.success) {
        adminData.agents = result.agents || [];
        renderAgentsAdmin();
    }
}

function renderAgentsAdmin() {
    const container = document.getElementById('agentsListAdmin');
    if (!container) return;

    const agents = adminData.agents || [];

    if (agents.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-user-tie"></i><p>No agents created yet</p></div>';
        return;
    }

    container.innerHTML = agents.map(agent => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">
                    <i class="fas fa-user-tie" style="color:#42a5f5;margin-right:6px;"></i>${agent.username}
                </div>
                <span class="item-badge ${agent.banned ? 'rejected' : 'approved'}">${agent.banned ? 'BANNED' : 'ACTIVE'}</span>
            </div>
            <div class="item-details">
                <div>Telegram ID: <span>${agent.telegramUserId}</span></div>
                <div>Balance: <span>MMK: ${formatNumber(agent.balance?.MMK||0)} | USD: $${formatNumber(agent.balance?.USD||0)} | CNY: ¥${formatNumber(agent.balance?.CNY||0)}</span></div>
                <div>Total Deposited: <span>MMK: ${formatNumber(agent.totalDeposited?.MMK||0)} | $${formatNumber(agent.totalDeposited?.USD||0)} | ¥${formatNumber(agent.totalDeposited?.CNY||0)}</span></div>
                <div>Users Served: <span>${(agent.depositedUsers||[]).length}</span></div>
                <div>Created: <span>${formatDate(agent.createdAt)}</span></div>
                ${agent.lastLogin ? `<div>Last Login: <span>${formatDate(agent.lastLogin)}</span></div>` : ''}
            </div>
            <div class="item-actions" style="flex-wrap:wrap;">
                <button class="btn-action" onclick="openAgentBalanceAdjust('${agent.id}','${agent.username}')">
                    <i class="fas fa-coins"></i> Balance
                </button>
                <button class="btn-action" onclick="viewAgentDetail('${agent.id}')">
                    <i class="fas fa-eye"></i> Details
                </button>
                <button class="btn-action" onclick="editAgentInfo('${agent.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-action danger" onclick="deleteAgent('${agent.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openCreateAgent() {
    document.getElementById('createAgentForm').style.display = 'block';
    document.getElementById('agentTelegramId').value = '';
    document.getElementById('agentUsernameInput').value = '';
    document.getElementById('agentPasswordInput').value = '';
}

function closeCreateAgent() {
    document.getElementById('createAgentForm').style.display = 'none';
}

async function createAgent() {
    const telegramUserId = document.getElementById('agentTelegramId').value.trim();
    const username = document.getElementById('agentUsernameInput').value.trim();
    const password = document.getElementById('agentPasswordInput').value.trim();

    if (!telegramUserId || !username || !password) {
        adminToast('All fields are required', 'error');
        return;
    }

    adminToast('Creating agent...', 'info');

    const result = await apiCall('agent', 'create-agent', 'POST',
        { telegramUserId, username, password },
        { 'X-Telegram-User-Id': window.ADMIN_TG_USER_ID || '' }
    );

    if (result && result.success) {
        adminToast('Agent created!', 'success');
        closeCreateAgent();
        await loadAgents();
    } else {
        adminToast(result.error || 'Failed to create agent', 'error');
    }
}

function openAgentBalanceAdjust(agentId, agentUsername) {
    document.getElementById('adminModalTitle').textContent = `Agent Balance: ${agentUsername}`;

    const agent = adminData.agents.find(a => a.id === agentId);
    const balInfo = agent ? `MMK: ${formatNumber(agent.balance?.MMK||0)} | USD: $${formatNumber(agent.balance?.USD||0)} | CNY: ¥${formatNumber(agent.balance?.CNY||0)}` : '';

    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <p style="color:#888;font-size:13px;margin-bottom:14px;">Current: ${balInfo}</p>
            <select id="agentAdjCurrency" class="admin-input">
                <option value="MMK">MMK</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
            </select>
            <input type="number" id="agentAdjAmount" placeholder="Amount" class="admin-input">
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn-approve" style="flex:1;" onclick="adjustAgentBalance('${agentId}','add')">
                    <i class="fas fa-plus"></i> Add Balance
                </button>
                <button class="btn-reject" style="flex:1;" onclick="adjustAgentBalance('${agentId}','subtract')">
                    <i class="fas fa-minus"></i> Subtract
                </button>
            </div>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function adjustAgentBalance(agentId, type) {
    const currency = document.getElementById('agentAdjCurrency').value;
    const amount = parseFloat(document.getElementById('agentAdjAmount').value);
    if (!amount || amount <= 0) { adminToast('Enter valid amount', 'error'); return; }

    const result = await apiCall('agent', 'adjust-agent-balance', 'POST',
        { agentId, currency, amount, type },
        { 'X-Telegram-User-Id': window.ADMIN_TG_USER_ID || '' }
    );

    if (result && result.success) {
        adminToast(result.message, 'success');
        closeAdminModal();
        await loadAgents();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

function viewAgentDetail(agentId) {
    const agent = adminData.agents.find(a => a.id === agentId);
    if (!agent) return;

    document.getElementById('adminModalTitle').textContent = `Agent: ${agent.username}`;

    let historyHtml = '<p style="color:#555;font-size:13px;">No history</p>';
    if (agent.transactionHistory && agent.transactionHistory.length > 0) {
        historyHtml = agent.transactionHistory.slice(0, 20).map(h => {
            const color = h.type.includes('deposit') ? '#4caf50' : h.type.includes('withdraw') || h.type.includes('approved') ? '#42a5f5' : '#888';
            return `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px;">
                <span style="color:${color};">${h.note || h.type}</span>
                <span style="float:right;color:#555;font-size:11px;">${formatDate(h.timestamp)}</span>
            </div>`;
        }).join('');
    }

    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin-bottom:10px;">INFO</h4>
            <div class="item-details">
                <div>ID: <span style="font-size:11px;">${agent.id}</span></div>
                <div>Username: <span>${agent.username}</span></div>
                <div>Telegram ID: <span>${agent.telegramUserId}</span></div>
                <div>Created: <span>${formatDate(agent.createdAt)}</span></div>
                <div>Last Login: <span>${formatDate(agent.lastLogin)}</span></div>
            </div>
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">BALANCE</h4>
            <div class="item-details">
                <div>MMK: <span>${formatNumber(agent.balance?.MMK||0)}</span></div>
                <div>USD: <span>$${formatNumber(agent.balance?.USD||0)}</span></div>
                <div>CNY: <span>¥${formatNumber(agent.balance?.CNY||0)}</span></div>
            </div>
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">TOTALS</h4>
            <div class="item-details">
                <div>Deposited to Users: <span>MMK:${formatNumber(agent.totalDeposited?.MMK||0)} | $${formatNumber(agent.totalDeposited?.USD||0)} | ¥${formatNumber(agent.totalDeposited?.CNY||0)}</span></div>
                <div>WD Handled: <span>MMK:${formatNumber(agent.totalWithdrawalsHandled?.MMK||0)} | $${formatNumber(agent.totalWithdrawalsHandled?.USD||0)} | ¥${formatNumber(agent.totalWithdrawalsHandled?.CNY||0)}</span></div>
                <div>Users Served: <span>${(agent.depositedUsers||[]).length}</span></div>
            </div>
            <h4 style="font-family:'Orbitron',sans-serif;font-size:12px;color:#666;letter-spacing:1px;margin:16px 0 10px;">RECENT HISTORY</h4>
            ${historyHtml}
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

function editAgentInfo(agentId) {
    const agent = adminData.agents.find(a => a.id === agentId);
    if (!agent) return;

    document.getElementById('adminModalTitle').textContent = `Edit Agent: ${agent.username}`;
    document.getElementById('adminModalBody').innerHTML = `
        <div style="padding:10px 0;">
            <input type="text" id="editAgentUsername" value="${agent.username}" placeholder="Username" class="admin-input">
            <input type="text" id="editAgentPassword" value="" placeholder="New Password (leave empty to keep)" class="admin-input">
            <div style="display:flex;gap:10px;margin-top:12px;">
                <label style="display:flex;align-items:center;gap:6px;color:#ccc;font-size:13px;">
                    <input type="checkbox" id="editAgentBanned" ${agent.banned ? 'checked' : ''}> Banned
                </label>
            </div>
            <button class="btn-primary" onclick="saveAgentEdit('${agentId}')" style="margin-top:16px;">Save Changes</button>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
}

async function saveAgentEdit(agentId) {
    const updates = {};
    const username = document.getElementById('editAgentUsername').value.trim();
    const password = document.getElementById('editAgentPassword').value.trim();
    const banned = document.getElementById('editAgentBanned').checked;

    if (username) updates.username = username;
    if (password) updates.password = password;
    updates.banned = banned;

    const result = await apiCall('agent', 'update-agent', 'POST',
        { agentId, updates },
        { 'X-Telegram-User-Id': window.ADMIN_TG_USER_ID || '' }
    );

    if (result && result.success) {
        adminToast('Agent updated!', 'success');
        closeAdminModal();
        await loadAgents();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

async function deleteAgent(agentId) {
    if (!confirm('Delete this agent permanently?')) return;

    const result = await apiCall('agent', 'delete-agent', 'POST',
        { agentId },
        { 'X-Telegram-User-Id': window.ADMIN_TG_USER_ID || '' }
    );

    if (result && result.success) {
        adminToast('Agent deleted', 'success');
        await loadAgents();
    } else {
        adminToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// PAYMENTS
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
        container.innerHTML = `<div class="empty-state"><i class="fas fa-credit-card"></i><p>No payments for ${currentPayTab}</p></div>`;
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
                <div>Address: <span>${pay.address||'-'}</span></div>
                <div>Note: <span>${pay.note||'-'}</span></div>
            </div>
            <div class="item-actions">
                <button class="btn-action" onclick="editPayment('${pay.id}','${currentPayTab}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-action danger" onclick="deletePayment('${pay.id}','${currentPayTab}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function openCreatePayment() { document.getElementById('createPaymentForm').style.display = 'block'; document.getElementById('paymentCurrencySelect').value = currentPayTab; }
function closeCreatePayment() { document.getElementById('createPaymentForm').style.display = 'none'; }

async function createPayment() {
    const d = { currency: document.getElementById('paymentCurrencySelect').value, name: document.getElementById('paymentName').value.trim(), address: document.getElementById('paymentAddress').value.trim(), note: document.getElementById('paymentNote').value.trim(), iconUrl: document.getElementById('paymentIconUrl').value.trim(), qrCodeUrl: document.getElementById('paymentQrUrl').value.trim() };
    if (!d.name) { adminToast('Name required', 'error'); return; }
    const r = await adminApiCall('create-payment', 'POST', d);
    if (r.success) { adminToast('Created!', 'success'); closeCreatePayment(); await loadPayments(); } else adminToast(r.error, 'error');
}

function editPayment(paymentId, currency) {
    const pay = adminData.payments[currency]?.find(p => p.id === paymentId);
    if (!pay) return;
    document.getElementById('adminModalTitle').textContent = 'Edit Payment';
    document.getElementById('adminModalBody').innerHTML = `<div style="padding:10px 0;">
        <input type="text" id="editPayName" value="${pay.name}" placeholder="Name" class="admin-input">
        <input type="text" id="editPayAddress" value="${pay.address||''}" placeholder="Address" class="admin-input">
        <input type="text" id="editPayNote" value="${pay.note||''}" placeholder="Note" class="admin-input">
        <input type="text" id="editPayIcon" value="${pay.iconUrl||''}" placeholder="Icon URL" class="admin-input">
        <input type="text" id="editPayQr" value="${pay.qrCodeUrl||''}" placeholder="QR URL" class="admin-input">
        <button class="btn-primary" onclick="savePaymentEdit('${paymentId}','${currency}')" style="margin-top:12px;">Save</button>
    </div>`;
    document.getElementById('adminModal').style.display = 'flex';
}

async function savePaymentEdit(paymentId, currency) {
    const updates = { name: document.getElementById('editPayName').value.trim(), address: document.getElementById('editPayAddress').value.trim(), note: document.getElementById('editPayNote').value.trim(), iconUrl: document.getElementById('editPayIcon').value.trim(), qrCodeUrl: document.getElementById('editPayQr').value.trim() };
    const r = await adminApiCall('update-payment', 'POST', { paymentId, currency, updates });
    if (r.success) { adminToast('Updated!', 'success'); closeAdminModal(); await loadPayments(); } else adminToast(r.error, 'error');
}

async function deletePayment(paymentId, currency) {
    if (!confirm('Delete?')) return;
    const r = await adminApiCall('delete-payment', 'POST', { paymentId, currency });
    if (r.success) { adminToast('Deleted', 'success'); await loadPayments(); } else adminToast(r.error, 'error');
}

// ========================================
// GAME VIDEOS
// ========================================
async function loadVideosAdmin() {
    const r = await adminApiCall('get-videos', 'GET');
    if (r && r.success) { adminData.videos = r.videos || { goal: [], nogoal: [] }; renderVideosAdmin(); }
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
    if (videos.length === 0) { container.innerHTML = `<div class="empty-state"><i class="fas fa-video"></i><p>No ${currentVideoTab} videos</p></div>`; return; }
    container.innerHTML = videos.map(vid => `
        <div class="admin-list-item">
            <div class="item-header"><div class="item-title">${vid.name||'Unnamed'}</div><span class="item-badge ${currentVideoTab==='goal'?'approved':'rejected'}">${vid.type.toUpperCase()}</span></div>
            <div class="item-details"><div>URL: <span style="font-size:11px;word-break:break-all;">${vid.url}</span></div></div>
            <div class="item-actions">
                <button class="btn-action" onclick="window.open('${vid.url}','_blank')"><i class="fas fa-play"></i> Preview</button>
                <button class="btn-action danger" onclick="deleteVideo('${vid.id}','${vid.type}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function openAddVideo() { document.getElementById('addVideoForm').style.display = 'block'; document.getElementById('videoTypeSelect').value = currentVideoTab; }
function closeAddVideo() { document.getElementById('addVideoForm').style.display = 'none'; }

async function addVideo() {
    const type = document.getElementById('videoTypeSelect').value, name = document.getElementById('videoName').value.trim(), url = document.getElementById('videoUrl').value.trim();
    if (!url) { adminToast('URL required', 'error'); return; }
    const r = await adminApiCall('upload-video', 'POST', { type, name, url });
    if (r.success) { adminToast('Added!', 'success'); closeAddVideo(); await loadVideosAdmin(); } else adminToast(r.error, 'error');
}

async function deleteVideo(videoId, type) {
    if (!confirm('Delete?')) return;
    const r = await adminApiCall('delete-video', 'POST', { videoId, type });
    if (r.success) { adminToast('Deleted', 'success'); await loadVideosAdmin(); } else adminToast(r.error, 'error');
}

// ========================================
// GAME CONTROLS
// ========================================
async function loadControlsAdmin() {
    const r = await adminApiCall('get-controls', 'GET');
    if (r && r.success) { adminData.controls = r.controls || { enabled: false, rules: [] }; renderControlsAdmin(); }
}

function renderControlsAdmin() {
    const toggle = document.getElementById('controlToggle');
    const status = document.getElementById('controlStatus');
    if (toggle) toggle.checked = adminData.controls.enabled;
    if (status) { status.textContent = adminData.controls.enabled ? 'ON' : 'OFF'; status.className = `control-status ${adminData.controls.enabled ? 'on' : 'off'}`; }
    renderRulesAdmin();
}

async function toggleGameControl() {
    const enabled = document.getElementById('controlToggle').checked;
    const r = await adminApiCall('toggle-controls', 'POST', { enabled });
    if (r.success) {
        adminData.controls.enabled = enabled;
        const s = document.getElementById('controlStatus');
        s.textContent = enabled ? 'ON' : 'OFF'; s.className = `control-status ${enabled ? 'on' : 'off'}`;
        adminToast(`Controls ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } else { adminToast(r.error, 'error'); document.getElementById('controlToggle').checked = !enabled; }
}

function renderRulesAdmin() {
    const container = document.getElementById('rulesListAdmin');
    if (!container) return;
    const rules = adminData.controls.rules || [];
    if (rules.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-sliders"></i><p>No rules</p></div>'; return; }
    container.innerHTML = rules.map(rule => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title">${rule.type==='exact'?'Exact':'Range'} | ${rule.currency} | ${rule.betChoice==='any'?'Any':rule.betChoice.toUpperCase()}</div>
                <span class="item-badge ${rule.action==='lose'?'rejected':'approved'}">${rule.action==='lose'?'FORCE LOSE':'FORCE WIN'}</span>
            </div>
            <div class="item-details">
                ${rule.type==='exact'?`<div>Amount: <span>${formatNumber(rule.betAmount)} ${rule.currency}</span></div>`:`<div>Range: <span>${formatNumber(rule.minAmount)} - ${formatNumber(rule.maxAmount)} ${rule.currency}</span></div>`}
            </div>
            <div class="item-actions"><button class="btn-action danger" onclick="deleteControlRule('${rule.id}')"><i class="fas fa-trash"></i> Delete</button></div>
        </div>
    `).join('');
}

function openAddRule() {
    document.getElementById('addRuleForm').style.display = 'block';
    document.getElementById('ruleType').value = 'exact';
    document.getElementById('exactAmountField').style.display = 'block';
    document.getElementById('rangeAmountFields').style.display = 'none';
    document.getElementById('ruleType').onchange = function() {
        if (this.value === 'exact') { document.getElementById('exactAmountField').style.display = 'block'; document.getElementById('rangeAmountFields').style.display = 'none'; }
        else { document.getElementById('exactAmountField').style.display = 'none'; document.getElementById('rangeAmountFields').style.display = 'block'; }
    };
}
function closeAddRule() { document.getElementById('addRuleForm').style.display = 'none'; }

async function addControlRule() {
    const type = document.getElementById('ruleType').value, currency = document.getElementById('ruleCurrency').value, betChoice = document.getElementById('ruleBetChoice').value, action = document.getElementById('ruleAction').value;
    let rule = { type, currency, betChoice, action };
    if (type === 'exact') {
        const amt = parseFloat(document.getElementById('ruleExactAmount').value);
        if (!amt || amt <= 0) { adminToast('Enter valid amount', 'error'); return; }
        rule.betAmount = amt;
    } else {
        const min = parseFloat(document.getElementById('ruleMinAmount').value), max = parseFloat(document.getElementById('ruleMaxAmount').value);
        if (!min || !max || min >= max) { adminToast('Enter valid range', 'error'); return; }
        rule.minAmount = min; rule.maxAmount = max;
    }
    const r = await adminApiCall('add-control-rule', 'POST', { rule });
    if (r.success) { adminToast('Rule added!', 'success'); closeAddRule(); await loadControlsAdmin(); } else adminToast(r.error, 'error');
}

async function deleteControlRule(ruleId) {
    if (!confirm('Delete?')) return;
    const r = await adminApiCall('delete-control-rule', 'POST', { ruleId });
    if (r.success) { adminToast('Deleted', 'success'); await loadControlsAdmin(); } else adminToast(r.error, 'error');
}

// ========================================
// CONTACTS
// ========================================
async function loadContactsAdmin() {
    const r = await adminApiCall('get-contacts', 'GET');
    if (r && r.success) { adminData.contacts = r.contacts || []; renderContactsAdmin(); }
}

function renderContactsAdmin() {
    const container = document.getElementById('contactsListAdmin');
    if (!container) return;
    if (adminData.contacts.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-address-book"></i><p>No contacts</p></div>'; return; }
    container.innerHTML = adminData.contacts.map(c => `
        <div class="admin-list-item">
            <div class="item-header">
                <div class="item-title" style="display:flex;align-items:center;gap:8px;">
                    ${c.imgUrl ? `<img src="${c.imgUrl}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
                    ${c.name}
                </div>
                <span class="item-badge approved">${c.type||'link'}</span>
            </div>
            <div class="item-details">
                ${c.link ? `<div>Link: <span style="word-break:break-all;">${c.link}</span></div>` : ''}
                ${c.address ? `<div>Address: <span>${c.address}</span></div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn-action" onclick="editContact('${c.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-action danger" onclick="deleteContact('${c.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function openCreateContact() { document.getElementById('createContactForm').style.display = 'block'; }
function closeCreateContact() { document.getElementById('createContactForm').style.display = 'none'; }

async function createContact() {
    const name = document.getElementById('contactName').value.trim(), imgUrl = document.getElementById('contactImgUrl').value.trim(), type = document.getElementById('contactType').value, val = document.getElementById('contactLinkOrAddress').value.trim();
    if (!name) { adminToast('Name required', 'error'); return; }
    const payload = { name, imgUrl, type };
    if (type === 'link') payload.link = val; else payload.address = val;
    const r = await adminApiCall('create-contact', 'POST', payload);
    if (r.success) { adminToast('Created!', 'success'); closeCreateContact(); await loadContactsAdmin(); } else adminToast(r.error, 'error');
}

function editContact(contactId) {
    const c = adminData.contacts.find(x => x.id === contactId);
    if (!c) return;
    document.getElementById('adminModalTitle').textContent = 'Edit Contact';
    document.getElementById('adminModalBody').innerHTML = `<div style="padding:10px 0;">
        <input type="text" id="editContactName" value="${c.name}" placeholder="Name" class="admin-input">
        <input type="text" id="editContactImg" value="${c.imgUrl||''}" placeholder="Image URL" class="admin-input">
        <select id="editContactType" class="admin-input"><option value="link" ${c.type==='link'?'selected':''}>Link</option><option value="address" ${c.type==='address'?'selected':''}>Address</option></select>
        <input type="text" id="editContactValue" value="${c.link||c.address||''}" placeholder="Link or Address" class="admin-input">
        <button class="btn-primary" onclick="saveContactEdit('${contactId}')" style="margin-top:12px;">Save</button>
    </div>`;
    document.getElementById('adminModal').style.display = 'flex';
}

async function saveContactEdit(contactId) {
    const type = document.getElementById('editContactType').value;
    const updates = { name: document.getElementById('editContactName').value.trim(), imgUrl: document.getElementById('editContactImg').value.trim(), type };
    const val = document.getElementById('editContactValue').value.trim();
    if (type === 'link') { updates.link = val; updates.address = ''; } else { updates.address = val; updates.link = ''; }
    const r = await adminApiCall('update-contact', 'POST', { contactId, updates });
    if (r.success) { adminToast('Updated!', 'success'); closeAdminModal(); await loadContactsAdmin(); } else adminToast(r.error, 'error');
}

async function deleteContact(contactId) {
    if (!confirm('Delete?')) return;
    const r = await adminApiCall('delete-contact', 'POST', { contactId });
    if (r.success) { adminToast('Deleted', 'success'); await loadContactsAdmin(); } else adminToast(r.error, 'error');
}

// ========================================
// BANNED USERS
// ========================================
async function loadBannedUsers() {
    const r = await adminApiCall('get-banned-users', 'GET');
    if (r && r.success) { adminData.bannedUsers = r.bannedUsers || []; renderBannedUsers(); }
}

function renderBannedUsers() {
    const container = document.getElementById('bannedListAdmin');
    if (!container) return;
    if (adminData.bannedUsers.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-ban"></i><p>No banned users</p></div>'; return; }
    container.innerHTML = adminData.bannedUsers.map(u => `
        <div class="admin-list-item">
            <div class="item-header"><div class="item-title">${u.username}</div><span class="item-badge rejected">BANNED</span></div>
            <div class="item-details">
                <div>Phone: <span>${u.phone}</span></div>
                <div>Reason: <span style="color:#ffc107;">${u.reason}</span></div>
                <div>Banned: <span>${formatDate(u.bannedAt)}</span></div>
            </div>
            <div class="item-actions">
                <button class="btn-action" style="color:#4caf50;border-color:rgba(76,175,80,0.2);" onclick="unbanUser('${u.id}')"><i class="fas fa-unlock"></i> Unban</button>
            </div>
        </div>
    `).join('');
}

// ========================================
// ADMIN API HELPER
// ========================================
async function adminApiCall(action, method = 'GET', body = null) {
    const tgUserId = window.ADMIN_TG_USER_ID || '';
    let endpoint = 'admin';

    const dbActions = ['get-users', 'get-deposits', 'get-withdrawals', 'get-payments', 'get-videos', 'get-controls', 'get-contacts', 'get-stats'];
    if (dbActions.includes(action)) endpoint = 'database';

    try {
        const url = `${API_BASE}/${endpoint}?action=${action}`;
        const options = { method, headers: { 'Content-Type': 'application/json', 'X-Telegram-User-Id': tgUserId } };
        if (body && method !== 'GET') options.body = JSON.stringify(body);
        const res = await fetch(url, options);
        return await res.json();
    } catch (err) {
        console.error('Admin API error:', err);
        return { success: false, error: 'Network error' };
    }
}
