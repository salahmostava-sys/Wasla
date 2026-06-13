import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { salaryEngineHandler, adminUpdateUserHandler, groqChatHandler, aiChatHandler } from './lib/handlers.js';

const app = express();
app.disable('x-powered-by'); // Fix: javascript:S5689 - Disable Express version disclosure
const PORT = process.env.SERVER_PORT || 3001;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY;

// Allowed CORS origins — comma-separated list via env var
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5000,http://localhost:3000' // NOSONAR
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no Origin header) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
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
// FIX #12: 2mb is too large for most endpoints (salary IDs, chat fields).
// Reduced to 256kb globally; AI endpoints override this per-route.
// This prevents memory exhaustion from large payloads before auth is checked.
app.use(express.json({ limit: '256kb' }));


// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Salary Engine (replaces salary-engine edge function) ─────────────────────
app.post('/api/functions/salary-engine', salaryEngineHandler);

// ── Admin Update User (replaces admin-update-user edge function) ──────────────
app.post('/api/functions/admin-update-user', adminUpdateUserHandler);

// ── Groq Chat (replaces groq-chat edge function) — larger body for AI payloads ──
app.post('/api/functions/groq-chat', express.json({ limit: '2mb' }), groqChatHandler);

// ── AI Chat (replaces ai-chat edge function) — larger body for AI payloads ──────
app.post('/api/functions/ai-chat', express.json({ limit: '2mb' }), aiChatHandler);


const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Startup checks ────────────────────────────────────────────────────────────
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
  console.log(`[server] CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] WARNING: SUPABASE_SERVICE_ROLE_KEY not set — admin actions will fail');
  if (!process.env.GROQ_API_KEY) console.warn('[server] WARNING: GROQ_API_KEY not set — AI features disabled');
  if (!AI_INTERNAL_KEY) console.warn('[server] WARNING: AI_INTERNAL_KEY not set — set in production via env');
});
