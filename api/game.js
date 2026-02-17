const {
  CONFIG, readBin, updateBin, generateId, getTimestamp,
  corsHeaders, sendSuccess, sendError, calculateVipLevel, checkTurnover
} = require('./config');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'play': return await handlePlay(req, res);
      case 'get-videos': return await handleGetVideos(req, res);
      case 'history': return await handleHistory(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Game error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handlePlay(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, betChoice, betAmount, currency } = JSON.parse(body);

  if (!userId || !betChoice || !betAmount || !currency) {
    return sendError(res, 'All fields are required');
  }

  if (!['goal', 'nogoal'].includes(betChoice)) {
    return sendError(res, 'Invalid bet choice. Must be "goal" or "nogoal"');
  }

  if (!['MMK', 'USD', 'CNY'].includes(currency)) {
    return sendError(res, 'Invalid currency');
  }

  const limits = CONFIG.LIMITS[currency];
  if (betAmount < limits.BET_MIN) {
    return sendError(res, `Minimum bet is ${limits.BET_MIN} ${currency}`);
  }
  if (betAmount > limits.BET_MAX) {
    return sendError(res, `Maximum bet is ${limits.BET_MAX} ${currency}`);
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

  if (user.balance[currency] < betAmount) {
    return sendError(res, `Insufficient ${currency} balance. You have ${user.balance[currency]} ${currency}`);
  }

  const controlsData = await readBin(CONFIG.BINS.GAME_CONTROLS);
  const controls = controlsData?.controls || { enabled: false, rules: [] };

  const videosData = await readBin(CONFIG.BINS.GAME_VIDEOS);
  const videos = videosData?.videos || { goal: [], nogoal: [] };

  let result;
  let videoType;
  let isControlled = false;

  if (controls.enabled && controls.rules && controls.rules.length > 0) {
    const matchingRule = findMatchingRule(controls.rules, betChoice, betAmount, currency);
    if (matchingRule) {
      isControlled = true;
      if (matchingRule.action === 'lose') {
        result = betChoice === 'goal' ? 'nogoal' : 'goal';
        videoType = result;
      } else if (matchingRule.action === 'win') {
        result = betChoice;
        videoType = result;
      }
    }
  }

  if (!isControlled) {
    const random = Math.random();
    result = random < 0.5 ? 'goal' : 'nogoal';
    videoType = result;
  }

  const typeVideos = videos[videoType] || [];
  let selectedVideo = null;
  if (typeVideos.length > 0) {
    const randomIdx = Math.floor(Math.random() * typeVideos.length);
    selectedVideo = typeVideos[randomIdx];
  }

  const won = (betChoice === result);
  const winAmount = won ? betAmount * 2 : 0;
  const profitLoss = won ? betAmount : -betAmount;

  users[userIdx].balance[currency] -= betAmount;

  if (won) {
    users[userIdx].balance[currency] += winAmount;
    users[userIdx].totalWinnings[currency] = (users[userIdx].totalWinnings[currency] || 0) + betAmount;
    users[userIdx].totalGamesWon = (users[userIdx].totalGamesWon || 0) + 1;
  } else {
    users[userIdx].totalLosses[currency] = (users[userIdx].totalLosses[currency] || 0) + betAmount;
    users[userIdx].totalGamesLost = (users[userIdx].totalGamesLost || 0) + 1;
  }

  users[userIdx].totalTurnover[currency] = (users[userIdx].totalTurnover[currency] || 0) + betAmount;
  users[userIdx].totalGamesPlayed = (users[userIdx].totalGamesPlayed || 0) + 1;

  if (user.pendingClaimBet && user.pendingClaimBet.currency === currency) {
    if (betAmount >= user.pendingClaimBet.minBet) {
      users[userIdx].pendingClaimBet = null;
    }
  }

  const newVipLevel = calculateVipLevel(users[userIdx]);
  const previousVipLevel = users[userIdx].vipLevel;

  const vvipReq = CONFIG.VIP.VVIP_REQUIREMENTS;
  users[userIdx].vvipCurrencies = {
    MMK: (users[userIdx].totalWinnings.MMK || 0) >= vvipReq.MMK,
    USD: (users[userIdx].totalWinnings.USD || 0) >= vvipReq.USD,
    CNY: (users[userIdx].totalWinnings.CNY || 0) >= vvipReq.CNY
  };

  users[userIdx].vipLevel = newVipLevel;

  let vvipKingReward = null;
  if (newVipLevel === 'VVIP_KING' && previousVipLevel !== 'VVIP_KING') {
    vvipKingReward = {
      MMK: CONFIG.VIP.CLAIM_REWARDS.MMK,
      USD: CONFIG.VIP.CLAIM_REWARDS.USD,
      CNY: CONFIG.VIP.CLAIM_REWARDS.CNY
    };
  }

  const gameRecord = {
    id: generateId(),
    betChoice: betChoice,
    betAmount: betAmount,
    currency: currency,
    result: result,
    won: won,
    winAmount: winAmount,
    profitLoss: profitLoss,
    videoId: selectedVideo?.id || null,
    controlled: isControlled,
    timestamp: getTimestamp()
  };

  if (!users[userIdx].gameHistory) users[userIdx].gameHistory = [];
  users[userIdx].gameHistory.unshift(gameRecord);

  if (users[userIdx].gameHistory.length > 100) {
    users[userIdx].gameHistory = users[userIdx].gameHistory.slice(0, 100);
  }

  users[userIdx].updatedAt = getTimestamp();

  const updated = await updateBin(CONFIG.BINS.USERS, { users });
  if (!updated) return sendError(res, 'Failed to save game result', 500);

  return sendSuccess(res, {
    game: gameRecord,
    video: selectedVideo ? { url: selectedVideo.url, type: selectedVideo.type } : null,
    newBalance: users[userIdx].balance[currency],
    balances: users[userIdx].balance,
    vipLevel: newVipLevel,
    vvipKingReward: vvipKingReward,
    message: won ? `You won ${winAmount} ${currency}!` : `You lost ${betAmount} ${currency}`
  });
}

function findMatchingRule(rules, betChoice, betAmount, currency) {
  const activeRules = rules.filter(r => r.active && r.currency === currency);

  for (const rule of activeRules) {
    if (rule.type === 'exact' && rule.betAmount === betAmount) {
      if (rule.betChoice === betChoice || rule.betChoice === 'any') {
        return rule;
      }
    }
    if (rule.type === 'range' && betAmount >= rule.minAmount && betAmount <= rule.maxAmount) {
      if (rule.betChoice === betChoice || rule.betChoice === 'any') {
        return rule;
      }
    }
  }
  return null;
}

async function handleGetVideos(req, res) {
  const videosData = await readBin(CONFIG.BINS.GAME_VIDEOS);
  if (!videosData) return sendError(res, 'Database error', 500);
  return sendSuccess(res, { videos: videosData.videos || { goal: [], nogoal: [] } });
}

async function handleHistory(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) return sendError(res, 'userId required');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const user = (data.users || []).find(u => u.id === userId);
  if (!user) return sendError(res, 'User not found', 404);

  return sendSuccess(res, {
    history: user.gameHistory || [],
    stats: {
      totalPlayed: user.totalGamesPlayed || 0,
      totalWon: user.totalGamesWon || 0,
      totalLost: user.totalGamesLost || 0,
      winnings: user.totalWinnings || { MMK: 0, USD: 0, CNY: 0 },
      losses: user.totalLosses || { MMK: 0, USD: 0, CNY: 0 }
    }
  });
}
