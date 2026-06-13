const { createClient } = require('@supabase/supabase-js');
const aiTools = require('./_aiTools');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// FIX #6: Log at startup instead of throwing at module-load time.
// Throwing at module level in Vercel Serverless causes ALL functions in the deployment
// to fail with a 500 on cold-start, with no useful error message to the client.
// Instead, we detect misconfiguration here and handle it per-request in requireAuth.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[api/_lib] FATAL: Missing SUPABASE_URL or SUPABASE_ANON_KEY. ' +
    'All authenticated requests will return 503. ' +
    'Set these variables in your Vercel project settings.'
  );
}

function getCallerClient(authHeader) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

function getAdminClient() {
  // FIX #7: Explicit guard prevents creating a client with an undefined key,
  // which could silently fall back to anon permissions in some SDK versions.
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Admin client unavailable: SUPABASE_SERVICE_ROLE_KEY is not set. Set it in your environment secrets.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function requireAuth(req, res) {
  // FIX #6 (runtime): If misconfigured, return 503 instead of crashing the process.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: 'Service misconfigured: missing Supabase credentials' });
    return null;
  }
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'No authorization header' });
    return null;
  }
  const callerClient = getCallerClient(authHeader);
  const { data: { user }, error } = await callerClient.auth.getUser();
  if (error || !user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return { user, callerClient };
}

// FIX #8: Role-based access control helper.
// Use this in admin endpoints instead of relying on manual role checks in each handler.
// Assumes a `user_roles` table with columns: user_id (uuid), role (text).
async function requireRole(req, res, allowedRoles) {
  const auth = await requireAuth(req, res);
  if (!auth) return null; // requireAuth already sent the error response
  const { data: roles, error } = await auth.callerClient
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.user.id);
  if (error || !roles?.some((r) => allowedRoles.includes(r.role))) {
    res.status(403).json({ error: 'Forbidden: insufficient role' });
    return null;
  }
  return auth;
}

const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || '') // NOSONAR
  .split(',')
  .map(s => s.trim())
  .filter(Boolean));

function setCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); // NOSONAR
    res.setHeader('Vary', 'Origin');
  } else if (origin && ALLOWED_ORIGINS.size > 0) {
    // FIX #9: Explicitly reject requests from unlisted origins with 403.
    // Without this, the request would still be processed (only the browser enforces CORS).
    // Non-browser clients (curl, scripts) bypass CORS headers entirely.
    // NOTE: We only block when ALLOWED_ORIGINS is non-empty to avoid breaking dev setups.
    res.status(403).json({ error: 'CORS: origin not permitted' });
    return false; // signal to ensurePostRequest to stop processing
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return true;
}

function ensurePostRequest(req, res) {
  const corsOk = setCors(req, res);
  if (corsOk === false) return false; // setCors already sent 403
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

function getErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isValidMonth = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const VALID_ROLES = new Set(['admin', 'hr', 'finance', 'operations', 'viewer']);
const logError = (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', message: msg, ...meta, ts: new Date().toISOString() }));
const logInfo = (msg, meta = {}) => console.log(JSON.stringify({ level: 'info', message: msg, ...meta, ts: new Date().toISOString() }));

module.exports = {
  getCallerClient, getAdminClient, requireAuth, requireRole, setCors,
  ensurePostRequest, getErrorMessage,
  isUuid, isValidMonth, VALID_ROLES, logError, logInfo,
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  DEFAULT_GROQ_MODEL: process.env.GROQ_MODEL || 'llama3-8b-8192',
  ...aiTools,
};
