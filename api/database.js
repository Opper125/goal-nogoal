const {
  CONFIG, readBin, updateBin, corsHeaders, sendSuccess, sendError
} = require('./config');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'get-users': return await handleGetUsers(req, res);
      case 'update-user': return await handleUpdateUser(req, res);
      case 'get-deposits': return await handleGetDeposits(req, res);
      case 'get-withdrawals': return await handleGetWithdrawals(req, res);
      case 'get-payments': return await handleGetPayments(req, res);
      case 'get-videos': return await handleGetVideos(req, res);
      case 'get-controls': return await handleGetControls(req, res);
      case 'get-contacts': return await handleGetContacts(req, res);
      case 'get-stats': return await handleGetStats(req, res);
      case 'poll-user': return await handlePollUser(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Database error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handleGetUsers(req, res) {
  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);
  const users = (data.users || []).map(u => {
    const safe = { ...u };
    delete safe.password;
    return safe;
  });
  return sendSuccess(res, { users });
}

async function handleUpdateUser(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, updates } = JSON.parse(body);

  if (!userId || !updates) return sendError(res, 'userId and updates required');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return sendError(res, 'User not found', 404);

  const protectedFields = ['id', 'createdAt'];
  Object.keys(updates).forEach(key => {
    if (!protectedFields.includes(key)) {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
        users[idx][key] = { ...users[idx][key], ...updates[key] };
      } else {
        users[idx][key] = updates[key];
      }
    }
  });
  users[idx].updatedAt = new Date().toISOString();

  const updated = await updateBin(CONFIG.BINS.USERS, { users });
  if (!updated) return sendError(res, 'Failed to update user', 500);

  const safe = { ...users[idx] };
  delete safe.password;
  return sendSuccess(res, { user: safe });
}

async function handleGetDeposits(req, res) {
  const data = await readBin(CONFIG.BINS.DEPOSITS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { deposits: data.deposits || [] });
}

async function handleGetWithdrawals(req, res) {
  const data = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { withdrawals: data.withdrawals || [] });
}

async function handleGetPayments(req, res) {
  const data = await readBin(CONFIG.BINS.PAYMENTS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { payments: data.payments || { MMK: [], USD: [], CNY: [] } });
}

async function handleGetVideos(req, res) {
  const data = await readBin(CONFIG.BINS.GAME_VIDEOS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { videos: data.videos || { goal: [], nogoal: [] } });
}

async function handleGetControls(req, res) {
  const data = await readBin(CONFIG.BINS.GAME_CONTROLS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { controls: data.controls || { enabled: false, rules: [] } });
}

async function handleGetContacts(req, res) {
  const data = await readBin(CONFIG.BINS.CONTACTS);
  if (!data) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { contacts: data.contacts || [] });
}

async function handlePollUser(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) return sendError(res, 'userId required');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const user = (data.users || []).find(u => u.id === userId);
  if (!user) return sendError(res, 'User not found', 404);

  if (user.bannedStatus && user.bannedStatus.isBanned) {
    return sendSuccess(res, { banned: true, reason: user.bannedStatus.reason, user: null });
  }

  const safe = { ...user };
  delete safe.password;
  return sendSuccess(res, { banned: false, user: safe });
}

async function handleGetStats(req, res) {
  const usersData = await readBin(CONFIG.BINS.USERS);
  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  const withdrawalsData = await readBin(CONFIG.BINS.WITHDRAWALS);

  const users = usersData?.users || [];
  const deposits = depositsData?.deposits || [];
  const withdrawals = withdrawalsData?.withdrawals || [];

  const now = new Date();
  const todayStr = now.toDateString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const todayDeposits = deposits.filter(d => d.status === 'approved' && new Date(d.createdAt).toDateString() === todayStr);
  const monthDeposits = deposits.filter(d => d.status === 'approved' && new Date(d.createdAt) >= monthStart);
  const yearDeposits = deposits.filter(d => d.status === 'approved' && new Date(d.createdAt) >= yearStart);

  const todayWithdrawals = withdrawals.filter(w => w.status === 'approved' && new Date(w.createdAt).toDateString() === todayStr);
  const monthWithdrawals = withdrawals.filter(w => w.status === 'approved' && new Date(w.createdAt) >= monthStart);
  const yearWithdrawals = withdrawals.filter(w => w.status === 'approved' && new Date(w.createdAt) >= yearStart);

  function sumByCurrency(items) {
    const sums = { MMK: 0, USD: 0, CNY: 0 };
    items.forEach(item => {
      if (sums.hasOwnProperty(item.currency)) {
        sums[item.currency] += item.amount || 0;
      }
    });
    return sums;
  }

  const todayUsers = users.filter(u => new Date(u.createdAt).toDateString() === todayStr);
  const monthUsers = users.filter(u => new Date(u.createdAt) >= monthStart);
  const yearUsers = users.filter(u => new Date(u.createdAt) >= yearStart);

  let totalGames = 0, totalWins = 0, totalLosses = 0;
  let totalWinAmount = { MMK: 0, USD: 0, CNY: 0 };
  let totalLossAmount = { MMK: 0, USD: 0, CNY: 0 };

  users.forEach(u => {
    totalGames += u.totalGamesPlayed || 0;
    totalWins += u.totalGamesWon || 0;
    totalLosses += u.totalGamesLost || 0;
    ['MMK', 'USD', 'CNY'].forEach(c => {
      totalWinAmount[c] += u.totalWinnings?.[c] || 0;
      totalLossAmount[c] += u.totalLosses?.[c] || 0;
    });
  });

  const revenue = { MMK: 0, USD: 0, CNY: 0 };
  ['MMK', 'USD', 'CNY'].forEach(c => {
    const depTotal = deposits.filter(d => d.status === 'approved' && d.currency === c).reduce((s, d) => s + (d.amount || 0), 0);
    const wdTotal = withdrawals.filter(w => w.status === 'approved' && w.currency === c).reduce((s, w) => s + (w.amount || 0), 0);
    revenue[c] = totalLossAmount[c] - totalWinAmount[c];
  });

  const bannedUsers = users.filter(u => u.bannedStatus?.isBanned);

  return sendSuccess(res, {
    stats: {
      totalUsers: users.length,
      todayNewUsers: todayUsers.length,
      monthNewUsers: monthUsers.length,
      yearNewUsers: yearUsers.length,
      bannedUsers: bannedUsers.length,
      deposits: {
        today: sumByCurrency(todayDeposits),
        month: sumByCurrency(monthDeposits),
        year: sumByCurrency(yearDeposits),
        total: sumByCurrency(deposits.filter(d => d.status === 'approved')),
        pendingCount: deposits.filter(d => d.status === 'pending').length
      },
      withdrawals: {
        today: sumByCurrency(todayWithdrawals),
        month: sumByCurrency(monthWithdrawals),
        year: sumByCurrency(yearWithdrawals),
        total: sumByCurrency(withdrawals.filter(w => w.status === 'approved')),
        pendingCount: withdrawals.filter(w => w.status === 'pending').length
      },
      games: {
        totalPlayed: totalGames,
        totalWins: totalWins,
        totalLosses: totalLosses,
        winAmount: totalWinAmount,
        lossAmount: totalLossAmount
      },
      revenue: revenue
    }
  });
}
