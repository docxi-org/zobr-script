import { Component, type ReactNode, type ErrorInfo } from "react";
import { Icon } from "./icon";
import { useT } from "../i18n/context";

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ padding: "56px 24px", color: "var(--text-2)", textAlign: "center" }}
    >
      <div
        className="mx-auto mb-4 grid place-items-center rounded-xl border border-[var(--border)]"
        style={{ width: 46, height: 46, background: "var(--bg-2)", color: "var(--trust-error)" }}
      >
        <Icon name="alert" size={22} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-0)", marginBottom: 6 }}>
        {t("error.title")}
      </div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--trust-error)", maxWidth: 500, marginBottom: 16 }}>
        {error.message}
      </div>
      <button
        onClick={onReset}
        className="cursor-pointer rounded-[var(--r-md)] border-none"
        style={{
          height: 34, padding: "0 16px",
          background: "var(--accent)", color: "var(--accent-fg)",
          fontSize: "var(--fs-sm)", fontWeight: 600,
        }}
      >
        {t("error.go_dashboard")}
      </button>
    </div>
  );
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <ErrorFallback
        error={this.state.error}
        onReset={() => { this.setState({ error: null }); window.location.hash = "/"; }}
      />
    );
  }
}
