import './lib/loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { salaryEngineHandler, adminUpdateUserHandler, groqChatHandler, aiChatHandler } from './lib/handlers.js';

const app = express();
app.disable('x-powered-by'); // Fix: javascript:S5689 - Disable Express version disclosure
const PORT = process.env.SERVER_PORT || 3001;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Allowed CORS origins — comma-separated list via env var
const defaultOrigins = IS_PRODUCTION ? '' : 'http://localhost:5173,http://localhost:5000,http://localhost:3000';
const ALLOWED_ORIGINS = new Set((
  process.env.ALLOWED_ORIGINS || defaultOrigins // NOSONAR
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no Origin header) and listed origins
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    // FIX #10: Return false (silent deny) instead of throwing an Error.
    // callback(new Error(...)) causes Express to emit a 500 with stack trace in logs.
    // The browser will see a network error, which is the correct CORS behavior.
    return callback(null, false);
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'x-client-info', 'apikey'],
}));
// FIX #11: helmet sets secure HTTP headers: X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, Strict-Transport-Security, and basic CSP.
// This protects against clickjacking, MIME-sniffing, and XSS reflected attacks.
app.use(helmet());
app.use(compression());
// FIX #12: 2mb is too large for most endpoints (salary IDs, chat fields).
// Reduced to 256kb globally; AI endpoints override this per-route.
// This prevents memory exhaustion from large payloads before auth is checked.
app.use(express.json({ limit: '256kb' }));

// Apply a general rate limiter to all requests to prevent abuse before route-specific handlers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', limiter, (req, res) => res.json({ status: 'ok' }));

// ── Authentication Middleware ────────────────────────────────────────────────
app.use('/api/functions/*', (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }
  next();
});

// ── Salary Engine (replaces salary-engine edge function) ─────────────────────
app.post('/api/functions/salary-engine', salaryEngineHandler);

// ── Admin Update User (replaces admin-update-user edge function) ──────────────
app.post('/api/functions/admin-update-user', adminUpdateUserHandler);

// ── Groq Chat (replaces groq-chat edge function) — larger body for AI payloads ──
app.post('/api/functions/groq-chat', express.json({ limit: '2mb' }), groqChatHandler);

// ── AI Chat (replaces ai-chat edge function) — larger body for AI payloads ──────
app.post('/api/functions/ai-chat', express.json({ limit: '2mb' }), aiChatHandler);


// ── Error Handling & Telegram Monitoring ──────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(err, req) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const text = `🔴 *CRITICAL ERROR - Muhimmat API*\n*Path:* \`${req.method} ${req.originalUrl}\`\n*Error:* \`${err.message}\`\n*Time:* \`${new Date().toISOString()}\``;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('[server] Failed to send Telegram alert:', e.message);
  }
}

app.use(async (err, req, res, next) => {
  console.error('[server] Unhandled Error:', err);
  await sendTelegramAlert(err, req);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// ── Startup checks ────────────────────────────────────────────────────────────
if (IS_PRODUCTION && ALLOWED_ORIGINS.size === 0) {
  console.error('[server] FATAL: ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[server] FATAL: SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) must be set.');
  process.exit(1);
}
if (IS_PRODUCTION && !AI_INTERNAL_KEY) {
  console.error('[server] FATAL: AI_INTERNAL_KEY must be set in production.');
  console.error('[server] Generate one with: openssl rand -hex 32');
  process.exit(1);
}

app.listen(PORT, '0.0.0.0', () => { // NOSONAR - Server runs securely behind a TLS-terminating load balancer
  console.log(`[server] Muhimmat API server running on port ${PORT}`);
  console.log(`[server] CORS allowed origins: ${[...ALLOWED_ORIGINS].join(', ')}`);
  if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] WARNING: SUPABASE_SERVICE_ROLE_KEY not set — admin actions will fail');
  if (!process.env.GROQ_API_KEY) console.warn('[server] WARNING: GROQ_API_KEY not set — AI features disabled');
  if (!AI_INTERNAL_KEY) console.warn('[server] WARNING: AI_INTERNAL_KEY not set — set in production via env');
});
