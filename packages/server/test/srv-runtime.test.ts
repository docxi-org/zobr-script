import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SrvRuntime } from "../src/srv-runtime";
import { transpileSrvModule } from "@zobr/validator";

const SRV_SOURCE = `
import type { Analysis } from "../store";

export default class TestScript extends ZsScript {
  private rounds = 0;

  double(n: number): number {
    return n * 2;
  }

  findAll(collection: string): unknown[] {
    return this.db.collection(collection).find();
  }

  insertAndCount(collection: string, doc: unknown): number {
    this.db.collection(collection).insertOne(doc);
    return this.db.collection(collection).count();
  }

  getConfig(key: string): unknown {
    return this.config[key];
  }

  getInvocationId(): string {
    return this.invocation.id;
  }

  onStart(): Record<string, unknown> {
    this.rounds = 0;
    return { greeting: "hello from onStart" };
  }

  onCheckpoint(label: string, data: unknown): "proceed" | "halt" {
    if (label === "count") {
      this.rounds++;
      if (this.rounds >= 3) return "halt";
    }
    if (label === "save") {
      this.db.collection("results").insertOne(data);
    }
    return "proceed";
  }

  buggy(): void {
    throw new Error("intentional error");
  }

  private seen: Set<string> = new Set();
  private lookup: Map<string, number> = new Map();

  addSeen(item: string): void { this.seen.add(item); }
  addMapping(key: string, value: number): void { this.lookup.set(key, value); }

  private helperMethod(): void {}
}
`;

describe("SrvRuntime (class-based worker)", () => {
  let dir: string;
  let dbPath: string;
  let runtime: SrvRuntime;
  const cjsSource = transpileSrvModule(SRV_SOURCE);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "zs-srv-test-"));
    dbPath = join(dir, "test.sqlite");
    runtime = new SrvRuntime({ moduleSource: cjsSource, dbPath });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dir, { recursive: true, force: true });
  });

  it("creates instance with onStart and returns initialData + serverFunctions", async () => {
    const res = await runtime.createInstance("inv-1", { maxRounds: 5 }, { id: "inv-1", scriptRef: "test", depth: 0 });
    expect(res.ok).toBe(true);
    expect(res.initialData).toEqual({ greeting: "hello from onStart" });
    expect(res.serverFunctions).toContain("double");
    expect(res.serverFunctions).toContain("findAll");
    expect(res.serverFunctions).not.toContain("onStart");
    expect(res.serverFunctions).not.toContain("onCheckpoint");
    expect(res.serverFunctions).not.toContain("constructor");
    expect(res.serverFunctions).not.toContain("_helperMethod");
  });

  it("calls a pure method (no db)", async () => {
    const res = await runtime.call("inv-1", "double", [21]);
    expect(res.ok).toBe(true);
    expect(res.result).toBe(42);
  });

  it("calls a method with this.db access", async () => {
    const insert = await runtime.call("inv-1", "insertAndCount", ["items", { name: "a" }]);
    expect(insert.ok).toBe(true);
    expect(insert.result).toBe(1);

    const find = await runtime.call("inv-1", "findAll", ["items"]);
    expect(find.ok).toBe(true);
    expect((find.result as unknown[]).length).toBe(1);
  });

  it("provides this.config from createInstance", async () => {
    const res = await runtime.call("inv-1", "getConfig", ["maxRounds"]);
    expect(res.ok).toBe(true);
    expect(res.result).toBe(5);
  });

  it("provides this.invocation from createInstance", async () => {
    const res = await runtime.call("inv-1", "getInvocationId", []);
    expect(res.ok).toBe(true);
    expect(res.result).toBe("inv-1");
  });

  it("calls onCheckpoint lifecycle and tracks per-invocation state", async () => {
    const r1 = await runtime.lifecycle("inv-1", "onCheckpoint", ["count", {}]);
    expect(r1.ok).toBe(true);
    expect(r1.result).toBe("proceed");

    const r2 = await runtime.lifecycle("inv-1", "onCheckpoint", ["count", {}]);
    expect(r2.result).toBe("proceed");

    const r3 = await runtime.lifecycle("inv-1", "onCheckpoint", ["count", {}]);
    expect(r3.result).toBe("halt");
  });

  it("onCheckpoint can write to db", async () => {
    await runtime.lifecycle("inv-1", "onCheckpoint", ["save", { result: "ok" }]);
    const find = await runtime.call("inv-1", "findAll", ["results"]);
    expect((find.result as unknown[]).length).toBe(1);
  });

  it("catches errors from buggy methods", async () => {
    const res = await runtime.call("inv-1", "buggy", []);
    expect(res.ok).toBe(false);
    expect(res.error?.kind).toBe("controller_error");
    expect(res.error?.message).toContain("intentional error");
  });

  it("returns timeout error for stuck methods", async () => {
    const stuckSrc = `export default class extends ZsScript { spin(): void { while(true){} } }`;
    const rt = new SrvRuntime({
      moduleSource: transpileSrvModule(stuckSrc),
      dbPath: join(dir, "timeout.sqlite"),
      timeoutMs: 200,
    });
    await rt.createInstance("stuck", {}, { id: "stuck", scriptRef: "t", depth: 0 });
    const r = await rt.call("stuck", "spin", []);
    expect(r.ok).toBe(false);
    expect(r.error?.message).toContain("timeout");
    rt.terminate();
  });

  it("isolates instances per invocation", async () => {
    const res2 = await runtime.createInstance("inv-2", {}, { id: "inv-2", scriptRef: "test", depth: 0 });
    expect(res2.ok).toBe(true);

    // inv-2 has fresh state (rounds = 0), inv-1 had rounds = 3
    const r = await runtime.lifecycle("inv-2", "onCheckpoint", ["count", {}]);
    expect(r.result).toBe("proceed"); // rounds = 1, not 4

    runtime.destroy("inv-2");
  });

  it("snapshots instance state (user properties only)", async () => {
    // inv-1 has rounds = 3 from earlier checkpoint tests
    const state = await runtime.snapshotState("inv-1");
    expect(state).not.toBeNull();
    expect(state!["rounds"]).toBe(3);
    // db, config, invocation are excluded
    expect(state!["db"]).toBeUndefined();
    expect(state!["config"]).toBeUndefined();
    expect(state!["invocation"]).toBeUndefined();
  });

  it("snapshots Set and Map properties with type tags", async () => {
    await runtime.call("inv-1", "addSeen", ["alpha"]);
    await runtime.call("inv-1", "addSeen", ["beta"]);
    await runtime.call("inv-1", "addMapping", ["x", 10]);
    await runtime.call("inv-1", "addMapping", ["y", 20]);

    const state = await runtime.snapshotState("inv-1");
    expect(state).not.toBeNull();
    expect(state!["seen"]).toEqual({ __type: "Set", values: ["alpha", "beta"] });
    expect(state!["lookup"]).toEqual({ __type: "Map", entries: [["x", 10], ["y", 20]] });
  });

  it("restores instance state from snapshot (full round-trip)", async () => {
    // inv-1 has rounds=3, seen={"alpha","beta"}, lookup={x:10,y:20}
    const snap = await runtime.snapshotState("inv-1");
    expect(snap).not.toBeNull();

    // Create a fresh instance (inv-3) — starts with rounds=0, empty Set/Map
    await runtime.createInstance("inv-3", {}, { id: "inv-3", scriptRef: "test", depth: 0 });
    const freshSnap = await runtime.snapshotState("inv-3");
    expect(freshSnap!["rounds"]).toBe(0);

    // Restore inv-1's state onto inv-3
    const ok = await runtime.restoreState("inv-3", snap!);
    expect(ok).toBe(true);

    // Verify rounds restored
    const r = await runtime.lifecycle("inv-3", "onCheckpoint", ["count", {}]);
    expect(r.result).toBe("halt"); // rounds was 3, now 4 → >= 3 → halt

    runtime.destroy("inv-3");
  });

  it("snapshotState returns null for unknown invocation", async () => {
    const state = await runtime.snapshotState("nonexistent");
    expect(state).toBeNull();
  });
});
