import { config } from "../config.js";

/** Sensitive field names to redact from logs */
const SENSITIVE_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "api_key",
  "apikey",
  "token",
  "credential",
  "private_key",
]);

/** Environment variable values we must never send outbound */
const SECRET_VALUES = new Set(
  [
    config.telegramBotToken,
    config.modelApiKey,
    config.transcriptionApiKey,
    config.ttsApiKey,
    config.googleClientId,
    config.googleClientSecret,
  ].filter(Boolean) as string[]
);

/**
 * Check if a tool is allowed by the allowlist.
 * If no allowlist is configured, all tools are allowed.
 */
export function isToolAllowed(toolName: string): boolean {
  if (config.mcpAllowedTools.length === 0) return true;
  return config.mcpAllowedTools.includes(toolName);
}

/**
 * Scan outbound arguments for leaked secrets.
 * Returns the name of the leaked field, or null if clean.
 */
export function scanForSecretLeak(
  args: Record<string, unknown>
): string | null {
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && SECRET_VALUES.has(value)) {
      return key;
    }
    if (typeof value === "object" && value !== null) {
      const nested = scanForSecretLeak(value as Record<string, unknown>);
      if (nested) return `${key}.${nested}`;
    }
  }
  return null;
}

/**
 * Redact sensitive fields from an object before logging.
 * Returns a deep copy with sensitive values replaced by "[REDACTED]".
 */
export function redactForLog(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactForLog);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && SECRET_VALUES.has(value)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactForLog(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
