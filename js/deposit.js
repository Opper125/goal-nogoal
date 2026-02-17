/* ===== DEPOSIT / TOPUP ===== */

let selectedTopupCurrency = null;
let selectedPaymentMethod = null;
let paymentMethods = [];

// Open topup modal
function openTopup() {
    closeAllModals();
    openModal('topupModal');
    selectedTopupCurrency = null;
    selectedPaymentMethod = null;

    renderBalanceCards('topupBalanceCards');

    document.getElementById('topupCurrencySelect').style.display = 'block';
    document.getElementById('topupAmountSection').style.display = 'none';
    document.getElementById('paymentMethodsSection').style.display = 'none';
    document.getElementById('paymentDetailSection').style.display = 'none';
    document.getElementById('topupNextBtn').style.display = 'block';

    document.querySelectorAll('#topupCurrencySelect .curr-option').forEach(btn => {
        btn.classList.remove('active');
    });
}

// Select topup currency
function selectTopupCurrency(currency) {
    selectedTopupCurrency = currency;

    document.querySelectorAll('#topupCurrencySelect .curr-option').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === currency);
    });

    const limits = getLimits(currency);
    document.getElementById('topupCurrLabel').textContent = currency;
    document.getElementById('topupLimitInfo').textContent = `Min: ${formatNumber(limits.DEPOSIT_MIN)} - Max: ${formatNumber(limits.DEPOSIT_MAX)}`;
    document.getElementById('topupAmount').value = '';

    document.getElementById('topupAmountSection').style.display = 'block';
    document.getElementById('paymentMethodsSection').style.display = 'none';
    document.getElementById('paymentDetailSection').style.display = 'none';
    document.getElementById('topupNextBtn').style.display = 'block';
}

// Load payment methods
async function loadPaymentMethods() {
    if (!selectedTopupCurrency) {
        showToast('Please select a currency first', 'warning');
        return;
    }

    const amountInput = document.getElementById('topupAmount');
    const amount = parseFloat(amountInput.value);
    const limits = getLimits(selectedTopupCurrency);

    if (!amount || amount < limits.DEPOSIT_MIN || amount > limits.DEPOSIT_MAX) {
        showToast(`Amount must be between ${formatNumber(limits.DEPOSIT_MIN)} and ${formatNumber(limits.DEPOSIT_MAX)} ${selectedTopupCurrency}`, 'error');
        return;
    }

    document.getElementById('topupNextBtn').style.display = 'none';

    const container = document.getElementById('paymentMethodsList');
    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading payment methods...</p></div>';
    document.getElementById('paymentMethodsSection').style.display = 'block';

    const result = await apiGet('payments', 'get-payment-methods', { currency: selectedTopupCurrency });

    if (!result.success || !result.methods || result.methods.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No payment methods available for this currency</p></div>';
        return;
    }

    paymentMethods = result.methods.filter(m => m.active !== false);

    if (paymentMethods.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No active payment methods</p></div>';
        return;
    }

    container.innerHTML = paymentMethods.map(method => `
        <div class="payment-method-item" onclick="selectPaymentMethod('${method.id}')" id="pay_${method.id}">
            ${method.iconUrl
                ? `<img src="${method.iconUrl}" alt="${method.name}" onerror="this.outerHTML='<div style=\\'width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;\\'><i class=\\'fas fa-wallet\\' style=\\'color:#555;\\'></i></div>'">`
                : `<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;"><i class="fas fa-wallet" style="color:#555;"></i></div>`
            }
            <div class="pay-name">${method.name}</div>
            <i class="fas fa-chevron-right" style="margin-left:auto;color:#333;font-size:12px;"></i>
        </div>
    `).join('');
}

// Select payment method
function selectPaymentMethod(methodId) {
    selectedPaymentMethod = paymentMethods.find(m => m.id === methodId);
    if (!selectedPaymentMethod) return;

    document.querySelectorAll('.payment-method-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById(`pay_${methodId}`).classList.add('selected');

    const detailCard = document.getElementById('paymentDetailCard');
    detailCard.innerHTML = `
        <div style="text-align:center;margin-bottom:15px;">
            ${selectedPaymentMethod.iconUrl
                ? `<img src="${selectedPaymentMethod.iconUrl}" style="width:50px;height:50px;border-radius:12px;object-fit:cover;margin-bottom:8px;" onerror="this.style.display='none'">`
                : ''
            }
            <h4 style="font-family:'Orbitron',sans-serif;font-size:14px;color:#ccc;letter-spacing:1px;">${selectedPaymentMethod.name}</h4>
        </div>
        ${selectedPaymentMethod.address ? `
            <div class="detail-row">
                <span class="detail-label">Address</span>
                <span class="detail-value">${selectedPaymentMethod.address}
                    <button onclick="copyToClipboard('${selectedPaymentMethod.address}')" style="background:none;border:none;color:#666;cursor:pointer;margin-left:6px;"><i class="fas fa-copy"></i></button>
                </span>
            </div>
        ` : ''}
        ${selectedPaymentMethod.note ? `
            <div class="detail-row">
                <span class="detail-label">Note</span>
                <span class="detail-value" style="color:#ffc107;">${selectedPaymentMethod.note}</span>
            </div>
        ` : ''}
        ${selectedPaymentMethod.qrCodeUrl ? `
            <div class="qr-code">
                <p style="font-size:12px;color:#555;margin-bottom:8px;">Scan QR Code</p>
                <img src="${selectedPaymentMethod.qrCodeUrl}" alt="QR Code" onerror="this.parentElement.style.display='none'">
            </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value" style="color:#4caf50;font-family:'Orbitron',sans-serif;">${formatNumber(document.getElementById('topupAmount').value)} ${selectedTopupCurrency}</span>
        </div>
    `;

    document.getElementById('paymentDetailSection').style.display = 'block';
    document.getElementById('transactionIdInput').value = '';
}

// Submit deposit
async function submitDeposit() {
    if (!selectedTopupCurrency || !selectedPaymentMethod) {
        showToast('Please select currency and payment method', 'error');
        return;
    }

    const amount = parseFloat(document.getElementById('topupAmount').value);
    const transactionId = document.getElementById('transactionIdInput').value.trim();
    const limits = getLimits(selectedTopupCurrency);

    if (!amount || amount < limits.DEPOSIT_MIN || amount > limits.DEPOSIT_MAX) {
        showToast(`Invalid amount. Min: ${formatNumber(limits.DEPOSIT_MIN)}, Max: ${formatNumber(limits.DEPOSIT_MAX)}`, 'error');
        return;
    }

    if (!transactionId || transactionId.length !== 6) {
        showToast('Please enter last 6 digits of transaction ID', 'error');
        return;
    }

    if (!/^[0-9a-zA-Z]{6}$/.test(transactionId)) {
        showToast('Transaction ID must be 6 alphanumeric characters', 'error');
        return;
    }

    const userId = getUserId();
    if (!userId) {
        showToast('Session expired. Please login again.', 'error');
        return;
    }

    showToast('Submitting deposit request...', 'info');

    const result = await apiCall('payments', 'deposit', 'POST', {
        userId: userId,
        amount: amount,
        currency: selectedTopupCurrency,
        paymentMethodId: selectedPaymentMethod.id,
        transactionId: transactionId
    });

    if (result.success) {
        showToast('Deposit request submitted! Waiting for admin approval.', 'success');
        closeModal('topupModal');

        // Send notification to admin via telegram
        apiCall('telegram', 'send-notification', 'POST', {
            type: 'deposit',
            message: `New deposit request!\nUser: ${currentUser?.username}\nAmount: ${formatNumber(amount)} ${selectedTopupCurrency}\nPayment: ${selectedPaymentMethod.name}\nTXN ID: ${transactionId}`
        });
    } else {
        showToast(result.error || 'Failed to submit deposit', 'error');
    }
}
