import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Client error boundary caught an error.", error, errorInfo);
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="fatal-screen">
        <section className="dark-card fatal-card">
          <p className="panel-label">Application Error</p>
          <h1>Something broke in the client.</h1>
          <p className="panel-caption">
            Reload the app to recover. If the problem persists, check the browser console for the captured stack trace.
          </p>
          <button type="button" className="accent-button" onClick={() => window.location.reload()}>
            Reload
          </button>
          <pre className="fatal-stack">{this.state.error.message}</pre>
        </section>
      </main>
    );
  }
}
