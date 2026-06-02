// Extract sandbox metadata from a server module: @sandbox function names,
// return-type Shapes, and transpiled JS. Uses the TypeScript compiler API
// to analyze types and JSDoc tags (doc 04 §5, doc 05 §3).
import ts from "typescript";
import type { VirtualFile } from "./types";
import type { Shape } from "@zobr/core";
import { createVirtualProgram, TS_OPTIONS } from "./program";

const SRV_AMBIENT = "/zs/zs.server.d.ts";
const COG_AMBIENT = "/zs/zs.cognitive.d.ts";

export interface CogShapes {
  readonly concludeShape?: Shape;
  readonly checkpointShapes: Readonly<Record<string, Shape>>;
  readonly reportShapes: Readonly<Record<string, Shape>>;
}

export interface MethodParam {
  readonly name: string;
  readonly typeText: string;
  readonly shape: Shape;
}

export interface MethodInfo {
  readonly name: string;
  readonly params: readonly MethodParam[];
  readonly returnTypeText: string;
  readonly returnShape: Shape;
}

export interface ClassInfo {
  readonly className: string;
  readonly methods: readonly MethodInfo[];
}

export function tsTypeToShape(type: ts.Type, checker: ts.TypeChecker): Shape {
  if (type.flags & ts.TypeFlags.String) return { kind: "string" };
  if (type.flags & ts.TypeFlags.Number) return { kind: "number" };
  if (type.flags & ts.TypeFlags.Boolean) return { kind: "boolean" };

  if (type.flags & ts.TypeFlags.StringLiteral) {
    return { kind: "literal", values: [(type as ts.StringLiteralType).value] };
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return { kind: "literal", values: [(type as ts.NumberLiteralType).value] };
  }

  if (type.isUnion()) {
    const members = type.types;
    if (members.every((m) => m.flags & ts.TypeFlags.BooleanLiteral)) {
      return { kind: "boolean" };
    }
    const literals: (string | number)[] = [];
    let allLiterals = true;
    for (const m of members) {
      if (m.flags & ts.TypeFlags.StringLiteral) {
        literals.push((m as ts.StringLiteralType).value);
      } else if (m.flags & ts.TypeFlags.NumberLiteral) {
        literals.push((m as ts.NumberLiteralType).value);
      } else {
        allLiterals = false;
        break;
      }
    }
    if (allLiterals && literals.length > 0) {
      return { kind: "literal", values: literals };
    }
    const shapes = members.map((m) => tsTypeToShape(m, checker));
    if (shapes.every((s) => s.kind === "unknown")) return { kind: "unknown" };
    return { kind: "union", members: shapes };
  }

  if (type.flags & ts.TypeFlags.Object) {
    const ref = type as ts.TypeReference;
    if (
      (ref as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference &&
      ref.target?.symbol?.escapedName === "Array"
    ) {
      const typeArgs = checker.getTypeArguments(ref);
      if (typeArgs.length === 1) {
        return { kind: "array", of: tsTypeToShape(typeArgs[0]!, checker) };
      }
    }

    const properties = checker.getPropertiesOfType(type);
    if (properties.length > 0) {
      const fields: Record<string, Shape> = {};
      const optional: string[] = [];
      for (const prop of properties) {
        const propType = checker.getTypeOfSymbol(prop);
        fields[prop.name] = tsTypeToShape(propType, checker);
        if (prop.flags & ts.SymbolFlags.Optional) {
          optional.push(prop.name);
        }
      }
      return { kind: "object", fields, ...(optional.length > 0 ? { optional } : {}) };
    }
  }

  return { kind: "unknown" };
}

export function extractCogShapes(
  cogFiles: readonly VirtualFile[],
  cognitiveAmbient: string,
): CogShapes {
  const allFiles: VirtualFile[] = [
    { name: COG_AMBIENT, content: cognitiveAmbient },
    ...cogFiles,
  ];

  const program = createVirtualProgram(allFiles, { ...TS_OPTIONS, skipLibCheck: true });
  const checker = program.getTypeChecker();

  let concludeShape: Shape | undefined;
  const checkpointShapes: Record<string, Shape> = {};
  const reportShapes: Record<string, Shape> = {};

  for (const file of cogFiles) {
    const sf = program.getSourceFile(file.name);
    if (sf === undefined) continue;

    const walk = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;

        if (name === "conclude" && concludeShape === undefined) {
          const typeArgs = node.typeArguments;
          if (typeArgs !== undefined && typeArgs.length > 0) {
            const t = checker.getTypeFromTypeNode(typeArgs[0]!);
            concludeShape = tsTypeToShape(t, checker);
          }
        }

        if ((name === "checkpoint" || name === "report") && node.arguments.length >= 2) {
          const labelArg = node.arguments[0]!;
          if (ts.isStringLiteral(labelArg)) {
            const label = labelArg.text;
            const target = name === "checkpoint" ? checkpointShapes : reportShapes;
            if (target[label] === undefined) {
              const dataType = checker.getTypeAtLocation(node.arguments[1]!);
              target[label] = tsTypeToShape(dataType, checker);
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
  }

  return {
    ...(concludeShape !== undefined ? { concludeShape } : {}),
    checkpointShapes,
    reportShapes,
  };
}

const CLASS_LIFECYCLE = new Set(["onStart", "onCheckpoint", "onReport"]);

export function extractClassInfo(
  srvFiles: readonly VirtualFile[],
  serverAmbient: string,
): ClassInfo | null {
  const allFiles: VirtualFile[] = [
    { name: SRV_AMBIENT, content: serverAmbient },
    ...srvFiles,
  ];

  const program = createVirtualProgram(allFiles, { ...TS_OPTIONS, skipLibCheck: true });
  const checker = program.getTypeChecker();

  for (const file of srvFiles) {
    const sf = program.getSourceFile(file.name);
    if (sf === undefined) continue;

    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt)) continue;

      const modifiers = ts.getModifiers(stmt);
      const isExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      const isDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      if (!isExport || !isDefault) continue;

      const extendsZsScript = stmt.heritageClauses?.some((h) =>
        h.token === ts.SyntaxKind.ExtendsKeyword &&
        h.types.some((t) => ts.isIdentifier(t.expression) && t.expression.text === "ZsScript"),
      ) ?? false;
      if (!extendsZsScript) continue;

      const className = stmt.name?.text ?? "Anonymous";
      const methods: MethodInfo[] = [];

      for (const member of stmt.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        if (member.name === undefined || !ts.isIdentifier(member.name)) continue;

        const name = member.name.text;
        if (CLASS_LIFECYCLE.has(name)) continue;

        const memberMods = ts.getModifiers(member);
        if (memberMods?.some((m) =>
          m.kind === ts.SyntaxKind.PrivateKeyword ||
          m.kind === ts.SyntaxKind.ProtectedKeyword ||
          m.kind === ts.SyntaxKind.StaticKeyword,
        )) continue;

        const sig = checker.getSignatureFromDeclaration(member);
        if (sig === undefined) continue;

        const params: MethodParam[] = member.parameters.map((p) => {
          const pType = checker.getTypeAtLocation(p);
          return {
            name: ts.isIdentifier(p.name) ? p.name.text : "arg",
            typeText: checker.typeToString(pType, undefined, ts.TypeFormatFlags.NoTruncation),
            shape: tsTypeToShape(pType, checker),
          };
        });

        const returnType = checker.getReturnTypeOfSignature(sig);
        methods.push({
          name,
          params,
          returnTypeText: checker.typeToString(returnType, undefined, ts.TypeFormatFlags.NoTruncation),
          returnShape: tsTypeToShape(returnType, checker),
        });
      }

      return { className, methods };
    }
  }

  return null;
}

export function shapeToTypeText(shape: Shape): string {
  switch (shape.kind) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "unknown": return "unknown";
    case "literal":
      return shape.values.map((v) => typeof v === "string" ? `"${v}"` : String(v)).join(" | ");
    case "array": {
      const inner = shapeToTypeText(shape.of);
      const needsParens = shape.of.kind === "object" || shape.of.kind === "literal";
      return needsParens ? `(${inner})[]` : `${inner}[]`;
    }
    case "object": {
      const entries = Object.entries(shape.fields);
      const opt = new Set(shape.optional ?? []);
      const fields = entries.map(([k, v]) => `${k}${opt.has(k) ? "?" : ""}: ${shapeToTypeText(v)}`);
      return `{ ${fields.join("; ")} }`;
    }
    case "union":
      return shape.members.map((m) => shapeToTypeText(m)).join(" | ");
  }
}

export function generateMethodAmbient(info: ClassInfo): string {
  return info.methods.map((m) => {
    const params = m.params.map((p) => `${p.name}: ${shapeToTypeText(p.shape)}`).join(", ");
    return `declare function ${m.name}(${params}): ${shapeToTypeText(m.returnShape)};`;
  }).join("\n");
}

export function extractStoreSchema(
  storeContent: string,
): Readonly<Record<string, Shape>> {
  const file: VirtualFile = { name: "/zs/store.d.ts", content: storeContent };
  const program = createVirtualProgram([file], { ...TS_OPTIONS, skipLibCheck: true });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file.name);
  if (sf === undefined) return {};

  const result: Record<string, Shape> = {};
  for (const stmt of sf.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    const modifiers = ts.getModifiers(stmt);
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) continue;

    const name = stmt.name.text;
    const type = checker.getTypeAtLocation(stmt);
    result[name] = tsTypeToShape(type, checker);
  }

  return result;
}

export function transpileSrvModule(content: string): string {
  const result = ts.transpileModule(content, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  return result.outputText;
}

