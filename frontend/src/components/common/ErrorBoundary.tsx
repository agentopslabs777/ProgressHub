import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f7f9f7] flex items-center justify-center p-4">
          <div className="panel max-w-lg w-full p-8 bg-white border border-[#d8e2d8] rounded-3xl shadow-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#faecea] text-[#b8483d] flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-black text-[#21352d]">Something went wrong</h2>
            <p className="text-xs text-[#6e7f76] max-w-md mx-auto">
              {this.state.error?.message || 'An unexpected rendering error occurred. Please refresh or return to the platform dashboard.'}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-primary text-xs py-2 px-5 font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <RefreshCw size={13} />
                <span>Reload Page</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="btn btn-outline text-xs py-2 px-5 font-bold flex items-center justify-center gap-1.5"
              >
                <Home size={13} />
                <span>Return to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
