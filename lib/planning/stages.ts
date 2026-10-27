// Task stages, in board order. Shared by the database types, forms, the
// Kanban board, and the MCP server.
export const TASK_STAGES = [
  { id: "backlog", label: "Backlog", hint: "Someday, or not yet scheduled" },
  { id: "todo", label: "Assigned", hint: "Has an owner, not started" },
  { id: "doing", label: "In progress", hint: "Being worked on now" },
  { id: "waiting", label: "Waiting on others", hint: "Blocked on a vendor or someone else" },
  { id: "done", label: "Done", hint: "Finished" },
] as const;

export type TaskStatus = (typeof TASK_STAGES)[number]["id"];

export const TASK_STATUSES = TASK_STAGES.map((s) => s.id) as [TaskStatus, ...TaskStatus[]];

export function stageLabel(status: string): string {
  return TASK_STAGES.find((s) => s.id === status)?.label ?? status;
}
