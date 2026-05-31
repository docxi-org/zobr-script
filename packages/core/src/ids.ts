// Id generation. No Node crypto (core is pure / types:[]): ECMAScript only.
// Determinism is not required; tests assert shape and uniqueness, not exact values.
let handleCounter = 0;

export function nextHandleId(prefix = "h"): string {
  handleCounter += 1;
  return `${prefix}_${handleCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newInvocationId(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
