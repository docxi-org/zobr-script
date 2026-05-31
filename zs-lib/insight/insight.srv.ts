export default class InsightScript extends ZsScript {
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
