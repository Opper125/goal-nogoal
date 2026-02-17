/* ===== BALANCE MANAGEMENT ===== */

let currentCurrency = 'MMK';
let currentUser = null;

// Switch currency
function switchCurrency(currency) {
    currentCurrency = currency;

    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === currency);
    });

    updateBalanceDisplay();
    updateBetLimits();
}

// Update balance display
function updateBalanceDisplay() {
    if (!currentUser) return;

    const amount = currentUser.balance[currentCurrency] || 0;
    const amountEl = document.getElementById('balanceAmount');
    const currLabel = document.getElementById('balanceCurrencyLabel');

    if (currLabel) currLabel.textContent = currentCurrency;
    if (amountEl) amountEl.textContent = formatNumber(amount);
}

// Update balance with animation
function updateBalanceAnimated(newBalance, currency) {
    if (!currentUser) return;

    const oldBalance = currentUser.balance[currency] || 0;
    currentUser.balance[currency] = newBalance;

    // Save updated user
    saveSession(currentUser);

    if (currency === currentCurrency) {
        const amountEl = document.getElementById('balanceAmount');
        if (amountEl) {
            if (newBalance > oldBalance) {
                showMoneyRain(currency);
            }
            animateBalance(amountEl, oldBalance, newBalance, 2000);
        }
    }
}

// Update all balance cards (for modals)
function renderBalanceCards(containerId) {
    if (!currentUser) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ['MMK', 'USD', 'CNY'].map(curr => `
        <div class="balance-card">
            <div class="card-currency">${curr}</div>
            <div class="card-amount">${formatNumber(currentUser.balance[curr] || 0)}</div>
        </div>
    `).join('');
}

// Update bet limits display
function updateBetLimits() {
    const limits = getLimits(currentCurrency);
    const limitsEl = document.getElementById('betLimits');
    if (limitsEl) {
        limitsEl.textContent = `Min: ${formatNumber(limits.BET_MIN)} - Max: ${formatNumber(limits.BET_MAX)}`;
    }
    const currLabel = document.getElementById('betCurrencyLabel');
    if (currLabel) currLabel.textContent = currentCurrency;
}

// Quick bet amounts update based on currency
function getQuickBetAmounts(currency) {
    switch (currency) {
        case 'USD':
            return [1, 5, 10, 50, 100];
        case 'CNY':
            return [5, 10, 50, 100, 500];
        default:
            return [1000, 5000, 10000, 50000, 100000];
    }
}

function updateQuickBets() {
    const amounts = getQuickBetAmounts(currentCurrency);
    const buttons = document.querySelectorAll('.quick-bet:not(:last-child)');
    buttons.forEach((btn, i) => {
        if (amounts[i] !== undefined) {
            btn.textContent = formatNumber(amounts[i]);
            btn.onclick = () => quickBet(amounts[i]);
        }
    });
}
