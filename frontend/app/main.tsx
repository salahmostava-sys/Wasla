import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { installGlobalErrorMonitoring } from "@shared/lib/logger";
import { isLikelyStaleChunkReason, reloadOnceForStaleChunk } from "@shared/lib/chunkLoadRecovery";
import i18n from '@app/i18n';

// ── Environment validation ────────────────────────────────────────────────────
// Fail fast with a clear message instead of cryptic Supabase/auth errors later.
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const;

const missingEnv = REQUIRED_ENV_VARS.filter(
  (key) => !import.meta.env[key],
);

if (missingEnv.length > 0) {
  const list = missingEnv.map((k) => `  • ${k}`).join('\n');
  throw new Error(
    `[startup] Missing required environment variables:\n${list}\n\n` +
    'Copy .env.example to .env.local and fill in the values.',
  );
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // This app renders employee, salary, and banking data in the DOM.
        // Keep Replay masked by default unless a future screen is explicitly unmasked.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    environment: import.meta.env.MODE,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
  });
}

const SentryFallback = () => (
  <div dir={i18n.dir()} className="min-h-screen w-full bg-background px-4">
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center">
      <div className="w-full rounded-2xl border border-border bg-card p-6 text-center shadow-card">
        <p className="text-base font-semibold text-foreground">
          {i18n.t('unexpectedError')}
        </p>
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {i18n.t('refresh')}
        </button>
      </div>
    </div>
  </div>
);

globalThis.addEventListener("vite:preloadError", () => {
  reloadOnceForStaleChunk();
});

globalThis.addEventListener("unhandledrejection", (event) => {
  if (isLikelyStaleChunkReason(event.reason)) {
    event.preventDefault();
    reloadOnceForStaleChunk();
  }
});

globalThis.addEventListener(
  "error",
  (event) => {
    const msg = event.message || "";
    if (msg && isLikelyStaleChunkReason(msg)) {
      event.preventDefault();
      reloadOnceForStaleChunk();
    }
  },
  true,
);

installGlobalErrorMonitoring();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <ErrorBoundary>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </ErrorBoundary>
);
