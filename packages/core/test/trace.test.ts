import { describe, it, expect } from "vitest";
import { Trace } from "../src/index";

describe("Trace — the product", () => {
  it("appends events with monotonic seq and a timestamp", () => {
    const tr = new Trace();
    const e1 = tr.append({ op: "survey", realizer: "llm", trust: "asserted", inputs: [] });
    const e2 = tr.append({ op: "retrieve", realizer: "external", trust: "verified", inputs: [], output: "h_1" });
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(typeof e1.t).toBe("string");
    expect(tr.length).toBe(2);
    expect(tr.events[1]?.output).toBe("h_1");
  });

  it("omits optional fields rather than storing undefined", () => {
    const tr = new Trace();
    const e = tr.append({ op: "pivot", realizer: "llm", trust: "asserted", inputs: [] });
    expect("output" in e).toBe(false);
    expect("meta" in e).toBe(false);
  });

  it("aggregates the trust-coverage metric", () => {
    const tr = new Trace();
    tr.append({ op: "assert", realizer: "llm", trust: "asserted", inputs: [] });
    tr.append({ op: "ground", realizer: "llm", trust: "asserted", inputs: [] });
    tr.append({ op: "rank", realizer: "sandbox", trust: "verified", inputs: [] });
    tr.append({ op: "retrieve", realizer: "external", trust: "verified", inputs: [] });
    tr.append({ op: "ask_user", realizer: "user", trust: "authority", inputs: [] });
    const c = tr.coverage();
    // 2 verified, 2 asserted -> 0.5 / 0.5 ; 1 authority gate
    expect(c.verified).toBeCloseTo(0.5);
    expect(c.asserted).toBeCloseTo(0.5);
    expect(c.authority_gates).toBe(1);
    expect(c.grounded_claims).toBe(1); // the verified retrieve
    expect(c.asserted_claims).toBe(2); // assert + ground
  });

  it("coverage is zero on an empty trace", () => {
    expect(new Trace().coverage().verified).toBe(0);
  });
});
