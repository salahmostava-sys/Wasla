/**
 * Shared handler business logic for API routes.
 *
 * Each exported function is a plain async `(req, res) => void` handler that
 * contains **only** business logic (no CORS / method-check — the caller is
 * responsible for that).
 *
 * • `server/index.js` imports these directly (ESM).
 * • `api/functions/*.js` import via `createRequire` (CJS bridge).
 */

import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);

const {
  requireAuth, getAdminClient, getErrorMessage,
  isUuid, isValidMonth, VALID_ROLES, logInfo, logError,
  GROQ_API_KEY, GROQ_BASE_URL, DEFAULT_GROQ_MODEL,
  AI_CHAT_SYSTEM_PROMPT, AI_CHAT_TOOLS, executeAiTool, callGroqChat,
} = require('../../api/_lib.js');

// ─── Rate Limiting Helper ───────────────────────────────────────────────────
// Uses Supabase RPC only — no in-memory fallback (unreliable on serverless).

async function checkRateLimit(supabaseClient, userId, action, limit, windowSeconds) {
  const key = `${action}_${userId}`;
  const { data, error } = await supabaseClient.rpc('enforce_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) {
    logError('Rate limit check failed — denying request (fail-closed)', { error: error.message, action, user_id: userId });
    return { allowed: false, remaining: 0 };
  }
  return data?.[0] ?? { allowed: true };
}

// ─── Salary engine error classifier ──────────────────────────────────────────

function classifySalaryError(message) {
  const clientPhrases = ['Invalid month_year', 'Invalid employee_id', 'Invalid mode', 'No authorization header', 'Not authenticated', 'Method not allowed', 'Only admin/finance'];
  const isAuthz = message.includes('Only admin/finance');
  const isClient = isAuthz || clientPhrases.some(p => message.includes(p));
  if (isAuthz) return 403;
  if (isClient) return 400;
  return 500;
}

// ─── Salary Engine ────────────────────────────────────────────────────────────

async function executeEmployeeMode(adminClient, payload) {
  const { month_year, payment_method, employee_id, manual_deduction, manual_deduction_note } = payload;
  if (!isUuid(employee_id)) return { status: 400, error: 'Invalid employee_id' };
  const { data, error } = await adminClient.rpc('calculate_salary_for_employee_month', {
    p_employee_id: employee_id,
    p_month_year: month_year,
    p_payment_method: payment_method || 'cash',
    p_manual_deduction: Number(manual_deduction || 0),
    p_manual_deduction_note: manual_deduction_note ?? null,
  });
  if (error) throw new Error(error.message);
  return { status: 200, data };
}

async function executeMonthMode(adminClient, payload) {
  const { month_year, payment_method } = payload;
  const { data, error } = await adminClient.rpc('calculate_salary_for_month', {
    p_month_year: month_year,
    p_payment_method: payment_method || 'cash',
  });
  if (error) throw new Error(error.message);
  return { status: 200, data };
}

async function executeMonthPreviewMode(adminClient, payload) {
  const { data, error } = await adminClient.rpc('preview_salary_for_month', {
    p_month_year: payload.month_year,
  });
  if (error) throw new Error(error.message);
  return { status: 200, data };
}

async function executeSalaryEngineMode(adminClient, payload) {
  if (payload.mode === 'employee') return executeEmployeeMode(adminClient, payload);
  if (payload.mode === 'month') return executeMonthMode(adminClient, payload);
  if (payload.mode === 'month_preview') return executeMonthPreviewMode(adminClient, payload);

  return { status: 400, error: 'Invalid mode. Use "employee", "month", or "month_preview"' };
}

export async function salaryEngineHandler(req, res) {
  const requestId = randomUUID();
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user, callerClient } = auth;

    const { data: roleRows, error: roleError } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (roleError) throw new Error(roleError.message);

    const roles = new Set((roleRows ?? []).map(r => r.role));
    if (!roles.has('admin') && !roles.has('finance')) {
      return res.status(403).json({ error: 'Only admin/finance can run salary engine' });
    }

    const payload = req.body;
    if (!payload?.month_year || !isValidMonth(payload.month_year)) {
      return res.status(400).json({ error: 'Invalid month_year format. Expected YYYY-MM' });
    }

    const adminClient = getAdminClient();
    
    const rl = await checkRateLimit(adminClient, user.id, 'salary_engine', 30, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }

    logInfo('Salary engine request accepted', { request_id: requestId, user_id: user.id, mode: payload.mode, month_year: payload.month_year });

    const result = await executeSalaryEngineMode(adminClient, payload);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ data: result.data });
  } catch (err) {
    const message = getErrorMessage(err);
    logError('Salary engine failed', { request_id: requestId, error: message });
    const status = classifySalaryError(message);
    const safeMessage = status === 500 ? 'Internal server error: ' + message : message;
    return res.status(status).json({ error: safeMessage });
  }
}

// ─── Admin Update User ────────────────────────────────────────────────────────

async function handleCreateUser(supabaseAdmin, { email, password, name, role }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const normalizedName = String(name ?? '').trim();
  const normalizedRole = normalizeAppRole(role);

  if (!normalizedEmail?.includes('@')) throw new Error('Invalid email');
  if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters');
  if (!normalizedName) throw new Error('name is required');

  let createdUserId = null;
  try {
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail, password, email_confirm: true,
      user_metadata: { name: normalizedName },
    });
    if (createError) throw createError;
    createdUserId = createdUser.user?.id ?? null;
    if (!createdUserId) throw new Error('User creation returned no user id');

    const { error: profileError } = await supabaseAdmin.from('profiles')
      .update({ email: normalizedEmail, name: normalizedName, is_active: true })
      .eq('id', createdUserId);
    if (profileError) throw profileError;

    await supabaseAdmin.from('user_roles').delete().eq('user_id', createdUserId);
    const { error: insertRoleError } = await supabaseAdmin.from('user_roles')
      .insert({ user_id: createdUserId, role: normalizedRole });
    if (insertRoleError) throw insertRoleError;
  } catch (err) {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
        .catch(e => logError('Failed to cleanup partially created user', { error: e.message }));
    }
    throw err;
  }
  return { success: true, user_id: createdUserId };
}

async function handleDeleteUser(supabaseAdmin, user_id, callerId) {
  if (user_id === callerId) throw new Error('You cannot delete your own account');
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
  if (error) throw error;
  return { success: true };
}

async function handleRevokeSession(supabaseAdmin, user_id) {
  const { error } = await supabaseAdmin.auth.admin.signOut(user_id, 'global');
  if (error) throw error;
  return { success: true };
}

async function handleUpdatePassword(supabaseAdmin, user_id, password) {
  if (!password) throw new Error('password is required for update_password');
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
  if (error) throw error;
  return { success: true };
}

async function updateAuthLayer(supabaseAdmin, user_id, { email, password }) {
  const authUpdates = {};
  if (email !== undefined) authUpdates.email = email.toLowerCase().trim();
  if (password !== undefined && password.trim() !== '') authUpdates.password = password;
  
  if (Object.keys(authUpdates).length === 0) return;

  if (authUpdates.email) authUpdates.email_confirm = true;
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdates);
  if (authError) throw authError;
}

async function updateProfileLayer(supabaseAdmin, user_id, { email, name, is_active }) {
  const profileUpdates = {};
  if (name !== undefined) profileUpdates.name = name.trim();
  if (email !== undefined) profileUpdates.email = email.toLowerCase().trim();
  if (is_active !== undefined) profileUpdates.is_active = is_active;

  if (Object.keys(profileUpdates).length === 0) return;

  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update(profileUpdates)
    .eq('id', user_id);
  if (profileError) throw profileError;
}

async function updateRoleLayer(supabaseAdmin, user_id, role) {
  if (role === undefined) return;
  const normalizedRole = normalizeAppRole(role);
  const { data: updatedRows, error: roleError } = await supabaseAdmin.from('user_roles')
    .update({ role: normalizedRole })
    .eq('user_id', user_id)
    .select('id');
  if (roleError) throw roleError;
  if (updatedRows?.length) return;

  const { error: insertRoleError } = await supabaseAdmin.from('user_roles')
    .insert({ user_id, role: normalizedRole });
  if (insertRoleError) throw insertRoleError;
}

async function handleUpdateUser(supabaseAdmin, user_id, { email, password, name, role, is_active }) {
  await updateAuthLayer(supabaseAdmin, user_id, { email, password });
  await updateProfileLayer(supabaseAdmin, user_id, { email, name, is_active });
  await updateRoleLayer(supabaseAdmin, user_id, role);
  return { success: true };
}

function normalizeAppRole(role) {
  const normalizedRole = String(role ?? 'viewer').trim().toLowerCase();
  if (!VALID_ROLES.has(normalizedRole)) throw new Error('Invalid role');
  return normalizedRole;
}

async function dispatchAction(supabaseAdmin, normalizedAction, { user_id, password, email, name, role, is_active }, callerId) {
  if (normalizedAction === 'create_user') return handleCreateUser(supabaseAdmin, { email, password, name, role });
  if (normalizedAction === 'update_user') return handleUpdateUser(supabaseAdmin, user_id, { email, password, name, role, is_active });
  if (normalizedAction === 'delete_user') return handleDeleteUser(supabaseAdmin, user_id, callerId);
  if (normalizedAction === 'revoke_session') return handleRevokeSession(supabaseAdmin, user_id);
  if (normalizedAction === 'update_password') return handleUpdatePassword(supabaseAdmin, user_id, password);
  throw new Error('Unsupported action');
}

function classifyAdminError(message) {
  const clientPhrases = ['Invalid', 'required', 'must be', 'cannot delete', 'email is required', 'password is required', 'name is required', 'action is required'];
  const isClient = clientPhrases.some(p => message.toLowerCase().includes(p.toLowerCase()));
  const isAuthError = message.includes('Only admins') || message.includes('Not authenticated');
  if (isAuthError) return { status: 403, safeMessage: message };
  if (isClient) return { status: 400, safeMessage: message };
  return { status: 500, safeMessage: 'Internal server error' };
}

async function checkUserManagementAccess(callerClient, callerUserId) {
  const { data: roleRows, error: roleError } = await callerClient
    .from('user_roles')
    .select('role')
    .eq('user_id', callerUserId);
  if (roleError) throw new Error(roleError.message);

  const callerRoles = new Set((roleRows ?? []).map(r => r.role));
  if (callerRoles.has('admin')) return true;

  // Delegated access: a non-admin can be granted "settings" edit permission via the
  // permissions matrix (user_permissions), which unlocks user/permission management too.
  const { data: settingsPerm, error: settingsPermError } = await callerClient
    .from('user_permissions')
    .select('can_edit')
    .eq('user_id', callerUserId)
    .eq('permission_key', 'settings')
    .maybeSingle();
  if (settingsPermError) throw new Error(settingsPermError.message);
  return Boolean(settingsPerm?.can_edit);
}

export async function adminUpdateUserHandler(req, res) {
  const requestId = randomUUID();
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user: callerUser, callerClient } = auth;

    const hasUserManagementAccess = await checkUserManagementAccess(callerClient, callerUser.id);
    if (!hasUserManagementAccess) {
      return res.status(403).json({ error: 'Only admins or users with settings management access can update users' });
    }

    const supabaseAdmin = getAdminClient();
    
    const rl = await checkRateLimit(supabaseAdmin, callerUser.id, 'admin_update_user', 30, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }

    const { user_id, password, email, name, role, is_active, action } = req.body;
    const normalizedAction = action || (password ? 'update_password' : undefined);
    if (!normalizedAction) throw new Error('action is required');

    if (normalizedAction !== 'create_user') {
      if (!user_id) throw new Error('user_id is required');
      if (!isUuid(user_id)) throw new Error('Invalid user_id');
    }

    logInfo('Admin update user request', { request_id: requestId, admin_user_id: callerUser.id, action: normalizedAction });

    const result = await dispatchAction(supabaseAdmin, normalizedAction, { user_id, password, email, name, role, is_active }, callerUser.id);
    return res.json(result);
  } catch (err) {
    const message = getErrorMessage(err);
    logError('Admin update user failed', { request_id: requestId, error: message });
    const { status, safeMessage } = classifyAdminError(message);
    return res.status(status).json({ error: safeMessage });
  }
}

// ─── Groq Chat ────────────────────────────────────────────────────────────────

export async function groqChatHandler(req, res) {
  const requestId = randomUUID();
  try {
    if (!GROQ_API_KEY) {
      logError('GROQ_API_KEY not configured', { request_id: requestId });
      return res.status(500).json({ error: 'AI service is not configured on the server' });
    }

    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user: callerUser, callerClient } = auth;

    const { data: roleRows, error: roleError } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id);
    if (roleError) throw new Error(roleError.message);
    const roles = new Set((roleRows ?? []).map(r => r.role));
    if (!roles.has('admin') && !roles.has('operations')) {
      return res.status(403).json({ error: 'Only admin/operations can access groq-chat directly' });
    }

    const adminClient = getAdminClient();
    const rl = await checkRateLimit(adminClient, callerUser.id, 'groq_chat', 15, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }

    const { messages, model, temperature, max_tokens } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    logInfo('groq-chat request accepted', { request_id: requestId, user_id: callerUser.id, message_count: messages.length });

    const groqResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: typeof model === 'string' ? model : DEFAULT_GROQ_MODEL,
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 1024,
        stream: false,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      logError('Groq API error', { request_id: requestId, status: groqResponse.status, body: errText });
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await groqResponse.json();
    const message = data.choices?.[0]?.message?.content ?? '';
    return res.json({ message });
  } catch (err) {
    const message = getErrorMessage(err);
    logError('groq-chat unhandled error', { request_id: requestId, error: message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

async function handleAiToolCalls(responseMessage, conversation, callerClient, userRole) {
  if (!responseMessage.tool_calls?.length) {
    return responseMessage.content ?? '';
  }

  conversation.push(responseMessage);

  for (const toolCall of responseMessage.tool_calls) {
    let fnArgs = {};
    try { fnArgs = JSON.parse(toolCall.function.arguments || '{}'); } catch { fnArgs = {}; }

    let result = {};
    try {
      result = await executeAiTool(callerClient, userRole, toolCall.function.name, fnArgs);
    } catch (e) {
      result = { error: `Tool error: ${e.message}` };
    }

    conversation.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
  }

  const finalResponse = await callGroqChat(GROQ_API_KEY, GROQ_BASE_URL, conversation, null, DEFAULT_GROQ_MODEL);
  return finalResponse.content ?? '';
}

export async function aiChatHandler(req, res) {
  const requestId = randomUUID();
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user: callerUser, callerClient } = auth;

    const adminClient = getAdminClient();
    const rl = await checkRateLimit(adminClient, callerUser.id, 'ai_chat', 15, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }

    // Fail-closed: default to most restrictive role so sensitive tools stay gated.
    let userRole = 'viewer';
    try {
      const { data: role } = await callerClient.rpc('get_my_role');
      if (typeof role === 'string' && role.length > 0) userRole = role;
    } catch (e) {
      logError('[ai-chat] get_my_role failed; defaulting to viewer', { request_id: requestId, error: e?.message });
    }

    const { messages: clientMessages } = req.body;
    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const conversation = [
      { role: 'system', content: AI_CHAT_SYSTEM_PROMPT },
      ...clientMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const responseMessage = await callGroqChat(GROQ_API_KEY, GROQ_BASE_URL, conversation, AI_CHAT_TOOLS, DEFAULT_GROQ_MODEL);
    const finalContent = await handleAiToolCalls(responseMessage, conversation, callerClient, userRole);
    
    return res.json({ message: finalContent });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logError('[ai-chat] error', { request_id: requestId, error: message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
