const {
  CONFIG, readBin, updateBin, generateId, getTimestamp,
  corsHeaders, sendSuccess, sendError
} = require('./config');

const BIN_AGENTS = process.env.BIN_AGENTS || '6995715ad0ea881f40c33b22';

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'verify-agent': return await handleVerifyAgent(req, res);
      case 'get-agent': return await handleGetAgent(req, res);
      case 'get-agents': return await handleGetAgents(req, res);
      case 'create-agent': return await handleCreateAgent(req, res);
      case 'update-agent': return await handleUpdateAgent(req, res);
      case 'delete-agent': return await handleDeleteAgent(req, res);
      case 'adjust-agent-balance': return await handleAdjustAgentBalance(req, res);
      case 'agent-deposit-to-user': return await handleAgentDepositToUser(req, res);
      case 'get-agent-withdrawals': return await handleGetAgentWithdrawals(req, res);
      case 'approve-agent-withdrawal': return await handleApproveAgentWithdrawal(req, res);
      case 'reject-agent-withdrawal': return await handleRejectAgentWithdrawal(req, res);
      case 'get-agent-history': return await handleGetAgentHistory(req, res);
      case 'get-users-for-agent': return await handleGetUsersForAgent(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Agent API error:', err);
    return sendError(res, 'Server error', 500);
  }
};

// Verify agent by Telegram User ID
async function handleVerifyAgent(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const telegramUserId = url.searchParams.get('telegramUserId');

  if (!telegramUserId) return sendError(res, 'Telegram User ID required');

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];
  const agent = agents.find(a => a.telegramUserId === telegramUserId);

  if (!agent) {
    return sendSuccess(res, { verified: false, message: 'Not an agent' });
  }

  if (agent.banned) {
    return sendSuccess(res, { verified: false, message: 'Agent account is banned' });
  }

  // Update last login
  const agentIdx = agents.findIndex(a => a.id === agent.id);
  agents[agentIdx].lastLogin = getTimestamp();
  agents[agentIdx].online = true;
  await updateBin(BIN_AGENTS, { agents });

  return sendSuccess(res, {
    verified: true,
    agent: {
      id: agent.id,
      username: agent.username,
      telegramUserId: agent.telegramUserId,
      balance: agent.balance,
      totalDeposited: agent.totalDeposited || { MMK: 0, USD: 0, CNY: 0 },
      transactionHistory: agent.transactionHistory || [],
      createdAt: agent.createdAt,
      lastLogin: agent.lastLogin
    }
  });
}

// Get agent by ID
async function handleGetAgent(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agentId');
  const telegramUserId = url.searchParams.get('telegramUserId');

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];
  let agent = null;

  if (agentId) {
    agent = agents.find(a => a.id === agentId);
  } else if (telegramUserId) {
    agent = agents.find(a => a.telegramUserId === telegramUserId);
  }

  if (!agent) return sendError(res, 'Agent not found', 404);

  const safe = { ...agent };
  delete safe.password;
  return sendSuccess(res, { agent: safe });
}

// Get all agents (admin only)
async function handleGetAgents(req, res) {
  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = (data.agents || []).map(a => {
    const safe = { ...a };
    delete safe.password;
    return safe;
  });

  return sendSuccess(res, { agents });
}

// Create agent (admin only)
async function handleCreateAgent(req, res) {
  const adminId = req.headers['x-telegram-user-id'];
  if (adminId !== (process.env.TELEGRAM_ADMIN_ID || '1538232799')) {
    return sendError(res, 'Unauthorized', 403);
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const { telegramUserId, username, password } = JSON.parse(body);

  if (!telegramUserId || !username || !password) {
    return sendError(res, 'Telegram User ID, username, and password are required');
  }

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];

  // Check if telegram ID already exists
  if (agents.find(a => a.telegramUserId === telegramUserId)) {
    return sendError(res, 'An agent with this Telegram ID already exists');
  }

  // Check if username already exists
  if (agents.find(a => a.username.toLowerCase() === username.toLowerCase())) {
    return sendError(res, 'Username already taken');
  }

  const newAgent = {
    id: generateId(),
    telegramUserId: telegramUserId,
    username: username,
    password: password,
    balance: { MMK: 0, USD: 0, CNY: 0 },
    totalDeposited: { MMK: 0, USD: 0, CNY: 0 },
    totalWithdrawalsHandled: { MMK: 0, USD: 0, CNY: 0 },
    transactionHistory: [],
    depositedUsers: [],
    banned: false,
    online: false,
    lastLogin: null,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };

  agents.push(newAgent);
  const updated = await updateBin(BIN_AGENTS, { agents });
  if (!updated) return sendError(res, 'Failed to create agent', 500);

  const safe = { ...newAgent };
  delete safe.password;
  return sendSuccess(res, { agent: safe, message: 'Agent created successfully' });
}

// Update agent (admin only)
async function handleUpdateAgent(req, res) {
  const adminId = req.headers['x-telegram-user-id'];
  if (adminId !== (process.env.TELEGRAM_ADMIN_ID || '1538232799')) {
    return sendError(res, 'Unauthorized', 403);
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const { agentId, updates } = JSON.parse(body);

  if (!agentId) return sendError(res, 'Agent ID required');

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx === -1) return sendError(res, 'Agent not found', 404);

  const protectedFields = ['id', 'createdAt', 'telegramUserId'];
  Object.keys(updates).forEach(key => {
    if (!protectedFields.includes(key)) {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
        agents[idx][key] = { ...agents[idx][key], ...updates[key] };
      } else {
        agents[idx][key] = updates[key];
      }
    }
  });
  agents[idx].updatedAt = getTimestamp();

  await updateBin(BIN_AGENTS, { agents });

  const safe = { ...agents[idx] };
  delete safe.password;
  return sendSuccess(res, { agent: safe, message: 'Agent updated' });
}

// Delete agent (admin only)
async function handleDeleteAgent(req, res) {
  const adminId = req.headers['x-telegram-user-id'];
  if (adminId !== (process.env.TELEGRAM_ADMIN_ID || '1538232799')) {
    return sendError(res, 'Unauthorized', 403);
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const { agentId } = JSON.parse(body);

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = (data.agents || []).filter(a => a.id !== agentId);
  await updateBin(BIN_AGENTS, { agents });

  return sendSuccess(res, { message: 'Agent deleted' });
}

// Adjust agent balance (admin only)
async function handleAdjustAgentBalance(req, res) {
  const adminId = req.headers['x-telegram-user-id'];
  if (adminId !== (process.env.TELEGRAM_ADMIN_ID || '1538232799')) {
    return sendError(res, 'Unauthorized', 403);
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const { agentId, currency, amount, type } = JSON.parse(body);

  if (!agentId || !currency || amount === undefined || !type) {
    return sendError(res, 'All fields required');
  }
  if (!['MMK', 'USD', 'CNY'].includes(currency)) return sendError(res, 'Invalid currency');
  if (!['add', 'subtract'].includes(type)) return sendError(res, 'Type must be add or subtract');

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx === -1) return sendError(res, 'Agent not found', 404);

  if (type === 'add') {
    agents[idx].balance[currency] = (agents[idx].balance[currency] || 0) + amount;
  } else {
    agents[idx].balance[currency] = Math.max(0, (agents[idx].balance[currency] || 0) - amount);
  }

  // Record in history
  if (!agents[idx].transactionHistory) agents[idx].transactionHistory = [];
  agents[idx].transactionHistory.unshift({
    id: generateId(),
    type: type === 'add' ? 'admin_deposit' : 'admin_withdraw',
    currency: currency,
    amount: amount,
    note: `Admin ${type} ${amount} ${currency}`,
    timestamp: getTimestamp()
  });

  if (agents[idx].transactionHistory.length > 200) {
    agents[idx].transactionHistory = agents[idx].transactionHistory.slice(0, 200);
  }

  agents[idx].updatedAt = getTimestamp();
  await updateBin(BIN_AGENTS, { agents });

  return sendSuccess(res, {
    message: `${type === 'add' ? 'Added' : 'Subtracted'} ${amount} ${currency}`,
    newBalance: agents[idx].balance
  });
}

// Agent deposits to user
async function handleAgentDepositToUser(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { agentId, agentTelegramId, userId, currency, amount } = JSON.parse(body);

  if (!userId || !currency || !amount) {
    return sendError(res, 'User ID, currency, and amount are required');
  }
  if (!['MMK', 'USD', 'CNY'].includes(currency)) return sendError(res, 'Invalid currency');
  if (amount <= 0) return sendError(res, 'Amount must be positive');

  // Get agent
  const agentData = await readBin(BIN_AGENTS);
  if (!agentData) return sendError(res, 'Database error', 500);

  const agents = agentData.agents || [];
  let agentIdx = -1;

  if (agentId) {
    agentIdx = agents.findIndex(a => a.id === agentId);
  } else if (agentTelegramId) {
    agentIdx = agents.findIndex(a => a.telegramUserId === agentTelegramId);
  }

  if (agentIdx === -1) return sendError(res, 'Agent not found', 404);

  const agent = agents[agentIdx];

  // Check agent balance
  if ((agent.balance[currency] || 0) < amount) {
    return sendError(res, `Insufficient agent ${currency} balance. You have ${agent.balance[currency] || 0} ${currency}`);
  }

  // Get user
  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) return sendError(res, 'User not found', 404);

  // Deduct from agent
  agents[agentIdx].balance[currency] -= amount;
  agents[agentIdx].totalDeposited[currency] = (agents[agentIdx].totalDeposited[currency] || 0) + amount;

  // Track which users this agent deposited to
  if (!agents[agentIdx].depositedUsers) agents[agentIdx].depositedUsers = [];
  if (!agents[agentIdx].depositedUsers.includes(userId)) {
    agents[agentIdx].depositedUsers.push(userId);
  }

  // Record agent transaction
  if (!agents[agentIdx].transactionHistory) agents[agentIdx].transactionHistory = [];
  agents[agentIdx].transactionHistory.unshift({
    id: generateId(),
    type: 'deposit_to_user',
    userId: userId,
    username: users[userIdx].username,
    currency: currency,
    amount: amount,
    note: `Deposited ${amount} ${currency} to ${users[userIdx].username}`,
    timestamp: getTimestamp()
  });

  if (agents[agentIdx].transactionHistory.length > 200) {
    agents[agentIdx].transactionHistory = agents[agentIdx].transactionHistory.slice(0, 200);
  }

  agents[agentIdx].updatedAt = getTimestamp();
  await updateBin(BIN_AGENTS, { agents });

  // Add to user balance
  users[userIdx].balance[currency] = (users[userIdx].balance[currency] || 0) + amount;
  users[userIdx].totalDeposits[currency] = (users[userIdx].totalDeposits[currency] || 0) + amount;

  // Record who deposited (agent info)
  if (!users[userIdx].depositedByAgent) users[userIdx].depositedByAgent = {};
  users[userIdx].depositedByAgent[currency] = {
    agentId: agent.id,
    agentUsername: agent.username,
    lastDeposit: getTimestamp()
  };

  // Add to user deposit history
  if (!users[userIdx].depositHistory) users[userIdx].depositHistory = [];
  users[userIdx].depositHistory.unshift({
    depositId: generateId(),
    amount: amount,
    currency: currency,
    status: 'approved',
    source: 'agent',
    agentId: agent.id,
    agentUsername: agent.username,
    timestamp: getTimestamp()
  });

  users[userIdx].updatedAt = getTimestamp();
  await updateBin(CONFIG.BINS.USERS, { users });

  return sendSuccess(res, {
    message: `Successfully deposited ${amount} ${currency} to ${users[userIdx].username}`,
    agentBalance: agents[agentIdx].balance,
    userBalance: users[userIdx].balance[currency]
  });
}

// Get withdrawals for agent (users who were deposited by this agent)
async function handleGetAgentWithdrawals(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agentId');
  const telegramUserId = url.searchParams.get('telegramUserId');

  // Find agent
  const agentData = await readBin(BIN_AGENTS);
  if (!agentData) return sendError(res, 'Database error', 500);

  const agents = agentData.agents || [];
  let agent = null;

  if (agentId) {
    agent = agents.find(a => a.id === agentId);
  } else if (telegramUserId) {
    agent = agents.find(a => a.telegramUserId === telegramUserId);
  }

  if (!agent) return sendError(res, 'Agent not found', 404);

  // Get withdrawals
  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const allWithdrawals = wdData.withdrawals || [];

  // Filter withdrawals from users deposited by this agent
  const depositedUserIds = agent.depositedUsers || [];
  const agentWithdrawals = allWithdrawals.filter(w =>
    depositedUserIds.includes(w.userId) && w.agentId === agent.id
  );

  return sendSuccess(res, { withdrawals: agentWithdrawals });
}

// Agent approves withdrawal
async function handleApproveAgentWithdrawal(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { withdrawalId, agentId, agentTelegramId } = JSON.parse(body);

  if (!withdrawalId) return sendError(res, 'Withdrawal ID required');

  // Get agent
  const agentData = await readBin(BIN_AGENTS);
  if (!agentData) return sendError(res, 'Database error', 500);

  const agents = agentData.agents || [];
  let agentIdx = -1;

  if (agentId) {
    agentIdx = agents.findIndex(a => a.id === agentId);
  } else if (agentTelegramId) {
    agentIdx = agents.findIndex(a => a.telegramUserId === agentTelegramId);
  }

  if (agentIdx === -1) return sendError(res, 'Agent not found', 404);

  // Get withdrawal
  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const withdrawals = wdData.withdrawals || [];
  const wdIdx = withdrawals.findIndex(w => w.id === withdrawalId);
  if (wdIdx === -1) return sendError(res, 'Withdrawal not found', 404);

  if (withdrawals[wdIdx].status !== 'pending') {
    return sendError(res, 'Withdrawal already processed');
  }

  const currency = withdrawals[wdIdx].currency;
  const amount = withdrawals[wdIdx].amount;

  // Approve withdrawal - money goes to agent balance
  withdrawals[wdIdx].status = 'approved';
  withdrawals[wdIdx].approvedBy = 'agent';
  withdrawals[wdIdx].approvedByAgentId = agents[agentIdx].id;
  withdrawals[wdIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.WITHDRAWALS, { withdrawals });

  // Add money to agent balance
  agents[agentIdx].balance[currency] = (agents[agentIdx].balance[currency] || 0) + amount;
  agents[agentIdx].totalWithdrawalsHandled[currency] = (agents[agentIdx].totalWithdrawalsHandled[currency] || 0) + amount;

  // Record agent transaction
  if (!agents[agentIdx].transactionHistory) agents[agentIdx].transactionHistory = [];
  agents[agentIdx].transactionHistory.unshift({
    id: generateId(),
    type: 'user_withdrawal_approved',
    userId: withdrawals[wdIdx].userId,
    username: withdrawals[wdIdx].username,
    currency: currency,
    amount: amount,
    note: `Approved withdrawal ${amount} ${currency} from ${withdrawals[wdIdx].username}`,
    timestamp: getTimestamp()
  });

  agents[agentIdx].updatedAt = getTimestamp();
  await updateBin(BIN_AGENTS, { agents });

  // Update user withdrawal history
  const usersData = await readBin(CONFIG.BINS.USERS);
  if (usersData) {
    const users = usersData.users || [];
    const userIdx = users.findIndex(u => u.id === withdrawals[wdIdx].userId);
    if (userIdx !== -1) {
      users[userIdx].totalWithdrawals[currency] = (users[userIdx].totalWithdrawals[currency] || 0) + amount;
      const histIdx = (users[userIdx].withdrawHistory || []).findIndex(h => h.withdrawId === withdrawalId);
      if (histIdx !== -1) {
        users[userIdx].withdrawHistory[histIdx].status = 'approved';
      }
      users[userIdx].updatedAt = getTimestamp();
      await updateBin(CONFIG.BINS.USERS, { users });
    }
  }

  return sendSuccess(res, {
    message: `Withdrawal approved. ${amount} ${currency} added to your balance.`,
    agentBalance: agents[agentIdx].balance
  });
}

// Agent rejects withdrawal - refund to user
async function handleRejectAgentWithdrawal(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { withdrawalId, agentId, agentTelegramId, reason } = JSON.parse(body);

  if (!withdrawalId) return sendError(res, 'Withdrawal ID required');

  // Get agent
  const agentData = await readBin(BIN_AGENTS);
  if (!agentData) return sendError(res, 'Database error', 500);

  const agents = agentData.agents || [];
  let agentIdx = -1;

  if (agentId) {
    agentIdx = agents.findIndex(a => a.id === agentId);
  } else if (agentTelegramId) {
    agentIdx = agents.findIndex(a => a.telegramUserId === agentTelegramId);
  }

  if (agentIdx === -1) return sendError(res, 'Agent not found', 404);

  // Get withdrawal
  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const withdrawals = wdData.withdrawals || [];
  const wdIdx = withdrawals.findIndex(w => w.id === withdrawalId);
  if (wdIdx === -1) return sendError(res, 'Withdrawal not found', 404);

  if (withdrawals[wdIdx].status !== 'pending') {
    return sendError(res, 'Withdrawal already processed');
  }

  const currency = withdrawals[wdIdx].currency;
  const amount = withdrawals[wdIdx].amount;

  // Reject withdrawal
  withdrawals[wdIdx].status = 'rejected';
  withdrawals[wdIdx].adminNote = reason || 'Rejected by agent';
  withdrawals[wdIdx].rejectedBy = 'agent';
  withdrawals[wdIdx].rejectedByAgentId = agents[agentIdx].id;
  withdrawals[wdIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.WITHDRAWALS, { withdrawals });

  // Refund user balance
  const usersData = await readBin(CONFIG.BINS.USERS);
  if (usersData) {
    const users = usersData.users || [];
    const userIdx = users.findIndex(u => u.id === withdrawals[wdIdx].userId);
    if (userIdx !== -1) {
      users[userIdx].balance[currency] = (users[userIdx].balance[currency] || 0) + amount;
      const histIdx = (users[userIdx].withdrawHistory || []).findIndex(h => h.withdrawId === withdrawalId);
      if (histIdx !== -1) {
        users[userIdx].withdrawHistory[histIdx].status = 'rejected';
        users[userIdx].withdrawHistory[histIdx].reason = reason || 'Rejected by agent';
      }
      users[userIdx].updatedAt = getTimestamp();
      await updateBin(CONFIG.BINS.USERS, { users });
    }
  }

  // Record agent transaction
  if (!agents[agentIdx].transactionHistory) agents[agentIdx].transactionHistory = [];
  agents[agentIdx].transactionHistory.unshift({
    id: generateId(),
    type: 'user_withdrawal_rejected',
    userId: withdrawals[wdIdx].userId,
    username: withdrawals[wdIdx].username,
    currency: currency,
    amount: amount,
    note: `Rejected withdrawal ${amount} ${currency} from ${withdrawals[wdIdx].username}. Reason: ${reason || 'No reason'}`,
    timestamp: getTimestamp()
  });

  agents[agentIdx].updatedAt = getTimestamp();
  await updateBin(BIN_AGENTS, { agents });

  return sendSuccess(res, { message: 'Withdrawal rejected. User balance refunded.' });
}

// Get agent transaction history
async function handleGetAgentHistory(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agentId');
  const telegramUserId = url.searchParams.get('telegramUserId');

  const data = await readBin(BIN_AGENTS);
  if (!data) return sendError(res, 'Database error', 500);

  const agents = data.agents || [];
  let agent = null;

  if (agentId) {
    agent = agents.find(a => a.id === agentId);
  } else if (telegramUserId) {
    agent = agents.find(a => a.telegramUserId === telegramUserId);
  }

  if (!agent) return sendError(res, 'Agent not found', 404);

  return sendSuccess(res, { history: agent.transactionHistory || [] });
}

// Get users list for agent
async function handleGetUsersForAgent(req, res) {
  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = (usersData.users || []).map(u => ({
    id: u.id,
    username: u.username,
    phone: u.phone,
    email: u.email,
    balance: u.balance,
    vipLevel: u.vipLevel,
    depositedByAgent: u.depositedByAgent || {},
    online: u.online,
    createdAt: u.createdAt
  }));

  return sendSuccess(res, { users });
}
