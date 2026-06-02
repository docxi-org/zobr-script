import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Router, json } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import request from "supertest";
import { ZsApp } from "../src/app";
import { FsScriptSourceReader } from "../src/reader";
import { createApiRouter } from "../src/api-routes";
import { AuthService } from "../src/auth";
import { createDb } from "../src/db";
import { log } from "../src/logger";

const tmp = mkdtempSync(join(tmpdir(), "zs-api-test-"));
const dbPath = join(tmp, "test.sqlite");
const libRoot = join(tmp, "lib");

// Create a test script in the library (file-based model: ref = "hello" → hello.cog.ts)
mkdirSync(libRoot, { recursive: true });
writeFileSync(join(libRoot, "hello.cog.ts"), `/** Test script. */
export type Result = { msg: string };
export function greet(name: string): Result {
  return conclude<Result>({ msg: "" as string });
}
`);

const reader = new FsScriptSourceReader(libRoot);
const zsApp = new ZsApp(reader, { dbPath });
const db = zsApp.getDb()!;
const auth = new AuthService(db.rawDb, { jwtSecret: "test-secret", logger: log });

const app = createMcpExpressApp({ host: "0.0.0.0" });
app.use("/api", json(), createApiRouter(zsApp, auth, log));

let adminCookie = "";
let executorCookie = "";

function extractCookie(res: request.Response, name: string): string {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const c of arr) {
    const m = c.match(new RegExp(`${name}=([^;]*)`));
    if (m) return `${name}=${m[1]}`;
  }
  return "";
}

beforeAll(async () => {
  auth.createUser("exec@test.com", "pass123", "executor");

  const adminLogin = await request(app).post("/api/auth/login")
    .send({ email: "admin@docxi.org", password: "admin" });
  adminCookie = extractCookie(adminLogin, "zs_token");

  const execLogin = await request(app).post("/api/auth/login")
    .send({ email: "exec@test.com", password: "pass123" });
  executorCookie = extractCookie(execLogin, "zs_token");
});

afterAll(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

function adminReq() { return { Cookie: adminCookie }; }
function execReq() { return { Cookie: executorCookie }; }

// ── Auth ──

describe("POST /api/auth/login", () => {
  it("returns user and sets httpOnly cookies for valid credentials", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ email: "admin@docxi.org", password: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@docxi.org");
    expect(res.body.user.role).toBe("admin");
    expect(res.body.token).toBeUndefined();
    expect(extractCookie(res, "zs_token")).toContain("zs_token=");
    expect(extractCookie(res, "zs_refresh")).toContain("zs_refresh=");
  });

  it("rejects invalid password", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ email: "admin@docxi.org", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/refresh", () => {
  it("refreshes token via cookie", async () => {
    const login = await request(app).post("/api/auth/login")
      .send({ email: "admin@docxi.org", password: "admin" });
    const refreshCookie = extractCookie(login, "zs_refresh");
    const res = await request(app).post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(extractCookie(res, "zs_token")).toContain("zs_token=");
  });

  it("rejects invalid refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh")
      .set("Cookie", "zs_refresh=garbage");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user for valid token", async () => {
    const res = await request(app).get("/api/auth/me").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@docxi.org");
    expect(res.body.role).toBe("admin");
  });

  it("rejects missing token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

// ── Protected endpoints ──

describe("GET /api/status", () => {
  it("returns server status", async () => {
    const res = await request(app).get("/api/status").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.2.0");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.config).toBeDefined();
    expect(res.body.scripts).toBeGreaterThanOrEqual(0);
  });

  it("rejects without auth", async () => {
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/traces", () => {
  it("returns empty list initially", async () => {
    const res = await request(app).get("/api/traces").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.traces).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("respects limit/offset", async () => {
    const res = await request(app).get("/api/traces?limit=5&offset=0").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(0);
  });
});

describe("GET /api/scripts", () => {
  it("returns library scripts", async () => {
    const res = await request(app).get("/api/scripts").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.scripts.length).toBeGreaterThanOrEqual(1);
    const hello = res.body.scripts.find((s: { name: string }) => s.name === "hello");
    expect(hello).toBeDefined();
    expect(hello.hasSrv).toBe(false);
    expect(hello.description).toBe("Test script.");
  });
});

describe("GET /api/scripts/:ref (detail)", () => {
  it("returns script source and shapes", async () => {
    const res = await request(app).get("/api/scripts/hello").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.script_ref).toBe("hello");
    expect(res.body.cog).toContain("greet");
    expect(res.body.concludeShape).toBeDefined();
  });

  it("returns 404 for unknown script", async () => {
    const res = await request(app).get("/api/scripts/nonexistent").set(adminReq());
    expect(res.status).toBe(404);
  });
});

describe("POST /api/scripts/:ref/validate", () => {
  it("validates script code", async () => {
    const res = await request(app).post("/api/scripts/hello/validate")
      .set(adminReq())
      .send({ cog: [{ name: "test.cog.ts", content: 'export function test(): void { return conclude(); }' }] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBeDefined();
  });
});

describe("GET /api/store/collections", () => {
  it("returns collections list", async () => {
    const res = await request(app).get("/api/store/collections").set(adminReq());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.collections)).toBe(true);
  });
});

describe("GET /api/store/notes", () => {
  it("returns notes list", async () => {
    const res = await request(app).get("/api/store/notes").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.notes).toBeDefined();
  });
});

describe("GET /api/agents", () => {
  it("returns agents list", async () => {
    const res = await request(app).get("/api/agents").set(adminReq());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
  });
});

describe("GET /api/invocations", () => {
  it("returns active invocations", async () => {
    const res = await request(app).get("/api/invocations").set(adminReq());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invocations)).toBe(true);
  });
});

describe("GET /api/ambients", () => {
  it("returns ambient declarations", async () => {
    const res = await request(app).get("/api/ambients").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.cognitive).toContain("survey");
    expect(res.body.server).toContain("ZsScript");
  });
});

// ── Agent role management ──

describe("PUT /api/agents/:id/role", () => {
  let agentId: string;
  beforeAll(() => { agentId = zsApp.agents.register("test-role-agent"); });

  it("changes agent role to architect", async () => {
    const res = await request(app).put(`/api/agents/${agentId}/role`).set(adminReq()).send({ role: "architect" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, role: "architect" });
    expect(zsApp.agents.get(agentId)?.role).toBe("architect");
  });

  it("changes agent role back to executor", async () => {
    const res = await request(app).put(`/api/agents/${agentId}/role`).set(adminReq()).send({ role: "executor" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("executor");
  });

  it("rejects invalid role", async () => {
    const res = await request(app).put(`/api/agents/${agentId}/role`).set(adminReq()).send({ role: "superadmin" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown agent", async () => {
    const res = await request(app).put("/api/agents/ag_nonexistent/role").set(adminReq()).send({ role: "architect" });
    expect(res.status).toBe(404);
  });

  it("rejects executor user (requires admin or architect)", async () => {
    const res = await request(app).put(`/api/agents/${agentId}/role`).set(execReq()).send({ role: "architect" });
    expect(res.status).toBe(403);
  });
});

// ── Role-based access ──

describe("role-based access", () => {
  it("executor can read scripts", async () => {
    const res = await request(app).get("/api/scripts").set(execReq());
    expect(res.status).toBe(200);
  });

  it("executor cannot create scripts", async () => {
    const res = await request(app).post("/api/scripts")
      .set(execReq())
      .send({ script_ref: "test", cog: [{ name: "test.cog.ts", content: "" }], srv: [] });
    expect(res.status).toBe(403);
  });

  it("executor cannot access users", async () => {
    const res = await request(app).get("/api/users").set(execReq());
    expect(res.status).toBe(403);
  });

  it("admin can access users", async () => {
    const res = await request(app).get("/api/users").set(adminReq());
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
  });
});

// ── User management ──

describe("user management (admin)", () => {
  it("creates a user", async () => {
    const res = await request(app).post("/api/users")
      .set(adminReq())
      .send({ email: "new@test.com", password: "pw123", role: "architect" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("new@test.com");
    expect(res.body.role).toBe("architect");
  });

  it("updates user role", async () => {
    const users = await request(app).get("/api/users").set(adminReq());
    const newUser = users.body.users.find((u: { email: string }) => u.email === "new@test.com");
    const res = await request(app).put(`/api/users/${newUser.id}`)
      .set(adminReq())
      .send({ role: "executor" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("deactivates user", async () => {
    const users = await request(app).get("/api/users").set(adminReq());
    const newUser = users.body.users.find((u: { email: string }) => u.email === "new@test.com");
    const res = await request(app).put(`/api/users/${newUser.id}`)
      .set(adminReq())
      .send({ active: false });
    expect(res.status).toBe(200);
  });

  it("rejects duplicate email", async () => {
    const res = await request(app).post("/api/users")
      .set(adminReq())
      .send({ email: "admin@docxi.org", password: "pw", role: "executor" });
    expect(res.status).toBe(409);
  });
});
