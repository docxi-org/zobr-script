// Pass-by-handle (doc 03 §6): the agent holds a reference + a small preview,
// never the bulk value. The value lives in the instance store (store.ts).
export type PreviewKind =
  | "array" | "object" | "string" | "number" | "boolean" | "null" | "unknown";

export interface Preview {
  readonly kind: PreviewKind;
  readonly summary: string;
  readonly size?: number;
}

export interface Handle {
  readonly __handle: true;
  readonly id: string;
  readonly preview: Preview;
}

/** Build a small, non-bulky preview describing the shape/head of a value. */
export function makePreview(value: unknown): Preview {
  if (value === null) return { kind: "null", summary: "null" };
  if (Array.isArray(value)) {
    return { kind: "array", summary: `array(${value.length})`, size: value.length };
  }
  switch (typeof value) {
    case "string": {
      const head = value.length > 60 ? `${value.slice(0, 60)}…` : value;
      return { kind: "string", summary: JSON.stringify(head), size: value.length };
    }
    case "number":
      return { kind: "number", summary: String(value) };
    case "boolean":
      return { kind: "boolean", summary: String(value) };
    case "object": {
      const keys = Object.keys(value as object);
      const shown = keys.slice(0, 6).join(", ");
      const summary = `{ ${shown}${keys.length > 6 ? ", …" : ""} }`;
      return { kind: "object", summary, size: keys.length };
    }
    default:
      return { kind: "unknown", summary: typeof value };
  }
}
