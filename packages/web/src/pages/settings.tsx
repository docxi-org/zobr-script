import { useState, useMemo } from "react";
import { Icon } from "../ui/icon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { DataTable, type Column } from "../ui/data-table";
import { SectionTitle } from "../ui/section-title";
import { fmtDuration, timeAgo } from "../ui/helpers";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import { api } from "../api/client";
import { useLocale, useT, type Locale } from "../i18n/context";
import { Segmented } from "../ui/segmented";
import type { StatusResponse } from "../api/types";

const NOW = Date.now();

interface UserRecord {
  id: string;
  email: string;
  role: string;
  active: boolean;
  created_at: number;
  last_login: number | null;
}

export function Settings({ role }: { role: string }) {
  const { data: status } = useApi<StatusResponse>("/status");
  const { locale, setLocale } = useLocale();
  const t = useT();
  const cfg = status?.config;

  const items = cfg ? [
    { label: "invocationTtlMs", value: cfg.invocationTtlMs, hint: fmtDuration(cfg.invocationTtlMs) },
    { label: "awaitingTtlMs", value: cfg.awaitingTtlMs, hint: fmtDuration(cfg.awaitingTtlMs) },
    { label: "maxActiveInvocations", value: cfg.maxActiveInvocations },
    { label: "budgets.steps", value: cfg.budgets.steps },
    { label: "budgets.iterations", value: cfg.budgets.iterations },
    { label: "version", value: status?.version ?? "—" },
  ] : [];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("settings.title")}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{t("settings.subtitle")}</p>
      </div>

      <Card pad={false}>
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center" style={{ padding: "13px 18px", gap: 16, borderBottom: i === items.length - 1 ? "none" : "1px solid var(--border)" }}>
            <span className="mono flex-1" style={{ fontSize: "var(--fs-sm)", color: "var(--text-1)", fontWeight: 600 }}>{it.label}</span>
            {it.hint && <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>{it.hint}</span>}
            <span className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text-0)", fontWeight: 600 }}>{String(it.value)}</span>
          </div>
        ))}
      </Card>

      <div className="mt-5">
        <SectionTitle title={t("settings.user_management")} hint={t("settings.admin_only")} />
        <Card className="flex items-center" style={{ gap: 12, color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          <Icon name="users" size={16} />
          <span className="flex-1">{t("settings.manage_users")}</span>
          {role === "admin"
            ? <Button variant="primary" size="sm" icon="external" onClick={() => navigate("/settings/users")}>{t("settings.open")}</Button>
            : <Badge color="var(--text-2)">{t("settings.requires_admin")}</Badge>}
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle title={t("settings.language")} />
        <Card className="flex items-center" style={{ gap: 16, fontSize: "var(--fs-sm)" }}>
          <Icon name="doc" size={16} style={{ color: "var(--text-2)" }} />
          <span style={{ color: "var(--text-2)", flex: 1 }}>{t("settings.language_hint")}</span>
          <Segmented
            value={locale}
            onChange={(v) => setLocale(v as Locale)}
            options={[{ value: "en", label: "English" }, { value: "ru", label: "Русский" }]}
          />
        </Card>
      </div>
    </div>
  );
}

export function Users() {
  const t = useT();
  const { data, refetch } = useApi<{ users: UserRecord[] }>("/users");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", pw: "", role: "executor" });
  const [err, setErr] = useState("");

  const users = data?.users ?? [];

  const create = async () => {
    if (!form.email.trim()) { setErr("Email is required."); return; }
    if (!form.pw.trim()) { setErr("Temporary password is required."); return; }
    try {
      await api.post("/users", { email: form.email.trim(), password: form.pw, role: form.role });
      setForm({ email: "", pw: "", role: "executor" });
      setCreating(false);
      setErr("");
      refetch();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const updateRole = async (id: string, role: string) => {
    await api.put(`/users/${id}`, { role });
    refetch();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await api.put(`/users/${id}`, { active: !active });
    refetch();
  };

  const roleColor = (r: string) => r === "architect" ? "var(--accent)" : r === "admin" ? "var(--trust-authority)" : "var(--text-2)";

  const columns = useMemo((): Column<UserRecord>[] => [
    { key: "email", label: "Email", sortable: true, sortVal: (r) => r.email, render: (r) => <span className="inline-flex items-center" style={{ gap: 9, fontWeight: 600, opacity: r.active ? 1 : 0.5 }}><span className="grid place-items-center rounded-full border border-[var(--border)]" style={{ width: 26, height: 26, background: "var(--bg-3)", fontSize: 11, fontWeight: 700 }}>{(r.email[0] ?? "?").toUpperCase()}</span>{r.email}</span> },
    { key: "role", label: "Role", width: 150, render: (r) => (
      <div className="relative inline-block">
        <select value={r.role} onChange={(e) => updateRole(r.id, e.target.value)}
          style={{ appearance: "none", height: 26, padding: "0 26px 0 9px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: "var(--fs-xs)", border: "none", fontFamily: "inherit", background: `color-mix(in oklch, ${roleColor(r.role)} calc(var(--tint) * 100%), transparent)`, color: roleColor(r.role) }}>
          <option value="executor">executor</option><option value="architect">architect</option><option value="admin">admin</option>
        </select>
      </div>
    ) },
    { key: "created", label: "Created", mono: true, muted: true, sortable: true, sortVal: (r) => r.created_at, render: (r) => timeAgo(r.created_at, NOW) + " ago" },
    { key: "last", label: "Last login", mono: true, muted: true, sortable: true, sortVal: (r) => r.last_login ?? 0, render: (r) => r.last_login ? timeAgo(r.last_login, NOW) + " ago" : "never" },
    { key: "status", label: "Status", sortable: true, sortVal: (r) => r.active ? 1 : 0, render: (r) => r.active ? <Badge color="var(--st-done)">active</Badge> : <Badge color="var(--text-2)">deactivated</Badge> },
    { key: "actions", label: "", align: "right", render: (r) => <Button size="sm" variant={r.active ? "danger" : "outline"} onClick={() => toggleActive(r.id, r.active)}>{r.active ? t("users.deactivate") : t("users.reactivate")}</Button> },
  ], [t, updateRole, toggleActive]);

  return (
    <div style={{ maxWidth: 920 }}>
      <a href="#/settings" className="mb-3 inline-flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}><Icon name="arrowLeft" size={14} /> Settings</a>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 16, marginBottom: "var(--gap)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("users.title")}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{users.filter((u) => u.active).length} active · {users.length} total</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => { setCreating((c) => !c); setErr(""); }}>{t("users.new_user")}</Button>
      </div>

      {creating && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 700, marginBottom: 14 }}>{t("users.create_user")}</div>
          <div className="zs-newuser grid items-end" style={{ gridTemplateColumns: "2fr 2fr 1.2fr auto", gap: 12 }}>
            <div>
              <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>Email</label>
              <Input value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="new@docxi.org" />
            </div>
            <div>
              <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>Temporary password</label>
              <Input value={form.pw} onChange={(v) => setForm((f) => ({ ...f, pw: v }))} placeholder="tempPass123" mono />
            </div>
            <div>
              <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>Role</label>
              <Select value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={["executor", "architect", "admin"]} width="100%" />
            </div>
            <Button variant="primary" onClick={create}>Create</Button>
          </div>
          {err && <div className="mt-3 flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--trust-error)" }}><Icon name="x" size={14} />{err}</div>}
        </Card>
      )}

      <DataTable rowKey={(r) => r.id} columns={columns} rows={users} />
    </div>
  );
}
