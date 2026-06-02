import { useState, useEffect } from "react";
import { useRoute, match, navigate } from "./router";
import { useAuth } from "./auth";
import { ErrorBoundary } from "./ui/error-boundary";
import { Sidebar } from "./layout/sidebar";
import { Header } from "./layout/header";
import { Footer } from "./layout/footer";
import { Login } from "./pages/login";
import { Dashboard } from "./pages/dashboard";
import { Traces } from "./pages/traces";
import { TraceDetail } from "./pages/trace-detail";
import { Scripts } from "./pages/scripts";
import { ScriptDetailPage } from "./pages/script-detail";
import { NewScript } from "./pages/new-script";
import { Store } from "./pages/store";
import { AgentsList, AgentDetailPage } from "./pages/agents";
import { Settings, Users } from "./pages/settings";
import { Help, CommandPalette } from "./pages/help";
import { Icon } from "./ui/icon";
import { TweaksPanel, useTweaks } from "./ui/tweaks-panel";
import { useT } from "./i18n/context";
import { preloadMonaco } from "./ui/monaco-editor";

function isTallPage(_p: string) {
  return false;
}

function RoleGuard({ need }: { need: string }) {
  const t = useT();
  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <div
        className="rounded-[var(--r-lg)] border border-[var(--border)] text-center"
        style={{ background: "var(--bg-1)", padding: "40px 28px" }}
      >
        <div
          className="mx-auto mb-4 grid place-items-center rounded-xl border border-[var(--border)]"
          style={{ width: 46, height: 46, background: "var(--bg-2)", color: "var(--st-halted)" }}
        >
          <Icon name="alert" size={22} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>
          {t("common.insufficient_permissions")}
        </h2>
        <p style={{ margin: "0 0 18px", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          {t("common.requires_role", { role: need })}
        </p>
      </div>
    </div>
  );
}

function Routed({ path, role, theme }: { path: string; role: string; theme: "dark" | "light" }) {
  const t = useT();
  let m;
  if (match("/", path)) return <Dashboard />;
  if (match("/traces", path)) return <Traces />;
  if ((m = match("/traces/:id", path))) return <TraceDetail id={m["id"]!} />;
  if (match("/scripts", path)) return <Scripts role={role} />;
  if (path === "/scripts/new")
    return role === "architect" || role === "admin" ? <NewScript theme={theme} /> : <RoleGuard need="architect" />;
  if (path.startsWith("/scripts/") && path !== "/scripts/new") {
    const ref = path.slice("/scripts/".length);
    return <ScriptDetailPage scriptRef={ref} role={role} theme={theme} />;
  }
  if (match("/store", path)) return <Store />;
  if (match("/agents", path)) return <AgentsList />;
  if ((m = match("/agents/:id", path))) return <AgentDetailPage id={m["id"]!} />;
  if (match("/help", path)) return <Help />;
  if ((m = match("/help/:slug", path))) return <Help slug={m["slug"]!} />;
  if (match("/settings", path)) return <Settings role={role} />;
  if (match("/settings/users", path))
    return role === "admin" ? <Users /> : <RoleGuard need="admin" />;

  return (
    <div className="flex flex-col items-center justify-center gap-2.5" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "var(--fs-base)" }}>{t("common.not_found")}</div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)" }}>{path}</div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const [tweaks, setTweak] = useTweaks({ theme: "dark", accent: "indigo", density: "comfortable", font: "inter" });
  const { authed, user, loading, error, login, logout, fetchMe } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { setDrawer(false); }, [route.path]);

  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", tweaks["theme"]!);
    r.setAttribute("data-accent", tweaks["accent"]!);
    r.setAttribute("data-density", tweaks["density"]!);
    r.setAttribute("data-font", tweaks["font"]!);
  }, [tweaks]);

  useEffect(() => {
    if (authed) {
      fetchMe();
      preloadMonaco();
    }
  }, [authed, fetchMe]);

  const theme = tweaks["theme"] as "dark" | "light";
  const toggleTheme = () => setTweak("theme", theme === "dark" ? "light" : "dark");

  const handleLogout = () => { logout(); navigate("/"); };

  if (!authed) return <Login onLogin={login} loading={loading} error={error} />;

  const role = user.role;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="zs-sidebar-desktop h-full">
        <Sidebar route={route} collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {drawer && (
        <>
          <div onClick={() => setDrawer(false)} className="fixed inset-0 z-40" style={{ background: "var(--overlay)" }} />
          <div className="fixed left-0 top-0 bottom-0 z-[41]">
            <Sidebar route={route} collapsed={false} setCollapsed={() => setDrawer(false)} onNavigate={() => setDrawer(false)} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          route={route}
          theme={theme}
          onToggleTheme={toggleTheme}
          onHamburger={() => setDrawer(true)}
          onOpenTweaks={() => setTweaksOpen((o) => !o)}
          user={user}
          role={role}
          onLogout={handleLogout}
        />
        <main className="min-h-0 flex-1" style={{ overflow: isTallPage(route.path) ? "hidden" : "auto" }}>
          <div style={{
            maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--pad)",
            height: isTallPage(route.path) ? "100%" : "auto",
            display: isTallPage(route.path) ? "flex" : "block",
            flexDirection: "column",
          }}>
            <div style={{ flex: isTallPage(route.path) ? 1 : "none", minHeight: 0, display: isTallPage(route.path) ? "flex" : "block", flexDirection: "column" }}>
              <ErrorBoundary resetKey={route.path}>
                <Routed path={route.path} role={role} theme={theme} />
              </ErrorBoundary>
            </div>
          </div>
        </main>
        <Footer />
      </div>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
      <CommandPalette />
    </div>
  );
}
