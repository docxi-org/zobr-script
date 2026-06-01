import { Router, json } from "express";
import type { Request, Response, NextFunction } from "express";
import type { ZsApp } from "./app";
import type { Logger } from "./logger";
import { AuthService, type Role, type UserRecord } from "./auth";

function rateLimit(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.status(429).json({ error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts, try again later" } });
      return;
    }
    next();
  };
}

interface AuthedRequest extends Request {
  user: UserRecord;
}

export function createApiRouter(zsApp: ZsApp, auth: AuthService, logger: Logger): Router {
  const router = Router();
  router.use(json());

  // ── Auth (public) ──

  const loginLimiter = rateLimit(60_000, 10);

  router.post("/auth/login", loginLimiter, async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "email and password required" } });
      return;
    }
    const result = await auth.login(email, password);
    if (!result) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
      return;
    }
    res.json(result);
  });

  router.post("/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "refreshToken required" } });
      return;
    }
    const result = await auth.refresh(refreshToken);
    if (!result) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" } });
      return;
    }
    res.json(result);
  });

  router.get("/auth/me", auth.middleware(), (req, res) => {
    const user = (req as AuthedRequest).user;
    res.json({ id: user.id, email: user.email, role: user.role });
  });

  // ── Protected endpoints ──

  router.use(auth.middleware());

  router.get("/status", async (_req, res) => {
    const cfg = zsApp.apiConfig;
    let scriptCount = 0;
    try { scriptCount = (await zsApp.list()).entries.length; } catch { /* no library */ }
    res.json({
      version: "0.2.0",
      uptime: Math.floor(process.uptime()),
      scripts: scriptCount,
      agents: zsApp.apiListAgents().length,
      invocations: {
        active: zsApp.apiActiveInvocations().length,
        total: zsApp.apiListTraces().length,
      },
      config: cfg,
    });
  });

  router.get("/traces", (req, res) => {
    const scriptRef = req.query["script_ref"] as string | undefined;
    const status = req.query["status"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"]) || 20, 100);
    const offset = Number(req.query["offset"]) || 0;

    const filter = {
      ...(scriptRef ? { scriptRef } : {}),
      ...(status ? { status } : {}),
    };
    const total = zsApp.apiCountTraces(filter);
    const traces = zsApp.apiListTraces({ ...filter, limit, offset });
    res.json({ traces, total, limit, offset });
  });

  router.get("/traces/:id", (req, res) => {
    const trace = zsApp.apiGetTrace(req.params["id"] as string);
    if (!trace) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: `Trace not found: ${req.params["id"]}` } });
      return;
    }
    res.json(trace);
  });

  router.get("/scripts", async (_req, res) => {
    try {
      const entries = await zsApp.list();
      res.json({ scripts: entries.entries });
    } catch (e) {
      logger.error({ err: e }, "GET /api/scripts error");
      res.status(500).json({ error: { code: "INTERNAL", message: "Failed to list scripts" } });
    }
  });

  router.get("/scripts/:ref", async (req, res) => {
    try {
      const raw = await zsApp.read(req.params["ref"] as string);
      res.json(raw);
    } catch {
      res.status(404).json({ error: { code: "NOT_FOUND", message: `Script not found: ${req.params["ref"]}` } });
    }
  });

  // Script write (architect/admin)
  router.post("/scripts", auth.middleware(["architect", "admin"]), async (req, res) => {
    try {
      const result = await zsApp.createScript(req.body);
      res.json(result);
    } catch (e) {
      logger.error({ err: e }, "POST /api/scripts error");
      res.status(500).json({ error: { code: "INTERNAL", message: "Failed to create script" } });
    }
  });

  router.put("/scripts/:ref", auth.middleware(["architect", "admin"]), async (req, res) => {
    try {
      const result = await zsApp.createScript({ ...req.body, script_ref: req.params["ref"] });
      res.json(result);
    } catch (e) {
      logger.error({ err: e }, "PUT /api/scripts error");
      res.status(500).json({ error: { code: "INTERNAL", message: "Failed to update script" } });
    }
  });

  router.delete("/scripts/:ref", auth.middleware(["architect", "admin"]), async (req, res) => {
    try {
      const result = await zsApp.deleteScript(req.params["ref"] as string);
      res.json(result);
    } catch (e) {
      logger.error({ err: e }, "DELETE /api/scripts error");
      res.status(500).json({ error: { code: "INTERNAL", message: "Failed to delete script" } });
    }
  });

  router.post("/scripts/:ref/validate", (req, res) => {
    const result = zsApp.validate({ cog: req.body.cog, srv: req.body.srv });
    res.json(result);
  });

  router.get("/store/collections", (_req, res) => {
    try {
      const result = zsApp.storeCollections() as { ok: boolean; names: string[]; counts: Record<string, number> };
      const collections = result.names.map((name) => ({ name, count: result.counts[name] ?? 0 }));
      res.json({ collections });
    } catch {
      res.json({ collections: [] });
    }
  });

  router.get("/store/collections/:name", (req, res) => {
    const name = req.params["name"] as string;
    const filterStr = req.query["filter"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"]) || 50, 200);
    const offset = Number(req.query["offset"]) || 0;

    let filter: Record<string, unknown> | undefined;
    if (filterStr) {
      try { filter = JSON.parse(filterStr) as Record<string, unknown>; } catch {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid filter JSON" } });
        return;
      }
    }

    res.json(zsApp.apiStoreCollectionDocs(name, filter, limit, offset));
  });

  router.get("/store/notes", (req, res) => {
    const type = req.query["type"] as string | undefined;
    res.json({ notes: zsApp.apiStoreNotes(type) });
  });

  router.get("/agents", (_req, res) => {
    res.json({ agents: zsApp.apiListAgents() });
  });

  router.get("/agents/:id", (req, res) => {
    const agent = zsApp.apiGetAgentDetail(req.params["id"] as string);
    if (!agent) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: `Agent not found: ${req.params["id"]}` } });
      return;
    }
    res.json(agent);
  });

  router.get("/invocations", (_req, res) => {
    res.json({ invocations: zsApp.apiActiveInvocations() });
  });

  // ── User management (admin) ──

  router.get("/users", auth.middleware(["admin"]), (_req, res) => {
    res.json({ users: auth.listUsers() });
  });

  router.post("/users", auth.middleware(["admin"]), (req, res) => {
    const { email, password, role } = req.body as { email?: string; password?: string; role?: string };
    if (!email || !password) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "email and password required" } });
      return;
    }
    try {
      const user = auth.createUser(email, password, (role as Role) || "executor");
      res.json(user);
    } catch (e) {
      res.status(409).json({ error: { code: "CONFLICT", message: "User already exists" } });
    }
  });

  router.put("/users/:id", auth.middleware(["admin"]), (req, res) => {
    const { role, active } = req.body as { role?: string; active?: boolean };
    const ok = auth.updateUser(req.params["id"] as string, {
      ...(role ? { role: role as Role } : {}),
      ...(active !== undefined ? { active } : {}),
    });
    if (!ok) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    res.json({ ok: true });
  });

  router.delete("/users/:id", auth.middleware(["admin"]), (req, res) => {
    const ok = auth.deleteUser(req.params["id"] as string);
    if (!ok) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    res.json({ ok: true });
  });

  router.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found" } });
  });

  return router;
}
