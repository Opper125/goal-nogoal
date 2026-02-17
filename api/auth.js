const {
  CONFIG, readBin, updateBin, checkGmail, generateId,
  getTimestamp, corsHeaders, sendSuccess, sendError,
  validatePassword, validateUsername, validateEmail
} = require('./config');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'register': return await handleRegister(req, res);
      case 'login': return await handleLogin(req, res);
      case 'check-username': return await handleCheckUsername(req, res);
      case 'check-email': return await handleCheckEmail(req, res);
      case 'check-phone': return await handleCheckPhone(req, res);
      case 'verify-gmail': return await handleVerifyGmail(req, res);
      case 'get-user': return await handleGetUser(req, res);
      case 'check-ban': return await handleCheckBan(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Auth error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handleRegister(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { phone, password, username, email, deviceId, ipAddress } = JSON.parse(body);

  if (!phone || !password || !username || !email) {
    return sendError(res, 'All fields are required');
  }

  const phoneRegex = /^[0-9]{6,15}$/;
  if (!phoneRegex.test(phone)) {
    return sendError(res, 'Invalid phone number format');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.valid) return sendError(res, passCheck.message);

  const userCheck = validateUsername(username);
  if (!userCheck.valid) return sendError(res, userCheck.message);

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return sendError(res, emailCheck.message);

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];

  const existPhone = users.find(u => u.phone === phone);
  if (existPhone) return sendError(res, 'Phone number already registered');

  const existUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existUser) return sendError(res, 'Username already taken');

  const existEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existEmail) return sendError(res, 'Email already registered');

  try {
    const gmailResult = await checkGmail(email);
    if (gmailResult && gmailResult.result === 'invalid') {
      return sendError(res, 'This Gmail address does not exist on Google');
    }
  } catch (e) {
    console.error('Gmail check failed:', e);
  }

  const now = getTimestamp();
  const newUser = {
    id: generateId(),
    phone: phone,
    password: password,
    username: username,
    email: email,
    balance: { MMK: 0, USD: 0, CNY: 0 },
    activeCurrency: 'MMK',
    vipLevel: 'VIP',
    vvipCurrencies: { MMK: false, USD: false, CNY: false },
    totalDeposits: { MMK: 0, USD: 0, CNY: 0 },
    totalWithdrawals: { MMK: 0, USD: 0, CNY: 0 },
    totalWinnings: { MMK: 0, USD: 0, CNY: 0 },
    totalLosses: { MMK: 0, USD: 0, CNY: 0 },
    totalTurnover: { MMK: 0, USD: 0, CNY: 0 },
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    totalGamesLost: 0,
    gameHistory: [],
    depositHistory: [],
    withdrawHistory: [],
    claimedRewards: [],
    pendingClaimBet: null,
    bannedStatus: {
      isBanned: false,
      reason: '',
      bannedAt: null,
      bannedIPs: [],
      bannedDevices: []
    },
    fraudAttempts: [],
    todayWithdrawCount: 0,
    lastWithdrawDate: null,
    online: true,
    deviceId: deviceId || '',
    ipAddress: ipAddress || '',
    lastLogin: now,
    createdAt: now,
    updatedAt: now
  };

  users.push(newUser);
  const updated = await updateBin(CONFIG.BINS.USERS, { users });
  if (!updated) return sendError(res, 'Failed to save user', 500);

  const safeUser = { ...newUser };
  delete safeUser.password;

  return sendSuccess(res, { user: safeUser, message: 'Account created successfully' });
}

async function handleLogin(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { phone, password, deviceId, ipAddress } = JSON.parse(body);

  if (!phone || !password) {
    return sendError(res, 'Phone and password are required');
  }

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const userIndex = users.findIndex(u => u.phone === phone);

  if (userIndex === -1) return sendError(res, 'Account not found');

  const user = users[userIndex];

  if (user.bannedStatus && user.bannedStatus.isBanned) {
    return sendError(res, 'Your account has been banned. Contact admin for support.', 403);
  }

  if (user.password !== password) {
    return sendError(res, 'Incorrect password');
  }

  const now = getTimestamp();
  users[userIndex].online = true;
  users[userIndex].lastLogin = now;
  users[userIndex].updatedAt = now;

  if (deviceId) users[userIndex].deviceId = deviceId;
  if (ipAddress) users[userIndex].ipAddress = ipAddress;

  const today = new Date().toDateString();
  const lastWd = users[userIndex].lastWithdrawDate;
  if (!lastWd || new Date(lastWd).toDateString() !== today) {
    users[userIndex].todayWithdrawCount = 0;
    users[userIndex].lastWithdrawDate = now;
  }

  await updateBin(CONFIG.BINS.USERS, { users });

  const safeUser = { ...users[userIndex] };
  delete safeUser.password;

  return sendSuccess(res, { user: safeUser, message: 'Login successful' });
}

async function handleCheckUsername(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('username');

  if (!username) return sendError(res, 'Username is required');

  const userCheck = validateUsername(username);
  if (!userCheck.valid) return sendSuccess(res, { available: false, message: userCheck.message });

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());

  return sendSuccess(res, {
    available: !exists,
    message: exists ? 'Username already taken' : 'Username is available'
  });
}

async function handleCheckEmail(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const email = url.searchParams.get('email');

  if (!email) return sendError(res, 'Email is required');

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return sendSuccess(res, { available: false, message: emailCheck.message });

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());

  return sendSuccess(res, {
    available: !exists,
    message: exists ? 'Email already registered' : 'Email is available'
  });
}

async function handleCheckPhone(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const phone = url.searchParams.get('phone');

  if (!phone) return sendError(res, 'Phone is required');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const exists = users.some(u => u.phone === phone);

  return sendSuccess(res, {
    available: !exists,
    message: exists ? 'Phone number already registered' : 'Phone number is available'
  });
}

async function handleVerifyGmail(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const email = url.searchParams.get('email');

  if (!email) return sendError(res, 'Email is required');

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return sendSuccess(res, { valid: false, message: emailCheck.message });

  try {
    const result = await checkGmail(email);
    const isValid = result && result.result !== 'invalid';
    return sendSuccess(res, {
      valid: isValid,
      message: isValid ? 'Gmail is valid and exists on Google' : 'This Gmail does not exist on Google',
      details: result
    });
  } catch (err) {
    return sendSuccess(res, { valid: false, message: 'Unable to verify Gmail at this time' });
  }
}

async function handleGetUser(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) return sendError(res, 'User ID is required');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];
  const user = users.find(u => u.id === userId);

  if (!user) return sendError(res, 'User not found', 404);

  if (user.bannedStatus && user.bannedStatus.isBanned) {
    return sendError(res, 'Account is banned', 403);
  }

  const safeUser = { ...user };
  delete safeUser.password;

  return sendSuccess(res, { user: safeUser });
}

async function handleCheckBan(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  const ipAddress = url.searchParams.get('ip');
  const deviceId = url.searchParams.get('deviceId');

  const data = await readBin(CONFIG.BINS.USERS);
  if (!data) return sendError(res, 'Database error', 500);

  const users = data.users || [];

  let banned = false;
  let reason = '';

  if (userId) {
    const user = users.find(u => u.id === userId);
    if (user && user.bannedStatus && user.bannedStatus.isBanned) {
      banned = true;
      reason = user.bannedStatus.reason || 'Account banned';
    }
  }

  if (!banned && ipAddress) {
    const bannedUser = users.find(u =>
      u.bannedStatus && u.bannedStatus.isBanned &&
      (u.ipAddress === ipAddress ||
        (u.bannedStatus.bannedIPs && u.bannedStatus.bannedIPs.includes(ipAddress)))
    );
    if (bannedUser) {
      banned = true;
      reason = 'IP address is banned';
    }
  }

  if (!banned && deviceId) {
    const bannedUser = users.find(u =>
      u.bannedStatus && u.bannedStatus.isBanned &&
      (u.deviceId === deviceId ||
        (u.bannedStatus.bannedDevices && u.bannedStatus.bannedDevices.includes(deviceId)))
    );
    if (bannedUser) {
      banned = true;
      reason = 'Device is banned';
    }
  }

  return sendSuccess(res, { banned, reason });
}
