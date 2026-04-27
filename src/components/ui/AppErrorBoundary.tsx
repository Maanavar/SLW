import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled app error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: '#f7f7f8',
            color: '#1f2937',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h1 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Something went wrong</h1>
            <p style={{ margin: '0 0 16px 0', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering this page.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                border: 'none',
                background: '#111827',
                color: '#ffffff',
                padding: '10px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
