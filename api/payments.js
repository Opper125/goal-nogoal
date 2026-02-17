const {
  CONFIG, readBin, updateBin, generateId, getTimestamp,
  isWithin24Hours, corsHeaders, sendSuccess, sendError, checkTurnover, getWithdrawLimit, calculateVipLevel
} = require('./config');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'deposit': return await handleDeposit(req, res);
      case 'withdraw': return await handleWithdraw(req, res);
      case 'deposit-history': return await handleDepositHistory(req, res);
      case 'withdraw-history': return await handleWithdrawHistory(req, res);
      case 'get-payment-methods': return await handleGetPaymentMethods(req, res);
      case 'check-withdraw-eligibility': return await handleCheckWithdrawEligibility(req, res);
      case 'claim-reward': return await handleClaimReward(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Payment error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handleDeposit(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, amount, currency, paymentMethodId, transactionId } = JSON.parse(body);

  if (!userId || !amount || !currency || !paymentMethodId || !transactionId) {
    return sendError(res, 'All fields are required');
  }

  if (!['MMK', 'USD', 'CNY'].includes(currency)) {
    return sendError(res, 'Invalid currency');
  }

  const limits = CONFIG.LIMITS[currency];
  if (amount < limits.DEPOSIT_MIN) {
    return sendError(res, `Minimum deposit is ${limits.DEPOSIT_MIN} ${currency}`);
  }
  if (amount > limits.DEPOSIT_MAX) {
    return sendError(res, `Maximum deposit is ${limits.DEPOSIT_MAX} ${currency}`);
  }

  if (!transactionId || transactionId.length !== 6) {
    return sendError(res, 'Transaction ID must be exactly 6 digits');
  }

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) return sendError(res, 'User not found', 404);

  const user = users[userIdx];
  if (user.bannedStatus?.isBanned) {
    return sendError(res, 'Account is banned', 403);
  }

  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  if (!depositsData) return sendError(res, 'Database error', 500);

  const deposits = depositsData.deposits || [];

  const recentDuplicates = deposits.filter(d =>
    d.transactionId === transactionId && isWithin24Hours(d.createdAt)
  );

  if (recentDuplicates.length > 0) {
    const approvedDup = recentDuplicates.filter(d => d.status === 'approved');

    if (!users[userIdx].fraudAttempts) users[userIdx].fraudAttempts = [];

    const recentFraud = users[userIdx].fraudAttempts.filter(f => isWithin24Hours(f.timestamp));

    if (approvedDup.length > 0) {
      users[userIdx].fraudAttempts.push({
        type: 'duplicate_approved_txn',
        transactionId: transactionId,
        timestamp: getTimestamp()
      });

      const updatedFraud = users[userIdx].fraudAttempts.filter(f => isWithin24Hours(f.timestamp));
      const approvedFraudCount = updatedFraud.filter(f => f.type === 'duplicate_approved_txn').length;

      if (approvedFraudCount >= CONFIG.BAN_THRESHOLD) {
        users[userIdx].bannedStatus = {
          isBanned: true,
          reason: `Auto-banned: Submitted approved transaction ID "${transactionId}" more than ${CONFIG.BAN_THRESHOLD} times within 24 hours`,
          bannedAt: getTimestamp(),
          bannedIPs: [user.ipAddress].filter(Boolean),
          bannedDevices: [user.deviceId].filter(Boolean)
        };
        await updateBin(CONFIG.BINS.USERS, { users });
        return sendError(res, 'Your account has been automatically banned for suspicious activity', 403);
      }

      await updateBin(CONFIG.BINS.USERS, { users });
      return sendError(res, 'This transaction ID has already been approved. Warning: Repeated attempts will result in account ban.');
    }

    return sendError(res, 'This transaction ID has already been submitted within the last 24 hours');
  }

  const paymentsData = await readBin(CONFIG.BINS.PAYMENTS);
  const paymentMethods = paymentsData?.payments?.[currency] || [];
  const selectedPayment = paymentMethods.find(p => p.id === paymentMethodId);

  const deposit = {
    id: generateId(),
    userId: userId,
    username: user.username,
    amount: amount,
    currency: currency,
    paymentMethodId: paymentMethodId,
    paymentName: selectedPayment?.name || 'Unknown',
    transactionId: transactionId,
    status: 'pending',
    adminNote: '',
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };

  deposits.push(deposit);
  await updateBin(CONFIG.BINS.DEPOSITS, { deposits });

  if (!users[userIdx].depositHistory) users[userIdx].depositHistory = [];
  users[userIdx].depositHistory.unshift({
    depositId: deposit.id,
    amount: amount,
    currency: currency,
    status: 'pending',
    timestamp: deposit.createdAt
  });
  await updateBin(CONFIG.BINS.USERS, { users });

  return sendSuccess(res, {
    deposit: deposit,
    message: 'Deposit request submitted successfully. Waiting for admin approval.'
  });
}

async function handleWithdraw(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, amount, currency } = JSON.parse(body);

  if (!userId || !amount || !currency) {
    return sendError(res, 'All fields are required');
  }

  if (!['MMK', 'USD', 'CNY'].includes(currency)) {
    return sendError(res, 'Invalid currency');
  }

  const limits = CONFIG.LIMITS[currency];
  if (amount < limits.WITHDRAW_MIN) {
    return sendError(res, `Minimum withdrawal is ${limits.WITHDRAW_MIN} ${currency}`);
  }
  if (amount > limits.WITHDRAW_MAX) {
    return sendError(res, `Maximum withdrawal is ${limits.WITHDRAW_MAX} ${currency}`);
  }

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) return sendError(res, 'User not found', 404);

  const user = users[userIdx];

  if (user.bannedStatus?.isBanned) {
    return sendError(res, 'Account is banned', 403);
  }

  if (user.balance[currency] < amount) {
    return sendError(res, `Insufficient balance. You have ${user.balance[currency]} ${currency}`);
  }

  const turnover = checkTurnover(user, currency);
  if (!turnover.met) {
    return sendError(res, `Turnover requirement not met. You need ${turnover.remaining} more ${currency} in turnover.`);
  }

  if (user.pendingClaimBet && user.pendingClaimBet.currency === currency) {
    return sendError(res, `You must place a bet of at least ${user.pendingClaimBet.minBet} ${currency} from your claimed reward before withdrawing.`);
  }

  const vipLevel = calculateVipLevel(user);
  const dailyLimit = getWithdrawLimit(vipLevel);

  const today = new Date().toDateString();
  const lastWd = user.lastWithdrawDate;
  let todayCount = user.todayWithdrawCount || 0;
  if (!lastWd || new Date(lastWd).toDateString() !== today) {
    todayCount = 0;
  }

  if (todayCount >= dailyLimit) {
    return sendError(res, `Daily withdrawal limit reached (${dailyLimit} times per day for ${vipLevel} level)`);
  }

  const withdrawalsData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!withdrawalsData) return sendError(res, 'Database error', 500);

  const withdrawals = withdrawalsData.withdrawals || [];

  const withdrawal = {
    id: generateId(),
    userId: userId,
    username: user.username,
    amount: amount,
    currency: currency,
    status: 'pending',
    adminNote: '',
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };

  withdrawals.push(withdrawal);
  await updateBin(CONFIG.BINS.WITHDRAWALS, { withdrawals });

  users[userIdx].balance[currency] -= amount;
  users[userIdx].todayWithdrawCount = todayCount + 1;
  users[userIdx].lastWithdrawDate = getTimestamp();

  if (!users[userIdx].withdrawHistory) users[userIdx].withdrawHistory = [];
  users[userIdx].withdrawHistory.unshift({
    withdrawId: withdrawal.id,
    amount: amount,
    currency: currency,
    status: 'pending',
    timestamp: withdrawal.createdAt
  });

  users[userIdx].updatedAt = getTimestamp();
  await updateBin(CONFIG.BINS.USERS, { users });

  return sendSuccess(res, {
    withdrawal: withdrawal,
    newBalance: users[userIdx].balance[currency],
    message: 'Withdrawal request submitted successfully.'
  });
}

async function handleDepositHistory(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) return sendError(res, 'userId required');

  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  if (!depositsData) return sendError(res, 'Database error', 500);

  const userDeposits = (depositsData.deposits || []).filter(d => d.userId === userId);
  return sendSuccess(res, { deposits: userDeposits });
}

async function handleWithdrawHistory(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) return sendError(res, 'userId required');

  const withdrawalsData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!withdrawalsData) return sendError(res, 'Database error', 500);

  const userWithdrawals = (withdrawalsData.withdrawals || []).filter(w => w.userId === userId);
  return sendSuccess(res, { withdrawals: userWithdrawals });
}

async function handleGetPaymentMethods(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const currency = url.searchParams.get('currency');

  const paymentsData = await readBin(CONFIG.BINS.PAYMENTS);
  if (!paymentsData) return sendError(res, 'Database error', 500);

  const payments = paymentsData.payments || { MMK: [], USD: [], CNY: [] };

  if (currency && payments[currency]) {
    return sendSuccess(res, { methods: payments[currency] });
  }

  return sendSuccess(res, { payments: payments });
}

async function handleCheckWithdrawEligibility(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  const currency = url.searchParams.get('currency');

  if (!userId || !currency) return sendError(res, 'userId and currency required');

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const user = (usersData.users || []).find(u => u.id === userId);
  if (!user) return sendError(res, 'User not found', 404);

  const turnover = checkTurnover(user, currency);
  const vipLevel = calculateVipLevel(user);
  const dailyLimit = getWithdrawLimit(vipLevel);

  const today = new Date().toDateString();
  let todayCount = user.todayWithdrawCount || 0;
  if (!user.lastWithdrawDate || new Date(user.lastWithdrawDate).toDateString() !== today) {
    todayCount = 0;
  }

  const hasPendingClaim = user.pendingClaimBet && user.pendingClaimBet.currency === currency;

  return sendSuccess(res, {
    eligible: turnover.met && todayCount < dailyLimit && !hasPendingClaim,
    turnover: turnover,
    vipLevel: vipLevel,
    dailyLimit: dailyLimit,
    todayCount: todayCount,
    remainingWithdraws: dailyLimit - todayCount,
    hasPendingClaim: hasPendingClaim,
    pendingClaimBet: user.pendingClaimBet,
    balance: user.balance[currency],
    limits: CONFIG.LIMITS[currency]
  });
}

async function handleClaimReward(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, currency } = JSON.parse(body);

  if (!userId || !currency) return sendError(res, 'userId and currency required');
  if (!['MMK', 'USD', 'CNY'].includes(currency)) return sendError(res, 'Invalid currency');

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) return sendError(res, 'User not found', 404);

  const user = users[userIdx];

  if (user.vipLevel !== 'VVIP_KING') {
    return sendError(res, 'Only VVIP KING users can claim rewards');
  }

  if (user.claimedRewards && user.claimedRewards.includes(currency)) {
    return sendError(res, `You have already claimed a ${currency} reward`);
  }

  if (user.claimedRewards && user.claimedRewards.length > 0) {
    return sendError(res, 'You can only claim one reward. You have already claimed a reward.');
  }

  const rewardAmount = CONFIG.VIP.CLAIM_REWARDS[currency];
  const minBet = CONFIG.VIP.CLAIM_MIN_BET[currency];

  users[userIdx].balance[currency] += rewardAmount;

  if (!users[userIdx].claimedRewards) users[userIdx].claimedRewards = [];
  users[userIdx].claimedRewards.push(currency);

  users[userIdx].pendingClaimBet = {
    currency: currency,
    minBet: minBet,
    rewardAmount: rewardAmount,
    claimedAt: getTimestamp()
  };

  users[userIdx].updatedAt = getTimestamp();
  await updateBin(CONFIG.BINS.USERS, { users });

  return sendSuccess(res, {
    message: `Claimed ${rewardAmount} ${currency} reward! You must place a bet of at least ${minBet} ${currency} before you can withdraw.`,
    newBalance: users[userIdx].balance[currency],
    pendingClaimBet: users[userIdx].pendingClaimBet
  });
}
