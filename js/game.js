/* ===== GAME LOGIC ===== */

let selectedBetChoice = null;
let isPlaying = false;

// Select bet choice
function selectBet(choice) {
    if (isPlaying) return;

    selectedBetChoice = choice;

    document.getElementById('goalBtn').classList.toggle('selected', choice === 'goal');
    document.getElementById('nogoalBtn').classList.toggle('selected', choice === 'nogoal');

    const betSection = document.getElementById('betSection');
    betSection.style.display = 'block';

    const choiceLabel = document.getElementById('betChoiceLabel');
    choiceLabel.textContent = choice === 'goal' ? 'GOAL' : 'NO GOAL';
    choiceLabel.className = `bet-choice ${choice}`;

    document.getElementById('betCurrencyLabel').textContent = currentCurrency;
    document.getElementById('betAmountInput').value = '';

    updateBetLimits();
    updateQuickBets();

    // Scroll to bet section
    betSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Quick bet
function quickBet(amount) {
    document.getElementById('betAmountInput').value = amount;
}

// Quick bet all in
function quickBetAll() {
    if (!currentUser) return;
    const balance = currentUser.balance[currentCurrency] || 0;
    const limits = getLimits(currentCurrency);
    const maxBet = Math.min(balance, limits.BET_MAX);
    document.getElementById('betAmountInput').value = maxBet;
}

// Cancel bet
function cancelBet() {
    selectedBetChoice = null;
    document.getElementById('betSection').style.display = 'none';
    document.getElementById('goalBtn').classList.remove('selected');
    document.getElementById('nogoalBtn').classList.remove('selected');
    document.getElementById('betAmountInput').value = '';
}

// Play game
async function playGame() {
    if (isPlaying) return;
    if (!selectedBetChoice) {
        showToast('Please select GOAL or NO GOAL', 'warning');
        return;
    }

    const betAmountInput = document.getElementById('betAmountInput');
    const betAmount = parseFloat(betAmountInput.value);

    if (!betAmount || isNaN(betAmount)) {
        showToast('Please enter a bet amount', 'error');
        return;
    }

    const limits = getLimits(currentCurrency);

    if (betAmount < limits.BET_MIN) {
        showToast(`Minimum bet is ${formatNumber(limits.BET_MIN)} ${currentCurrency}`, 'error');
        return;
    }

    if (betAmount > limits.BET_MAX) {
        showToast(`Maximum bet is ${formatNumber(limits.BET_MAX)} ${currentCurrency}`, 'error');
        return;
    }

    const balance = currentUser?.balance[currentCurrency] || 0;
    if (betAmount > balance) {
        showToast(`Insufficient balance! You have ${formatNumber(balance)} ${currentCurrency}`, 'error');
        return;
    }

    const userId = getUserId();
    if (!userId) {
        showToast('Session expired. Please login again.', 'error');
        return;
    }

    // Start playing
    isPlaying = true;

    // Hide game buttons and bet section
    document.getElementById('gameButtons').style.display = 'none';
    document.getElementById('betSection').style.display = 'none';

    // Show video container with loading
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.style.display = 'block';
    videoContainer.innerHTML = `
        <div class="game-loading">
            <div class="spinner"></div>
            <p>Placing bet...</p>
        </div>
    `;

    // Deduct balance immediately (visual)
    const oldBalance = currentUser.balance[currentCurrency];
    currentUser.balance[currentCurrency] = oldBalance - betAmount;
    saveSession(currentUser);
    updateBalanceDisplay();

    // Call API
    const result = await apiCall('game', 'play', 'POST', {
        userId: userId,
        betChoice: selectedBetChoice,
        betAmount: betAmount,
        currency: currentCurrency
    });

    if (!result.success) {
        // Restore balance on error
        currentUser.balance[currentCurrency] = oldBalance;
        saveSession(currentUser);
        updateBalanceDisplay();

        showToast(result.error || 'Game error', 'error');
        resetGameUI();
        return;
    }

    // Play video
    if (result.video && result.video.url) {
        await playVideoResult(result);
    } else {
        // No video, show result directly
        await showResultDirectly(result);
    }
}

// Play video result
function playVideoResult(result) {
    return new Promise((resolve) => {
        const videoContainer = document.getElementById('videoContainer');

        videoContainer.innerHTML = `
            <video id="gameVideo" playsinline webkit-playsinline preload="auto"></video>
            <div id="videoOverlay" class="video-overlay" style="display:none;">
                <div class="result-display" id="resultDisplay"></div>
            </div>
        `;

        const video = document.getElementById('gameVideo');
        const overlay = document.getElementById('videoOverlay');

        video.src = result.video.url;
        video.load();

        // Handle video loaded
        video.oncanplay = function () {
            video.play().catch(err => {
                console.error('Video play error:', err);
                // If autoplay fails, show result directly
                showGameResult(result, overlay);
                resolve();
            });
        };

        // Handle video ended
        video.onended = function () {
            showGameResult(result, overlay);
            resolve();
        };

        // Handle video error
        video.onerror = function () {
            console.error('Video load error');
            showResultDirectly(result).then(resolve);
        };

        // Timeout fallback (30 seconds max)
        setTimeout(() => {
            if (isPlaying) {
                video.pause();
                showGameResult(result, overlay);
                resolve();
            }
        }, 30000);
    });
}

// Show result directly (no video)
function showResultDirectly(result) {
    return new Promise((resolve) => {
        const videoContainer = document.getElementById('videoContainer');
        videoContainer.innerHTML = `
            <div style="min-height:250px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);border-radius:20px;">
                <div class="result-display" id="resultDisplay"></div>
            </div>
        `;

        const display = document.getElementById('resultDisplay');
        showGameResultContent(result, display);

        setTimeout(resolve, 500);
    });
}

// Show game result overlay
function showGameResult(result, overlay) {
    overlay.style.display = 'flex';
    const display = document.getElementById('resultDisplay');
    showGameResultContent(result, display);
}

// Render game result content
function showGameResultContent(result, display) {
    const game = result.game;
    const won = game.won;
    const betAmount = game.betAmount;
    const currency = game.currency;

    display.className = `result-display ${won ? 'win' : 'lose'}`;

    if (won) {
        const winAmount = game.winAmount;
        display.innerHTML = `
            <div class="result-icon"><i class="fas fa-trophy"></i></div>
            <div class="result-text">YOU WIN!</div>
            <div class="result-amount">+${formatNumber(winAmount)} ${currency}</div>
            <div style="font-size:13px;color:#888;margin-bottom:15px;">
                Bet: ${game.betChoice.toUpperCase()} | Result: ${game.result.toUpperCase()}
            </div>
            <button class="btn-continue" onclick="continueAfterGame()">CONTINUE</button>
        `;

        // Update balance with animation
        updateBalanceAnimated(result.newBalance, currency);

        showToast(`🏆 You won ${formatNumber(winAmount)} ${currency}!`, 'success', 4000);
    } else {
        display.innerHTML = `
            <div class="result-icon"><i class="fas fa-times-circle"></i></div>
            <div class="result-text">YOU LOSE</div>
            <div class="result-amount">-${formatNumber(betAmount)} ${currency}</div>
            <div style="font-size:13px;color:#888;margin-bottom:15px;">
                Bet: ${game.betChoice.toUpperCase()} | Result: ${game.result.toUpperCase()}
            </div>
            <button class="btn-continue" onclick="continueAfterGame()">CONTINUE</button>
        `;

        // Update balance
        if (currentUser) {
            currentUser.balance[currency] = result.newBalance;
            saveSession(currentUser);
            updateBalanceDisplay();
        }

        showToast(`You lost ${formatNumber(betAmount)} ${currency}`, 'error', 4000);
    }

    // Update local user data
    if (currentUser && result.balances) {
        currentUser.balance = result.balances;
        saveSession(currentUser);
    }

    if (result.vipLevel && currentUser) {
        currentUser.vipLevel = result.vipLevel;
        saveSession(currentUser);
        updateVipBadge();
    }

    // Check VVIP KING reward
    if (result.vvipKingReward) {
        setTimeout(() => {
            showVvipKingRewardNotification();
        }, 2000);
    }
}

// Continue after game
function continueAfterGame() {
    resetGameUI();
}

// Reset game UI
function resetGameUI() {
    isPlaying = false;
    selectedBetChoice = null;

    document.getElementById('videoContainer').style.display = 'none';
    document.getElementById('videoContainer').innerHTML = `
        <video id="gameVideo" playsinline webkit-playsinline></video>
        <div id="videoOverlay" class="video-overlay" style="display:none;">
            <div class="result-display" id="resultDisplay"></div>
        </div>
    `;

    document.getElementById('gameButtons').style.display = 'flex';
    document.getElementById('betSection').style.display = 'none';

    document.getElementById('goalBtn').classList.remove('selected');
    document.getElementById('nogoalBtn').classList.remove('selected');

    document.getElementById('betAmountInput').value = '';

    updateBalanceDisplay();
}

// Update VIP badge
function updateVipBadge() {
    if (!currentUser) return;

    const badge = document.getElementById('vipBadge');
    if (!badge) return;

    const level = currentUser.vipLevel || 'VIP';
    badge.innerHTML = getVipDisplay(level);
    badge.className = `vip-badge ${getVipBadgeClass(level)}`;
    badge.onclick = () => showVipInfo();
}

// Show VIP info modal
function showVipInfo() {
    if (!currentUser) return;

    openModal('vipModal');

    const body = document.getElementById('vipModalBody');
    const level = currentUser.vipLevel || 'VIP';
    const winnings = currentUser.totalWinnings || { MMK: 0, USD: 0, CNY: 0 };
    const vvipReq = { MMK: 1000000, USD: 1000, CNY: 2000 };

    body.innerHTML = `
        <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;margin-bottom:10px;">
                ${level === 'VVIP_KING' ? '<i class="fas fa-crown" style="color:#ffd54f;"></i>'
                : level === 'VVIP' ? '<i class="fas fa-gem" style="color:#ce93d8;"></i>'
                : '<i class="fas fa-star" style="color:#9e9e9e;"></i>'}
            </div>
            <h2 style="font-family:'Orbitron',sans-serif;font-size:22px;color:#ccc;letter-spacing:3px;">${level.replace('_', ' ')}</h2>
        </div>

        <div style="margin-bottom:20px;">
            <p class="section-label">WITHDRAW LIMITS</p>
            <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid rgba(255,255,255,0.04);">
                <div style="color:#ccc;font-size:14px;">
                    ${level === 'VVIP_KING' ? 'Unlimited withdrawals per day'
                    : level === 'VVIP' ? '10 withdrawals per day'
                    : '5 withdrawals per day'}
                </div>
            </div>
        </div>

        <div style="margin-bottom:20px;">
            <p class="section-label">VVIP REQUIREMENTS (Win Amount)</p>
            ${['MMK', 'USD', 'CNY'].map(curr => {
                const current = winnings[curr] || 0;
                const required = vvipReq[curr];
                const met = current >= required;
                const percent = Math.min(100, (current / required) * 100);
                return `
                    <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid rgba(255,255,255,0.04);margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span style="color:#888;font-size:13px;">${curr}</span>
                            <span style="color:${met ? '#4caf50' : '#888'};font-size:13px;">${formatNumber(current)} / ${formatNumber(required)}</span>
                        </div>
                        <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
                            <div style="width:${percent}%;height:100%;background:${met ? '#4caf50' : 'linear-gradient(90deg, #333, #555)'};border-radius:4px;transition:width 0.5s;"></div>
                        </div>
                        ${met ? '<div style="color:#4caf50;font-size:11px;margin-top:4px;"><i class="fas fa-check"></i> VVIP Achieved</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>

        ${level === 'VVIP_KING' ? `
            <div style="text-align:center;padding:16px;background:linear-gradient(135deg,rgba(255,193,7,0.05),rgba(255,160,0,0.02));border-radius:14px;border:1px solid rgba(255,193,7,0.1);">
                <div style="color:#ffd54f;font-family:'Orbitron',sans-serif;font-size:13px;letter-spacing:2px;margin-bottom:8px;">VVIP KING ACHIEVED!</div>
                <p style="color:#888;font-size:12px;">You have unlimited withdrawal privileges</p>
                ${!currentUser.claimedRewards || currentUser.claimedRewards.length === 0 ? `
                    <button class="btn-primary" style="margin-top:12px;padding:10px;" onclick="closeModal('vipModal');openClaimReward();">
                        <i class="fas fa-gift"></i> CLAIM YOUR REWARD
                    </button>
                ` : `
                    <p style="color:#4caf50;font-size:12px;margin-top:8px;"><i class="fas fa-check"></i> Reward already claimed</p>
                `}
            </div>
        ` : ''}
    `;
}

// VVIP King reward notification
function showVvipKingRewardNotification() {
    showToast('👑 Congratulations! You reached VVIP KING! Claim your reward now!', 'success', 6000);
    setTimeout(() => {
        openClaimReward();
    }, 1500);
}

// Open claim reward modal
function openClaimReward() {
    if (!currentUser || currentUser.vipLevel !== 'VVIP_KING') {
        showToast('Only VVIP KING can claim rewards', 'error');
        return;
    }

    if (currentUser.claimedRewards && currentUser.claimedRewards.length > 0) {
        showToast('You have already claimed your reward', 'warning');
        return;
    }

    openModal('claimModal');

    const body = document.getElementById('claimModalBody');
    const rewards = { MMK: 1000000, USD: 500, CNY: 1000 };
    const minBets = { MMK: 100000, USD: 100, CNY: 200 };

    body.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;color:#ffd54f;margin-bottom:10px;"><i class="fas fa-gift"></i></div>
            <h3 style="font-family:'Orbitron',sans-serif;color:#ffd54f;letter-spacing:2px;">VVIP KING REWARD</h3>
            <p style="color:#888;font-size:13px;margin-top:8px;">Choose one reward to claim. You can only claim once!</p>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
            ${['MMK', 'USD', 'CNY'].map(curr => `
                <div class="claim-box" onclick="claimReward('${curr}')" style="padding:20px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:all 0.3s ease;text-align:center;">
                    <div style="font-family:'Orbitron',sans-serif;font-size:11px;color:#666;letter-spacing:2px;margin-bottom:8px;">${curr}</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:24px;font-weight:800;color:#ffd54f;">${formatCurrency(rewards[curr], curr)}</div>
                    <div style="font-size:11px;color:#555;margin-top:8px;">Min bet required: ${formatCurrency(minBets[curr], curr)}</div>
                </div>
            `).join('')}
        </div>

        <p style="color:#555;font-size:11px;text-align:center;margin-top:16px;">
            <i class="fas fa-info-circle"></i> After claiming, you must place at least one bet with the minimum amount before withdrawing.
        </p>
    `;
}

// Claim reward
async function claimReward(currency) {
    const userId = getUserId();
    if (!userId) return;

    const confirmed = confirm(`Claim ${currency} reward? You can only choose one!`);
    if (!confirmed) return;

    showToast('Claiming reward...', 'info');

    const result = await apiCall('payments', 'claim-reward', 'POST', {
        userId: userId,
        currency: currency
    });

    if (result.success) {
        showToast(result.message, 'success', 5000);
        closeModal('claimModal');

        // Update balance
        if (currentUser) {
            currentUser.balance[currency] = result.newBalance;
            currentUser.pendingClaimBet = result.pendingClaimBet;
            if (!currentUser.claimedRewards) currentUser.claimedRewards = [];
            currentUser.claimedRewards.push(currency);
            saveSession(currentUser);

            if (currency === currentCurrency) {
                const amountEl = document.getElementById('balanceAmount');
                const oldBal = currentUser.balance[currency] - (currency === 'MMK' ? 1000000 : currency === 'USD' ? 500 : 1000);
                animateBalance(amountEl, oldBal, result.newBalance, 3000);
                showMoneyRain(currency);
            }
            updateBalanceDisplay();
        }
    } else {
        showToast(result.error || 'Failed to claim reward', 'error');
    }
}
