import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundaryInner extends Component<
  { children: ReactNode; resetKey: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed:', error, info);
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-50 p-6">
          <section className="mx-auto mt-16 max-w-2xl rounded-3xl border border-red-100 bg-white p-8 shadow-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">Page recovered safely</p>
            <h1 className="mt-3 text-3xl font-black text-slate-950">This page hit a loading problem.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The rest of the system is still protected. Try again, or go back to the dashboard while we keep the app
              from turning into a blank white screen.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => window.location.reload()} type="button">
                Reload page
              </button>
              <a className="btn-ghost" href="/">
                Go Home
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundaryInner resetKey={location.pathname}>{children}</ErrorBoundaryInner>;
}
