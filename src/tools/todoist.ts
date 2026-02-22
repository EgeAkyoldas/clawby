import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const TODOIST_API = "https://api.todoist.com/rest/v2";

function todoistHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${config.todoistApiKey}`, "Content-Type": "application/json" };
}

async function getTasks(filter?: string): Promise<string> {
  if (!config.todoistApiKey) return JSON.stringify({ error: "TODOIST_API_KEY not configured" });
  const params = filter ? `?filter=${encodeURIComponent(filter)}` : "";
  const res = await fetch(`${TODOIST_API}/tasks${params}`, { headers: todoistHeaders() });
  if (!res.ok) return JSON.stringify({ error: `Todoist error: ${res.status}` });
  const tasks = await res.json() as Array<{
    id: string; content: string; description: string;
    due?: { date: string; string: string }; priority: number; labels: string[];
  }>;
  return JSON.stringify(tasks.slice(0, 10).map((t) => ({
    id: t.id, task: t.content, description: t.description || undefined,
    due: t.due?.string || t.due?.date, priority: t.priority, labels: t.labels,
  })));
}

async function createTask(content: string, description?: string, dueString?: string, priority?: number): Promise<string> {
  if (!config.todoistApiKey) return JSON.stringify({ error: "TODOIST_API_KEY not configured" });
  const body: Record<string, unknown> = { content };
  if (description) body.description = description;
  if (dueString) body.due_string = dueString;
  if (priority) body.priority = priority;
  const res = await fetch(`${TODOIST_API}/tasks`, {
    method: "POST", headers: todoistHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) return JSON.stringify({ error: `Todoist error: ${res.status}` });
  const task = await res.json() as { id: string; content: string; due?: { string: string } };
  return JSON.stringify({ created: true, id: task.id, task: task.content, due: task.due?.string });
}

async function completeTask(taskId: string): Promise<string> {
  if (!config.todoistApiKey) return JSON.stringify({ error: "TODOIST_API_KEY not configured" });
  const res = await fetch(`${TODOIST_API}/tasks/${taskId}/close`, { method: "POST", headers: todoistHeaders() });
  if (!res.ok) return JSON.stringify({ error: `Todoist error: ${res.status}` });
  return JSON.stringify({ completed: true, id: taskId });
}

export const todoistGetTasksTool: ToolDefinition = {
  declaration: {
    name: "todoist_get_tasks",
    description: "Get tasks from Todoist. Optionally filter by date, label, or priority.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filter: { type: SchemaType.STRING, description: "Todoist filter (e.g. 'today', 'tomorrow', 'overdue', 'p1', '#Work')" },
      },
      required: [],
    },
  },
  execute: async (args) => getTasks(args.filter as string | undefined),
};

export const todoistCreateTaskTool: ToolDefinition = {
  declaration: {
    name: "todoist_create_task",
    description: "Create a new task in Todoist.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        content: { type: SchemaType.STRING, description: "Task title/content" },
        description: { type: SchemaType.STRING, description: "Optional task description" },
        due_string: { type: SchemaType.STRING, description: "Natural language due date (e.g. 'tomorrow', 'next Monday')" },
        priority: { type: SchemaType.NUMBER, description: "Priority 1-4 (4 = highest/urgent)" },
      },
      required: ["content"],
    },
  },
  execute: async (args) => createTask(args.content as string, args.description as string | undefined, args.due_string as string | undefined, args.priority as number | undefined),
};

export const todoistCompleteTool: ToolDefinition = {
  declaration: {
    name: "todoist_complete_task",
    description: "Mark a Todoist task as complete by its ID.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_id: { type: SchemaType.STRING, description: "The Todoist task ID to complete" },
      },
      required: ["task_id"],
    },
  },
  execute: async (args) => completeTask(args.task_id as string),
};
