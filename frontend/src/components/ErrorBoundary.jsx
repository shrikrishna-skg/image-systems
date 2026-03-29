import { Component } from "react";

/**
 * Catches render errors so a single broken view does not blank the entire SPA.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] px-6 py-16 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
          <p className="mt-2 max-w-md mx-auto text-sm text-neutral-600">
            Please reload the page. If this keeps happening, try signing out and back in, or contact support with
            what you were doing when it failed.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
