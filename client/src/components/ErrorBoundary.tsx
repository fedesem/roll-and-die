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
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(245,198,92,0.1),transparent_28%),linear-gradient(180deg,#090b0f,#10131b)] p-6">
        <section className="w-full max-w-2xl rounded-none border border-amber-200/12 bg-slate-950/82 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-200/55">Application Error</p>
          <h1 className="mt-3 font-serif text-3xl text-amber-50">Something broke in the client.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Reload the app to recover. If the problem persists, check the browser console for the captured stack trace.
          </p>
          <button type="button" className="mt-5 inline-flex h-11 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24" onClick={() => window.location.reload()}>
            Reload
          </button>
          <pre className="mt-5 overflow-auto rounded-none border border-white/8 bg-white/[0.03] p-4 text-sm text-rose-200">{this.state.error.message}</pre>
        </section>
      </main>
    );
  }
}
