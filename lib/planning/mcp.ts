import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as data from "./data";
import { db, rows, type Activity, type Task } from "./db";
import { WEDDING_DAY, daysBetween, personName, today } from "./format";
import type { Person } from "./session";
import { TASK_STAGES, TASK_STATUSES } from "./stages";

// MCP server for the planning board. One URL per person
// (planning.oosterhouse.wedding/mcp/hannah or /mcp/james) so every change
// made through Claude is logged under the right name.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const person = z.enum(["hannah", "james", "both"]);
const id = z.string().uuid();

function ok(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function guard<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
      };
    }
  };
}

const taskOut = (t: Task) => ({
  id: t.id,
  title: t.title,
  assignee: t.assignee,
  status: t.status,
  start_date: t.start_date,
  due_date: t.due_date,
  notes: t.notes,
});

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

export function planningServer(me: Person) {
  const actor: data.Actor = { person: me, via: "claude" };
  const name = personName(me);
  const other = me === "hannah" ? "James" : "Hannah";

  const server = new McpServer(
    { name: "oosterhouse-wedding-planning", version: "1.0.0" },
    {
      instructions: [
        `This is Hannah and James's wedding planning board (planning.oosterhouse.wedding).`,
        `You are acting for ${name}. "Me" or "I" means ${name}; "${other}" is the partner. Assign with "hannah", "james", or "both".`,
        `The wedding is Sunday, July 4, 2027 at Bay Pointe Inn on Gun Lake, Michigan. Today is ${today()}.`,
        `This is a task planner: everything is a task with an owner, a stage, and dates. Dates are YYYY-MM-DD.`,
        `Tasks move through Kanban stages: ${TASK_STAGES.map((s) => `${s.id} (${s.label}: ${s.hint})`).join(", ")}. New tasks without an assignee start in backlog; with one, in todo.`,
        `Tasks can have a start_date and due_date; the timeline draws them as bars, grouped by owner.`,
        `Look things up with the list_* tools to get ids before updating. Pass null to clear a field. Confirm with the user before deleting several things at once.`,
      ].join("\n"),
    },
  );

  // ---- overview -----------------------------------------------------------

  server.registerTool(
    "get_board_summary",
    {
      title: "Board summary",
      description:
        "Snapshot of the board: days to go, task counts by stage, what's overdue, and what's due next. Start here.",
      annotations: READ,
    },
    guard(async () => {
      const now = today();
      const tasks = await rows<Task[]>(
        db().from("wedding_tasks").select("*").order("due_date", { nullsFirst: false }),
      );
      const open = tasks.filter((t) => t.status !== "done");
      return {
        acting_for: me,
        today: now,
        wedding_day: WEDDING_DAY,
        days_to_go: daysBetween(now, WEDDING_DAY),
        tasks: {
          open: open.length,
          by_stage: Object.fromEntries(
            TASK_STAGES.map((s) => [s.id, tasks.filter((t) => t.status === s.id).length]),
          ),
          done: tasks.length - open.length,
          overdue: open.filter((t) => t.due_date && t.due_date < now).map(taskOut),
          next_up: open.filter((t) => t.due_date && t.due_date >= now).slice(0, 8).map(taskOut),
          mine_open: open.filter((t) => t.assignee === me || t.assignee === "both").length,
          unassigned_open: open.filter((t) => !t.assignee).length,
          without_due_date: open.filter((t) => !t.due_date).length,
        },
      };
    }),
  );

  server.registerTool(
    "get_recent_activity",
    {
      title: "Recent activity",
      description: "What Hannah and James have changed lately, newest first.",
      inputSchema: { limit: z.number().int().min(1).max(100).default(20) },
      annotations: READ,
    },
    guard(async ({ limit }: { limit: number }) =>
      (
        await rows<Activity[]>(
          db().from("wedding_activity").select("*").order("created_at", { ascending: false }).limit(limit),
        )
      ).map((a) => ({ who: a.actor, what: a.summary, when: a.created_at })),
    ),
  );

  // ---- tasks --------------------------------------------------------------

  const taskFields = {
    notes: z.string().nullable().optional(),
    assignee: person.nullable().optional().describe("hannah, james, both, or null for unassigned"),
    status: z
      .enum(TASK_STATUSES)
      .optional()
      .describe("backlog, todo (shown as 'Assigned'), doing (in progress), waiting (on others), or done"),
    start_date: date.nullable().optional().describe("When work on it begins (draws a bar on the timeline)"),
    due_date: date.nullable().optional(),
  };

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks, soonest due first. Filter by who, status, date range, or text.",
      inputSchema: {
        assignee: z
          .enum(["me", "hannah", "james", "both", "unassigned", "any"])
          .default("any")
          .describe("'me' is the person you're acting for (includes tasks for both)"),
        status: z.enum(["open", "done", "all"]).default("open"),
        due_after: date.optional(),
        due_before: date.optional(),
        search: z.string().optional().describe("Case-insensitive match on title or notes"),
      },
      annotations: READ,
    },
    guard(
      async (args: {
        assignee: string;
        status: string;
        due_after?: string;
        due_before?: string;
        search?: string;
      }) => {
        let q = db().from("wedding_tasks").select("*");
        if (args.status === "open") q = q.neq("status", "done");
        if (args.status === "done") q = q.eq("status", "done");
        if (args.assignee === "me") q = q.in("assignee", [me, "both"]);
        else if (args.assignee === "unassigned") q = q.is("assignee", null);
        else if (args.assignee !== "any") q = q.eq("assignee", args.assignee);
        if (args.due_after) q = q.gte("due_date", args.due_after);
        if (args.due_before) q = q.lte("due_date", args.due_before);
        if (args.search) {
          const s = args.search.replace(/[%,()]/g, " ");
          q = q.or(`title.ilike.%${s}%,notes.ilike.%${s}%`);
        }
        const tasks = await rows<Task[]>(q.order("due_date", { nullsFirst: false }).order("created_at"));
        return tasks.map(taskOut);
      },
    ),
  );

  server.registerTool(
    "create_tasks",
    {
      title: "Create tasks",
      description: "Add one or more tasks. Use this for single tasks too.",
      inputSchema: {
        tasks: z.array(z.object({ title: z.string().min(1), ...taskFields })).min(1).max(100),
      },
      annotations: WRITE,
    },
    guard(async ({ tasks }: { tasks: (data.TaskInput & { title: string })[] }) => {
      const created = [];
      for (const t of tasks) created.push(taskOut(await data.createTask(actor, t)));
      return { created };
    }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      description:
        "Change any field on a task: rename, reassign, reschedule, move it to another stage, or mark it done. Only the fields you pass change.",
      inputSchema: { id, title: z.string().min(1).optional(), ...taskFields },
      annotations: WRITE,
    },
    guard(async ({ id, ...patch }: data.TaskInput & { id: string }) =>
      taskOut(await data.updateTask(actor, id, patch)),
    ),
  );

  server.registerTool(
    "delete_tasks",
    {
      title: "Delete tasks",
      description: "Permanently delete one or more tasks by id.",
      inputSchema: { ids: z.array(id).min(1).max(100) },
      annotations: DELETE,
    },
    guard(async ({ ids }: { ids: string[] }) => {
      const deleted = [];
      for (const taskId of ids) deleted.push((await data.deleteTask(actor, taskId)).title);
      return { deleted };
    }),
  );

  return server;
}
