import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

function getLocalISODate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalHHMM(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function defaultNotifyConfig() {
  return {
    enabled: false,
    scheduleTime: '09:00',
    scope: 'keyring_and_active',
    emailEnabled: false,
    emailTo: 'yahiamahmud10@gmail.com',
    smtpUser: '',
    smtpPass: '',
    whatsappEnabled: false,
    whatsappProvider: 'textmebot',
    whatsappPhone: '',
    whatsappApiKey: '',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    webhookUrl: '',
    lastSentDate: ''
  };
}

export function getNotifyConfigPath(dataDir) {
  return path.join(dataDir, 'notify-config.json');
}

export function readNotifyConfig(dataDir) {
  const defaults = defaultNotifyConfig();
  try {
    const file = getNotifyConfigPath(dataDir);
    if (!fs.existsSync(file)) return defaults;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { ...defaults, ...raw };
  } catch (e) {
    return defaults;
  }
}

export function writeNotifyConfig(dataDir, cfg) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(getNotifyConfigPath(dataDir), JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Notifier] Failed to save config:', e?.message || e);
    return false;
  }
}

export function maskNotifyConfig(cfg) {
  return {
    enabled: !!cfg.enabled,
    scheduleTime: cfg.scheduleTime || '09:00',
    scope: cfg.scope || 'keyring_and_active',
    emailEnabled: !!cfg.emailEnabled,
    emailTo: cfg.emailTo || '',
    smtpUser: cfg.smtpUser || '',
    smtpPass: '',
    hasSmtpPass: Boolean(cfg.smtpPass),
    whatsappEnabled: !!cfg.whatsappEnabled,
    whatsappProvider: cfg.whatsappProvider === 'callmebot' ? 'callmebot' : 'textmebot',
    whatsappPhone: cfg.whatsappPhone || '',
    whatsappApiKey: '',
    hasWhatsappApiKey: Boolean(cfg.whatsappApiKey),
    telegramEnabled: !!cfg.telegramEnabled,
    telegramBotToken: '',
    hasTelegramBotToken: Boolean(cfg.telegramBotToken),
    telegramChatId: cfg.telegramChatId || '',
    webhookUrl: cfg.webhookUrl || '',
    lastSentDate: cfg.lastSentDate || ''
  };
}

export function mergeNotifyConfig(existing, incoming = {}) {
  const cleanTime = /^\d{2}:\d{2}$/.test(String(incoming.scheduleTime || '').trim())
    ? String(incoming.scheduleTime).trim()
    : (existing.scheduleTime || '09:00');

  const next = {
    ...existing,
    enabled: incoming.enabled !== undefined ? !!incoming.enabled : existing.enabled,
    scheduleTime: cleanTime,
    scope: incoming.scope === 'keyring_only' ? 'keyring_only' : 'keyring_and_active',
    emailEnabled: incoming.emailEnabled !== undefined ? !!incoming.emailEnabled : existing.emailEnabled,
    emailTo: incoming.emailTo !== undefined ? String(incoming.emailTo).trim() : existing.emailTo,
    smtpUser: incoming.smtpUser !== undefined ? String(incoming.smtpUser).trim() : existing.smtpUser,
    whatsappEnabled: incoming.whatsappEnabled !== undefined ? !!incoming.whatsappEnabled : existing.whatsappEnabled,
    whatsappProvider: incoming.whatsappProvider === 'callmebot' ? 'callmebot'
      : (incoming.whatsappProvider === 'textmebot' ? 'textmebot' : (existing.whatsappProvider || 'textmebot')),
    whatsappPhone: incoming.whatsappPhone !== undefined ? String(incoming.whatsappPhone).trim() : existing.whatsappPhone,
    telegramEnabled: incoming.telegramEnabled !== undefined ? !!incoming.telegramEnabled : existing.telegramEnabled,
    telegramChatId: incoming.telegramChatId !== undefined ? String(incoming.telegramChatId).trim() : existing.telegramChatId,
    webhookUrl: incoming.webhookUrl !== undefined ? String(incoming.webhookUrl).trim() : existing.webhookUrl
  };

  if (incoming.clearSmtpPass) {
    next.smtpPass = '';
  } else if (typeof incoming.smtpPass === 'string' && incoming.smtpPass.trim() !== '') {
    next.smtpPass = incoming.smtpPass.trim();
  }

  if (incoming.clearWhatsappApiKey) {
    next.whatsappApiKey = '';
  } else if (typeof incoming.whatsappApiKey === 'string' && incoming.whatsappApiKey.trim() !== '') {
    next.whatsappApiKey = incoming.whatsappApiKey.trim();
  }

  if (incoming.clearTelegramBotToken) {
    next.telegramBotToken = '';
  } else if (typeof incoming.telegramBotToken === 'string' && incoming.telegramBotToken.trim() !== '') {
    next.telegramBotToken = incoming.telegramBotToken.trim();
  }

  return next;
}

export function isKeyringTask(task) {
  if (!task) return false;
  const cat = String(task.category || '').trim().toLowerCase();
  const title = String(task.title || '').trim().toLowerCase();
  return cat === 'keyring' || title.includes('keyring');
}

function formatLineItem(task, empMap) {
  const bits = [];
  if (task.quantity) bits.push(task.quantity);
  if (task.client) bits.push(task.client);
  const empName = empMap.get(task.employeeId);
  if (empName) bits.push(empName);
  const suffix = bits.length > 0 ? ` (${bits.join(' • ')})` : '';
  return `• ${task.title}${suffix}`;
}

export function buildOrderDigest(store, scope = 'keyring_and_active') {
  const tasks = Array.isArray(store?.tasks) ? store.tasks : [];
  const employees = Array.isArray(store?.employees) ? store.employees : [];
  const empMap = new Map(employees.map(e => [e.id, e.name]));

  const active = tasks.filter(t => !t.completed && t.stage !== 'delivered');
  const keyringsActive = active.filter(isKeyringTask);
  const keyringPendingWork = keyringsActive.filter(t => t.stage === 'work' || t.stage === 'ordered');
  const keyringPrinting = keyringsActive.filter(t => t.stage === 'printing');

  const orderedAll = active.filter(t => t.stage === 'ordered');
  const workAll = active.filter(t => t.stage === 'work');
  const printingAll = active.filter(t => t.stage === 'printing');

  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const subject = `Team To do: ${keyringPendingWork.length} Keyring Needs Work (${active.length} Active)`;

  const lines = [
    `🔑 Team To do — ${dateLabel}`,
    `Keyring Work Pending: ${keyringPendingWork.length} | Keyring Printing: ${keyringPrinting.length}`,
    ''
  ];

  if (keyringPendingWork.length > 0) {
    lines.push(`🛠️ Keyring Kaj Baki (${keyringPendingWork.length}):`);
    keyringPendingWork.forEach(t => lines.push(formatLineItem(t, empMap)));
    lines.push('');
  } else {
    lines.push('✓ No Keyring work pending right now.');
    lines.push('');
  }

  if (keyringPrinting.length > 0) {
    lines.push(`🖨️ Keyring Printing (${keyringPrinting.length}):`);
    keyringPrinting.forEach(t => lines.push(formatLineItem(t, empMap)));
    lines.push('');
  }

  if (scope !== 'keyring_only') {
    const nonKeyringPrinting = printingAll.filter(t => !isKeyringTask(t));
    if (nonKeyringPrinting.length > 0) {
      lines.push(`🖨️ Other Printing (${nonKeyringPrinting.length}):`);
      nonKeyringPrinting.forEach(t => lines.push(formatLineItem(t, empMap)));
      lines.push('');
    }
    if (orderedAll.length > 0) {
      lines.push(`📦 Ordered (${orderedAll.length}):`);
      orderedAll.forEach(t => lines.push(formatLineItem(t, empMap)));
      lines.push('');
    }
    lines.push(`📊 Total Active: ${active.length} (Ordered: ${orderedAll.length}, Needs Work: ${workAll.length}, Printing: ${printingAll.length})`);
  }

  const renderHtmlList = (items, emptyMsg) => {
    if (!items.length) return `<p style="color:#6b7280;font-size:13px;margin:6px 0 0;">${escapeHtml(emptyMsg)}</p>`;
    return `<ul style="margin:8px 0 0;padding-left:18px;color:#111827;font-size:13.5px;line-height:1.55;">
      ${items.map(t => {
        const meta = [];
        if (t.quantity) meta.push(escapeHtml(t.quantity));
        if (t.client) meta.push(escapeHtml(t.client));
        const emp = empMap.get(t.employeeId);
        if (emp) meta.push(escapeHtml(emp));
        if (t.notes) meta.push(escapeHtml(t.notes));
        return `<li><strong>${escapeHtml(t.title)}</strong>${meta.length ? ` <span style="color:#6b7280;">(${meta.join(' • ')})</span>` : ''}</li>`;
      }).join('')}
    </ul>`;
  };

  const otherPrinting = printingAll.filter(t => !isKeyringTask(t));
  const otherWork = workAll.filter(t => !isKeyringTask(t));

  const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:18px;">Team To do — Keyring & Order Update</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${escapeHtml(dateLabel)}</p>
      <div style="display:flex;gap:10px;margin-bottom:18px;">
        <div style="flex:1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 12px;">
          <div style="font-size:20px;font-weight:700;color:#1D4ED8;">${keyringPendingWork.length}</div>
          <div style="font-size:11px;font-weight:600;color:#1E40AF;">Keyring Pending</div>
        </div>
        <div style="flex:1;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;">
          <div style="font-size:20px;font-weight:700;color:#B45309;">${printingAll.length}</div>
          <div style="font-size:11px;font-weight:600;color:#92400E;">In Printing</div>
        </div>
        <div style="flex:1;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:10px;padding:10px 12px;">
          <div style="font-size:20px;font-weight:700;color:#111827;">${active.length}</div>
          <div style="font-size:11px;font-weight:600;color:#4B5563;">Total Active</div>
        </div>
      </div>

      <h3 style="margin:14px 0 4px;font-size:14px;color:#1D4ED8;">Keyring — Needs Work / Ordered (${keyringPendingWork.length})</h3>
      ${renderHtmlList(keyringPendingWork, 'No pending Keyring work right now.')}

      ${keyringPrinting.length ? `<h3 style="margin:16px 0 4px;font-size:14px;color:#B45309;">Keyring — In Printing (${keyringPrinting.length})</h3>${renderHtmlList(keyringPrinting, '')}` : ''}

      ${scope !== 'keyring_only' && otherPrinting.length ? `<h3 style="margin:16px 0 4px;font-size:14px;color:#B45309;">Other Orders in Printing (${otherPrinting.length})</h3>${renderHtmlList(otherPrinting, '')}` : ''}

      ${scope !== 'keyring_only' && otherWork.length ? `<h3 style="margin:16px 0 4px;font-size:14px;color:#374151;">Other Needs Work (${otherWork.length})</h3>${renderHtmlList(otherWork, '')}` : ''}

      <p style="margin-top:20px;font-size:11px;color:#9CA3AF;">Sent automatically by Team To do Desktop Widget</p>
    </div>
  `;

  return {
    subject,
    whatsappText: lines.join('\n').trim(),
    emailText: lines.join('\n').trim(),
    emailHtml,
    counts: {
      active: active.length,
      keyringPending: keyringPendingWork.length,
      keyringPrinting: keyringPrinting.length,
      ordered: orderedAll.length,
      work: workAll.length,
      printing: printingAll.length
    }
  };
}

export async function sendEmailDigest({ cfg, digest }) {
  if (!cfg.smtpUser || !cfg.smtpPass || !cfg.emailTo) {
    throw new Error('Missing Gmail address, App Password, or recipient email');
  }
  const isGmail = /@(gmail|googlemail)\.com$/i.test(cfg.smtpUser);
  const transport = nodemailer.createTransport(
    isGmail
      ? { service: 'gmail', auth: { user: cfg.smtpUser, pass: cfg.smtpPass } }
      : { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: cfg.smtpUser, pass: cfg.smtpPass } }
  );
  await transport.sendMail({
    from: `"Team To do" <${cfg.smtpUser}>`,
    to: cfg.emailTo,
    subject: digest.subject,
    text: digest.emailText,
    html: digest.emailHtml
  });
}

export async function sendWhatsAppDigest({ cfg, digest }) {
  if (!cfg.whatsappPhone || !cfg.whatsappApiKey) {
    throw new Error('Missing WhatsApp number or API key');
  }
  const digits = String(cfg.whatsappPhone).replace(/[^\d]/g, '');
  if (!digits) throw new Error('Invalid WhatsApp phone number');
  const cleanPhone = `+${digits}`;
  const provider = cfg.whatsappProvider === 'callmebot' ? 'callmebot' : 'textmebot';

  if (provider === 'callmebot') {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(digest.whatsappText)}&apikey=${encodeURIComponent(cfg.whatsappApiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    if (!res.ok || (/error/i.test(body) && !/queued/i.test(body))) {
      throw new Error(`CallMeBot error (${res.status}): ${body.slice(0, 120)}`);
    }
    return;
  }

  const url = `https://api.textmebot.com/send.php?recipient=${encodeURIComponent(cleanPhone)}&apikey=${encodeURIComponent(cfg.whatsappApiKey)}&text=${encodeURIComponent(digest.whatsappText)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await res.text();
  if (!res.ok || (/error|not connected|invalid|fail/i.test(body) && !/success|queued|ok/i.test(body))) {
    throw new Error(`TextMeBot error (${res.status}): ${body.replace(/<[^>]+>/g, ' ').trim().slice(0, 140)}`);
  }
}

export async function detectTelegramChatId(botToken) {
  const token = String(botToken || '').trim();
  if (!token) throw new Error('Enter your Telegram Bot Token first');

  const meRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
    signal: AbortSignal.timeout(10000)
  });
  const meData = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !meData.ok) {
    throw new Error(meData.description || 'Invalid Telegram Bot Token');
  }

  const updRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getUpdates?limit=25`, {
    signal: AbortSignal.timeout(10000)
  });
  const updData = await updRes.json().catch(() => ({}));
  if (!updRes.ok || !updData.ok) {
    throw new Error(updData.description || 'Could not fetch Telegram updates');
  }

  const updates = Array.isArray(updData.result) ? updData.result : [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    const chat = u.message?.chat || u.edited_message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
    if (chat && chat.id !== undefined) {
      return {
        botUsername: meData.result?.username || '',
        chatId: String(chat.id),
        chatLabel: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id)
      };
    }
  }

  const botHint = meData.result?.username ? `@${meData.result.username}` : 'your new bot';
  throw new Error(`Open ${botHint} in Telegram, tap Start (send "hi"), then click Detect ID again.`);
}

export async function sendTelegramDigest({ cfg, digest }) {
  if (!cfg.telegramBotToken || !cfg.telegramChatId) {
    throw new Error('Missing Telegram Bot Token or Chat ID');
  }
  const url = `https://api.telegram.org/bot${encodeURIComponent(cfg.telegramBotToken)}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: cfg.telegramChatId,
      text: digest.whatsappText
    }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`Telegram error (${res.status}): ${data.description || 'Failed'}`);
  }
}

export async function sendWebhookDigest({ cfg, digest }) {
  if (!cfg.webhookUrl) throw new Error('Missing webhook URL');
  const res = await fetch(cfg.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'team-to-do',
      timestamp: new Date().toISOString(),
      subject: digest.subject,
      text: digest.whatsappText,
      counts: digest.counts
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    throw new Error(`Webhook HTTP ${res.status}`);
  }
}

export async function dispatchDigest({ store, cfg }) {
  const digest = buildOrderDigest(store, cfg.scope);
  const tasks = [];

  if (cfg.emailEnabled && cfg.smtpUser && cfg.smtpPass && cfg.emailTo) {
    tasks.push(
      sendEmailDigest({ cfg, digest }).then(() => ({ channel: 'email' }))
    );
  }
  if (cfg.whatsappEnabled && cfg.whatsappPhone && cfg.whatsappApiKey) {
    tasks.push(
      sendWhatsAppDigest({ cfg, digest }).then(() => ({ channel: 'whatsapp' }))
    );
  }
  if (cfg.telegramEnabled && cfg.telegramBotToken && cfg.telegramChatId) {
    tasks.push(
      sendTelegramDigest({ cfg, digest }).then(() => ({ channel: 'telegram' }))
    );
  }
  if (cfg.webhookUrl) {
    tasks.push(
      sendWebhookDigest({ cfg, digest }).then(() => ({ channel: 'webhook' }))
    );
  }

  if (tasks.length === 0) {
    return {
      sent: [],
      errors: ['No notification channel configured (enable Email, WhatsApp, Telegram, or Webhook first)'],
      digest
    };
  }

  const settled = await Promise.allSettled(tasks);
  const sent = [];
  const errors = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled') sent.push(r.value.channel);
    else errors.push(r.reason?.message || String(r.reason));
  });

  return { sent, errors, digest };
}

export function startNotifyScheduler({ dataDir, getStore }) {
  const tick = async () => {
    try {
      const cfg = readNotifyConfig(dataDir);
      if (!cfg.enabled) return;

      const now = new Date();
      const todayStr = getLocalISODate(now);
      if (cfg.lastSentDate === todayStr) return;

      const nowHHMM = getLocalHHMM(now);
      if (nowHHMM < (cfg.scheduleTime || '09:00')) return;

      const hasChannel =
        (cfg.emailEnabled && cfg.smtpUser && cfg.smtpPass && cfg.emailTo) ||
        (cfg.whatsappEnabled && cfg.whatsappPhone && cfg.whatsappApiKey) ||
        (cfg.telegramEnabled && cfg.telegramBotToken && cfg.telegramChatId) ||
        Boolean(cfg.webhookUrl);
      if (!hasChannel) return;

      // Mark sent date before dispatch to avoid overlapping minute ticks
      writeNotifyConfig(dataDir, { ...cfg, lastSentDate: todayStr });
      const res = await dispatchDigest({ store: getStore(), cfg });
      if (res.sent.length === 0 && res.errors.length > 0) {
        console.error('[Notifier] Scheduled send failed:', res.errors.join('; '));
      } else if (res.sent.length > 0) {
        console.log('[Notifier] Daily summary sent via:', res.sent.join(', '));
      }
    } catch (e) {
      console.error('[Notifier] Scheduler error:', e?.message || e);
    }
  };

  const timer = setInterval(tick, 60000);
  setTimeout(tick, 10000);
  return () => clearInterval(timer);
}
