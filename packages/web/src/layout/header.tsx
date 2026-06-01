import { useEffect, useState } from "react";
import { Icon } from "../ui/icon";
import type { Route } from "../router";
import type { User } from "../auth";
import { useT } from "../i18n/context";

function crumbFor(route: Route, t: (k: string) => string): string[] {
  const CRUMB: Record<string, string> = {
    "/": t("nav.dashboard"),
    "/traces": t("nav.traces"),
    "/scripts": t("nav.scripts"),
    "/scripts/new": t("new_script.title"),
    "/store": t("nav.store"),
    "/agents": t("nav.agents"),
    "/help": t("nav.help"),
    "/settings": t("nav.settings"),
    "/settings/users": t("users.title"),
  };
  if (CRUMB[route.path]) return [CRUMB[route.path]!];
  if (route.path.startsWith("/traces/"))
    return [t("nav.traces"), route.path.split("/")[2]!];
  if (route.path.startsWith("/scripts/"))
    return [t("nav.scripts"), route.path.slice("/scripts/".length)];
  if (route.path.startsWith("/agents/"))
    return [t("nav.agents"), route.path.split("/")[2]!];
  if (route.path.startsWith("/help/"))
    return [t("nav.help"), route.path.split("/")[2]!];
  return ["Dashboard"];
}

interface HeaderProps {
  route: Route;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onHamburger: () => void;
  user: User;
  role: string;
  onLogout: () => void;
}

export function Header({
  route,
  theme,
  onToggleTheme,
  onHamburger,
  user,
  role,
  onLogout,
}: HeaderProps) {
  const t = useT();
  const crumbs = crumbFor(route, t as (k: string) => string);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    if (!userMenu) return;
    const close = () => setUserMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [userMenu]);

  return (
    <header
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center border-b border-[var(--border)]"
      style={{ padding: "0 16px", background: "var(--bg-0)", gap: 12 }}
    >
      {/* hamburger (mobile) */}
      <button
        className="zs-hamburger hidden border-none"
        onClick={onHamburger}
        style={{
          background: "transparent",
          cursor: "pointer",
          color: "var(--text-1)",
          padding: 4,
        }}
      >
        <Icon name="hamburger" size={20} />
      </button>

      {/* breadcrumb */}
      <div
        className="flex min-w-0 items-center"
        style={{ gap: 7, fontSize: "var(--fs-sm)" }}
      >
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center" style={{ gap: 7 }}>
            {i > 0 && (
              <Icon name="chevronRight" size={13} style={{ color: "var(--text-3)" }} />
            )}
            <span
              className={i === crumbs.length - 1 && i > 0 ? "mono" : ""}
              style={{
                color: i === crumbs.length - 1 ? "var(--text-0)" : "var(--text-2)",
                fontWeight: i === crumbs.length - 1 ? 600 : 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 320,
              }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1" />

      {/* theme toggle */}
      <button
        onClick={onToggleTheme}
        title="Toggle theme"
        className="grid cursor-pointer place-items-center rounded-[var(--r-md)] border border-[var(--border)]"
        style={{ width: 32, height: 32, background: "var(--bg-1)", color: "var(--text-1)" }}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
      </button>

      {/* user section */}
      <div className="flex items-center gap-2" style={{ paddingLeft: 4 }}>
        {/* email */}
        <div className="zs-user-meta text-right" style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>
            {user.email}
          </div>
        </div>

        {/* role badge */}
        <span
          className="inline-flex items-center rounded-full"
          style={{
            height: 22,
            padding: "0 8px",
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            background: "color-mix(in oklch, var(--accent) calc(var(--tint) * 100%), transparent)",
            color: "var(--accent)",
          }}
        >
          {role}
        </span>

        {/* user avatar + menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setUserMenu((v) => !v); }}
            title="Account"
            className="grid cursor-pointer place-items-center rounded-full border border-[var(--border)]"
            style={{
              width: 30,
              height: 30,
              background: "var(--bg-3)",
              fontWeight: 700,
              fontSize: 12,
              color: "var(--text-0)",
            }}
          >
            {(user.email[0] ?? "?").toUpperCase()}
          </button>
          {userMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 z-60 overflow-hidden rounded-[var(--r-lg)]"
              style={{
                top: 38,
                width: 230,
                background: "var(--bg-1)",
                border: "1px solid var(--border-2)",
                boxShadow: "var(--shadow)",
                padding: 5,
              }}
            >
              <div
                className="mb-1 border-b border-[var(--border)]"
                style={{ padding: "8px 9px 9px" }}
              >
                <div
                  className="overflow-hidden text-ellipsis"
                  style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}
                >
                  {user.email}
                </div>
                <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", marginTop: 2 }}>
                  Signed in · {role}
                </div>
              </div>
              <button
                onClick={() => { setUserMenu(false); onLogout(); }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-md)] border-none text-left"
                style={{
                  padding: "8px 9px",
                  background: "transparent",
                  color: "var(--trust-error)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "color-mix(in oklch, var(--trust-error) 12%, transparent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Icon name="logout" size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
