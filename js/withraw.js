/* ===== WITHDRAW ===== */

let selectedWithdrawCurrency = null;
let withdrawEligibility = null;

// Open withdraw modal
function openWithdraw() {
    closeAllModals();
    openModal('withdrawModal');
    selectedWithdrawCurrency = null;
    withdrawEligibility = null;

    renderBalanceCards('withdrawBalanceCards');

    document.getElementById('withdrawCurrencySelect').style.display = 'block';
    document.getElementById('withdrawAmountSection').style.display = 'none';

    document.querySelectorAll('#withdrawCurrencySelect .curr-option').forEach(btn => {
        btn.classList.remove('active');
    });
}

// Select withdraw currency
async function selectWithdrawCurrency(currency) {
    selectedWithdrawCurrency = currency;

    document.querySelectorAll('#withdrawCurrencySelect .curr-option').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === currency);
    });

    const limits = getLimits(currency);
    document.getElementById('withdrawCurrLabel').textContent = currency;
    document.getElementById('withdrawLimitInfo').textContent = `Min: ${formatNumber(limits.WITHDRAW_MIN)} - Max: ${formatNumber(limits.WITHDRAW_MAX)}`;
    document.getElementById('withdrawAmount').value = '';

    document.getElementById('withdrawAmountSection').style.display = 'block';

    // Check eligibility
    await checkWithdrawEligibility(currency);
}

// Check withdraw eligibility
async function checkWithdrawEligibility(currency) {
    const userId = getUserId();
    if (!userId) return;

    const turnoverEl = document.getElementById('turnoverInfo');
    const eligibilityEl = document.getElementById('withdrawEligibility');
    const submitBtn = document.getElementById('withdrawSubmitBtn');

    turnoverEl.innerHTML = '<div style="text-align:center;color:#555;">Checking eligibility...</div>';
    eligibilityEl.innerHTML = '';

    const result = await apiGet('payments', 'check-withdraw-eligibility', {
        userId: userId,
        currency: currency
    });

    if (!result.success) {
        turnoverEl.innerHTML = '<div style="color:#f44336;">Error checking eligibility</div>';
        return;
    }

    withdrawEligibility = result;

    // Turnover info
    const turnover = result.turnover;
    turnoverEl.innerHTML = `
        <div class="turnover-label">Turnover Requirement (1x deposit)</div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span>Required: <strong>${formatNumber(turnover.required)} ${currency}</strong></span>
            <span>Current: <strong>${formatNumber(turnover.current)} ${currency}</strong></span>
        </div>
        ${!turnover.met ? `
            <div style="margin-top:8px;color:#ffc107;font-size:12px;">
                <i class="fas fa-exclamation-triangle"></i> Need ${formatNumber(turnover.remaining)} more ${currency} in turnover
            </div>
        ` : `
            <div style="margin-top:8px;color:#4caf50;font-size:12px;">
                <i class="fas fa-check-circle"></i> Turnover requirement met!
            </div>
        `}
    `;

    // Eligibility
    if (result.hasPendingClaim) {
        eligibilityEl.className = 'eligibility-info not-eligible';
        eligibilityEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> You must place a bet of at least ${formatNumber(result.pendingClaimBet.minBet)} ${currency} from your claimed reward before withdrawing.`;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        return;
    }

    if (!result.eligible) {
        eligibilityEl.className = 'eligibility-info not-eligible';
        let reasons = [];
        if (!turnover.met) reasons.push(`Turnover not met (need ${formatNumber(turnover.remaining)} more)`);
        if (result.todayCount >= result.dailyLimit) reasons.push(`Daily limit reached (${result.dailyLimit} times for ${result.vipLevel})`);
        eligibilityEl.innerHTML = `<i class="fas fa-times-circle"></i> Cannot withdraw: ${reasons.join(', ')}`;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
    } else {
        eligibilityEl.className = 'eligibility-info eligible';
        eligibilityEl.innerHTML = `<i class="fas fa-check-circle"></i> Eligible to withdraw | ${result.vipLevel} Level | ${result.remainingWithdraws} withdrawals remaining today`;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
    }
}

// Set max withdraw amount
function setMaxWithdraw() {
    if (!currentUser || !selectedWithdrawCurrency) return;

    const balance = currentUser.balance[selectedWithdrawCurrency] || 0;
    const limits = getLimits(selectedWithdrawCurrency);
    const maxAmount = Math.min(balance, limits.WITHDRAW_MAX);

    document.getElementById('withdrawAmount').value = maxAmount;
}

// Submit withdrawal
async function submitWithdraw() {
    if (!selectedWithdrawCurrency) {
        showToast('Please select a currency', 'error');
        return;
    }

    if (withdrawEligibility && !withdrawEligibility.eligible) {
        showToast('You are not eligible to withdraw at this time', 'error');
        return;
    }

    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const limits = getLimits(selectedWithdrawCurrency);

    if (!amount) {
        showToast('Please enter an amount', 'error');
        return;
    }

    if (amount < limits.WITHDRAW_MIN) {
        showToast(`Minimum withdrawal is ${formatNumber(limits.WITHDRAW_MIN)} ${selectedWithdrawCurrency}`, 'error');
        return;
    }

    if (amount > limits.WITHDRAW_MAX) {
        showToast(`Maximum withdrawal is ${formatNumber(limits.WITHDRAW_MAX)} ${selectedWithdrawCurrency}`, 'error');
        return;
    }

    const balance = currentUser?.balance[selectedWithdrawCurrency] || 0;
    if (amount > balance) {
        showToast(`Insufficient balance. You have ${formatNumber(balance)} ${selectedWithdrawCurrency}`, 'error');
        return;
    }

    const userId = getUserId();
    if (!userId) {
        showToast('Session expired. Please login again.', 'error');
        return;
    }

    showToast('Submitting withdrawal request...', 'info');

    const result = await apiCall('payments', 'withdraw', 'POST', {
        userId: userId,
        amount: amount,
        currency: selectedWithdrawCurrency
    });

    if (result.success) {
        showToast('Withdrawal request submitted!', 'success');

        // Update local balance
        if (currentUser) {
            currentUser.balance[selectedWithdrawCurrency] = result.newBalance;
            saveSession(currentUser);
            updateBalanceDisplay();
        }

        closeModal('withdrawModal');

        // Notify admin
        apiCall('telegram', 'send-notification', 'POST', {
            type: 'withdraw',
            message: `New withdrawal request!\nUser: ${currentUser?.username}\nAmount: ${formatNumber(amount)} ${selectedWithdrawCurrency}`
        });
    } else {
        showToast(result.error || 'Failed to submit withdrawal', 'error');
    }
}

// Open history modal
async function openHistory() {
    closeAllModals();
    openModal('historyModal');
    await switchHistoryTab('deposits');
}

// Switch history tab
async function switchHistoryTab(tab) {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    event?.target?.classList.add('active');

    const container = document.getElementById('historyContent');
    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading...</p></div>';

    const userId = getUserId();
    if (!userId) return;

    if (tab === 'deposits') {
        const result = await apiGet('payments', 'deposit-history', { userId });
        if (result.success && result.deposits) {
            renderDepositHistory(result.deposits);
        } else {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No deposit history</p></div>';
        }
    } else if (tab === 'withdrawals') {
        const result = await apiGet('payments', 'withdraw-history', { userId });
        if (result.success && result.withdrawals) {
            renderWithdrawHistory(result.withdrawals);
        } else {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No withdrawal history</p></div>';
        }
    } else if (tab === 'games') {
        const result = await apiGet('game', 'history', { userId });
        if (result.success && result.history) {
            renderGameHistory(result.history);
        } else {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No game history</p></div>';
        }
    }
}

// Render deposit history
function renderDepositHistory(deposits) {
    const container = document.getElementById('historyContent');

    if (!deposits || deposits.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No deposit history</p></div>';
        return;
    }

    const sorted = deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = sorted.map(dep => `
        <div class="history-item">
            <div class="hist-top">
                <span class="hist-amount positive">+${formatNumber(dep.amount)} ${dep.currency}</span>
                ${getStatusBadge(dep.status)}
            </div>
            <div class="hist-detail">
                Payment: ${dep.paymentName || '-'} | TXN: ${dep.transactionId || '-'}
            </div>
            ${dep.status === 'rejected' && dep.adminNote ? `
                <div class="hist-detail" style="color:#f44336;margin-top:4px;">
                    <i class="fas fa-info-circle"></i> ${dep.adminNote}
                </div>
            ` : ''}
            <div class="hist-time">${timeAgo(dep.createdAt)} - ${formatDate(dep.createdAt)}</div>
        </div>
    `).join('');
}

// Render withdraw history
function renderWithdrawHistory(withdrawals) {
    const container = document.getElementById('historyContent');

    if (!withdrawals || withdrawals.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No withdrawal history</p></div>';
        return;
    }

    const sorted = withdrawals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = sorted.map(wd => `
        <div class="history-item">
            <div class="hist-top">
                <span class="hist-amount negative">-${formatNumber(wd.amount)} ${wd.currency}</span>
                ${getStatusBadge(wd.status)}
            </div>
            ${wd.status === 'rejected' && wd.adminNote ? `
                <div class="hist-detail" style="color:#f44336;margin-top:4px;">
                    <i class="fas fa-info-circle"></i> ${wd.adminNote}
                </div>
            ` : ''}
            <div class="hist-time">${timeAgo(wd.createdAt)} - ${formatDate(wd.createdAt)}</div>
        </div>
    `).join('');
}

// Render game history
function renderGameHistory(history) {
    const container = document.getElementById('historyContent');

    if (!history || history.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No game history</p></div>';
        return;
    }

    container.innerHTML = history.map(game => `
        <div class="history-item">
            <div class="hist-top">
                <span class="hist-amount ${game.won ? 'positive' : 'negative'}">
                    ${game.won ? '+' : ''}${formatNumber(game.profitLoss)} ${game.currency}
                </span>
                <span class="hist-status ${game.won ? 'approved' : 'rejected'}">
                    ${game.won ? 'WIN' : 'LOSE'}
                </span>
            </div>
            <div class="hist-detail">
                Bet: ${game.betChoice.toUpperCase()} | Amount: ${formatNumber(game.betAmount)} ${game.currency} | Result: ${game.result.toUpperCase()}
            </div>
            <div class="hist-time">${timeAgo(game.timestamp)} - ${formatDate(game.timestamp)}</div>
        </div>
    `).join('');
}
