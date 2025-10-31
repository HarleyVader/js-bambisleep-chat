import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details
        console.error('React Error Boundary caught an error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-container">
                        <h2>🚨 Something went wrong</h2>
                        <details style={{ whiteSpace: 'pre-wrap', color: '#ff6b6b' }}>
                            <summary>Error Details</summary>
                            <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
                            <p><strong>Stack Trace:</strong></p>
                            <pre>{this.state.errorInfo.componentStack}</pre>
                        </details>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                marginTop: '20px',
                                backgroundColor: '#ff6b6b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            🔄 Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;