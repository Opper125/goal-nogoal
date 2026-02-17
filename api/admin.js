const {
  CONFIG, readBin, updateBin, generateId, getTimestamp,
  corsHeaders, sendSuccess, sendError
} = require('./config');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const telegramUserId = req.headers['x-telegram-user-id'];
  if (telegramUserId !== CONFIG.TELEGRAM.ADMIN_ID) {
    res.status(404);
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!DOCTYPE html><html><head><title>404</title></head><body><h1>404 - Page Not Found</h1><p>The page you are looking for does not exist.</p></body></html>');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'approve-deposit': return await handleApproveDeposit(req, res);
      case 'reject-deposit': return await handleRejectDeposit(req, res);
      case 'approve-withdraw': return await handleApproveWithdraw(req, res);
      case 'reject-withdraw': return await handleRejectWithdraw(req, res);
      case 'create-payment': return await handleCreatePayment(req, res);
      case 'update-payment': return await handleUpdatePayment(req, res);
      case 'delete-payment': return await handleDeletePayment(req, res);
      case 'upload-video': return await handleUploadVideo(req, res);
      case 'delete-video': return await handleDeleteVideo(req, res);
      case 'update-controls': return await handleUpdateControls(req, res);
      case 'add-control-rule': return await handleAddControlRule(req, res);
      case 'delete-control-rule': return await handleDeleteControlRule(req, res);
      case 'toggle-controls': return await handleToggleControls(req, res);
      case 'ban-user': return await handleBanUser(req, res);
      case 'unban-user': return await handleUnbanUser(req, res);
      case 'adjust-balance': return await handleAdjustBalance(req, res);
      case 'create-contact': return await handleCreateContact(req, res);
      case 'update-contact': return await handleUpdateContact(req, res);
      case 'delete-contact': return await handleDeleteContact(req, res);
      case 'get-banned-users': return await handleGetBannedUsers(req, res);
      case 'get-pending-deposits': return await handleGetPendingDeposits(req, res);
      case 'get-pending-withdrawals': return await handleGetPendingWithdrawals(req, res);
      case 'set-vip': return await handleSetVip(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Admin error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handleApproveDeposit(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { depositId } = JSON.parse(body);

  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  if (!depositsData) return sendError(res, 'Database error', 500);

  const deposits = depositsData.deposits || [];
  const depIdx = deposits.findIndex(d => d.id === depositId);
  if (depIdx === -1) return sendError(res, 'Deposit not found', 404);

  if (deposits[depIdx].status !== 'pending') {
    return sendError(res, 'Deposit has already been processed');
  }

  deposits[depIdx].status = 'approved';
  deposits[depIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.DEPOSITS, { deposits });

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const userIdx = users.findIndex(u => u.id === deposits[depIdx].userId);

  if (userIdx !== -1) {
    const currency = deposits[depIdx].currency;
    const amount = deposits[depIdx].amount;

    users[userIdx].balance[currency] = (users[userIdx].balance[currency] || 0) + amount;
    users[userIdx].totalDeposits[currency] = (users[userIdx].totalDeposits[currency] || 0) + amount;

    const histIdx = (users[userIdx].depositHistory || []).findIndex(h => h.depositId === depositId);
    if (histIdx !== -1) {
      users[userIdx].depositHistory[histIdx].status = 'approved';
    }

    users[userIdx].updatedAt = getTimestamp();
    await updateBin(CONFIG.BINS.USERS, { users });
  }

  return sendSuccess(res, { message: 'Deposit approved', deposit: deposits[depIdx] });
}

async function handleRejectDeposit(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { depositId, reason } = JSON.parse(body);

  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  if (!depositsData) return sendError(res, 'Database error', 500);

  const deposits = depositsData.deposits || [];
  const depIdx = deposits.findIndex(d => d.id === depositId);
  if (depIdx === -1) return sendError(res, 'Deposit not found', 404);

  deposits[depIdx].status = 'rejected';
  deposits[depIdx].adminNote = reason || 'Rejected by admin';
  deposits[depIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.DEPOSITS, { deposits });

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (usersData) {
    const users = usersData.users || [];
    const userIdx = users.findIndex(u => u.id === deposits[depIdx].userId);
    if (userIdx !== -1) {
      const histIdx = (users[userIdx].depositHistory || []).findIndex(h => h.depositId === depositId);
      if (histIdx !== -1) {
        users[userIdx].depositHistory[histIdx].status = 'rejected';
        users[userIdx].depositHistory[histIdx].reason = reason || 'Rejected by admin';
      }
      users[userIdx].updatedAt = getTimestamp();
      await updateBin(CONFIG.BINS.USERS, { users });
    }
  }

  return sendSuccess(res, { message: 'Deposit rejected', deposit: deposits[depIdx] });
}

async function handleApproveWithdraw(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { withdrawalId } = JSON.parse(body);

  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const withdrawals = wdData.withdrawals || [];
  const wdIdx = withdrawals.findIndex(w => w.id === withdrawalId);
  if (wdIdx === -1) return sendError(res, 'Withdrawal not found', 404);

  if (withdrawals[wdIdx].status !== 'pending') {
    return sendError(res, 'Withdrawal has already been processed');
  }

  withdrawals[wdIdx].status = 'approved';
  withdrawals[wdIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.WITHDRAWALS, { withdrawals });

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (usersData) {
    const users = usersData.users || [];
    const userIdx = users.findIndex(u => u.id === withdrawals[wdIdx].userId);
    if (userIdx !== -1) {
      const currency = withdrawals[wdIdx].currency;
      users[userIdx].totalWithdrawals[currency] = (users[userIdx].totalWithdrawals[currency] || 0) + withdrawals[wdIdx].amount;

      const histIdx = (users[userIdx].withdrawHistory || []).findIndex(h => h.withdrawId === withdrawalId);
      if (histIdx !== -1) {
        users[userIdx].withdrawHistory[histIdx].status = 'approved';
      }
      users[userIdx].updatedAt = getTimestamp();
      await updateBin(CONFIG.BINS.USERS, { users });
    }
  }

  return sendSuccess(res, { message: 'Withdrawal approved', withdrawal: withdrawals[wdIdx] });
}

async function handleRejectWithdraw(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { withdrawalId, reason } = JSON.parse(body);

  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const withdrawals = wdData.withdrawals || [];
  const wdIdx = withdrawals.findIndex(w => w.id === withdrawalId);
  if (wdIdx === -1) return sendError(res, 'Withdrawal not found', 404);

  withdrawals[wdIdx].status = 'rejected';
  withdrawals[wdIdx].adminNote = reason || 'Rejected by admin';
  withdrawals[wdIdx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.WITHDRAWALS, { withdrawals });

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (usersData) {
    const users = usersData.users || [];
    const userIdx = users.findIndex(u => u.id === withdrawals[wdIdx].userId);
    if (userIdx !== -1) {
      const currency = withdrawals[wdIdx].currency;
      users[userIdx].balance[currency] = (users[userIdx].balance[currency] || 0) + withdrawals[wdIdx].amount;

      const histIdx = (users[userIdx].withdrawHistory || []).findIndex(h => h.withdrawId === withdrawalId);
      if (histIdx !== -1) {
        users[userIdx].withdrawHistory[histIdx].status = 'rejected';
        users[userIdx].withdrawHistory[histIdx].reason = reason || 'Rejected by admin';
      }
      users[userIdx].updatedAt = getTimestamp();
      await updateBin(CONFIG.BINS.USERS, { users });
    }
  }

  return sendSuccess(res, { message: 'Withdrawal rejected and balance refunded', withdrawal: withdrawals[wdIdx] });
}

async function handleCreatePayment(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { currency, name, address, note, iconUrl, qrCodeUrl } = JSON.parse(body);

  if (!currency || !name) return sendError(res, 'Currency and name are required');
  if (!['MMK', 'USD', 'CNY'].includes(currency)) return sendError(res, 'Invalid currency');

  const paymentsData = await readBin(CONFIG.BINS.PAYMENTS);
  if (!paymentsData) return sendError(res, 'Database error', 500);

  const payments = paymentsData.payments || { MMK: [], USD: [], CNY: [] };

  const newPayment = {
    id: generateId(),
    name: name,
    address: address || '',
    note: note || '',
    iconUrl: iconUrl || '',
    qrCodeUrl: qrCodeUrl || '',
    currency: currency,
    active: true,
    createdAt: getTimestamp()
  };

  payments[currency].push(newPayment);
  await updateBin(CONFIG.BINS.PAYMENTS, { payments });

  return sendSuccess(res, { message: 'Payment method created', payment: newPayment });
}

async function handleUpdatePayment(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { paymentId, currency, updates } = JSON.parse(body);

  if (!paymentId || !currency) return sendError(res, 'paymentId and currency required');

  const paymentsData = await readBin(CONFIG.BINS.PAYMENTS);
  if (!paymentsData) return sendError(res, 'Database error', 500);

  const payments = paymentsData.payments || { MMK: [], USD: [], CNY: [] };
  const idx = payments[currency].findIndex(p => p.id === paymentId);
  if (idx === -1) return sendError(res, 'Payment not found', 404);

  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'createdAt') {
      payments[currency][idx][key] = updates[key];
    }
  });

  await updateBin(CONFIG.BINS.PAYMENTS, { payments });
  return sendSuccess(res, { message: 'Payment updated', payment: payments[currency][idx] });
}

async function handleDeletePayment(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { paymentId, currency } = JSON.parse(body);

  const paymentsData = await readBin(CONFIG.BINS.PAYMENTS);
  if (!paymentsData) return sendError(res, 'Database error', 500);

  const payments = paymentsData.payments || { MMK: [], USD: [], CNY: [] };
  payments[currency] = payments[currency].filter(p => p.id !== paymentId);

  await updateBin(CONFIG.BINS.PAYMENTS, { payments });
  return sendSuccess(res, { message: 'Payment deleted' });
}

async function handleUploadVideo(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { type, url, name } = JSON.parse(body);

  if (!type || !url) return sendError(res, 'Type and URL required');
  if (!['goal', 'nogoal'].includes(type)) return sendError(res, 'Type must be "goal" or "nogoal"');

  const videosData = await readBin(CONFIG.BINS.GAME_VIDEOS);
  if (!videosData) return sendError(res, 'Database error', 500);

  const videos = videosData.videos || { goal: [], nogoal: [] };

  const newVideo = {
    id: generateId(),
    type: type,
    url: url,
    name: name || `${type}_video_${videos[type].length + 1}`,
    createdAt: getTimestamp()
  };

  videos[type].push(newVideo);
  await updateBin(CONFIG.BINS.GAME_VIDEOS, { videos });

  return sendSuccess(res, { message: 'Video added', video: newVideo });
}

async function handleDeleteVideo(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { videoId, type } = JSON.parse(body);

  const videosData = await readBin(CONFIG.BINS.GAME_VIDEOS);
  if (!videosData) return sendError(res, 'Database error', 500);

  const videos = videosData.videos || { goal: [], nogoal: [] };
  videos[type] = videos[type].filter(v => v.id !== videoId);

  await updateBin(CONFIG.BINS.GAME_VIDEOS, { videos });
  return sendSuccess(res, { message: 'Video deleted' });
}

async function handleUpdateControls(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { controls } = JSON.parse(body);

  await updateBin(CONFIG.BINS.GAME_CONTROLS, { controls });
  return sendSuccess(res, { message: 'Controls updated', controls });
}

async function handleAddControlRule(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { rule } = JSON.parse(body);

  if (!rule) return sendError(res, 'Rule data required');

  const controlsData = await readBin(CONFIG.BINS.GAME_CONTROLS);
  if (!controlsData) return sendError(res, 'Database error', 500);

  const controls = controlsData.controls || { enabled: false, rules: [] };

  const newRule = {
    id: generateId(),
    type: rule.type || 'exact',
    betChoice: rule.betChoice || 'any',
    currency: rule.currency || 'MMK',
    betAmount: rule.betAmount || 0,
    minAmount: rule.minAmount || 0,
    maxAmount: rule.maxAmount || 0,
    action: rule.action || 'lose',
    active: true,
    createdAt: getTimestamp()
  };

  controls.rules.push(newRule);
  await updateBin(CONFIG.BINS.GAME_CONTROLS, { controls });

  return sendSuccess(res, { message: 'Control rule added', rule: newRule });
}

async function handleDeleteControlRule(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { ruleId } = JSON.parse(body);

  const controlsData = await readBin(CONFIG.BINS.GAME_CONTROLS);
  if (!controlsData) return sendError(res, 'Database error', 500);

  const controls = controlsData.controls || { enabled: false, rules: [] };
  controls.rules = controls.rules.filter(r => r.id !== ruleId);

  await updateBin(CONFIG.BINS.GAME_CONTROLS, { controls });
  return sendSuccess(res, { message: 'Control rule deleted' });
}

async function handleToggleControls(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { enabled } = JSON.parse(body);

  const controlsData = await readBin(CONFIG.BINS.GAME_CONTROLS);
  if (!controlsData) return sendError(res, 'Database error', 500);

  const controls = controlsData.controls || { enabled: false, rules: [] };
  controls.enabled = !!enabled;

  await updateBin(CONFIG.BINS.GAME_CONTROLS, { controls });
  return sendSuccess(res, { message: `Game controls ${controls.enabled ? 'enabled' : 'disabled'}`, enabled: controls.enabled });
}

async function handleBanUser(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, reason } = JSON.parse(body);

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return sendError(res, 'User not found', 404);

  users[idx].bannedStatus = {
    isBanned: true,
    reason: reason || 'Banned by admin',
    bannedAt: getTimestamp(),
    bannedIPs: [users[idx].ipAddress].filter(Boolean),
    bannedDevices: [users[idx].deviceId].filter(Boolean)
  };
  users[idx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.USERS, { users });
  return sendSuccess(res, { message: `User ${users[idx].username} has been banned` });
}

async function handleUnbanUser(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId } = JSON.parse(body);

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return sendError(res, 'User not found', 404);

  users[idx].bannedStatus = {
    isBanned: false,
    reason: '',
    bannedAt: null,
    bannedIPs: [],
    bannedDevices: []
  };
  users[idx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.USERS, { users });
  return sendSuccess(res, { message: `User ${users[idx].username} has been unbanned` });
}

async function handleAdjustBalance(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, currency, amount, type } = JSON.parse(body);

  if (!userId || !currency || amount === undefined || !type) {
    return sendError(res, 'userId, currency, amount, and type are required');
  }

  if (!['add', 'subtract'].includes(type)) {
    return sendError(res, 'Type must be "add" or "subtract"');
  }

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return sendError(res, 'User not found', 404);

  if (type === 'add') {
    users[idx].balance[currency] = (users[idx].balance[currency] || 0) + amount;
  } else {
    users[idx].balance[currency] = Math.max(0, (users[idx].balance[currency] || 0) - amount);
  }

  users[idx].updatedAt = getTimestamp();
  await updateBin(CONFIG.BINS.USERS, { users });

  return sendSuccess(res, {
    message: `Balance ${type === 'add' ? 'added' : 'subtracted'}: ${amount} ${currency}`,
    newBalance: users[idx].balance
  });
}

async function handleCreateContact(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { name, imgUrl, link, address, type } = JSON.parse(body);

  if (!name) return sendError(res, 'Name is required');

  const contactsData = await readBin(CONFIG.BINS.CONTACTS);
  if (!contactsData) return sendError(res, 'Database error', 500);

  const contacts = contactsData.contacts || [];

  const newContact = {
    id: generateId(),
    name: name,
    imgUrl: imgUrl || '',
    link: link || '',
    address: address || '',
    type: type || 'link',
    createdAt: getTimestamp()
  };

  contacts.push(newContact);
  await updateBin(CONFIG.BINS.CONTACTS, { contacts });

  return sendSuccess(res, { message: 'Contact created', contact: newContact });
}

async function handleUpdateContact(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { contactId, updates } = JSON.parse(body);

  const contactsData = await readBin(CONFIG.BINS.CONTACTS);
  if (!contactsData) return sendError(res, 'Database error', 500);

  const contacts = contactsData.contacts || [];
  const idx = contacts.findIndex(c => c.id === contactId);
  if (idx === -1) return sendError(res, 'Contact not found', 404);

  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'createdAt') {
      contacts[idx][key] = updates[key];
    }
  });

  await updateBin(CONFIG.BINS.CONTACTS, { contacts });
  return sendSuccess(res, { message: 'Contact updated', contact: contacts[idx] });
}

async function handleDeleteContact(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { contactId } = JSON.parse(body);

  const contactsData = await readBin(CONFIG.BINS.CONTACTS);
  if (!contactsData) return sendError(res, 'Database error', 500);

  const contacts = (contactsData.contacts || []).filter(c => c.id !== contactId);
  await updateBin(CONFIG.BINS.CONTACTS, { contacts });

  return sendSuccess(res, { message: 'Contact deleted' });
}

async function handleGetBannedUsers(req, res) {
  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const bannedUsers = (usersData.users || [])
    .filter(u => u.bannedStatus?.isBanned)
    .map(u => ({
      id: u.id,
      username: u.username,
      phone: u.phone,
      email: u.email,
      reason: u.bannedStatus.reason,
      bannedAt: u.bannedStatus.bannedAt,
      ipAddress: u.ipAddress
    }));

  return sendSuccess(res, { bannedUsers });
}

async function handleGetPendingDeposits(req, res) {
  const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
  if (!depositsData) return sendError(res, 'Database error', 500);

  const pending = (depositsData.deposits || []).filter(d => d.status === 'pending');
  return sendSuccess(res, { deposits: pending });
}

async function handleGetPendingWithdrawals(req, res) {
  const wdData = await readBin(CONFIG.BINS.WITHDRAWALS);
  if (!wdData) return sendError(res, 'Database error', 500);

  const pending = (wdData.withdrawals || []).filter(w => w.status === 'pending');
  return sendSuccess(res, { withdrawals: pending });
}

async function handleSetVip(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { userId, vipLevel } = JSON.parse(body);

  if (!['VIP', 'VVIP', 'VVIP_KING'].includes(vipLevel)) {
    return sendError(res, 'Invalid VIP level');
  }

  const usersData = await readBin(CONFIG.BINS.USERS);
  if (!usersData) return sendError(res, 'Database error', 500);

  const users = usersData.users || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return sendError(res, 'User not found', 404);

  users[idx].vipLevel = vipLevel;
  users[idx].updatedAt = getTimestamp();

  await updateBin(CONFIG.BINS.USERS, { users });
  return sendSuccess(res, { message: `User VIP level set to ${vipLevel}` });
}
