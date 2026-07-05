import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@services/serviceError';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CardErrorBoundary caught an error:', error, errorInfo);
  }

  private readonly handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center space-y-3">
          <div className="bg-destructive/20 p-3 rounded-full">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {this.props.title || 'تعذر تحميل هذا القسم'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {getErrorMessage(this.state.error, 'حدث خطأ غير متوقع أثناء معالجة البيانات.')}
            </p>
          </div>
          {this.props.onRetry && (
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 mt-2 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors border border-destructive/20"
            >
              <RefreshCw className="h-3 w-3" />
              إعادة المحاولة
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
