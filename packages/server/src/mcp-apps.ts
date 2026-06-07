import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST_APPS = join(here, "..", "dist-apps");

interface AppDef {
  readonly name: string;
  readonly resourceUri: string;
  readonly htmlFile: string;
}

const APPS: AppDef[] = [
  { name: "ZS Trace Progress", resourceUri: "ui://zs-trace-progress/app.html", htmlFile: "trace-progress/index.html" },
];

export function registerZsApps(server: McpServer): void {
  for (const app of APPS) {
    const htmlPath = join(DIST_APPS, app.htmlFile);
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
