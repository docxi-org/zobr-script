// @zobr/validator — the ZS validation engine (doc 09). Pure given its inputs;
// the server calls validateScript() at write-time (CRUD) and start-time.
export { validateScript } from "./validate";
export { typecheck } from "./typecheck";
export { fence } from "./fence";
export { extractCogShapes, extractClassInfo, extractStoreSchema, tsTypeToShape, shapeToTypeText, generateMethodAmbient, transpileSrvModule } from "./extract";
export type { CogShapes, ClassInfo, MethodInfo, MethodParam } from "./extract";
export type {
  Diagnostic, DiagSource, Severity, VirtualFile, ScriptBundle, Ambients, ValidationResult,
} from "./types";
