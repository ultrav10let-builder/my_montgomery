// @ts-nocheck
import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
          <h1 className="text-xl font-bold text-slate-900 mb-4">Something went wrong</h1>
          <pre className="text-sm text-red-600 bg-red-50 p-4 rounded-lg max-w-2xl overflow-auto">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.handleReset}
            className="mt-6 px-4 py-2 bg-civic-blue text-white rounded-lg hover:bg-civic-blue/90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
