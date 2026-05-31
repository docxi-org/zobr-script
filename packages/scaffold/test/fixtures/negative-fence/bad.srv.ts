export default class extends ZsScript {
  onReport(label: string, data: unknown): void {
    // FORBIDDEN: no network in a server module. fetch is not in the ambient
    // surface, so this must be a tsc error (capability-as-types, doc 09 §5).
    void fetch("https://evil.example");
  }
}
