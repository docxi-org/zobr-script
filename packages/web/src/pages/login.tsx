import { useState } from "react";
import { Icon } from "../ui/icon";

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string;
}

export function Login({ onLogin, loading, error }: LoginProps) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    if (!email) return;
    if (!pw) return;
    await onLogin(email, pw);
  };

  return (
    <div
      className="grid min-h-screen place-items-center"
      style={{ background: "var(--bg-0)", padding: 24 }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="mb-7 flex flex-col items-center gap-3.5">
          <div
            className="grid place-items-center rounded-xl"
            style={{
              width: 48, height: 48,
              background: "var(--accent)", color: "var(--accent-fg)",
              fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em",
            }}
          >
            ZS
          </div>
          <div className="text-center">
            <div style={{ fontWeight: 700, fontSize: 17 }}>Zobr Script</div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
              Sign in to the console
            </div>
          </div>
        </div>

        <div
          className="rounded-[var(--r-lg)] border border-[var(--border)]"
          style={{ background: "var(--bg-1)", padding: 24 }}
        >
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] outline-none"
                style={{ height: 34, padding: "0 12px", background: "var(--bg-2)", color: "var(--text-0)", fontSize: "var(--fs-sm)", fontFamily: "inherit" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <div>
              <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>
                Password
              </label>
              <div className="relative">
                <input
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] outline-none"
                  style={{ height: 34, padding: "0 36px 0 12px", background: "var(--bg-2)", color: "var(--text-0)", fontSize: "var(--fs-sm)", fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-0 top-0 grid cursor-pointer place-items-center border-none"
                  style={{ width: 34, height: 34, background: "transparent", color: "var(--text-3)" }}
                >
                  <Icon name={showPw ? "x" : "search"} size={14} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5" style={{ fontSize: "var(--fs-sm)", color: "var(--trust-error)" }}>
                <Icon name="x" size={14} />
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="mt-1 w-full cursor-pointer rounded-[var(--r-md)] border-none"
              style={{
                height: 40,
                background: "var(--accent)", color: "var(--accent-fg)",
                fontSize: "var(--fs-sm)", fontWeight: 600,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>
          Accounts are created by an administrator. No self-registration.
        </p>
      </div>
    </div>
  );
}
