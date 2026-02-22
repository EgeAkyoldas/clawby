import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { isToolAllowed, scanForSecretLeak, redactForLog } from "./guardrails.js";
import type { FunctionDeclaration } from "@google/generative-ai";

// ── Types ─────────────────────────────────────────────────

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

interface ConnectedServer {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: string[];
}

// ── State ─────────────────────────────────────────────────

const connectedServers: ConnectedServer[] = [];

// ── Config Loader ─────────────────────────────────────────

const CONFIG_PATH = join(process.cwd(), "mcp.config.json");

function loadMcpConfig(): McpConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as McpConfig;
  } catch (err) {
    console.error("⚠️ Failed to parse mcp.config.json:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Resolve ${VAR} placeholders in server env values from process.env.
 */
function resolveEnv(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const match = value.match(/^\$\{(.+)\}$/);
    if (match) {
      resolved[key] = process.env[match[1]] || "";
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// ── Initialization ────────────────────────────────────────

/**
 * Initialize all MCP servers defined in mcp.config.json.
 * Returns the count of successfully connected servers.
 */
export async function initializeMcpServers(): Promise<number> {
  const mcpConfig = loadMcpConfig();
  if (!mcpConfig) return 0;

  for (const [serverName, serverConfig] of Object.entries(mcpConfig.servers)) {
    try {
      const client = new Client({
        name: "agent-claw",
        version: "1.0.0",
      });

      const env = {
        ...process.env,
        ...(serverConfig.env ? resolveEnv(serverConfig.env) : {}),
      };

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: env as Record<string, string>,
      });

      await client.connect(transport);

      // Discover tools
      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      connectedServers.push({
        name: serverName,
        client,
        transport,
        tools: toolNames,
      });

      console.log(
        `  🔌 MCP server "${serverName}" connected — ${toolNames.length} tool(s): ${toolNames.join(", ")}`
      );
    } catch (err) {
      console.error(
        `  ❌ MCP server "${serverName}" failed to connect:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return connectedServers.length;
}

// ── Tool Discovery ────────────────────────────────────────

/**
 * Get Gemini-compatible function declarations from all MCP servers.
 * Only includes tools that pass the allowlist check.
 */
export async function getMcpFunctionDeclarations(): Promise<FunctionDeclaration[]> {
  const declarations: FunctionDeclaration[] = [];

  for (const server of connectedServers) {
    const { tools } = await server.client.listTools();

    for (const tool of tools) {
      if (!isToolAllowed(tool.name)) continue;

      // Convert MCP tool schema to Gemini FunctionDeclaration
      const decl: FunctionDeclaration = {
        name: tool.name,
        description: tool.description || `MCP tool from ${server.name}`,
      };

      // Convert JSON Schema parameters to Gemini format
      if (tool.inputSchema && typeof tool.inputSchema === "object") {
        const schema = tool.inputSchema as Record<string, unknown>;
        if (schema.properties) {
          decl.parameters = {
            type: "object" as const,
            properties: schema.properties as Record<string, unknown>,
            required: (schema.required as string[]) || [],
          } as FunctionDeclaration["parameters"];
        }
      }

      declarations.push(decl);
    }
  }

  return declarations;
}

// ── Tool Execution ────────────────────────────────────────

/**
 * Check if a tool name belongs to an MCP server.
 */
export function isMcpTool(name: string): boolean {
  return connectedServers.some((s) => s.tools.includes(name));
}

/**
 * Execute an MCP tool by name.
 * Applies guardrails: allowlist check, secret leak scan, log redaction.
 */
export async function executeMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  // Guardrail 1: Allowlist
  if (!isToolAllowed(name)) {
    return JSON.stringify({ error: `Tool "${name}" is not in the allowed tools list` });
  }

  // Guardrail 2: Secret leak scan
  const leak = scanForSecretLeak(args);
  if (leak) {
    console.error(`🚨 BLOCKED: Secret leak detected in field "${leak}" for tool "${name}"`);
    return JSON.stringify({ error: "Request blocked: contains sensitive data" });
  }

  // Find the server that owns this tool
  const server = connectedServers.find((s) => s.tools.includes(name));
  if (!server) {
    return JSON.stringify({ error: `No MCP server has tool "${name}"` });
  }

  try {
    console.log(`  🔌 MCP call: ${name} (${server.name})`);

    const result = await server.client.callTool({ name, arguments: args });

    // Guardrail 3: Redact before logging
    console.log(`  📨 MCP result:`, JSON.stringify(redactForLog(result.content)).slice(0, 200));

    // Extract text content from MCP response
    if (Array.isArray(result.content)) {
      return result.content
        .map((c) => {
          if (typeof c === "object" && c !== null && "text" in c) {
            return (c as { text: string }).text;
          }
          return JSON.stringify(c);
        })
        .join("\n");
    }

    return JSON.stringify(result.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ MCP tool "${name}" failed:`, message);
    return JSON.stringify({ error: `MCP tool "${name}" failed: ${message}` });
  }
}

// ── Lifecycle ─────────────────────────────────────────────

/**
 * Get the count of connected MCP servers.
 */
export function getConnectedServerCount(): number {
  return connectedServers.length;
}

/**
 * Get all connected server names and their tools.
 */
export function getConnectedServerInfo(): Array<{ name: string; tools: string[] }> {
  return connectedServers.map((s) => ({ name: s.name, tools: s.tools }));
}

/**
 * Gracefully disconnect all MCP servers.
 */
export async function shutdownMcpServers(): Promise<void> {
  for (const server of connectedServers) {
    try {
      await server.client.close();
      console.log(`  🔌 MCP server "${server.name}" disconnected`);
    } catch {
      // ignore shutdown errors
    }
  }
  connectedServers.length = 0;
}
