export default class WidgetTestScript extends ZsScript {
  computeScore(items: number, issues: number): number {
    return Math.round((items / (items + issues)) * 100) / 100;
  }

  onCheckpoint(label: string, data: unknown): Directive {
    return "proceed";
  }
}
