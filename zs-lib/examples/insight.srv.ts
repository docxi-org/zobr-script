export default class InsightScript extends ZsScript {
  confidenceScore(mechanisms: number, tradeoffs: number): number {
    return Math.round(Math.min(1, mechanisms / 5) * (1 - tradeoffs * 0.1) * 100) / 100;
  }

  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "reflection_done") {
      this.db.notes.put(
        `insight:${this.invocation.id}`,
        data,
        "architectural-insight",
      );
    }
    return "proceed";
  }
}
