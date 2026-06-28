import toastHot from "react-hot-toast";

export type AppToastOptions = {
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
};

const POSITION = "top-center" as const;

function formatBody(message: string, description?: string): string {
  return description ? `${message}\n${description}` : message;
}

function toastError(message: string, options?: AppToastOptions) {
  const { description, action, duration } = options ?? {};
  if (action) {
    return toastHot.custom(
      (t) => (
        <div
          dir="rtl"
          className="border border-border bg-card px-4 py-3 shadow-card text-sm text-foreground max-w-md rounded-2xl"
        >
          <p className="font-medium">{message}</p>
          {description ? (
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{description}</p>
          ) : null}
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              action.onClick();
              toastHot.dismiss(t.id);
            }}
          >
            {action.label}
          </button>
        </div>
      ),
      { duration: duration ?? 10_000, position: POSITION },
    );
  }
  return toastHot.error(formatBody(message, description), {
    duration: duration ?? 4000,
    position: POSITION,
  });
}

function toastSuccess(message: string, options?: AppToastOptions) {
  const { description, duration } = options ?? {};
  return toastHot.success(formatBody(message, description), {
    duration: duration ?? 4000,
    position: POSITION,
  });
}

function toastWarning(message: string, options?: AppToastOptions) {
  const { description, duration } = options ?? {};
  return toastHot(formatBody(message, description), {
    duration: duration ?? 4000,
    position: POSITION,
    icon: '⚠️',
  });
}

/** Sonner-compatible API backed by react-hot-toast */
export const toast = {
  success: toastSuccess,
  error: toastError,
  warning: toastWarning,
  dismiss: toastHot.dismiss,
  promise: toastHot.promise,
  loading: toastHot.loading,
  custom: toastHot.custom,
};
