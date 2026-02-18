/* ===== AGENT PANEL ===== */

let agentData = null;
let agentUsers = [];
let agentWithdrawals = [];
let agentCurrentSection = 'users';
let agentWdFilter = 'pending';
let agentPollInterval = null;

// Initialize agent panel
async function initAgentPanel(telegramUserId, fake404, agentPanel, tg, userData) {
    // Verify agent with server
    var result = await apiGet('agent', 'verify-agent', { telegramUserId: telegramUserId });

    if (!result || !result.success || !result.verified) {
        fake404.style.display = 'flex';
        agentPanel.style.display = 'none';
        return;
    }

    // Agent verified
    agentData = result.agent;

    fake404.style.display = 'none';
    agentPanel.style.display = 'block';

    try {
        tg.expand();
        tg.ready();
    } catch(e) {}

    // Set username
    var usernameEl = document.getElementById('agentUsername');
    if (usernameEl) usernameEl.textContent = agentData.username;

    // Update balance display
    updateAgentBalanceDisplay();

    // Load initial data
    await loadAgentUsers();
    await loadAgentWithdrawals();

    // Start polling
    startAgentPolling();
}

// Agent polling
function startAgentPolling() {
    if (agentPollInterval) clearInterval(agentPollInterval);
    agentPollInterval = setInterval(async function() {
        await refreshAgentData();
    }, 8000);
}

async function refreshAgentData() {
    var tgId = window.AGENT_TG_USER_ID;
    if (!tgId || !agentData) return;

    var result = await apiGet('agent', 'get-agent', { telegramUserId: tgId });
    if (result && result.success && result.agent) {
        var oldBal = agentData.balance;
        agentData = result.agent;
        updateAgentBalanceDisplay();

        // Check for balance changes
        ['MMK', 'USD', 'CNY'].forEach(function(c) {
            if ((agentData.balance[c] || 0) !== (oldBal[c] || 0)) {
                agentToast('Balance updated: ' + formatNumber(agentData.balance[c]) + ' ' + c, 'info');
            }
        });
    }

    // Refresh current section
    if (agentCurrentSection === 'withdrawals') {
        await loadAgentWithdrawals();
    }
}

// Update balance display
function updateAgentBalanceDisplay() {
    if (!agentData) return;
    var mmk = document.getElementById('agentBalMMK');
    var usd = document.getElementById('agentBalUSD');
    var cny = document.getElementById('agentBalCNY');

    if (mmk) mmk.textContent = formatNumber(agentData.balance.MMK || 0);
    if (usd) usd.textContent = '$' + formatNumber(agentData.balance.USD || 0);
    if (cny) cny.textContent = '¥' + formatNumber(agentData.balance.CNY || 0);
}

// Show agent section
function showAgentSection(section) {
    agentCurrentSection = section;

    document.querySelectorAll('#agentPanel .admin-section').forEach(function(s) {
        s.style.display = 'none';
    });
    document.querySelectorAll('#agentPanel .admin-nav-btn').forEach(function(b) {
        b.classList.remove('active');
    });

    var el = document.getElementById('agent-section-' + section);
    if (el) el.style.display = 'block';

    var btns = document.querySelectorAll('#agentPanel .admin-nav-btn');
    btns.forEach(function(btn) {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(section)) {
            btn.classList.add('active');
        }
    });

    if (section === 'users') loadAgentUsers();
    if (section === 'withdrawals') loadAgentWithdrawals();
    if (section === 'history') loadAgentHistory();
}

// Agent toast
function agentToast(message, type) {
    var container = document.getElementById('agentToast');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.innerHTML = message;
    toast.style.animationDuration = '0.4s, 0.4s';
    toast.style.animationDelay = '0s, 3s';
    container.appendChild(toast);

    setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
}

// Close agent modal
function closeAgentModal() {
    document.getElementById('agentModal').style.display = 'none';
}

// ========================================
// USERS - DEPOSIT
// ========================================
async function loadAgentUsers() {
    var container = document.getElementById('agentUsersList');
    if (!container) return;

    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading users...</p></div>';

    var result = await apiGet('agent', 'get-users-for-agent');
    if (!result || !result.success) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Failed to load users</p></div>';
        return;
    }

    agentUsers = result.users || [];
    renderAgentUsers();
}

function agentSearchUsers() {
    renderAgentUsers();
}

function renderAgentUsers() {
    var container = document.getElementById('agentUsersList');
    if (!container) return;

    var searchVal = (document.getElementById('agentUserSearch') || {}).value || '';
    searchVal = searchVal.toLowerCase().trim();

    var users = agentUsers;
    if (searchVal) {
        users = users.filter(function(u) {
            return u.username.toLowerCase().includes(searchVal) ||
                   u.phone.includes(searchVal) ||
                   u.email.toLowerCase().includes(searchVal);
        });
    }

    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No users found</p></div>';
        return;
    }

    var html = '';
    users.forEach(function(user) {
        html += '<div class="admin-list-item">' +
            '<div class="item-header">' +
                '<div class="item-title">' + user.username + '</div>' +
                '<span class="item-badge approved">' + (user.vipLevel || 'VIP') + '</span>' +
            '</div>' +
            '<div class="item-details">' +
                '<div>Phone: <span>' + user.phone + '</span></div>' +
                '<div>Balance: <span>MMK: ' + formatNumber(user.balance.MMK || 0) +
                    ' | USD: $' + formatNumber(user.balance.USD || 0) +
                    ' | CNY: ¥' + formatNumber(user.balance.CNY || 0) + '</span></div>' +
            '</div>' +
            '<div class="item-actions">' +
                '<button class="btn-approve" onclick="openAgentDeposit(\'' + user.id + '\', \'' + user.username + '\')">' +
                    '<i class="fas fa-coins"></i> Deposit' +
                '</button>' +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;
}

// Open deposit form for user
function openAgentDeposit(userId, username) {
    document.getElementById('agentModalTitle').textContent = 'Deposit to: ' + username;
    document.getElementById('agentModalBody').innerHTML =
        '<div class="deposit-to-user-form">' +
            '<h4>DEPOSIT TO USER</h4>' +
            '<p style="color:#888;font-size:13px;margin-bottom:14px;">Your balances: MMK: ' + formatNumber(agentData.balance.MMK || 0) +
                ' | USD: $' + formatNumber(agentData.balance.USD || 0) +
                ' | CNY: ¥' + formatNumber(agentData.balance.CNY || 0) + '</p>' +
            '<select id="agentDepCurrency" class="admin-input">' +
                '<option value="MMK">MMK</option>' +
                '<option value="USD">USD</option>' +
                '<option value="CNY">CNY</option>' +
            '</select>' +
            '<input type="number" id="agentDepAmount" placeholder="Amount to deposit" class="admin-input">' +
            '<div style="display:flex;gap:10px;margin-top:14px;">' +
                '<button class="btn-approve" style="flex:1;" onclick="submitAgentDeposit(\'' + userId + '\')">' +
                    '<i class="fas fa-paper-plane"></i> Submit Deposit' +
                '</button>' +
                '<button class="btn-reject" style="flex:1;" onclick="closeAgentModal()">' +
                    'Cancel' +
                '</button>' +
            '</div>' +
        '</div>';

    document.getElementById('agentModal').style.display = 'flex';
}

// Submit agent deposit to user
async function submitAgentDeposit(userId) {
    var currency = document.getElementById('agentDepCurrency').value;
    var amount = parseFloat(document.getElementById('agentDepAmount').value);

    if (!amount || amount <= 0) {
        agentToast('Enter a valid amount', 'error');
        return;
    }

    if ((agentData.balance[currency] || 0) < amount) {
        agentToast('Insufficient ' + currency + ' balance! You have ' + formatNumber(agentData.balance[currency] || 0), 'error');
        return;
    }

    agentToast('Processing deposit...', 'info');

    var result = await apiCall('agent', 'agent-deposit-to-user', 'POST', {
        agentTelegramId: window.AGENT_TG_USER_ID,
        userId: userId,
        currency: currency,
        amount: amount
    });

    if (result && result.success) {
        agentToast(result.message, 'success');
        closeAgentModal();

        // Update local agent balance
        if (result.agentBalance) {
            agentData.balance = result.agentBalance;
            updateAgentBalanceDisplay();
        }

        // Refresh users list
        await loadAgentUsers();
    } else {
        agentToast(result.error || 'Failed to deposit', 'error');
    }
}

// ========================================
// WITHDRAWALS
// ========================================
async function loadAgentWithdrawals() {
    var container = document.getElementById('agentWdList');
    if (!container) return;

    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading withdrawals...</p></div>';

    var result = await apiGet('agent', 'get-agent-withdrawals', {
        telegramUserId: window.AGENT_TG_USER_ID
    });

    if (!result || !result.success) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Failed to load</p></div>';
        return;
    }

    agentWithdrawals = result.withdrawals || [];
    renderAgentWithdrawals();
}

function agentFilterWd(filter) {
    agentWdFilter = filter;
    document.querySelectorAll('#agent-section-withdrawals .filter-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    event.target.classList.add('active');
    renderAgentWithdrawals();
}

function renderAgentWithdrawals() {
    var container = document.getElementById('agentWdList');
    if (!container) return;

    var wds = agentWithdrawals;
    if (agentWdFilter !== 'all') {
        wds = wds.filter(function(w) { return w.status === agentWdFilter; });
    }

    wds.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    if (wds.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No ' + agentWdFilter + ' withdrawals</p></div>';
        return;
    }

    var html = '';
    wds.forEach(function(wd) {
        html += '<div class="wd-request-item">' +
            '<div class="wd-user">' + wd.username + '</div>' +
            '<div class="wd-info">' +
                '<div>Amount: <span style="font-family:Orbitron,sans-serif;font-weight:700;color:#ffc107;">' + formatNumber(wd.amount) + ' ' + wd.currency + '</span></div>' +
                '<div>Time: <span>' + formatDate(wd.createdAt) + '</span></div>' +
                '<div>Status: <span class="hist-status ' + wd.status + '">' + wd.status.toUpperCase() + '</span></div>' +
                (wd.adminNote ? '<div>Note: <span style="color:#ffc107;">' + wd.adminNote + '</span></div>' : '') +
            '</div>';

        if (wd.status === 'pending') {
            html += '<div class="wd-actions">' +
                '<button class="btn-approve" onclick="agentApproveWd(\'' + wd.id + '\')">' +
                    '<i class="fas fa-check"></i> Approve' +
                '</button>' +
                '<button class="btn-reject" onclick="agentRejectWd(\'' + wd.id + '\')">' +
                    '<i class="fas fa-times"></i> Reject' +
                '</button>' +
            '</div>';
        }

        html += '</div>';
    });

    container.innerHTML = html;
}

async function agentApproveWd(withdrawalId) {
    if (!confirm('Approve this withdrawal? The amount will be added to your balance.')) return;

    agentToast('Approving...', 'info');

    var result = await apiCall('agent', 'approve-agent-withdrawal', 'POST', {
        withdrawalId: withdrawalId,
        agentTelegramId: window.AGENT_TG_USER_ID
    });

    if (result && result.success) {
        agentToast(result.message, 'success');

        if (result.agentBalance) {
            agentData.balance = result.agentBalance;
            updateAgentBalanceDisplay();
        }

        await loadAgentWithdrawals();
    } else {
        agentToast(result.error || 'Failed', 'error');
    }
}

async function agentRejectWd(withdrawalId) {
    var reason = prompt('Rejection reason:');
    if (reason === null) return;

    agentToast('Rejecting...', 'info');

    var result = await apiCall('agent', 'reject-agent-withdrawal', 'POST', {
        withdrawalId: withdrawalId,
        agentTelegramId: window.AGENT_TG_USER_ID,
        reason: reason || 'Rejected by agent'
    });

    if (result && result.success) {
        agentToast(result.message, 'success');
        await loadAgentWithdrawals();
    } else {
        agentToast(result.error || 'Failed', 'error');
    }
}

// ========================================
// HISTORY
// ========================================
async function loadAgentHistory() {
    var container = document.getElementById('agentHistoryList');
    if (!container) return;

    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading history...</p></div>';

    var result = await apiGet('agent', 'get-agent-history', {
        telegramUserId: window.AGENT_TG_USER_ID
    });

    if (!result || !result.success || !result.history || result.history.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clock-rotate-left"></i><p>No transaction history</p></div>';
        return;
    }

    var html = '';
    result.history.forEach(function(item) {
        var isDeposit = item.type === 'deposit_to_user' || item.type === 'admin_deposit';
        var isWithdraw = item.type === 'admin_withdraw' || item.type === 'user_withdrawal_approved';
        var isReject = item.type === 'user_withdrawal_rejected';

        var color = isDeposit ? (item.type === 'admin_deposit' ? '#4caf50' : '#ffc107') : isWithdraw ? '#f44336' : '#888';
        var sign = (item.type === 'admin_deposit' || item.type === 'user_withdrawal_approved') ? '+' : '-';
        if (item.type === 'user_withdrawal_rejected') sign = '';

        var typeLabel = '';
        switch(item.type) {
            case 'deposit_to_user': typeLabel = 'Deposit to User'; break;
            case 'admin_deposit': typeLabel = 'Admin Deposit'; break;
            case 'admin_withdraw': typeLabel = 'Admin Withdraw'; break;
            case 'user_withdrawal_approved': typeLabel = 'User WD Approved'; break;
            case 'user_withdrawal_rejected': typeLabel = 'User WD Rejected'; break;
            default: typeLabel = item.type;
        }

        html += '<div class="admin-list-item">' +
            '<div class="item-header">' +
                '<div class="item-title">' + typeLabel + '</div>' +
                '<span style="font-family:Orbitron,sans-serif;font-size:14px;font-weight:700;color:' + color + ';">' +
                    sign + formatNumber(item.amount) + ' ' + item.currency +
                '</span>' +
            '</div>' +
            '<div class="item-details">' +
                '<div>' + (item.note || '') + '</div>' +
                '<div>Time: <span>' + formatDate(item.timestamp) + '</span></div>' +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;
}
