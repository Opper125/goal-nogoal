/* ===== WITHDRAW ===== */

var selectedWithdrawCurrency = null;
var withdrawEligibility = null;

// Open withdraw modal
function openWithdraw() {
    closeAllModals();

    var modal = document.getElementById('withdrawModal');
    if (!modal) {
        console.error('withdrawModal not found');
        return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    selectedWithdrawCurrency = null;
    withdrawEligibility = null;

    renderBalanceCards('withdrawBalanceCards');

    var currSelect = document.getElementById('withdrawCurrencySelect');
    var amountSection = document.getElementById('withdrawAmountSection');

    if (currSelect) currSelect.style.display = 'block';
    if (amountSection) amountSection.style.display = 'none';

    document.querySelectorAll('#withdrawCurrencySelect .curr-option').forEach(function(btn) {
        btn.classList.remove('active');
    });
}

// Select withdraw currency
async function selectWithdrawCurrency(currency) {
    selectedWithdrawCurrency = currency;

    document.querySelectorAll('#withdrawCurrencySelect .curr-option').forEach(function(btn) {
        btn.classList.toggle('active', btn.textContent.trim() === currency);
    });

    var limits = getLimits(currency);
    var currLabel = document.getElementById('withdrawCurrLabel');
    var limitInfo = document.getElementById('withdrawLimitInfo');
    var amountInput = document.getElementById('withdrawAmount');
    var amountSection = document.getElementById('withdrawAmountSection');

    if (currLabel) currLabel.textContent = currency;
    if (limitInfo) limitInfo.textContent = 'Min: ' + formatNumber(limits.WITHDRAW_MIN) + ' - Max: ' + formatNumber(limits.WITHDRAW_MAX);
    if (amountInput) amountInput.value = '';
    if (amountSection) amountSection.style.display = 'block';

    await checkWithdrawEligibility(currency);
}

// Check withdraw eligibility
async function checkWithdrawEligibility(currency) {
    var userId = getUserId();
    if (!userId) return;

    var turnoverEl = document.getElementById('turnoverInfo');
    var eligibilityEl = document.getElementById('withdrawEligibility');
    var submitBtn = document.getElementById('withdrawSubmitBtn');

    if (turnoverEl) turnoverEl.innerHTML = '<div style="text-align:center;color:#555;">Checking eligibility...</div>';
    if (eligibilityEl) eligibilityEl.innerHTML = '';

    var result = await apiGet('payments', 'check-withdraw-eligibility', {
        userId: userId,
        currency: currency
    });

    if (!result || !result.success) {
        if (turnoverEl) turnoverEl.innerHTML = '<div style="color:#f44336;">Error checking eligibility</div>';
        return;
    }

    withdrawEligibility = result;

    var turnover = result.turnover;
    if (turnoverEl) {
        turnoverEl.innerHTML =
            '<div class="turnover-label">Turnover Requirement (1x deposit)</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
                '<span>Required: <strong>' + formatNumber(turnover.required) + ' ' + currency + '</strong></span>' +
                '<span>Current: <strong>' + formatNumber(turnover.current) + ' ' + currency + '</strong></span>' +
            '</div>' +
            (!turnover.met ?
                '<div style="margin-top:8px;color:#ffc107;font-size:12px;">' +
                    '<i class="fas fa-exclamation-triangle"></i> Need ' + formatNumber(turnover.remaining) + ' more ' + currency + ' in turnover' +
                '</div>'
            :
                '<div style="margin-top:8px;color:#4caf50;font-size:12px;">' +
                    '<i class="fas fa-check-circle"></i> Turnover requirement met!' +
                '</div>'
            );
    }

    if (result.hasPendingClaim) {
        if (eligibilityEl) {
            eligibilityEl.className = 'eligibility-info not-eligible';
            eligibilityEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> You must place a bet of at least ' + formatNumber(result.pendingClaimBet.minBet) + ' ' + currency + ' from your claimed reward before withdrawing.';
        }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
        return;
    }

    if (!result.eligible) {
        if (eligibilityEl) {
            eligibilityEl.className = 'eligibility-info not-eligible';
            var reasons = [];
            if (!turnover.met) reasons.push('Turnover not met (need ' + formatNumber(turnover.remaining) + ' more)');
            if (result.todayCount >= result.dailyLimit) reasons.push('Daily limit reached (' + result.dailyLimit + ' times for ' + result.vipLevel + ')');
            eligibilityEl.innerHTML = '<i class="fas fa-times-circle"></i> Cannot withdraw: ' + reasons.join(', ');
        }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
    } else {
        if (eligibilityEl) {
            eligibilityEl.className = 'eligibility-info eligible';
            eligibilityEl.innerHTML = '<i class="fas fa-check-circle"></i> Eligible to withdraw | ' + result.vipLevel + ' Level | ' + result.remainingWithdraws + ' withdrawals remaining today';
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
    }
}

// Set max withdraw amount
function setMaxWithdraw() {
    if (!currentUser || !selectedWithdrawCurrency) return;

    var balance = currentUser.balance[selectedWithdrawCurrency] || 0;
    var limits = getLimits(selectedWithdrawCurrency);
    var maxAmount = Math.min(balance, limits.WITHDRAW_MAX);

    var input = document.getElementById('withdrawAmount');
    if (input) input.value = maxAmount;
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

    var amountInput = document.getElementById('withdrawAmount');
    var amount = parseFloat(amountInput ? amountInput.value : 0);
    var limits = getLimits(selectedWithdrawCurrency);

    if (!amount) {
        showToast('Please enter an amount', 'error');
        return;
    }

    if (amount < limits.WITHDRAW_MIN) {
        showToast('Minimum withdrawal is ' + formatNumber(limits.WITHDRAW_MIN) + ' ' + selectedWithdrawCurrency, 'error');
        return;
    }

    if (amount > limits.WITHDRAW_MAX) {
        showToast('Maximum withdrawal is ' + formatNumber(limits.WITHDRAW_MAX) + ' ' + selectedWithdrawCurrency, 'error');
        return;
    }

    var balance = currentUser ? (currentUser.balance[selectedWithdrawCurrency] || 0) : 0;
    if (amount > balance) {
        showToast('Insufficient balance. You have ' + formatNumber(balance) + ' ' + selectedWithdrawCurrency, 'error');
        return;
    }

    var userId = getUserId();
    if (!userId) {
        showToast('Session expired. Please login again.', 'error');
        return;
    }

    showToast('Submitting withdrawal request...', 'info');

    var result = await apiCall('payments', 'withdraw', 'POST', {
        userId: userId,
        amount: amount,
        currency: selectedWithdrawCurrency
    });

    if (result.success) {
        showToast('Withdrawal request submitted!', 'success');

        if (currentUser) {
            currentUser.balance[selectedWithdrawCurrency] = result.newBalance;
            saveSession(currentUser);
            updateBalanceDisplay();
        }

        closeModal('withdrawModal');

        apiCall('telegram', 'send-notification', 'POST', {
            type: 'withdraw',
            message: 'New withdrawal request!\nUser: ' + (currentUser ? currentUser.username : 'Unknown') + '\nAmount: ' + formatNumber(amount) + ' ' + selectedWithdrawCurrency
        });
    } else {
        showToast(result.error || 'Failed to submit withdrawal', 'error');
    }
}

// ========================================
// HISTORY
// ========================================

// Open history modal
function openHistory() {
    closeAllModals();

    var modal = document.getElementById('historyModal');
    if (!modal) {
        console.error('historyModal not found');
        return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Set first tab active
    document.querySelectorAll('.history-tab').forEach(function(t, i) {
        t.classList.toggle('active', i === 0);
    });

    loadHistoryTab('deposits');
}

// Switch history tab (called from HTML onclick)
function switchHistoryTab(tab) {
    // Update active tab
    document.querySelectorAll('.history-tab').forEach(function(t) {
        var tabName = t.textContent.trim().toLowerCase();
        t.classList.toggle('active', tabName === tab);
    });

    loadHistoryTab(tab);
}

// Load history tab content
async function loadHistoryTab(tab) {
    var container = document.getElementById('historyContent');
    if (!container) return;

    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading...</p></div>';

    var userId = getUserId();
    if (!userId) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-user"></i><p>Please login first</p></div>';
        return;
    }

    try {
        if (tab === 'deposits') {
            var result = await apiGet('payments', 'deposit-history', { userId: userId });
            if (result && result.success && result.deposits && result.deposits.length > 0) {
                renderDepositHistory(result.deposits);
            } else {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No deposit history</p></div>';
            }
        } else if (tab === 'withdrawals') {
            var result = await apiGet('payments', 'withdraw-history', { userId: userId });
            if (result && result.success && result.withdrawals && result.withdrawals.length > 0) {
                renderWithdrawHistory(result.withdrawals);
            } else {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No withdrawal history</p></div>';
            }
        } else if (tab === 'games') {
            var result = await apiGet('game', 'history', { userId: userId });
            if (result && result.success && result.history && result.history.length > 0) {
                renderGameHistory(result.history);
            } else {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No game history</p></div>';
            }
        }
    } catch (err) {
        console.error('History load error:', err);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading data</p></div>';
    }
}

// Render deposit history
function renderDepositHistory(deposits) {
    var container = document.getElementById('historyContent');
    if (!container) return;

    var sorted = deposits.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var html = '';
    sorted.forEach(function(dep) {
        html += '<div class="history-item">' +
            '<div class="hist-top">' +
                '<span class="hist-amount positive">+' + formatNumber(dep.amount) + ' ' + dep.currency + '</span>' +
                getStatusBadge(dep.status) +
            '</div>' +
            '<div class="hist-detail">' +
                'Payment: ' + (dep.paymentName || '-') + ' | TXN: ' + (dep.transactionId || '-') +
            '</div>';

        if (dep.status === 'rejected' && dep.adminNote) {
            html += '<div class="hist-detail" style="color:#f44336;margin-top:4px;">' +
                '<i class="fas fa-info-circle"></i> ' + dep.adminNote +
            '</div>';
        }

        html += '<div class="hist-time">' + timeAgo(dep.createdAt) + ' - ' + formatDate(dep.createdAt) + '</div>' +
            '</div>';
    });

    container.innerHTML = html;
}

// Render withdraw history
function renderWithdrawHistory(withdrawals) {
    var container = document.getElementById('historyContent');
    if (!container) return;

    var sorted = withdrawals.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var html = '';
    sorted.forEach(function(wd) {
        html += '<div class="history-item">' +
            '<div class="hist-top">' +
                '<span class="hist-amount negative">-' + formatNumber(wd.amount) + ' ' + wd.currency + '</span>' +
                getStatusBadge(wd.status) +
            '</div>';

        if (wd.status === 'rejected' && wd.adminNote) {
            html += '<div class="hist-detail" style="color:#f44336;margin-top:4px;">' +
                '<i class="fas fa-info-circle"></i> ' + wd.adminNote +
            '</div>';
        }

        html += '<div class="hist-time">' + timeAgo(wd.createdAt) + ' - ' + formatDate(wd.createdAt) + '</div>' +
            '</div>';
    });

    container.innerHTML = html;
}

// Render game history
function renderGameHistory(history) {
    var container = document.getElementById('historyContent');
    if (!container) return;

    var html = '';
    history.forEach(function(game) {
        html += '<div class="history-item">' +
            '<div class="hist-top">' +
                '<span class="hist-amount ' + (game.won ? 'positive' : 'negative') + '">' +
                    (game.won ? '+' : '') + formatNumber(game.profitLoss) + ' ' + game.currency +
                '</span>' +
                '<span class="hist-status ' + (game.won ? 'approved' : 'rejected') + '">' +
                    (game.won ? 'WIN' : 'LOSE') +
                '</span>' +
            '</div>' +
            '<div class="hist-detail">' +
                'Bet: ' + game.betChoice.toUpperCase() + ' | Amount: ' + formatNumber(game.betAmount) + ' ' + game.currency + ' | Result: ' + game.result.toUpperCase() +
            '</div>' +
            '<div class="hist-time">' + timeAgo(game.timestamp) + ' - ' + formatDate(game.timestamp) + '</div>' +
        '</div>';
    });

    container.innerHTML = html;
}
