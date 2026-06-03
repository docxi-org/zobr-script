import { randomUUID, randomBytes } from "node:crypto";
import Database from "better-sqlite3";
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
    CREATE TABLE IF NOT EXISTS oauth_users (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL
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
  readonly adminEmail: string;
  readonly adminPassword: string;
}

export class ZsOAuthProvider implements OAuthServerProvider {
  readonly #db: DB;
  readonly #clients: ZsOAuthClientsStore;
  readonly #issuerUrl: string;

  constructor(config: ZsOAuthProviderConfig) {
    this.#db = new Database(config.dbPath);
    this.#db.pragma("journal_mode = WAL");
    initSchema(this.#db);
    this.#clients = new ZsOAuthClientsStore(this.#db);
    this.#seedAdmin(config.adminEmail, config.adminPassword);
    this.#issuerUrl = config.issuerUrl;
  }

  #seedAdmin(email: string, password: string): void {
    const existing = this.#db.prepare("SELECT email FROM oauth_users WHERE email = ?").get(email);
    if (!existing) {
      this.#db.prepare("INSERT INTO oauth_users (email, password) VALUES (?, ?)").run(email, password);
    }
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
    res.send(`<!DOCTYPE html>
<html><head><title>ZS — Sign in</title>
<style>body{font-family:system-ui;max-width:400px;margin:80px auto;padding:0 20px}
input,button{width:100%;padding:10px;margin:6px 0;box-sizing:border-box;border-radius:6px;border:1px solid #ccc}
button{background:#333;color:#fff;border:none;cursor:pointer;font-weight:600}
.error{color:#e53e3e;font-size:14px;margin-top:8px}</style></head>
<body><h2>ZS — Sign in</h2>
<form method="POST" action="/oauth/callback">
<input type="hidden" name="code" value="${esc(code)}">
<input name="email" type="email" placeholder="Email" required>
<input name="password" type="password" placeholder="Password" required>
<button type="submit">Sign in</button>
</form></body></html>`);
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const row = this.#db.prepare("SELECT code_challenge FROM oauth_codes WHERE code = ?").get(authorizationCode) as { code_challenge: string } | undefined;
    if (!row) throw new Error("Authorization code not found");
    return row.code_challenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const row = this.#db.prepare("SELECT * FROM oauth_codes WHERE code = ?").get(authorizationCode) as { code: string; client_id: string; redirect_uri: string; state: string | null } | undefined;
    if (!row) throw new Error("Invalid authorization code");
    if (row.client_id !== client.client_id) throw new Error("Client mismatch");
    this.#db.prepare("DELETE FROM oauth_codes WHERE code = ?").run(authorizationCode);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresIn = 3600;
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
    const expiresIn = 3600;
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
    const row = this.#db.prepare("SELECT password FROM oauth_users WHERE email = ?").get(email) as { password: string } | undefined;
    return row !== undefined && row.password === password;
  }

  completeAuthorization(code: string): { redirectUri: string; state: string | null } | null {
    const row = this.#db.prepare("SELECT redirect_uri, state FROM oauth_codes WHERE code = ?").get(code) as { redirect_uri: string; state: string | null } | undefined;
    if (!row) return null;
    return { redirectUri: row.redirect_uri, state: row.state };
  }
}
