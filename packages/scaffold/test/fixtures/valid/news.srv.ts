export default class extends ZsScript {
  private rounds = 0;

  onCheckpoint(label: string, data: unknown): Directive {
    this.rounds++;
    return label === "topics_ready" && this.rounds < 3 ? "proceed" : "warn";
  }
}
