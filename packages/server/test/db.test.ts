import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../src/db";
import type { Db } from "../src/db";

interface TestDoc {
  name: string;
  score: number;
  meta: { level: string };
}

describe("Db (SQLite)", () => {
  let dir: string;
  let db: Db;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "zs-db-test-"));
    db = createDb(join(dir, "test.sqlite"));
  });

  afterAll(async () => {
    db.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe("Collection CRUD", () => {
    it("insertOne + findOne", () => {
      const col = db.collection<TestDoc>("items");
      const id = col.insertOne({ name: "alpha", score: 10, meta: { level: "high" } });
      expect(typeof id).toBe("string");
      const found = col.findOne({ name: "alpha" });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("alpha");
      expect(found!._id).toBe(id);
    });

    it("insertMany + find", () => {
      const col = db.collection<TestDoc>("bulk");
      const ids = col.insertMany([
        { name: "a", score: 1, meta: { level: "low" } },
        { name: "b", score: 2, meta: { level: "mid" } },
        { name: "c", score: 3, meta: { level: "high" } },
      ]);
      expect(ids).toHaveLength(3);
      expect(col.find()).toHaveLength(3);
      expect(col.find({ name: "b" })).toHaveLength(1);
    });

    it("dot-notation filter on nested fields", () => {
      const col = db.collection<TestDoc>("items");
      const results = col.find({ "meta.level": "high" } as Partial<TestDoc>);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.meta.level === "high")).toBe(true);
    });

    it("updateOne + updateMany", () => {
      const col = db.collection<TestDoc>("bulk");
      const updated = col.updateOne({ name: "a" }, { score: 99 });
      expect(updated).toBe(1);
      expect(col.findOne({ name: "a" })!.score).toBe(99);

      const many = col.updateMany({ "meta.level": "mid" } as Partial<TestDoc>, { score: 50 });
      expect(many).toBe(1);
    });

    it("deleteOne + deleteMany", () => {
      const col = db.collection<TestDoc>("deletable");
      col.insertMany([
        { name: "x", score: 1, meta: { level: "a" } },
        { name: "y", score: 2, meta: { level: "a" } },
        { name: "z", score: 3, meta: { level: "b" } },
      ]);
      expect(col.deleteOne({ name: "x" })).toBe(1);
      expect(col.count()).toBe(2);
      expect(col.deleteMany({ "meta.level": "a" } as Partial<TestDoc>)).toBe(1);
      expect(col.count()).toBe(1);
    });

    it("count with filter", () => {
      const col = db.collection<TestDoc>("bulk");
      expect(col.count()).toBeGreaterThan(0);
      expect(col.count({ name: "c" })).toBe(1);
    });
  });

  describe("Notes", () => {
    it("put + get (upsert)", () => {
      db.notes.put("key1", { x: 1 }, "test");
      expect(db.notes.get("key1")).toEqual({ x: 1 });
      db.notes.put("key1", { x: 2 }, "test");
      expect(db.notes.get("key1")).toEqual({ x: 2 });
    });

    it("get nonexistent returns null", () => {
      expect(db.notes.get("nope")).toBeNull();
    });

    it("delete", () => {
      db.notes.put("del-me", { a: 1 });
      expect(db.notes.delete("del-me")).toBe(true);
      expect(db.notes.get("del-me")).toBeNull();
      expect(db.notes.delete("del-me")).toBe(false);
    });

    it("list + keys by type", () => {
      db.notes.put("n1", { v: 1 }, "obs");
      db.notes.put("n2", { v: 2 }, "obs");
      db.notes.put("n3", { v: 3 }, "draft");

      const obs = db.notes.list("obs");
      expect(obs).toHaveLength(2);
      expect(obs[0]!.type).toBe("obs");

      const keys = db.notes.keys("draft");
      expect(keys).toEqual(["n3"]);

      expect(db.notes.list().length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("collections()", () => {
    it("lists collections with counts", () => {
      const cols = db.collections();
      const names = cols.map((c) => c.name);
      expect(names).toContain("items");
      expect(names).toContain("bulk");
      const bulk = cols.find((c) => c.name === "bulk");
      expect(bulk!.count).toBeGreaterThan(0);
    });
  });

  describe("infra (traces + invocations)", () => {
    it("saveTrace + getTrace", () => {
      db.infra.saveTrace({
        invocation_id: "inv-t1",
        script_ref: "news",
        code_snapshot: "function f(){}",
        status: "done",
        events: [{ op: "start" }, { op: "conclude" }],
        coverage: { verified: 0.5, asserted: 0.5 },
        result: { summary: "ok" },
      });
      const t = db.infra.getTrace("inv-t1");
      expect(t).not.toBeNull();
      expect(t!.script_ref).toBe("news");
      expect(t!.status).toBe("done");
      expect(t!.events).toHaveLength(2);
      expect(t!.coverage).toEqual({ verified: 0.5, asserted: 0.5 });
      expect(t!.result).toEqual({ summary: "ok" });
    });

    it("getTrace returns null for unknown", () => {
      expect(db.infra.getTrace("nope")).toBeNull();
    });

    it("recordInvocation + finishInvocation", () => {
      db.infra.recordInvocation({ invocation_id: "inv-h1", script_ref: "news", status: "running" });
      db.infra.finishInvocation("inv-h1", "done");
    });
  });

  describe("schema migrations", () => {
    it("_schema_version is created and set to latest", () => {
      const row = db.rawDb.prepare("SELECT version FROM _schema_version").get() as { version: number };
      expect(row.version).toBeGreaterThanOrEqual(1);
    });

    it("reopening the same db is idempotent", () => {
      const dbPath = join(dir, "test.sqlite");
      const col = db.collection("reopen_test");
      col.insertOne({ x: 1 });
      db.close();
      const db2 = createDb(dbPath);
      expect(db2.collection("reopen_test").count()).toBe(1);
      const v = (db2.rawDb.prepare("SELECT version FROM _schema_version").get() as { version: number }).version;
      expect(v).toBeGreaterThanOrEqual(1);
      db2.close();
      db = createDb(dbPath);
    });
  });
});
