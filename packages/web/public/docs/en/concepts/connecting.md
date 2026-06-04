---
title: Connecting to ZS
category: What is ZS
order: 4
summary: How to connect your AI assistant to the ZS server as an MCP client. Step-by-step for claude.ai, ChatGPT, Cursor, and other platforms.
tags: [mcp, connection, setup, oauth]
related: [what-is-zs, how-execution-works, agents]
---

# Connecting to ZS

ZS is an MCP server. To use it, you need an AI assistant that supports remote MCP connections over HTTPS. The server URL is:

```
https://zs.docxi.org/mcp
```

The server uses **OAuth 2.1** for authentication. On first connection, your client will open a login page where you enter your credentials. After that, the session is maintained automatically.

## claude.ai

Available on Pro, Team, and Enterprise plans.

1. Open **Settings** (profile icon in the bottom-left corner)
2. Go to **Connectors**
3. Click **Add custom connector**
4. Enter the server URL: `https://zs.docxi.org/mcp`
5. Click **Add** — a browser window opens with the ZS login page
6. Enter your email and password, click **Sign in**
7. The connector appears in your list — it syncs across Claude Desktop, iOS, and Android

After connecting, ZS tools (`zs_register`, `zs_start`, etc.) become available in every conversation. Ask Claude to register and run a script.

## ChatGPT

Available on Plus, Pro, Team, and Enterprise plans. Requires Developer Mode.

1. Open **Settings** → **Apps** → **Advanced settings**
2. Enable **Developer Mode**
3. Go to **Connectors**, click **Create**
4. Enter a name (e.g. "ZS"), description, and the server URL: `https://zs.docxi.org/mcp`
5. Choose auth type: **OAuth**
6. Save the connector
7. In a new chat, click **+** → **More** → select the ZS connector to activate it

Write actions require per-chat confirmation from the user.

## Cursor

Available in Cursor v0.48+.

1. Open **Settings** → **MCP Servers**
2. Click **Add** or edit `.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "zs": { "url": "https://zs.docxi.org/mcp" }
     }
   }
   ```
3. OAuth flow opens in the browser automatically on first use

## Windsurf

1. Open the **Cascade** panel → click the **MCP icon**
2. Add a new server or edit `~/.codeium/windsurf/mcp_config.json`:
   ```json
   {
     "mcpServers": {
       "zs": { "serverUrl": "https://zs.docxi.org/mcp" }
     }
   }
   ```

## Claude Code (CLI)

If you're running Claude Code in this repository, ZS is already configured as a local MCP server in the project settings. No additional setup needed — tools are available immediately after `/mcp` reconnect.

## After connecting

Once connected, the typical flow is:

1. Ask your assistant to **register** — it calls `zs_register` and receives the system guide
2. Ask it to **list scripts** — `zs_list` shows available scripts
3. Ask it to **run a script** — e.g. "run the insight script on our authentication module"

The assistant handles the MCP protocol automatically. You interact in natural language.

## See also

- [What is ZS](what-is-zs) — overview of the system
- [How execution works](how-execution-works) — the start-to-conclude cycle
- [Agents](agents) — registration and identity
