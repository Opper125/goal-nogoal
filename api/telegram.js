const {
  CONFIG, readBin, updateBin, corsHeaders, sendSuccess, sendError
} = require('./config');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'verify': return await handleVerify(req, res);
      case 'webhook': return await handleWebhook(req, res);
      case 'send-notification': return await handleSendNotification(req, res);
      default: return sendError(res, 'Invalid action', 400);
    }
  } catch (err) {
    console.error('Telegram error:', err);
    return sendError(res, 'Server error', 500);
  }
};

async function handleVerify(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const telegramUserId = url.searchParams.get('telegramUserId');

  if (!telegramUserId) {
    return sendError(res, 'Telegram User ID required');
  }

  const isAdmin = telegramUserId === CONFIG.TELEGRAM.ADMIN_ID;

  if (!isAdmin) {
    res.status(404);
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!DOCTYPE html><html><head><title>404</title></head><body><h1>404 - Page Not Found</h1><p>The page you are looking for does not exist.</p></body></html>');
  }

  return sendSuccess(res, {
    verified: true,
    isAdmin: true,
    adminUsername: CONFIG.TELEGRAM.ADMIN_USERNAME,
    message: 'Admin verified successfully'
  });
}

async function handleWebhook(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;

  try {
    const update = JSON.parse(body);

    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id.toString();
      const text = update.message.text || '';

      if (userId === CONFIG.TELEGRAM.ADMIN_ID) {
        if (text === '/start') {
          await sendTelegramMessage(chatId,
            '🎯 *GOAL OR NO GOAL - Admin Panel*\n\n' +
            'Welcome Admin! Use the Mini App button below to access the admin panel.\n\n' +
            '📊 Commands:\n' +
            '/stats - View statistics\n' +
            '/pending - View pending requests\n' +
            '/banned - View banned users\n' +
            '/users - View total users',
            {
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🎮 Open Admin Panel',
                    web_app: { url: `https://${req.headers.host}/admin.html` }
                  }
                ]]
              }
            }
          );
        } else if (text === '/stats') {
          await handleStatsCommand(chatId);
        } else if (text === '/pending') {
          await handlePendingCommand(chatId);
        } else if (text === '/banned') {
          await handleBannedCommand(chatId);
        } else if (text === '/users') {
          await handleUsersCommand(chatId);
        }
      } else {
        await sendTelegramMessage(chatId,
          '⚠️ Access Denied.\n\nThis bot is restricted to authorized administrators only.'
        );
      }
    }

    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const userId = update.callback_query.from.id.toString();

      if (userId === CONFIG.TELEGRAM.ADMIN_ID) {
        await handleCallbackQuery(chatId, callbackData);
      }

      await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
}

async function handleStatsCommand(chatId) {
  try {
    const usersData = await readBin(CONFIG.BINS.USERS);
    const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
    const withdrawalsData = await readBin(CONFIG.BINS.WITHDRAWALS);

    const users = usersData?.users || [];
    const deposits = depositsData?.deposits || [];
    const withdrawals = withdrawalsData?.withdrawals || [];

    const totalUsers = users.length;
    const bannedCount = users.filter(u => u.bannedStatus?.isBanned).length;
    const pendingDep = deposits.filter(d => d.status === 'pending').length;
    const pendingWd = withdrawals.filter(w => w.status === 'pending').length;

    let totalGames = 0;
    users.forEach(u => { totalGames += u.totalGamesPlayed || 0; });

    const approvedDeps = deposits.filter(d => d.status === 'approved');
    const approvedWds = withdrawals.filter(w => w.status === 'approved');

    let depSums = { MMK: 0, USD: 0, CNY: 0 };
    let wdSums = { MMK: 0, USD: 0, CNY: 0 };

    approvedDeps.forEach(d => { depSums[d.currency] = (depSums[d.currency] || 0) + d.amount; });
    approvedWds.forEach(w => { wdSums[w.currency] = (wdSums[w.currency] || 0) + w.amount; });

    const msg =
      `📊 *STATISTICS*\n\n` +
      `👥 Total Users: ${totalUsers}\n` +
      `🚫 Banned: ${bannedCount}\n` +
      `🎮 Total Games: ${totalGames}\n\n` +
      `💰 *Deposits (Approved)*\n` +
      `MMK: ${depSums.MMK.toLocaleString()}\n` +
      `USD: $${depSums.USD.toLocaleString()}\n` +
      `CNY: ¥${depSums.CNY.toLocaleString()}\n\n` +
      `💸 *Withdrawals (Approved)*\n` +
      `MMK: ${wdSums.MMK.toLocaleString()}\n` +
      `USD: $${wdSums.USD.toLocaleString()}\n` +
      `CNY: ¥${wdSums.CNY.toLocaleString()}\n\n` +
      `⏳ Pending Deposits: ${pendingDep}\n` +
      `⏳ Pending Withdrawals: ${pendingWd}`;

    await sendTelegramMessage(chatId, msg);
  } catch (err) {
    await sendTelegramMessage(chatId, '❌ Error fetching stats');
  }
}

async function handlePendingCommand(chatId) {
  try {
    const depositsData = await readBin(CONFIG.BINS.DEPOSITS);
    const withdrawalsData = await readBin(CONFIG.BINS.WITHDRAWALS);

    const pendingDeps = (depositsData?.deposits || []).filter(d => d.status === 'pending');
    const pendingWds = (withdrawalsData?.withdrawals || []).filter(w => w.status === 'pending');

    let msg = `⏳ *PENDING REQUESTS*\n\n`;
    msg += `📥 *Deposits (${pendingDeps.length})*\n`;

    pendingDeps.slice(0, 5).forEach((d, i) => {
      msg += `${i + 1}. ${d.username} - ${d.amount} ${d.currency} (TXN: ${d.transactionId})\n`;
    });

    if (pendingDeps.length > 5) msg += `...and ${pendingDeps.length - 5} more\n`;

    msg += `\n📤 *Withdrawals (${pendingWds.length})*\n`;

    pendingWds.slice(0, 5).forEach((w, i) => {
      msg += `${i + 1}. ${w.username} - ${w.amount} ${w.currency}\n`;
    });

    if (pendingWds.length > 5) msg += `...and ${pendingWds.length - 5} more\n`;

    msg += `\nUse Admin Panel for full management.`;

    await sendTelegramMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Open Admin Panel', web_app: { url: `https://goalornogoal.vercel.app/admin.html` } }
        ]]
      }
    });
  } catch (err) {
    await sendTelegramMessage(chatId, '❌ Error fetching pending requests');
  }
}

async function handleBannedCommand(chatId) {
  try {
    const usersData = await readBin(CONFIG.BINS.USERS);
    const banned = (usersData?.users || []).filter(u => u.bannedStatus?.isBanned);

    let msg = `🚫 *BANNED USERS (${banned.length})*\n\n`;

    banned.slice(0, 10).forEach((u, i) => {
      msg += `${i + 1}. ${u.username}\n   Reason: ${u.bannedStatus.reason}\n   Date: ${u.bannedStatus.bannedAt}\n\n`;
    });

    if (banned.length === 0) msg += 'No banned users.';
    if (banned.length > 10) msg += `...and ${banned.length - 10} more`;

    await sendTelegramMessage(chatId, msg);
  } catch (err) {
    await sendTelegramMessage(chatId, '❌ Error fetching banned users');
  }
}

async function handleUsersCommand(chatId) {
  try {
    const usersData = await readBin(CONFIG.BINS.USERS);
    const users = usersData?.users || [];

    const now = new Date();
    const todayStr = now.toDateString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayUsers = users.filter(u => new Date(u.createdAt).toDateString() === todayStr);
    const monthUsers = users.filter(u => new Date(u.createdAt) >= monthStart);
    const onlineUsers = users.filter(u => u.online);

    let msg =
      `👥 *USERS OVERVIEW*\n\n` +
      `📊 Total: ${users.length}\n` +
      `🟢 Online: ${onlineUsers.length}\n` +
      `📅 Today: ${todayUsers.length}\n` +
      `📆 This Month: ${monthUsers.length}\n\n` +
      `*VIP Levels:*\n` +
      `⭐ VIP: ${users.filter(u => u.vipLevel === 'VIP').length}\n` +
      `💎 VVIP: ${users.filter(u => u.vipLevel === 'VVIP').length}\n` +
      `👑 VVIP KING: ${users.filter(u => u.vipLevel === 'VVIP_KING').length}`;

    await sendTelegramMessage(chatId, msg);
  } catch (err) {
    await sendTelegramMessage(chatId, '❌ Error fetching users');
  }
}

async function handleCallbackQuery(chatId, data) {
  await sendTelegramMessage(chatId, `Received: ${data}`);
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...extra
    };

    await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Send telegram message error:', err);
  }
}

async function handleSendNotification(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { message, type } = JSON.parse(body);

  const chatId = CONFIG.TELEGRAM.ADMIN_ID;

  let prefix = '📢';
  if (type === 'deposit') prefix = '💰';
  if (type === 'withdraw') prefix = '💸';
  if (type === 'ban') prefix = '🚫';
  if (type === 'game') prefix = '🎮';

  await sendTelegramMessage(chatId, `${prefix} ${message}`);
  return sendSuccess(res, { message: 'Notification sent' });
}
