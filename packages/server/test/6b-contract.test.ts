import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { FsScriptSourceReader, FsScriptLoader, ZsApp, materializeScaffold, createZsHttpApp, MCP_TOOLS, createLogger, SrvRuntime } from "../src/index";
import { transpileSrvModule } from "@zobr/validator";
import { FakeReader, VALID_COG, TYPED_COG } from "./_fakereader";

const MCP_PROTOCOL_VERSION = "2025-03-26";

interface McpResponse {
  id?: number;
  result?: { tools?: { name: string }[]; content?: { type: string; text: string }[]; [k: string]: unknown };
  error?: { code: number; message: string };
  [k: string]: unknown;
}

function parseToolResult(res: McpResponse): unknown {
  const text = res.result?.content?.[0]?.text;
  if (text === undefined) throw new Error(`no content in MCP response: ${JSON.stringify(res)}`);
  return JSON.parse(text);
}

const silentLogger = createLogger({ level: "silent" });

// ─────────────────────────────────────────────────────────────────────────────
// 6b-CONTRACT — specification for Claude Code (the "meat").
// These it.todo entries are the executable to-do list. Claude Code should:
//   1. implement the real piece,
//   2. convert the matching it.todo(...) into a real it(...) test that passes,
//   3. keep the whole suite green.
// ─────────────────────────────────────────────────────────────────────────────

describe("6b SrvRuntime (class-based worker)", () => {
  let dir: string;
  let runtime: SrvRuntime;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "zs-6b-"));
    const srvSrc = `export default class extends ZsScript {
      add(a: number, b: number): number { return a + b; }
      buggy(): void { throw new Error("boom"); }
    }`;
    runtime = new SrvRuntime({
      moduleSource: transpileSrvModule(srvSrc),
      dbPath: join(dir, "test.sqlite"),
    });
    await runtime.createInstance("i1", {}, { id: "i1", scriptRef: "test", depth: 0 });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dir, { recursive: true, force: true });
  });

  it("calls a public method and returns result", async () => {
    const r = await runtime.call("i1", "add", [2, 3]);
    expect(r.ok).toBe(true);
    expect(r.result).toBe(5);
  });

  it("maps thrown error to controller_error", async () => {
    const r = await runtime.call("i1", "buggy", []);
    expect(r.ok).toBe(false);
    expect(r.error?.kind).toBe("controller_error");
    expect(r.error?.message).toContain("boom");
  });

  it("denies require/fetch/process in sandbox (defense-in-depth)", async () => {
    const srvBad = `export default class extends ZsScript {
      tryRequire(): unknown { return require("fs"); }
    }`;
    const rt2 = new SrvRuntime({
      moduleSource: transpileSrvModule(srvBad),
      dbPath: join(dir, "test2.sqlite"),
    });
    await rt2.createInstance("bad1", {}, { id: "bad1", scriptRef: "bad", depth: 0 });
    const r = await rt2.call("bad1", "tryRequire", []);
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/require|not defined/);
    rt2.terminate();
  });
});

describe("6b Express + MCP Streamable HTTP transport", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { app } = await createZsHttpApp({
      library: new FakeReader({
        news: { script_ref: "news", cog: [{ name: "/zs/news.cog.ts", content: VALID_COG }], srv: [] },
        typed: { script_ref: "typed", cog: [{ name: "/zs/typed.cog.ts", content: TYPED_COG }], srv: [] },
      }),
      logger: silentLogger,
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr !== null ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => { server?.close(); });

  async function mcpPost(body: unknown, sessionId?: string): Promise<{ status: number; body: McpResponse; headers: Headers }> {
    const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
      headers["mcp-protocol-version"] = MCP_PROTOCOL_VERSION;
    }
    const res = await fetch(`${baseUrl}/mcp`, { method: "POST", headers, body: JSON.stringify(body) });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    let parsed: McpResponse;
    if (ct.includes("text/event-stream")) {
      const events: McpResponse[] = [];
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try { events.push(JSON.parse(line.slice(6)) as McpResponse); } catch { /* skip malformed */ }
      }
      parsed = events.find((e) => e.id !== undefined && e.result !== undefined) ?? events[events.length - 1] ?? {};
    } else {
      try { parsed = JSON.parse(text) as McpResponse; } catch { parsed = {} as McpResponse; }
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }

  function initReq(id = 1) {
    return { jsonrpc: "2.0", id, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "test", version: "0.0.1" } } };
  }

  async function initSession(): Promise<string> {
    const { headers } = await mcpPost(initReq());
    return headers.get("mcp-session-id") ?? "";
  }

  async function registerAgent(sid: string): Promise<string> {
    await mcpPost({ jsonrpc: "2.0", method: "notifications/initialized" }, sid);
    const res = await mcpPost({ jsonrpc: "2.0", id: 900, method: "tools/call", params: { name: "zs_register", arguments: { name: "test-agent" } } }, sid);
    return (parseToolResult(res.body) as { agent_id: string }).agent_id;
  }

  async function initWithAgent(): Promise<{ sid: string; agent_id: string }> {
    const sid = await initSession();
    const agent_id = await registerAgent(sid);
    return { sid, agent_id };
  }

  it("boots an Express app and mounts the MCP Streamable HTTP endpoint", async () => {
    const res = await mcpPost(initReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("registers all MCP_TOOLS as visible (role gating is per-agent, not per-visibility)", async () => {
    const sid = await initSession();
    await mcpPost({ jsonrpc: "2.0", method: "notifications/initialized" }, sid);
    const res = await mcpPost({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sid);
    console.log("DIAG sid:", JSON.stringify(sid), "tools status:", res.status, "body:", JSON.stringify(res.body).substring(0, 300));
    const tools = (res.body.result?.tools ?? []).map((t) => t.name);
    for (const t of MCP_TOOLS) {
      expect(tools).toContain(t.name);
    }
  });

  it("routes a tool call over HTTP into ZsApp.callTool and returns the result", async () => {
    const { sid, agent_id } = await initWithAgent();
    const res = await mcpPost({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "zs_start", arguments: { agent_id, script_ref: "news" } } }, sid);
    const parsed = parseToolResult(res.body) as { invocation_id: string; code: string };
    expect(parsed.invocation_id).toBeTruthy();
    expect(parsed.code).toContain("function analyze");
  });

  it("provides ZsApp as composition root (loader + registry + service wired)", async () => {
    const { sid, agent_id } = await initWithAgent();
    const startRes = await mcpPost({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "zs_start", arguments: { agent_id, script_ref: "news" } } }, sid);
    const { invocation_id } = parseToolResult(startRes.body) as { invocation_id: string };
    const concludeRes = await mcpPost({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "zs_conclude", arguments: { agent_id, invocation_id, result: { summary: "test" } } } }, sid);
    const result = parseToolResult(concludeRes.body) as { ok: boolean; status: string };
    expect(result.ok).toBe(true);
    expect(result.status).toBe("done");
  });

  it("guards architect-only tools by per-agent role (executor gets soft rejection)", async () => {
    const { sid, agent_id } = await initWithAgent();
    const res = await mcpPost({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "zs_create", arguments: { agent_id, script_ref: "test/x", cog: [{ name: "x.cog.ts", content: "export function x(){return conclude<{a:string}>({a:''});}" }] } } }, sid);
    const result = parseToolResult(res.body) as { ok: boolean; error?: { kind: string } };
    expect(result.ok).toBe(false);
    expect(result.error?.kind).toBe("role_insufficient");
  });

  it("rejects requests without session ID (except initialize)", async () => {
    const res = await mcpPost({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} });
    expect(res.status).toBe(400);
  });
  it("validates conclude result against concludeShape (doc 05 §3)", async () => {
    const { sid, agent_id } = await initWithAgent();
    const startRes = await mcpPost({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "zs_start", arguments: { agent_id, script_ref: "news" } } }, sid);
    const { invocation_id } = parseToolResult(startRes.body) as { invocation_id: string };
    const badRes = await mcpPost({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "zs_conclude", arguments: { agent_id, invocation_id, result: { garbage: 42 } } } }, sid);
    const bad = parseToolResult(badRes.body) as { ok: boolean; error?: { kind: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error?.kind).toBe("schema_mismatch");
  });

  it("validates checkpoint data against per-label checkpointShapes", async () => {
    const { sid, agent_id } = await initWithAgent();
    const startRes = await mcpPost({ jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "zs_start", arguments: { agent_id, script_ref: "typed" } } }, sid);
    const { invocation_id } = parseToolResult(startRes.body) as { invocation_id: string };

    const badRes = await mcpPost({ jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "zs_checkpoint", arguments: { agent_id, invocation_id, label: "progress", data: { wrong: true } } } }, sid);
    const bad = parseToolResult(badRes.body) as { ok: boolean; error?: { kind: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error?.kind).toBe("schema_mismatch");

    const okRes = await mcpPost({ jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "zs_checkpoint", arguments: { agent_id, invocation_id, label: "progress", data: { step: 1, findings: ["anything — Sem is unknown"], status: "open" } } } }, sid);
    const ok = parseToolResult(okRes.body) as { ok: boolean; directive: string };
    expect(ok.ok).toBe(true);
    expect(ok.directive).toBe("proceed");
  });

  it("validates report data against per-label reportShapes", async () => {
    const { sid, agent_id } = await initWithAgent();
    const startRes = await mcpPost({ jsonrpc: "2.0", id: 30, method: "tools/call", params: { name: "zs_start", arguments: { agent_id, script_ref: "typed" } } }, sid);
    const { invocation_id } = parseToolResult(startRes.body) as { invocation_id: string };

    const badRes = await mcpPost({ jsonrpc: "2.0", id: 31, method: "tools/call", params: { name: "zs_report", arguments: { agent_id, invocation_id, label: "metrics", data: { wrong: true } } } }, sid);
    const bad = parseToolResult(badRes.body) as { ok: boolean; error?: { kind: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error?.kind).toBe("schema_mismatch");

    const okRes = await mcpPost({ jsonrpc: "2.0", id: 32, method: "tools/call", params: { name: "zs_report", arguments: { agent_id, invocation_id, label: "metrics", data: { total: 5, quality: "open" } } } }, sid);
    const ok = parseToolResult(okRes.body) as { ok: boolean };
    expect(ok.ok).toBe(true);
  });

  it("loads class-based srv and exposes runtime with serverFunctions", async () => {
    const cogSrc = `export type R = { score: number };\nexport function analyze(t: string): R { return conclude<R>({} as R); }`;
    const srvSrc = `export default class extends ZsScript {\n  rank(items: string[]): string[] { return items.sort(); }\n}`;
    const loader = new FsScriptLoader(new FakeReader({
      demo: {
        script_ref: "demo",
        cog: [{ name: "/zs/demo.cog.ts", content: cogSrc }],
        srv: [{ name: "/zs/demo.srv.ts", content: srvSrc }],
      },
    }));
    const loaded = await loader.load("demo");
    expect(loaded.runtime).toBeDefined();
    expect(loaded.sandboxHost.has("rank")).toBe(true);
    loaded.runtime!.terminate();
  });

  it("instantiates SrvRuntime over class-based srv.ts at start", async () => {
    const cogSrc = `export type R = { x: number };\nexport function f(t: string): R { return conclude<R>({} as R); }`;
    const srvSrc = `export default class extends ZsScript {\n  double(n: number): number { return n * 2; }\n}`;
    const loader = new FsScriptLoader(new FakeReader({
      calc: {
        script_ref: "calc",
        cog: [{ name: "/zs/calc.cog.ts", content: cogSrc }],
        srv: [{ name: "/zs/calc.srv.ts", content: srvSrc }],
      },
    }));
    const loaded = await loader.load("calc");
    expect(loaded.runtime).toBeDefined();
    const cr = await loaded.runtime!.createInstance("test-inv", {}, { id: "test-inv", scriptRef: "calc", depth: 0 });
    expect(cr.ok).toBe(true);
    expect(cr.serverFunctions).toContain("double");
    const result = await loaded.runtime!.call("test-inv", "double", [5]);
    expect(result.ok).toBe(true);
    expect(result.result).toBe(10);
    loaded.runtime!.destroy("test-inv");
    loaded.runtime!.terminate();
  });
});

describe("6b library ScriptSourceReader (filesystem)", () => {
  let libRoot: string;

  beforeAll(async () => {
    libRoot = await mkdtemp(join(tmpdir(), "zs-test-"));
    await writeFile(
      join(libRoot, "demo.cog.ts"),
      `export type R = { x: string };\nexport function run(t: string): R { return conclude<R>({} as R); }\n`,
    );
  });

  afterAll(async () => {
    await rm(libRoot, { recursive: true, force: true });
  });

  it("reads a script file (ref.cog.ts + optional ref.srv.ts) from the library", async () => {
    const reader = new FsScriptSourceReader(libRoot);
    const raw = await reader.read("demo");
    expect(raw.script_ref).toBe("demo");
    expect(raw.cog).toHaveLength(1);
    expect(raw.cog[0]?.name).toBe("/zs/demo.cog.ts");
    expect(raw.cog[0]?.content).toContain("function run");
    expect(raw.srv).toHaveLength(0);

    await expect(reader.read("nonexistent")).rejects.toThrow(/script not found/);
  });

  it("zs_list enumerates scripts in library", async () => {
    const lib = new FsScriptSourceReader(libRoot);
    const zsApp = new ZsApp(lib);
    const { agent_id } = zsApp.register("test");
    const res = (await zsApp.callTool("zs_list", { agent_id })) as { entries: { name: string }[] };
    expect(res.entries.some((e) => e.name === "demo")).toBe(true);
  });

  it("zs_create writes a validated script to disk", async () => {
    const lib = new FsScriptSourceReader(libRoot);
    const zsApp = new ZsApp(lib);
    const { agent_id } = zsApp.register("test");
    zsApp.agents.setRole(agent_id, "architect");
    const res = (await zsApp.callTool("zs_create", {
      agent_id,
      script_ref: "new-script",
      cog: [{ name: "new-script.cog.ts", content: `export function f() { return conclude<{ok:boolean}>({ok:true}); }` }],
    })) as { ok: boolean };
    expect(res.ok).toBe(true);
    const read = (await zsApp.callTool("zs_read", { agent_id, script_ref: "new-script" })) as { cog: string };
    expect(read.cog).toContain("function f");
  });

  it("zs_create rejects invalid scripts", async () => {
    const lib = new FsScriptSourceReader(libRoot);
    const zsApp = new ZsApp(lib);
    const { agent_id } = zsApp.register("test");
    zsApp.agents.setRole(agent_id, "architect");
    const res = (await zsApp.callTool("zs_create", {
      agent_id,
      script_ref: "bad-script",
      cog: [{ name: "bad.cog.ts", content: `export function f() { eval("x"); }` }],
    })) as { ok: boolean; errors?: string[] };
    expect(res.ok).toBe(false);
    expect(res.errors!.length).toBeGreaterThan(0);
  });

  it("zs_delete removes a script folder", async () => {
    const lib = new FsScriptSourceReader(libRoot);
    const zsApp = new ZsApp(lib);
    const { agent_id } = zsApp.register("test");
    zsApp.agents.setRole(agent_id, "architect");
    await zsApp.callTool("zs_create", {
      agent_id,
      script_ref: "to-delete",
      cog: [{ name: "td.cog.ts", content: `export function f() { return conclude(); }` }],
    });
    const del = (await zsApp.callTool("zs_delete", { agent_id, script_ref: "to-delete" })) as { ok: boolean };
    expect(del.ok).toBe(true);
    await expect(lib.read("to-delete")).rejects.toThrow();
  });

  it("E2E: start → report → conclude with real script from disk", async () => {
    const lib = new FsScriptSourceReader(libRoot);
    const zsApp = new ZsApp(lib);
    const { agent_id } = zsApp.register("test");
    const start = (await zsApp.callTool("zs_start", { agent_id, script_ref: "demo" })) as { invocation_id: string; code: string; preamble?: string };
    expect(start.invocation_id).toBeTruthy();
    expect(start.code).toContain("function run");

    const report = (await zsApp.callTool("zs_report", { agent_id, invocation_id: start.invocation_id, label: "test", data: { n: 1 } })) as { ok: boolean };
    expect(report.ok).toBe(true);

    const conclude = (await zsApp.callTool("zs_conclude", { agent_id, invocation_id: start.invocation_id, result: { x: "done" } })) as { ok: boolean; status: string; trace_ref?: string };
    expect(conclude.ok).toBe(true);
    expect(conclude.status).toBe("done");
    expect(conclude.trace_ref).toBe(start.invocation_id);
  });

  it("materializes the zs.* scaffold into a library folder (doc 09 §8)", async () => {
    const target = join(libRoot, "_scaffold_out");
    await materializeScaffold(target);

    const files = (await readdir(target)).sort();
    expect(files).toEqual([
      "store.d.ts",
      "tsconfig.base.json",
      "tsconfig.cognitive.json",
      "tsconfig.json",
      "tsconfig.server.json",
      "zs.cognitive.d.ts",
      "zs.server.d.ts",
    ]);

    const cog = await readFile(join(target, "zs.cognitive.d.ts"), "utf8");
    expect(cog).toContain("declare function survey");
    expect(cog).toContain("declare function conclude");

    const srv = await readFile(join(target, "zs.server.d.ts"), "utf8");
    expect(srv).toContain("declare class ZsScript");

    const tscBase = await readFile(join(target, "tsconfig.base.json"), "utf8");
    expect(JSON.parse(tscBase).compilerOptions.strict).toBe(true);
  });
});
