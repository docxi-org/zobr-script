import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { config } from "./config";
import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

type DB = ReturnType<typeof Database>;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function initSchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_secret TEXT,
      client_secret_expires_at INTEGER,
      redirect_uris TEXT NOT NULL,
      grant_types TEXT NOT NULL,
      response_types TEXT NOT NULL,
      client_name TEXT,
      token_endpoint_auth_method TEXT,
      client_id_issued_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      state TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      access_token TEXT PRIMARY KEY,
      refresh_token TEXT,
      client_id TEXT NOT NULL,
      scopes TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

export class ZsOAuthClientsStore implements OAuthRegisteredClientsStore {
  constructor(private db: DB) {}

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const row = this.db.prepare("SELECT data FROM oauth_clients WHERE client_id = ?").get(clientId) as { data: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data) as OAuthClientInformationFull;
  }

  registerClient(client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">): OAuthClientInformationFull {
    const clientId = randomBytes(16).toString("hex");
    const now = Math.floor(Date.now() / 1000);
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: now,
    } as OAuthClientInformationFull;
    this.db.prepare("INSERT INTO oauth_clients (client_id, client_secret, redirect_uris, grant_types, response_types, client_name, token_endpoint_auth_method, client_id_issued_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      clientId,
      full.client_secret ?? null,
      JSON.stringify(full.redirect_uris),
      JSON.stringify(full.grant_types ?? []),
      JSON.stringify(full.response_types ?? []),
      full.client_name ?? null,
      full.token_endpoint_auth_method ?? "none",
      now,
      JSON.stringify(full),
    );
    return full;
  }
}

export interface ZsOAuthProviderConfig {
  readonly dbPath: string;
  readonly issuerUrl: string;
  readonly checkCredentials: (email: string, password: string) => boolean;
}

export class ZsOAuthProvider implements OAuthServerProvider {
  readonly #db: DB;
  readonly #clients: ZsOAuthClientsStore;
  readonly #issuerUrl: string;
  readonly #checkCredentials: (email: string, password: string) => boolean;

  constructor(config: ZsOAuthProviderConfig) {
    this.#db = new Database(config.dbPath);
    this.#db.pragma("journal_mode = WAL");
    initSchema(this.#db);
    this.#clients = new ZsOAuthClientsStore(this.#db);
    this.#issuerUrl = config.issuerUrl;
    this.#checkCredentials = config.checkCredentials;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this.#clients;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const code = generateToken();
    this.#db.prepare("INSERT INTO oauth_codes (code, client_id, redirect_uri, code_challenge, state, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      code, client.client_id, params.redirectUri, params.codeChallenge, params.state ?? null, Date.now(),
    );

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    res.send(renderLoginPage({ code: esc(code) }));
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const row = this.#db.prepare("SELECT code_challenge, created_at FROM oauth_codes WHERE code = ?").get(authorizationCode) as { code_challenge: string; created_at: number } | undefined;
    if (!row) throw new Error("Authorization code not found");
    if (Date.now() - row.created_at > 600_000) {
      this.#db.prepare("DELETE FROM oauth_codes WHERE code = ?").run(authorizationCode);
      throw new Error("Authorization code expired");
    }
    return row.code_challenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const row = this.#db.prepare("SELECT * FROM oauth_codes WHERE code = ?").get(authorizationCode) as { code: string; client_id: string; redirect_uri: string; state: string | null; created_at: number } | undefined;
    if (!row) throw new Error("Invalid authorization code");
    if (Date.now() - row.created_at > 600_000) {
      this.#db.prepare("DELETE FROM oauth_codes WHERE code = ?").run(authorizationCode);
      throw new Error("Authorization code expired");
    }
    if (row.client_id !== client.client_id) throw new Error("Client mismatch");
    this.#db.prepare("DELETE FROM oauth_codes WHERE code = ?").run(authorizationCode);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresIn = config.oauthTokenTtlSec;
    const now = Math.floor(Date.now() / 1000);
    this.#db.prepare("INSERT INTO oauth_tokens (access_token, refresh_token, client_id, scopes, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      accessToken, refreshToken, client.client_id, "openid", now + expiresIn, now,
    );
    return { access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: expiresIn };
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const row = this.#db.prepare("SELECT * FROM oauth_tokens WHERE refresh_token = ? AND client_id = ?").get(refreshToken, client.client_id) as { access_token: string } | undefined;
    if (!row) throw new Error("Invalid refresh token");
    this.#db.prepare("DELETE FROM oauth_tokens WHERE access_token = ?").run(row.access_token);

    const newAccessToken = generateToken();
    const newRefreshToken = generateToken();
    const expiresIn = config.oauthTokenTtlSec;
    const now = Math.floor(Date.now() / 1000);
    this.#db.prepare("INSERT INTO oauth_tokens (access_token, refresh_token, client_id, scopes, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      newAccessToken, newRefreshToken, client.client_id, "openid", now + expiresIn, now,
    );
    return { access_token: newAccessToken, refresh_token: newRefreshToken, token_type: "Bearer", expires_in: expiresIn };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const row = this.#db.prepare("SELECT * FROM oauth_tokens WHERE access_token = ?").get(token) as { access_token: string; client_id: string; scopes: string; expires_at: number } | undefined;
    if (!row) throw new InvalidTokenError("Unknown access token");
    if (row.expires_at < Math.floor(Date.now() / 1000)) {
      this.#db.prepare("DELETE FROM oauth_tokens WHERE access_token = ?").run(token);
      throw new InvalidTokenError("Token expired");
    }
    return { token, clientId: row.client_id, scopes: row.scopes.split(" "), expiresAt: row.expires_at };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this.#db.prepare("DELETE FROM oauth_tokens WHERE access_token = ? OR refresh_token = ?").run(request.token, request.token);
  }

  verifyCredentials(email: string, password: string): boolean {
    return this.#checkCredentials(email, password);
  }

  completeAuthorization(code: string): { redirectUri: string; state: string | null } | null {
    const row = this.#db.prepare("SELECT redirect_uri, state FROM oauth_codes WHERE code = ?").get(code) as { redirect_uri: string; state: string | null } | undefined;
    if (!row) return null;
    this.#db.prepare("DELETE FROM oauth_codes WHERE code = ?").run(code);
    return { redirectUri: row.redirect_uri, state: row.state };
  }
}

const LOGIN_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;
  background:#1c1d25;color:#f3f3f5;padding:24px}
.wrap{width:100%;max-width:380px}
.logo{display:flex;flex-direction:column;align-items:center;gap:14px;margin-bottom:28px}
.logo-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;
  background:#5b6abf;color:#f6f7ff;font-weight:800;font-size:20px;letter-spacing:-0.02em}
.logo-title{font-weight:700;font-size:17px}
.logo-sub{font-size:12.5px;color:#8c8e9e}
.card{border:1px solid #3b3c47;border-radius:12px;background:#262730;padding:24px}
.field{margin-bottom:14px}
.field:last-of-type{margin-bottom:0}
label{display:block;margin-bottom:6px;font-size:11.5px;color:#8c8e9e;font-weight:600}
input{width:100%;height:34px;padding:0 12px;border-radius:8px;border:1px solid #3b3c47;
  background:#30313b;color:#f3f3f5;font-size:12.5px;font-family:inherit;outline:none;transition:border-color .15s}
input:focus{border-color:#5b6abf}
.pw-wrap{position:relative}
.pw-wrap input{padding-right:36px}
.pw-toggle{position:absolute;right:0;top:0;width:34px;height:34px;display:grid;place-items:center;
  background:none;border:none;color:#6b6d7e;cursor:pointer}
.pw-toggle:hover{color:#8c8e9e}
.error{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#d05050;margin-bottom:10px}
.error svg{flex-shrink:0}
.btn{width:100%;height:40px;border:none;border-radius:8px;background:#5b6abf;color:#f6f7ff;
  font-size:12.5px;font-weight:600;cursor:pointer;margin-top:14px;transition:opacity .15s}
.btn:hover{opacity:0.9}
.btn:disabled{opacity:0.5;cursor:not-allowed}
.footer{margin-top:16px;text-align:center;font-size:11.5px;color:#6b6d7e}
`;

const ERROR_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
const EYE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

const PW_TOGGLE_SCRIPT = `<script>
document.querySelector('.pw-toggle').addEventListener('click',function(){
  var i=document.getElementById('pw');
  var show=i.type==='password';
  i.type=show?'text':'password';
  this.innerHTML=show?'${EYE_OFF_ICON.replace(/'/g, "\\'")}':'${EYE_ICON.replace(/'/g, "\\'")}';
});
<\/script>`;

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderLoginPage(opts: { code: string; error?: string }): string {
  const errorHtml = opts.error
    ? `<div class="error">${ERROR_ICON} ${escHtml(opts.error)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZS — Sign in</title><style>${LOGIN_CSS}</style></head>
<body>
<div class="wrap">
  <div class="logo">
    <div class="logo-icon">ZS</div>
    <div style="text-align:center">
      <div class="logo-title">Zobr Script</div>
      <div class="logo-sub">Sign in to connect MCP</div>
    </div>
  </div>
  <div class="card">
    ${errorHtml}
    <form method="POST" action="/oauth/callback">
      <input type="hidden" name="code" value="${opts.code}">
      <div class="field">
        <label>Email</label>
        <input name="email" type="email" placeholder="you@example.com" required autofocus>
      </div>
      <div class="field">
        <label>Password</label>
        <div class="pw-wrap">
          <input id="pw" name="password" type="password" placeholder="••••••••" required>
          <button type="button" class="pw-toggle">${EYE_ICON}</button>
        </div>
      </div>
      <button type="submit" class="btn">Sign in</button>
    </form>
  </div>
  <p class="footer">Authentication required by MCP server</p>
</div>
${PW_TOGGLE_SCRIPT}
</body></html>`;
}

export function renderLoginError(code: string, error: string): string {
  return renderLoginPage({ code, error });
}

const CHECK_ICON = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

export function renderLoginSuccess(redirectUrl: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZS — Connected</title>
<meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}">
<style>${LOGIN_CSS}
.success-icon{animation:pop .4s ease}
@keyframes pop{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
.success-text{font-weight:700;font-size:20px;margin-top:16px}
.success-sub{font-size:12.5px;color:#8c8e9e;margin-top:8px}
.dots{display:inline-block;width:20px;text-align:left}
.dots::after{content:'...';animation:dots 1.5s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
</style></head>
<body>
<div class="wrap" style="text-align:center">
  <div class="logo">
    <div class="logo-icon">ZS</div>
  </div>
  <div class="card" style="padding:40px 24px">
    <div class="success-icon">${CHECK_ICON}</div>
    <div class="success-text">Connected</div>
    <div class="success-sub">Redirecting back<span class="dots"></span></div>
  </div>
  <p class="footer" style="margin-top:20px">You can close this window if it doesn't redirect automatically.</p>
</div>
</body></html>`;
}
