import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIST_APPS = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-apps");

interface AppDef {
  readonly name: string;
  readonly resourceUri: string;
  readonly htmlFile: string;
}

const APPS: AppDef[] = [
  { name: "ZS Trace Progress", resourceUri: "ui://zs-trace-progress/app.html", htmlFile: "trace-progress/index.html" },
  { name: "ZS Report", resourceUri: "ui://zs-report/app.html", htmlFile: "trace-report/index.html" },
  { name: "ZS Checkpoint", resourceUri: "ui://zs-checkpoint/app.html", htmlFile: "trace-checkpoint/index.html" },
  { name: "ZS Sandbox", resourceUri: "ui://zs-sandbox/app.html", htmlFile: "trace-sandbox/index.html" },
  { name: "ZS Commit", resourceUri: "ui://zs-commit/app.html", htmlFile: "trace-commit/index.html" },
  { name: "ZS Check", resourceUri: "ui://zs-check/app.html", htmlFile: "trace-check/index.html" },
  { name: "ZS Retrieve", resourceUri: "ui://zs-retrieve/app.html", htmlFile: "trace-retrieve/index.html" },
  { name: "ZS Conclude", resourceUri: "ui://zs-conclude/app.html", htmlFile: "trace-conclude/index.html" },
];

export function registerZsApps(server: McpServer, appsDir?: string): void {
  const dir = appsDir ?? DEFAULT_DIST_APPS;
  for (const app of APPS) {
    const htmlPath = join(dir, app.htmlFile);
    if (!existsSync(htmlPath)) continue;

    registerAppResource(
      server,
      app.name,
      app.resourceUri,
      {},
      async () => ({
        contents: [{ uri: app.resourceUri, mimeType: RESOURCE_MIME_TYPE, text: readFileSync(htmlPath, "utf-8") }],
      }),
    );
  }
}

export const ZS_APP_RESOURCES = APPS.map((a) => ({ name: a.name, uri: a.resourceUri }));

export const TOOL_UI_META: Record<string, { resourceUri: string }> = {
  zs_start: { resourceUri: "ui://zs-trace-progress/app.html" },
  zs_report: { resourceUri: "ui://zs-report/app.html" },
  zs_checkpoint: { resourceUri: "ui://zs-checkpoint/app.html" },
  zs_sandbox: { resourceUri: "ui://zs-sandbox/app.html" },
  zs_commit: { resourceUri: "ui://zs-commit/app.html" },
  zs_check: { resourceUri: "ui://zs-check/app.html" },
  zs_retrieve: { resourceUri: "ui://zs-retrieve/app.html" },
  zs_conclude: { resourceUri: "ui://zs-conclude/app.html" },
};
