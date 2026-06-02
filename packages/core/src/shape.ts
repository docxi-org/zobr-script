// Schema-at-seam validation (doc 05 §3). Core checks a value against a
// ShapeDescriptor — a light, runtime-checkable projection of a TS type. The
// descriptor is DERIVED from the declared TS type by the server/validator (one
// source of truth: the type). Core stays dependency-free: it only consumes the
// descriptor. The seam checks FORM, not truth (a coherent-but-false value passes).
export type Shape =
  | { readonly kind: "string" }
  | { readonly kind: "number" }
  | { readonly kind: "boolean" }
  | { readonly kind: "unknown" } // accepts anything (Sem); no structural check
  | { readonly kind: "literal"; readonly values: readonly (string | number | boolean)[] }
  | { readonly kind: "array"; readonly of: Shape }
  | { readonly kind: "object"; readonly fields: Readonly<Record<string, Shape>>; readonly optional?: readonly string[] }
  | { readonly kind: "union"; readonly members: readonly Shape[] };

export interface ShapeError {
  readonly path: string;
  readonly expected: string;
  readonly got: string;
}

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Validate value against shape. Returns [] when the value conforms (form only). */
export function checkShape(value: unknown, shape: Shape, path = "$"): ShapeError[] {
  switch (shape.kind) {
    case "unknown":
      return [];
    case "string":
    case "number":
    case "boolean": {
      return typeof value === shape.kind ? [] : [{ path, expected: shape.kind, got: typeName(value) }];
    }
    case "literal": {
      return shape.values.includes(value as never)
        ? []
        : [{ path, expected: `one of [${shape.values.map(String).join(", ")}]`, got: JSON.stringify(value) }];
    }
    case "array": {
      if (!Array.isArray(value)) return [{ path, expected: "array", got: typeName(value) }];
      const errs: ShapeError[] = [];
      value.forEach((el, i) => errs.push(...checkShape(el, shape.of, `${path}[${i}]`)));
      return errs;
    }
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return [{ path, expected: "object", got: typeName(value) }];
      }
      const obj = value as Record<string, unknown>;
      const optional = new Set(shape.optional ?? []);
      const errs: ShapeError[] = [];
      for (const [key, fieldShape] of Object.entries(shape.fields)) {
        const present = Object.prototype.hasOwnProperty.call(obj, key);
        if (!present) {
          if (!optional.has(key)) errs.push({ path: `${path}.${key}`, expected: fieldShape.kind, got: "missing" });
          continue;
        }
        errs.push(...checkShape(obj[key], fieldShape, `${path}.${key}`));
      }
      return errs;
    }
    case "union": {
      for (const member of shape.members) {
        if (checkShape(value, member, path).length === 0) return [];
      }
      const expected = shape.members.map((m) => m.kind).join(" | ");
      return [{ path, expected, got: typeName(value) }];
    }
  }
}

export function conforms(value: unknown, shape: Shape): boolean {
  return checkShape(value, shape).length === 0;
}
