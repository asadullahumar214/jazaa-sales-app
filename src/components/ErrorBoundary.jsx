import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL_UI_ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          background: '#fef2f2',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2 style={{ color: '#b91c1c' }}>Something went wrong.</h2>
          <p style={{ color: '#7f1d1d', maxWidth: '400px' }}>
            The application encountered an unexpected error. This usually happens due to a slow connection or stale cache.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
             <button 
                onClick={() => window.location.reload(true)} 
                style={{
                    padding: '0.75rem 1.5rem',
                    background: '#b91c1c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                }}
             >
                Hard Refresh App
             </button>
             <button 
                onClick={() => { localStorage.clear(); window.location.href = '/'; }} 
                style={{
                    padding: '0.75rem 1.5rem',
                    background: '#4b5563',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                }}
             >
                Clear Data & Reset
             </button>
          </div>
          <details style={{ marginTop: '2rem', textAlign: 'left', opacity: 0.5 }}>
            <summary>Error Details (for developers)</summary>
            <pre style={{ fontSize: '0.75rem' }}>{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
