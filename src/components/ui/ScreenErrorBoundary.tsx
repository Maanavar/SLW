import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

const RUNTIME_RECOVERY_KEY = 'slw.runtime.recovered.once';
const RECOVERABLE_RUNTIME_ERROR_RE =
  /(Cannot read properties of null \(reading 'useRef'\)|Invalid hook call|Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed)/i;

function isRecoverableRuntimeError(message: string): boolean {
  return RECOVERABLE_RUNTIME_ERROR_RE.test(message);
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error): void {
    console.error(`[${this.props.screenName ?? 'Screen'}] Unhandled error:`, error);

    // Try a single self-heal reload for stale chunk/runtime mismatch issues.
    if (typeof window !== 'undefined' && isRecoverableRuntimeError(error.message)) {
      try {
        const alreadyRecovered = sessionStorage.getItem(RUNTIME_RECOVERY_KEY) === '1';
        if (!alreadyRecovered) {
          sessionStorage.setItem(RUNTIME_RECOVERY_KEY, '1');
          window.location.reload();
        }
      } catch {
        // If storage is unavailable, keep the boundary fallback UI.
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '32px',
            gap: '12px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '16px', color: '#111827' }}>
              {this.props.screenName ? `${this.props.screenName} failed to load` : 'This screen encountered an error'}
            </p>
            {this.state.errorMessage && (
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                border: 'none',
                background: '#111827',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
