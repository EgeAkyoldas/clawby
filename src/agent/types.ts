import type { Content, FunctionDeclaration } from "@google/generative-ai";

/** A single turn in the conversation history */
export type ConversationMessage = Content;

/** The result returned by the agent loop */
export interface AgentResult {
  text: string;
  toolCalls: number;
  images?: Array<{ data: string; mimeType: string; caption?: string }>;
}

/** A tool definition for our registry */
export interface ToolDefinition {
  declaration: FunctionDeclaration;
  execute: (args: Record<string, unknown>) => Promise<string>;
}
