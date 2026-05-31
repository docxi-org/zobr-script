// Orchestrates the validation engine: tsc (two environments) + structural fence.
// One function, called at both write-time and start-time (doc 09 §2).
import { typecheck } from "./typecheck";
import { fence } from "./fence";
import { extractClassInfo, generateMethodAmbient } from "./extract";
import { cognitiveAmbient, serverAmbient } from "@zobr/scaffold";
import type { Ambients, Diagnostic, ScriptBundle, ValidationResult } from "./types";

const DEFAULT_AMBIENTS: Ambients = { cognitive: cognitiveAmbient, server: serverAmbient };

const COG_AMBIENT = "/zs/zs.cognitive.d.ts";
const SRV_AMBIENT = "/zs/zs.server.d.ts";

export function validateScript(bundle: ScriptBundle, ambients: Ambients = DEFAULT_AMBIENTS): ValidationResult {
  const diags: Diagnostic[] = [];

  let cogAmbientContent = ambients.cognitive;
  if (bundle.srv.length > 0) {
    const classInfo = extractClassInfo(bundle.srv, ambients.server);
    if (classInfo !== null && classInfo.methods.length > 0) {
      cogAmbientContent += "\n" + generateMethodAmbient(classInfo);
    }
  }

  // Two TS environments, mirroring the dual tsconfig (doc 09 §3).
  diags.push(...typecheck([{ name: COG_AMBIENT, content: cogAmbientContent }, ...bundle.cog]));
  if (bundle.srv.length > 0) {
    diags.push(...typecheck([{ name: SRV_AMBIENT, content: ambients.server }, ...bundle.srv]));
  }

  // Structural fence over every script source.
  for (const f of [...bundle.cog, ...bundle.srv]) {
    diags.push(...fence(f.name, f.content));
  }

  const errors = diags.filter((d) => d.severity === "error");
  const warnings = diags.filter((d) => d.severity === "warning");
  return { ok: errors.length === 0, errors, warnings };
}
