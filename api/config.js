const fetch = require('node-fetch');

const CONFIG = {
  JSONBIN_API_KEY: process.env.JSONBIN_API_KEY || '$2a$10$G4ArcYwbjfH6p1wSxZtR3.w7VfM7HW8E5JRyXp/u7EWVaJZZe7vue',
  BINS: {
    USERS: process.env.BIN_USERS || '69946d1d43b1c97be985ec60',
    DEPOSITS: process.env.BIN_DEPOSITS || '69946d3b43b1c97be985ec9f',
    WITHDRAWALS: process.env.BIN_WITHDRAWALS || '69946d53d0ea881f40c14dbd',
    PAYMENTS: process.env.BIN_PAYMENTS || '69946d6743b1c97be985ecfe',
    GAME_VIDEOS: process.env.BIN_GAME_VIDEOS || '69946d8243b1c97be985ed53',
    GAME_CONTROLS: process.env.BIN_GAME_CONTROLS || '69946d9943b1c97be985ed8b',
    CONTACTS: process.env.BIN_CONTACTS || '69946dabd0ea881f40c14eba',
    AGENTS: process.env.BIN_AGENTS || '6995715ad0ea881f40c33b22'
  },
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8532065930:AAHyQgfa-YQn3L4jK17mXf5XM_1YHbwmM_M',
    ADMIN_ID: process.env.TELEGRAM_ADMIN_ID || '1538232799',
    ADMIN_USERNAME: '@OPPER101',
    AGENT_BOT_TOKEN: process.env.AGENT_BOT_TOKEN || '7872785824:AAEy4VZkXDaUE3-3Bzo2kq_Ava_QZALXYBo'
  },
  GMAIL_API: {
    KEY: process.env.GMAIL_API_KEY || 'e9dca4286emsh4d7cdfebdedad21p12269cjsn0581391f6ed3',
    HOST: 'gmail-valid-email-checker-api.p.rapidapi.com'
  },
  LIMITS: {
    MMK: { DEPOSIT_MIN: 10000, DEPOSIT_MAX: 1000000, WITHDRAW_MIN: 10000, WITHDRAW_MAX: 1000000, BET_MIN: 1000, BET_MAX: 24681098 },
    USD: { DEPOSIT_MIN: 10, DEPOSIT_MAX: 10000, WITHDRAW_MIN: 10, WITHDRAW_MAX: 10000, BET_MIN: 1, BET_MAX: 28038 },
    CNY: { DEPOSIT_MIN: 50, DEPOSIT_MAX: 10000, WITHDRAW_MIN: 100, WITHDRAW_MAX: 100000, BET_MIN: 5, BET_MAX: 2890300 }
  },
  VIP: {
    VIP_WITHDRAW_LIMIT: 5,
    VVIP_WITHDRAW_LIMIT: 10,
    VVIP_KING_WITHDRAW_LIMIT: 999999,
    VVIP_REQUIREMENTS: { MMK: 1000000, USD: 1000, CNY: 2000 },
    CLAIM_REWARDS: { MMK: 1000000, USD: 500, CNY: 1000 },
    CLAIM_MIN_BET: { MMK: 100000, USD: 100, CNY: 200 }
  },
  TURNOVER_MULTIPLIER: 1,
  BAN_THRESHOLD: 3,
  BAN_WINDOW_HOURS: 24
};

async function readBin(binId) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: {
          'X-Master-Key': CONFIG.JSONBIN_API_KEY,
          'X-Bin-Meta': 'false'
        }
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`readBin error for ${binId} (attempt ${attempt + 1}):`, errText);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error(`readBin exception (attempt ${attempt + 1}):`, err);
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function updateBin(binId, data) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.JSONBIN_API_KEY
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`updateBin error for ${binId} (attempt ${attempt + 1}):`, errText);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error(`updateBin exception (attempt ${attempt + 1}):`, err);
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return false;
    }
  }
  return false;
}

async function checkGmail(email) {
  try {
    const res = await fetch(
      `https://gmail-valid-email-checker-api.p.rapidapi.com/check_email.php?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'x-rapidapi-key': CONFIG.GMAIL_API.KEY,
          'x-rapidapi-host': CONFIG.GMAIL_API.HOST
        }
      }
    );
    if (!res.ok) return { valid: false, error: 'API error' };
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('checkGmail error:', err);
    return { valid: false, error: err.message };
  }
}

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getTimestamp() {
  return new Date().toISOString();
}

function getTodayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function isWithin24Hours(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff < 24 * 60 * 60 * 1000;
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getYearStart() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-User-Id',
    'Content-Type': 'application/json'
  };
}

function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json({ success: true, ...data });
}

function sendError(res, message, statusCode = 400) {
  res.status(statusCode).json({ success: false, error: message });
}

function validatePassword(password) {
  if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { valid: false, message: 'Password must contain at least one special character' };
  return { valid: true };
}

function validateUsername(username) {
  if (!username || username.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
  if (/\s/.test(username)) return { valid: false, message: 'Username must not contain spaces' };
  if (!/^[a-zA-Z0-9]+$/.test(username)) return { valid: false, message: 'Username must contain only English letters and numbers' };
  return { valid: true };
}

function validateEmail(email) {
  if (!email) return { valid: false, message: 'Email is required' };
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) return { valid: false, message: 'Must be a valid Gmail address' };
  return { valid: true };
}

function calculateVipLevel(user) {
  const winnings = user.totalWinnings || { MMK: 0, USD: 0, CNY: 0 };
  const req = CONFIG.VIP.VVIP_REQUIREMENTS;
  const allMet = winnings.MMK >= req.MMK && winnings.USD >= req.USD && winnings.CNY >= req.CNY;
  if (allMet) return 'VVIP_KING';
  const anyMet = winnings.MMK >= req.MMK || winnings.USD >= req.USD || winnings.CNY >= req.CNY;
  if (anyMet) return 'VVIP';
  return 'VIP';
}

function getWithdrawLimit(vipLevel) {
  switch (vipLevel) {
    case 'VVIP_KING': return CONFIG.VIP.VVIP_KING_WITHDRAW_LIMIT;
    case 'VVIP': return CONFIG.VIP.VVIP_WITHDRAW_LIMIT;
    default: return CONFIG.VIP.VIP_WITHDRAW_LIMIT;
  }
}

function checkTurnover(user, currency) {
  const totalDeposits = user.totalDeposits?.[currency] || 0;
  const totalTurnover = user.totalTurnover?.[currency] || 0;
  const required = totalDeposits * CONFIG.TURNOVER_MULTIPLIER;
  const remaining = Math.max(0, required - totalTurnover);
  return {
    met: remaining <= 0,
    required: required,
    current: totalTurnover,
    remaining: remaining
  };
}

module.exports = {
  CONFIG,
  readBin,
  updateBin,
  checkGmail,
  generateId,
  getTimestamp,
  getTodayStart,
  isWithin24Hours,
  getMonthStart,
  getYearStart,
  corsHeaders,
  sendSuccess,
  sendError,
  validatePassword,
  validateUsername,
  validateEmail,
  calculateVipLevel,
  getWithdrawLimit,
  checkTurnover
};
