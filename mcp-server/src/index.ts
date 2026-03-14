import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { SPEC, SYSTEM_PROMPT, EXAMPLES } from "./content.js";
import { parse } from "./parser.js";
import { validate as validateAst } from "./validator.js";

export class ZobrMCP extends McpAgent {
  server = new McpServer({
    name: "ZS (Zobr Script)",
    version: "0.1.0",
  });

  async init() {
    // ── Resources ──

    this.server.resource(
      "spec",
      "zs://spec",
      { description: "ZS language specification v0.1 — full syntax, operations, control flow, types" },
      async () => ({
        contents: [{ uri: "zs://spec", mimeType: "text/markdown", text: SPEC }],
      })
    );

    this.server.resource(
      "interpreter",
      "zs://interpreter",
      { description: "System prompt for LLM to interpret ZS scripts — operation semantics, execution format" },
      async () => ({
        contents: [{ uri: "zs://interpreter", mimeType: "text/markdown", text: SYSTEM_PROMPT }],
      })
    );

    this.server.resource(
      "examples",
      "zs://examples",
      { description: "List of available ZS example scripts" },
      async () => ({
        contents: [{
          uri: "zs://examples",
          mimeType: "application/json",
          text: JSON.stringify(
            Object.entries(EXAMPLES).map(([name, code]) => ({
              name,
              uri: `zs://examples/${name}`,
              firstLine: code.split("\n").find((l: string) => l.startsWith("task:")) || code.split("\n")[0],
            })),
            null, 2
          ),
        }],
      })
    );

    // Dynamic resource template for individual examples
    this.server.resource(
      "example",
      "zs://examples/{name}",
      { description: "Get a specific ZS example script by name" },
      async (uri, { name }) => {
        const code = EXAMPLES[name as string];
        if (!code) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `Example "${name}" not found. Available: ${Object.keys(EXAMPLES).join(", ")}`,
            }],
          };
        }
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: code,
          }],
        };
      }
    );

    this.server.resource(
      "quickstart",
      "zs://quickstart",
      { description: "Quick start guide — how to interpret a ZS script (read this first)" },
      async () => ({
        contents: [{
          uri: "zs://quickstart",
          mimeType: "text/markdown",
          text: QUICKSTART,
        }],
      })
    );

    // ── Tools ──

    this.server.tool(
      "zs_execute",
      {
        script: z.string().describe("ZS (.zobr) script to execute. If the user pastes a script or asks to run/interpret a .zobr file, call this tool with the script text."),
        input: z.string().optional().describe("Value for the 'input' parameter declared in the script, if any"),
      },
      async ({ script, input }) => {
        const sections = [
          "# ZS Interpreter Context",
          "",
          "You are now a ZS (Zobr Script) interpreter. Below is everything you need to execute the script.",
          "",
          "## Language Specification",
          "",
          SPEC,
          "",
          "## Execution Instructions",
          "",
          SYSTEM_PROMPT,
          "",
          "## Script to Execute",
          "",
          "```zobr",
          script,
          "```",
        ];
        if (input) {
          sections.push("", "## Input Parameter Value", "", input);
        }
        sections.push(
          "",
          "## Your Task",
          "",
          "Execute this ZS script now. Follow the execution instructions precisely:",
          "- Show each operation with its tag: [survey], [ground], [doubt], etc.",
          "- Track all variables",
          "- Follow all control flow (for, if, loop)",
          "- End with the conclude block formatted exactly as specified",
        );
        return {
          content: [{ type: "text", text: sections.join("\n") }],
        };
      }
    );

    this.server.tool(
      "zs_validate",
      {
        script: z.string().describe("ZS script source code to validate"),
      },
      async ({ script }) => {
        try {
          const ast = parse(script);
          const diagnostics = validateAst(ast);
          const errors = diagnostics.filter(d => d.severity === "error");
          const warnings = diagnostics.filter(d => d.severity === "warning");
          if (errors.length === 0 && warnings.length === 0) {
            return {
              content: [{ type: "text", text: "✓ Valid ZS script. 0 errors, 0 warnings." }],
            };
          }
          const lines: string[] = [];
          for (const e of errors) {
            const loc = e.location ? `:${e.location.start.line}:${e.location.start.column}` : "";
            lines.push(`ERROR${loc} ${e.message}`);
          }
          for (const w of warnings) {
            const loc = w.location ? `:${w.location.start.line}:${w.location.start.column}` : "";
            lines.push(`WARNING${loc} ${w.message}`);
          }
          lines.push(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        } catch (e: any) {
          const loc = e.location ? ` at line ${e.location.start.line}:${e.location.start.column}` : "";
          return {
            content: [{ type: "text", text: `Syntax error${loc}: ${e.message}` }],
          };
        }
      }
    );

    this.server.tool(
      "zs_operations",
      {},
      async () => ({
        content: [{
          type: "text",
          text: OPERATIONS_REFERENCE,
        }],
      })
    );
  }
}

// ── Static content ──

const QUICKSTART = `# ZS Quick Start

ZS (Zobr Script) is a cognitive scripting language for structured reasoning with LLMs.

## How to interpret a ZS script

1. Read \`zs://spec\` for the full language specification
2. Read \`zs://interpreter\` for the system prompt that tells you how to execute scripts
3. The user gives you a \`.zobr\` script — execute it step by step
4. Show each operation with its tag: \`[survey]\`, \`[ground]\`, \`[doubt]\`, etc.
5. Track variables, follow control flow, end with the \`conclude\` block

## Validate before executing

Use the \`zs_validate\` tool to check a script for syntax errors before execution.

## Available resources

- \`zs://spec\` — Full language specification
- \`zs://interpreter\` — System prompt for execution
- \`zs://examples\` — List of example scripts
- \`zs://examples/{name}\` — Get a specific example
- \`zs://quickstart\` — This guide

## 12 built-in operations

Use the \`zs_operations\` tool for a quick reference of all operations.
`;

const OPERATIONS_REFERENCE = `ZS Operations Quick Reference:

DISCOVERY:
  survey(topic, count?) → list — Explore and identify key elements
  ground(claim, extract?) → evidence — Connect to concrete facts

ARGUMENT:
  assert(thesis, based_on?) → claim — State a position with reasoning
  doubt(target) → critique — Find weaknesses and assumptions
  contrast(target, with?) → counter — Construct opposing position
  analogy(target, from?) → mapping — Transfer from another domain

SYNTHESIS:
  synthesize(sources, method?) → unified — Combine into higher understanding
  reframe(target, lens?) → new_view — Reformulate in different terms

META:
  assess(scale?) → state — Evaluate current reasoning state
  pivot(reason) → side effect — Change reasoning strategy
  scope(narrow|wide, focus?) → side effect — Control analytical zoom

OUTPUT:
  conclude { field: type, ... } → structured result

CONTROL FLOW:
  for item in collection { ... yield { } }
  if condition { ... } else { ... }
  loop N times { ... }
  loop until condition { ... }

VARIABLES:
  name = operation(...)
  @last — previous result
  @N — N-th result (1-indexed)
`;

// ── Request handler ──

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      return ZobrMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Landing page
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(LANDING_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

const LANDING_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>ZS (Zobr Script) — MCP Server</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 20px; color: #e0e6ed; background: #0a0e17; }
    h1 { color: #a78bfa; }
    a { color: #6366f1; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
    .connect { background: #1a2035; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .connect h2 { margin-top: 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .url { background: #0f172a; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 15px; color: #22d3ee; word-break: break-all; }
  </style>
</head>
<body>
  <h1>ZS (Zobr Script)</h1>
  <p>A cognitive scripting language for structured reasoning with LLMs.</p>
  <p>This is an MCP server. Connect it to Claude, Claude Desktop, or any MCP client.</p>

  <div class="connect">
    <h2>Connect to Claude.ai</h2>
    <p>Settings → Connectors → Add custom connector</p>
    <div class="url">https://zobr-script-mcp.docxi-next.workers.dev/mcp</div>
  </div>

  <div class="connect">
    <h2>Resources provided</h2>
    <p><code>zs://spec</code> — Language specification</p>
    <p><code>zs://interpreter</code> — System prompt for execution</p>
    <p><code>zs://examples</code> — Example scripts catalog</p>
    <p><code>zs://quickstart</code> — Quick start guide</p>
  </div>

  <div class="connect">
    <h2>Tools provided</h2>
    <p><code>zs_validate</code> — Validate a .zobr script</p>
    <p><code>zs_operations</code> — Quick reference for all 12 operations</p>
  </div>

  <p><a href="https://github.com/docxi-org/zobr-script">GitHub</a> · Apache 2.0</p>
</body>
</html>`;
