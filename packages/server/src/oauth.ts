import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";
import { toNodeHandler } from "better-auth/node";
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from "better-auth/plugins";
import Database from "better-sqlite3";
import { Router } from "express";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import type { Logger } from "./logger";

export interface ZsOAuthConfig {
  readonly dbPath: string;
  readonly mcpUrl: string;
  readonly authUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly logger?: Logger;
}

function initSchema(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id),
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS oauthApplication (
      id TEXT PRIMARY KEY,
      name TEXT,
      icon TEXT,
      metadata TEXT,
      clientId TEXT NOT NULL UNIQUE,
      clientSecret TEXT,
      redirectUrls TEXT NOT NULL,
      type TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0,
      userId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauthAccessToken (
      id TEXT PRIMARY KEY,
      accessToken TEXT NOT NULL UNIQUE,
      refreshToken TEXT UNIQUE,
      accessTokenExpiresAt TEXT NOT NULL,
      refreshTokenExpiresAt TEXT,
      clientId TEXT NOT NULL,
      userId TEXT,
      scopes TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauthRefreshToken (
      id TEXT PRIMARY KEY,
      refreshToken TEXT NOT NULL UNIQUE,
      accessTokenId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauthAuthorizationCode (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      clientId TEXT NOT NULL,
      userId TEXT,
      scopes TEXT NOT NULL,
      redirectURI TEXT NOT NULL,
      codeChallenge TEXT,
      codeChallengeMethod TEXT,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauthConsent (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      userId TEXT NOT NULL,
      scopes TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      consentGiven INTEGER NOT NULL DEFAULT 0
    );
  `);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZsAuth = ReturnType<typeof betterAuth>;

export function createZsOAuth(config: ZsOAuthConfig): { auth: ZsAuth; seedAdmin: () => Promise<void> } {
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  initSchema(db);

  const auth = betterAuth({
    baseURL: config.authUrl,
    database: db as never,
    trustedOrigins: [config.authUrl, config.mcpUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      mcp({
        loginPage: "/oauth/sign-in",
        resource: config.mcpUrl,
        oidcConfig: {
          loginPage: "/oauth/sign-in",
          accessTokenExpiresIn: 3600,
          refreshTokenExpiresIn: 604_800,
          defaultScope: "openid",
          scopes: ["openid", "profile", "email", "offline_access"],
          allowDynamicClientRegistration: true,
        },
      }),
    ],
  });

  const seedAdmin = async () => {
    try {
      await (auth.api as Record<string, Function>)["signUpEmail"]!({
        body: { email: config.adminEmail, password: config.adminPassword, name: "Admin" },
      });
      config.logger?.info("OAuth: seeded admin user %s", config.adminEmail);
    } catch {
      // already exists
    }
  };

  return { auth: auth as unknown as ZsAuth, seedAdmin };
}

export function createOAuthRoutes(auth: ZsAuth, mcpUrl: string): Router {
  const router = Router();
  const handler = toNodeHandler(auth);

  router.options("/.well-known/oauth-authorization-server", cors());
  router.get("/.well-known/oauth-authorization-server", cors(), toNodeHandler(oAuthDiscoveryMetadata(auth as never)));

  router.all("/api/auth/{*splat}", (req, res) => handler(req, res));

  router.get("/oauth/sign-in", (req: Request, res: Response) => {
    const q = new URLSearchParams(req.query as Record<string, string>);
    res.send(`<!DOCTYPE html>
<html><head><title>ZS OAuth Login</title>
<style>body{font-family:system-ui;max-width:400px;margin:80px auto;padding:0 20px}
input,button{width:100%;padding:10px;margin:6px 0;box-sizing:border-box;border-radius:6px;border:1px solid #ccc}
button{background:#333;color:#fff;border:none;cursor:pointer;font-weight:600}</style></head>
<body><h2>ZS — Sign in</h2>
<form method="POST" action="/oauth/sign-in">
<input type="hidden" name="redirect" value="${q.toString()}">
<input name="email" type="email" placeholder="Email" required>
<input name="password" type="password" placeholder="Password" required>
<button type="submit">Sign in</button>
</form></body></html>`);
  });

  router.post("/oauth/sign-in", async (req: Request, res: Response) => {
    const { email, password, redirect } = req.body as { email: string; password: string; redirect: string };
    try {
      const api = auth.api as Record<string, Function>;
      const signInResponse = await api["signInEmail"]!({
        body: { email, password },
        asResponse: true,
      }) as globalThis.Response;
      for (const cookie of signInResponse.headers.getSetCookie()) {
        res.append("Set-Cookie", cookie);
      }
      const authorizeUrl = new URL("/api/auth/mcp/authorize", req.protocol + "://" + req.get("host"));
      authorizeUrl.search = redirect;
      res.redirect(authorizeUrl.toString());
    } catch {
      res.status(401).send("Invalid credentials. <a href='javascript:history.back()'>Try again</a>");
    }
  });

  return router;
}

export function createProtectedResourceRouter(auth: ZsAuth, resourcePath = "/mcp"): Router {
  const router = Router();
  const metadataPath = `/.well-known/oauth-protected-resource${resourcePath}`;
  router.options(metadataPath, cors());
  router.get(metadataPath, cors(), toNodeHandler(oAuthProtectedResourceMetadata(auth as never)));
  return router;
}

export function requireBearerAuth(auth: ZsAuth, resourceMetadataUrl: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.set("WWW-Authenticate", `Bearer error="invalid_token", error_description="Missing Authorization header", resource_metadata="${resourceMetadataUrl}"`);
      res.status(401).json({ error: "invalid_token", error_description: "Missing Authorization header" });
      return;
    }
    const token = header.slice(7);
    try {
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${token}`);
      const session = await (auth.api as Record<string, Function>)["getMcpSession"]!({ headers });
      if (!session) throw new Error("Invalid token");
      (req as Request & { oauthUser?: unknown }).oauthUser = session;
      next();
    } catch {
      res.set("WWW-Authenticate", `Bearer error="invalid_token", error_description="Invalid or expired token", resource_metadata="${resourceMetadataUrl}"`);
      res.status(401).json({ error: "invalid_token", error_description: "Invalid or expired token" });
    }
  };
}
