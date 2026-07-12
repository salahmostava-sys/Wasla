const { getAdminClient, getErrorMessage, logError } = require('./_lib');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber ?? '').replace(/\D/g, '');
}

function isFourDigitOtp(value) {
  return /^\d{4}$/.test(String(value ?? '').trim());
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: '📱 مشاركة رقم الجوال', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function hasPagePermission(permissions, pageKey, action = 'can_view') {
  return permissions.some((permission) => (
    permission.permission_key === pageKey && permission[action] === true
  ));
}

function buildDashboardKeyboard({ role, permissions }) {
  const rows = [];

  if (role === 'finance' || hasPagePermission(permissions, 'finance') || hasPagePermission(permissions, 'treasury')) {
    rows.push([{ text: '💰 التقارير المالية', callback_data: 'finance_reports' }]);
  }

  if (hasPagePermission(permissions, 'orders')) {
    rows.push([{ text: '📦 الطلبات', callback_data: 'orders' }]);
  }

  if (role === 'operations' || hasPagePermission(permissions, 'vehicles') || hasPagePermission(permissions, 'vehicle_assignment')) {
    rows.push([{ text: '🚚 حالة الأسطول', callback_data: 'fleet_status' }]);
  }

  if (hasPagePermission(permissions, 'maintenance')) {
    rows.push([{ text: '🛠 الصيانة', callback_data: 'maintenance' }]);
  }

  if (hasPagePermission(permissions, 'salaries')) {
    rows.push([{ text: '💳 الرواتب', callback_data: 'salaries' }]);
  }

  if (rows.length === 0) {
    rows.push([{ text: '📊 لوحة المتابعة', callback_data: 'dashboard' }]);
  }

  return { inline_keyboard: rows };
}

async function fetchUserTelegramAccess(adminClient, userId) {
  const [profileResult, roleResult, permissionsResult] = await Promise.all([
    adminClient.from('profiles').select('id, name, email, is_active').eq('id', userId).maybeSingle(),
    adminClient.from('user_roles').select('role').eq('user_id', userId).limit(1).maybeSingle(),
    adminClient
      .from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (roleResult.error) throw roleResult.error;
  if (permissionsResult.error) throw permissionsResult.error;

  return {
    profile: profileResult.data,
    role: roleResult.data?.role ?? 'viewer',
    permissions: permissionsResult.data ?? [],
  };
}

async function handleStart(chatId) {
  await sendTelegramMessage(
    chatId,
    'أهلا بك. من فضلك شارك رقم الجوال المسجل في النظام.',
    contactKeyboard(),
  );
}

async function handleContact(adminClient, chatId, contact) {
  const phoneNumber = normalizePhoneNumber(contact.phone_number);
  const { data: integration, error } = await adminClient
    .from('user_telegram_integrations')
    .select('id, is_linked')
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  if (error) throw error;

  if (!integration) {
    await sendTelegramMessage(chatId, 'Access Denied. This number is not registered.');
    return;
  }

  if (integration.is_linked) {
    await sendTelegramMessage(chatId, 'هذا الحساب مربوط بالفعل بتليجرام.', removeKeyboard());
    return;
  }

  const { error: updateError } = await adminClient
    .from('user_telegram_integrations')
    .update({ telegram_chat_id: String(chatId) })
    .eq('id', integration.id);

  if (updateError) throw updateError;

  await sendTelegramMessage(
    chatId,
    'Phone verified ✅. Please type your 4-digit OTP to link your account.',
    removeKeyboard(),
  );
}

async function handleOtp(adminClient, chatId, text) {
  const { data: integration, error } = await adminClient
    .from('user_telegram_integrations')
    .select('id, user_id, otp_code')
    .eq('telegram_chat_id', String(chatId))
    .eq('is_linked', false)
    .maybeSingle();

  if (error) throw error;

  if (!integration) {
    await sendTelegramMessage(chatId, 'لا يوجد طلب ربط معلق. ابدأ من /start مرة أخرى.');
    return;
  }

  if (integration.otp_code !== text.trim()) {
    await sendTelegramMessage(chatId, 'Incorrect OTP code. Please try again.');
    return;
  }

  const access = await fetchUserTelegramAccess(adminClient, integration.user_id);
  if (!access.profile?.is_active) {
    await sendTelegramMessage(chatId, 'Access Denied. Your system account is inactive.');
    return;
  }

  const { error: linkError } = await adminClient
    .from('user_telegram_integrations')
    .update({ is_linked: true })
    .eq('id', integration.id);

  if (linkError) throw linkError;

  await sendTelegramMessage(
    chatId,
    'Account successfully linked to the system! 🚀 Here is your dashboard.',
    buildDashboardKeyboard(access),
  );
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;

  if (!message || !chatId) return { ok: true };

  const adminClient = getAdminClient();

  if (message.text === '/start') {
    await handleStart(chatId);
    return { ok: true };
  }

  if (message.contact?.phone_number) {
    await handleContact(adminClient, chatId, message.contact);
    return { ok: true };
  }

  if (isFourDigitOtp(message.text)) {
    await handleOtp(adminClient, chatId, message.text);
    return { ok: true };
  }

  await sendTelegramMessage(chatId, 'اضغط /start لبدء ربط حسابك.');
  return { ok: true };
}

async function telegramWebhookHandler(req, res) {
  try {
    const result = await handleTelegramUpdate(req.body);
    return res.status(200).json(result);
  } catch (error) {
    const message = getErrorMessage(error);
    logError('Telegram webhook failed', { error: message });
    return res.status(500).json({ ok: false, error: 'Telegram webhook failed' });
  }
}

module.exports = {
  buildDashboardKeyboard,
  handleTelegramUpdate,
  normalizePhoneNumber,
  sendTelegramMessage,
  telegramWebhookHandler,
};
