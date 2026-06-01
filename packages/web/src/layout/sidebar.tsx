import { Icon } from "../ui/icon";
import type { Route } from "../router";

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/traces", label: "Traces", icon: "activity" },
  { to: "/scripts", label: "Scripts", icon: "filecode" },
  { to: "/store", label: "Store", icon: "database" },
  { to: "/agents", label: "Agents", icon: "users" },
  { to: "/help", label: "Help", icon: "doc" },
  { to: "/settings", label: "Settings", icon: "settings" },
] as const;

interface SidebarProps {
  route: Route;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onNavigate?: () => void;
}

export function Sidebar({ route, collapsed, setCollapsed, onNavigate }: SidebarProps) {
  const isActive = (to: string) => {
    if (to === "/") return route.path === "/";
    return route.path === to || route.path.startsWith(to + "/");
  };

  return (
    <aside
      className="flex h-full flex-col border-r border-[var(--border)]"
      style={{
        width: collapsed ? 64 : 240,
        background: "var(--bg-1)",
        transition: "width .18s var(--ease)",
        flexShrink: 0,
      }}
    >
      {/* brand */}
      <div
        className="flex h-12 shrink-0 items-center border-b border-[var(--border)]"
        style={{
          padding: collapsed ? 0 : "0 16px",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
        }}
      >
        <div
          className="grid shrink-0 place-items-center rounded-[7px]"
          style={{
            width: 26,
            height: 26,
            background: "var(--accent)",
            color: "var(--accent-fg)",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "-0.02em",
          }}
        >
          ZS
        </div>
        {!collapsed && (
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>
            Zobr Script
          </div>
        )}
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
        {NAV.map((n) => {
          const on = isActive(n.to);
          return (
            <a
              key={n.to}
              href={"#" + n.to}
              title={collapsed ? n.label : undefined}
              onClick={onNavigate}
              className="relative flex items-center rounded-[var(--r-md)] transition-colors"
              style={{
                gap: 11,
                height: 36,
                padding: collapsed ? 0 : "0 11px",
                justifyContent: collapsed ? "center" : "flex-start",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                color: on ? "var(--text-0)" : "var(--text-1)",
                background: on ? "var(--bg-2)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!on) e.currentTarget.style.background = "var(--bg-2)";
              }}
              onMouseLeave={(e) => {
                if (!on) e.currentTarget.style.background = "transparent";
              }}
            >
              {on && (
                <span
                  className="absolute rounded-full"
                  style={{
                    left: -10,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    background: "var(--accent)",
                  }}
                />
              )}
              <Icon
                name={n.icon}
                size={17}
                style={{ color: on ? "var(--accent)" : "var(--text-2)" }}
              />
              {!collapsed && n.label}
            </a>
          );
        })}
      </nav>

      {/* collapse toggle */}
      <div className="border-t border-[var(--border)] p-2.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center rounded-[var(--r-md)] border-none"
          style={{
            gap: 10,
            height: 34,
            padding: collapsed ? 0 : "0 11px",
            justifyContent: collapsed ? "center" : "flex-start",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-2)",
            fontSize: "var(--fs-sm)",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name={collapsed ? "chevronsRight" : "chevronsLeft"} size={16} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
