import { Router, json } from "express";
import type { Request, Response, NextFunction } from "express";
import type { ZsApp } from "./app";
import type { Logger } from "./logger";
import { verifyArtifactToken } from "./artifact-token";
import type { AuthService } from "./auth";

function artifactAuth(authService?: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (authService) {
      const cookie = req.headers.cookie;
      const tokenMatch = cookie?.match(/(?:^|;)\s*zs_token=([^;]*)/);
      if (tokenMatch?.[1]) {
        const user = await authService.verifyRequest(tokenMatch[1]);
        if (user) { next(); return; }
      }
    }

    const token = (req.query["token"] as string | undefined)
      ?? req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) { res.status(401).json({ error: "Missing artifact token" }); return; }
    const payload = await verifyArtifactToken(token);
    if (!payload) { res.status(401).json({ error: "Invalid or expired artifact token" }); return; }
    (req as Request & { artifactPayload?: typeof payload }).artifactPayload = payload;
    next();
  };
}

export function createArtifactRouter(zsApp: ZsApp, logger: Logger, authService?: AuthService): Router {
  const router = Router();
  router.use(json());
  router.use(artifactAuth(authService));
  const log = logger.child({ module: "artifact" });

  router.get("/trace/:id", (req, res) => {
    const trace = zsApp.apiGetTrace(req.params["id"] as string);
    if (!trace) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }
    res.json(trace);
  });

  router.get("/trace/:id/events", (req, res) => {
    const id = req.params["id"] as string;
    const since = Number(req.query["since"]) || 0;

    const inst = zsApp.registry.get(id);
    if (inst) {
      const events = inst.trace.events.filter((e) => (e as { seq: number }).seq > since);
      res.json({ events, status: inst.status, coverage: inst.trace.coverage() });
      return;
    }

    const saved = zsApp.apiGetTrace(id);
    if (!saved) { res.status(404).json({ error: "Trace not found" }); return; }
    const events = (saved.events as { seq: number }[]).filter((e) => e.seq > since);
    res.json({ events, status: saved.status, coverage: saved.coverage });
  });

  router.get("/instance/:id", (req, res) => {
    const id = req.params["id"] as string;
    const inst = zsApp.registry.get(id);
    if (!inst) {
      res.status(404).json({ error: "Instance not found (may be cold or finished)" });
      return;
    }
    res.json({
      invocation_id: inst.invocation_id,
      script_ref: inst.script_ref,
      status: inst.status,
      depth: inst.depth,
      parent_invocation_id: inst.parent_invocation_id ?? null,
      events_count: inst.trace.events.length,
      created_at: inst.createdAt,
    });
  });

  router.get("/instance/:id/children", (req, res) => {
    const parentId = req.params["id"] as string;
    const children: unknown[] = [];
    for (const inst of zsApp.registry.values()) {
      if (inst.parent_invocation_id === parentId) {
        children.push({
          invocation_id: inst.invocation_id,
          script_ref: inst.script_ref,
          status: inst.status,
        });
      }
    }
    res.json({ children });
  });

  log.info("artifact API routes registered");
  return router;
}
