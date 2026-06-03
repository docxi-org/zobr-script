import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type Database from "better-sqlite3";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config";

export type Role = "admin" | "architect" | "executor";

export interface UserRecord {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: number;
  last_login: number | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: string;
  active: number;
  created_at: number;
  last_login: number | null;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(derived, expected);
}

export class AuthService {
  readonly #db: Database.Database;
  readonly #secret: Uint8Array;
  readonly #tokenTtl: number;
  readonly #refreshTtl: number;

  constructor(db: Database.Database, opts?: { jwtSecret?: string; tokenTtlSec?: number; refreshTtlSec?: number; logger?: { warn: (msg: string) => void } }) {
    this.#db = db;
    const envSecret = opts?.jwtSecret ?? config.jwtSecret;
    if (!envSecret) {
      opts?.logger?.warn("ZS_JWT_SECRET not set — using random secret, tokens will not survive restart");
    }
    this.#secret = new TextEncoder().encode(envSecret ?? randomBytes(32).toString("hex"));
    this.#tokenTtl = opts?.tokenTtlSec ?? config.tokenTtlSec;
    this.#refreshTtl = opts?.refreshTtlSec ?? config.refreshTtlSec;
    this.#seedAdmin(opts?.logger);
  }

  #seedAdmin(logger?: { warn: (msg: string) => void }) {
    const existing = this.#db.prepare("SELECT id FROM zs_users LIMIT 1").get() as { id: string } | undefined;
    if (existing) return;
    if (config.adminPassword === "admin") {
      logger?.warn("ZS_ADMIN_PASSWORD not set — seeding admin with default password 'admin'. Change it immediately.");
    }
    this.createUser(config.adminEmail, config.adminPassword, "admin");
    logger?.warn(`Seeded admin user: ${config.adminEmail}`);
  }

  createUser(email: string, password: string, role: Role): UserRecord {
    const id = "usr_" + randomUUID().slice(0, 12);
    const salt = randomBytes(16).toString("hex");
    const password_hash = hashPassword(password, salt);
    const now = Date.now();
    this.#db.prepare(
      "INSERT INTO zs_users (id, email, password_hash, salt, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    ).run(id, email, password_hash, salt, role, now);
    return { id, email, role, active: true, created_at: now, last_login: null };
  }

  async login(email: string, password: string): Promise<{ token: string; refreshToken: string; user: UserRecord } | null> {
    const row = this.#db.prepare("SELECT * FROM zs_users WHERE email = ? AND active = 1").get(email) as UserRow | undefined;
    if (!row) return null;
    if (!verifyPassword(password, row.salt, row.password_hash)) return null;

    const now = Date.now();
    this.#db.prepare("UPDATE zs_users SET last_login = ? WHERE id = ?").run(now, row.id);

    const user: UserRecord = { id: row.id, email: row.email, role: row.role as Role, active: true, created_at: row.created_at, last_login: now };
    const token = await this.#signToken(user, this.#tokenTtl);
    const refreshToken = await this.#signToken(user, this.#refreshTtl);
    return { token, refreshToken, user };
  }

  async refresh(oldRefreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
    const payload = await this.#verifyToken(oldRefreshToken);
    if (!payload) return null;
    const row = this.#db.prepare("SELECT * FROM zs_users WHERE id = ? AND active = 1").get(payload.sub) as UserRow | undefined;
    if (!row) return null;
    const user: UserRecord = { id: row.id, email: row.email, role: row.role as Role, active: true, created_at: row.created_at, last_login: row.last_login };
    const token = await this.#signToken(user, this.#tokenTtl);
    const refreshToken = await this.#signToken(user, this.#refreshTtl);
    return { token, refreshToken };
  }

  async verifyRequest(token: string): Promise<UserRecord | null> {
    const payload = await this.#verifyToken(token);
    if (!payload) return null;
    const row = this.#db.prepare("SELECT * FROM zs_users WHERE id = ? AND active = 1").get(payload.sub) as UserRow | undefined;
    if (!row) return null;
    return { id: row.id, email: row.email, role: row.role as Role, active: true, created_at: row.created_at, last_login: row.last_login };
  }

  listUsers(): UserRecord[] {
    const rows = this.#db.prepare("SELECT id, email, role, active, created_at, last_login FROM zs_users ORDER BY created_at DESC").all() as UserRow[];
    return rows.map((r) => ({ id: r.id, email: r.email, role: r.role as Role, active: r.active === 1, created_at: r.created_at, last_login: r.last_login }));
  }

  updateUser(id: string, patch: { role?: Role; active?: boolean }): boolean {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.role !== undefined) { sets.push("role = ?"); params.push(patch.role); }
    if (patch.active !== undefined) { sets.push("active = ?"); params.push(patch.active ? 1 : 0); }
    if (sets.length === 0) return false;
    params.push(id);
    return this.#db.prepare(`UPDATE zs_users SET ${sets.join(", ")} WHERE id = ?`).run(...params).changes > 0;
  }

  changePassword(userId: string, currentPassword: string, newPassword: string): { ok: boolean; error?: string } {
    const row = this.#db.prepare("SELECT * FROM zs_users WHERE id = ?").get(userId) as UserRow | undefined;
    if (!row) return { ok: false, error: "User not found" };
    if (!verifyPassword(currentPassword, row.salt, row.password_hash)) return { ok: false, error: "Current password is incorrect" };
    const salt = randomBytes(16).toString("hex");
    const password_hash = hashPassword(newPassword, salt);
    this.#db.prepare("UPDATE zs_users SET password_hash = ?, salt = ? WHERE id = ?").run(password_hash, salt, userId);
    return { ok: true };
  }

  deleteUser(id: string): boolean {
    return this.#db.prepare("DELETE FROM zs_users WHERE id = ?").run(id).changes > 0;
  }

  async #signToken(user: UserRecord, ttlSec: number): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ttlSec}s`)
      .sign(this.#secret);
  }

  async #verifyToken(token: string): Promise<{ sub: string; email: string; role: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.#secret);
      if (!payload.sub) return null;
      return { sub: payload.sub, email: payload["email"] as string, role: payload["role"] as string };
    } catch {
      return null;
    }
  }

  get tokenTtlSec(): number { return this.#tokenTtl; }
  get refreshTtlSec(): number { return this.#refreshTtl; }

  middleware(requiredRoles?: Role[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const cookieToken = parseCookie(req.headers.cookie ?? "", "zs_token");
      const header = req.headers.authorization;
      const token = cookieToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
      if (!token) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing authentication" } });
        return;
      }
      const user = await this.verifyRequest(token);
      if (!user) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
        return;
      }
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        res.status(403).json({ error: { code: "FORBIDDEN", message: `Requires role: ${requiredRoles.join(" or ")}` } });
        return;
      }
      (req as Request & { user: UserRecord }).user = user;
      next();
    };
  }
}

function parseCookie(header: string, name: string): string | undefined {
  const match = header.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match?.[1];
}
