import { Component, type ReactNode } from 'react';
import { getErrorContextSnapshot } from '@shared/lib/errorContextMeta';
import { logger } from '@shared/lib/logger';
import { isLikelyStaleChunkReason, reloadOnceForStaleChunk } from '@shared/lib/chunkLoadRecovery';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

function extractCauseMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === 'object' && cause !== null) {
    try {
      return JSON.stringify(cause);
    } catch {
      return `[Object ${cause.constructor?.name || ''}]`.trim();
    }
  }
  if (typeof cause === 'string') {
    return cause;
  }
  if (typeof cause === 'number' || typeof cause === 'boolean' || typeof cause === 'bigint') {
    return String(cause);
  }
  if (typeof cause === 'symbol' || typeof cause === 'function') {
    return cause.toString();
  }
  return '';
}

function extractErrorMessage(error: Error): string {
  if (error.message) {
    return error.message;
  }
  if ('cause' in error && error.cause) {
    return extractCauseMessage(error.cause) || String(error);
  }
  return String(error);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    /* فشل تحميل chunk بعد نشر جديد — إعادة تحميل كاملة قبل عرض شاشة الخطأ */
    if (isLikelyStaleChunkReason(error) && reloadOnceForStaleChunk()) {
      return;
    }
    logger.error('App crashed', error, { meta: getErrorContextSnapshot() });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = extractErrorMessage(this.state.error);
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-card border border-border -2xl shadow-card p-6 space-y-3 rounded-2xl">
          <h1 className="text-lg font-bold">حدث خطأ أثناء تشغيل الصفحة</h1>
          <p className="text-sm text-muted-foreground">
            لو الشاشة كانت بيضاء، صوّر هذه الرسالة وأرسلها لنا.
          </p>
          <pre className="text-xs overflow-auto max-h-[50vh] rounded-xl bg-muted/40 p-4 whitespace-pre-wrap break-words">
            {message}
          </pre>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm"
              onClick={() => globalThis.location.reload()}
              type="button"
            >
              إعادة تحميل
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-border text-sm"
              onClick={() => this.setState({ error: null })}
              type="button"
            >
              تجاهل
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
