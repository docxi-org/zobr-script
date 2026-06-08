import { Router, json } from "express";
import type { ZsApp } from "./app";
import type { Logger } from "./logger";

export function createArtifactRouter(zsApp: ZsApp, logger: Logger): Router {
  const router = Router();
  router.use(json());
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
