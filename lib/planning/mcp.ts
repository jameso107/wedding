import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { budgetTotals } from "./budget";
import * as data from "./data";
import {
  db,
  rows,
  type Activity,
  type BudgetCategory,
  type Decision,
  type Payment,
  type Task,
  type Vendor,
} from "./db";
import { WEDDING_DAY, daysBetween, personName, today } from "./format";
import type { Person } from "./session";
import { TASK_STAGES, TASK_STATUSES } from "./stages";

// MCP server for the planning board. One URL per person
// (planning.oosterhouse.wedding/mcp/hannah or /mcp/james) so every change
// made through Claude is logged under the right name.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const person = z.enum(["hannah", "james", "both"]);
const id = z.string().uuid();
const dollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? null : Number(cents) / 100;
const toCents = (amount: number | null | undefined) =>
  amount === null || amount === undefined ? amount : Math.round(amount * 100);

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
  vendor_id: t.vendor_id,
  decision_id: t.decision_id,
});

const vendorOut = (v: Vendor) => ({
  ...v,
  quote_cents: undefined,
  quote_dollars: dollars(v.quote_cents),
});

const paymentOut = (p: Payment) => ({
  ...p,
  amount_cents: undefined,
  amount_dollars: dollars(p.amount_cents),
});

const categoryOut = (c: BudgetCategory) => ({
  id: c.id,
  name: c.name,
  planned_dollars: dollars(c.planned_cents),
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
        `Dates are YYYY-MM-DD. Money is in US dollars.`,
        `Tasks move through Kanban stages: ${TASK_STAGES.map((s) => `${s.id} (${s.label}: ${s.hint})`).join(", ")}. New tasks without an assignee start in backlog; with one, in todo.`,
        `Tasks can have a start_date and due_date; the timeline draws them as bars. Link follow-up tasks to the decision they come from with decision_id.`,
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
        "Snapshot of the whole board: days to go, task counts, what's overdue or due soon, open decisions, vendor pipeline, and budget totals. Start here.",
      annotations: READ,
    },
    guard(async () => {
      const now = today();
      const [tasks, decisions, vendors, categories, payments] = await Promise.all([
        rows<Task[]>(db().from("wedding_tasks").select("*").order("due_date", { nullsFirst: false })),
        rows<Decision[]>(db().from("wedding_decisions").select("*").order("decide_by", { nullsFirst: false })),
        rows<Vendor[]>(db().from("wedding_vendors").select("*")),
        rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*")),
        rows<Payment[]>(db().from("wedding_payments").select("*")),
      ]);
      const open = tasks.filter((t) => t.status !== "done");
      const budget = budgetTotals(categories, vendors, payments);
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
        open_decisions: decisions
          .filter((d) => d.status !== "decided")
          .map((d) => ({ id: d.id, title: d.title, status: d.status, owner: d.owner, decide_by: d.decide_by })),
        vendors_by_status: Object.fromEntries(
          ["researching", "contacted", "quoted", "booked", "passed"].map((s) => [
            s,
            vendors.filter((v) => v.status === s).map((v) => v.name),
          ]),
        ),
        budget_dollars: {
          planned: dollars(budget.planned),
          committed: dollars(budget.committed),
          paid: dollars(budget.paid),
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
    vendor_id: id.nullable().optional(),
    decision_id: id.nullable().optional().describe("The decision this task follows from"),
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
        "Change any field on a task: rename, reassign, reschedule, mark done (status 'done'), link to a vendor or decision. Only the fields you pass change.",
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

  // ---- decisions ----------------------------------------------------------

  const decisionFields = {
    context: z.string().nullable().optional().describe("Background, constraints, opinions"),
    options: z.string().nullable().optional().describe("Options being weighed, one per line"),
    status: z.enum(["open", "leaning", "decided"]).optional(),
    outcome: z.string().nullable().optional().describe("What was chosen"),
    rationale: z.string().nullable().optional().describe("Why"),
    owner: person.nullable().optional(),
    decide_by: date.nullable().optional(),
  };

  server.registerTool(
    "list_decisions",
    {
      title: "List decisions",
      description: "The decisions log: open questions and what's been decided, with options and rationale.",
      inputSchema: { status: z.enum(["open", "decided", "all"]).default("all") },
      annotations: READ,
    },
    guard(async ({ status }: { status: string }) => {
      let q = db().from("wedding_decisions").select("*");
      if (status === "open") q = q.neq("status", "decided");
      if (status === "decided") q = q.eq("status", "decided");
      return rows<Decision[]>(q.order("decide_by", { nullsFirst: false }));
    }),
  );

  server.registerTool(
    "create_decision",
    {
      title: "Create a decision",
      description: "Add a question to settle (e.g. 'Live band or DJ?'). Can be created already decided.",
      inputSchema: { title: z.string().min(1), ...decisionFields },
      annotations: WRITE,
    },
    guard(async (input: data.DecisionInput & { title: string }) => data.createDecision(actor, input)),
  );

  server.registerTool(
    "update_decision",
    {
      title: "Update a decision",
      description:
        "Edit a decision. To record a decision, set status 'decided' with an outcome and rationale. Only the fields you pass change.",
      inputSchema: { id, title: z.string().min(1).optional(), ...decisionFields },
      annotations: WRITE,
    },
    guard(async ({ id, ...patch }: data.DecisionInput & { id: string }) =>
      data.updateDecision(actor, id, patch),
    ),
  );

  server.registerTool(
    "delete_decision",
    {
      title: "Delete a decision",
      description: "Permanently delete a decision. Linked tasks stay but lose the link.",
      inputSchema: { id },
      annotations: DELETE,
    },
    guard(async ({ id }: { id: string }) => ({ deleted: (await data.deleteDecision(actor, id)).title })),
  );

  // ---- vendors ------------------------------------------------------------

  const vendorFields = {
    service: z.string().nullable().optional().describe("e.g. Photographer, Florist"),
    category_id: id.nullable().optional().describe("Budget category id (see get_budget)"),
    status: z.enum(["researching", "contacted", "quoted", "booked", "passed"]).optional(),
    owner: person.nullable().optional().describe("Point person"),
    contact_name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    quote_dollars: z.number().nonnegative().nullable().optional(),
    notes: z.string().nullable().optional(),
  };
  type VendorArgs = Omit<data.VendorInput, "quote_cents"> & { quote_dollars?: number | null };
  const vendorPatch = ({ quote_dollars, ...rest }: VendorArgs): data.VendorInput => ({
    ...rest,
    quote_cents: toCents(quote_dollars),
  });

  server.registerTool(
    "list_vendors",
    {
      title: "List vendors",
      description: "Vendors with their pipeline status, contact info, quotes, and notes.",
      inputSchema: {
        status: z.enum(["researching", "contacted", "quoted", "booked", "passed", "any"]).default("any"),
      },
      annotations: READ,
    },
    guard(async ({ status }: { status: string }) => {
      let q = db().from("wedding_vendors").select("*");
      if (status !== "any") q = q.eq("status", status);
      return (await rows<Vendor[]>(q.order("name"))).map(vendorOut);
    }),
  );

  server.registerTool(
    "create_vendor",
    {
      title: "Create a vendor",
      description: "Add a vendor (photographer, florist, band…).",
      inputSchema: { name: z.string().min(1), ...vendorFields },
      annotations: WRITE,
    },
    guard(async ({ name, ...rest }: VendorArgs & { name: string }) =>
      vendorOut(await data.createVendor(actor, { name, ...vendorPatch(rest) })),
    ),
  );

  server.registerTool(
    "update_vendor",
    {
      title: "Update a vendor",
      description: "Edit a vendor: move it through the pipeline, add contact info, record a quote. Only the fields you pass change.",
      inputSchema: { id, name: z.string().min(1).optional(), ...vendorFields },
      annotations: WRITE,
    },
    guard(async ({ id, ...rest }: VendorArgs & { id: string }) =>
      vendorOut(await data.updateVendor(actor, id, vendorPatch(rest))),
    ),
  );

  server.registerTool(
    "delete_vendor",
    {
      title: "Delete a vendor",
      description: "Permanently delete a vendor and its payments. Linked tasks stay but lose the link.",
      inputSchema: { id },
      annotations: DELETE,
    },
    guard(async ({ id }: { id: string }) => ({ deleted: (await data.deleteVendor(actor, id)).name })),
  );

  // ---- budget -------------------------------------------------------------

  server.registerTool(
    "get_budget",
    {
      title: "Budget",
      description:
        "Budget categories (with ids) showing planned, committed, paid, and remaining dollars, plus every payment. Committed counts booked vendors' quotes or scheduled payments, whichever is more.",
      annotations: READ,
    },
    guard(async () => {
      const [categories, vendors, payments] = await Promise.all([
        rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*").order("sort")),
        rows<Vendor[]>(db().from("wedding_vendors").select("*")),
        rows<Payment[]>(db().from("wedding_payments").select("*").order("due_date", { nullsFirst: false })),
      ]);
      const totals = budgetTotals(categories, vendors, payments);
      return {
        totals_dollars: {
          planned: dollars(totals.planned),
          committed: dollars(totals.committed),
          paid: dollars(totals.paid),
          left: dollars(totals.planned - totals.committed),
        },
        categories: totals.rows.map((r) => ({
          id: r.category?.id ?? null,
          name: r.category?.name ?? "Uncategorized",
          planned: dollars(r.planned),
          committed: dollars(r.committed),
          paid: dollars(r.paid),
          left: dollars(r.planned - r.committed),
        })),
        payments: payments.map((p) => ({
          ...paymentOut(p),
          vendor: vendors.find((v) => v.id === p.vendor_id)?.name ?? null,
        })),
      };
    }),
  );

  server.registerTool(
    "set_budget_category",
    {
      title: "Create or update a budget category",
      description: "Pass an id to rename a category or change its planned amount; omit the id to create a new one.",
      inputSchema: {
        id: id.optional(),
        name: z.string().min(1).optional(),
        planned_dollars: z.number().nonnegative().optional(),
      },
      annotations: WRITE,
    },
    guard(async (args: { id?: string; name?: string; planned_dollars?: number }) => {
      const planned_cents = toCents(args.planned_dollars) ?? undefined;
      if (args.id) return categoryOut(await data.updateCategory(actor, args.id, { name: args.name, planned_cents }));
      if (!args.name) throw new Error("A name is required to create a category.");
      return categoryOut(await data.createCategory(actor, { name: args.name, planned_cents }));
    }),
  );

  server.registerTool(
    "delete_budget_category",
    {
      title: "Delete a budget category",
      description: "Delete a category. Its vendors and payments become uncategorized.",
      inputSchema: { id },
      annotations: DELETE,
    },
    guard(async ({ id }: { id: string }) => ({ deleted: (await data.deleteCategory(actor, id)).name })),
  );

  const paymentFields = {
    vendor_id: id.nullable().optional(),
    category_id: id.nullable().optional().describe("Defaults to the vendor's category"),
    due_date: date.nullable().optional(),
    paid_on: date.nullable().optional().describe("Set when paid; null marks it unpaid"),
  };
  type PaymentArgs = Omit<data.PaymentInput, "amount_cents"> & { amount_dollars?: number };

  server.registerTool(
    "create_payment",
    {
      title: "Add a payment",
      description: "Schedule or record a payment: a vendor deposit, a balance, or any other expense.",
      inputSchema: {
        label: z.string().min(1).describe("e.g. Deposit, Final balance"),
        amount_dollars: z.number().positive(),
        ...paymentFields,
      },
      annotations: WRITE,
    },
    guard(async ({ amount_dollars, ...rest }: PaymentArgs & { label: string; amount_dollars: number }) =>
      paymentOut(await data.createPayment(actor, { ...rest, amount_cents: toCents(amount_dollars)! })),
    ),
  );

  server.registerTool(
    "update_payment",
    {
      title: "Update a payment",
      description: "Change a payment, or mark it paid by setting paid_on. Only the fields you pass change.",
      inputSchema: {
        id,
        label: z.string().min(1).optional(),
        amount_dollars: z.number().positive().optional(),
        ...paymentFields,
      },
      annotations: WRITE,
    },
    guard(async ({ id, amount_dollars, ...rest }: PaymentArgs & { id: string }) =>
      paymentOut(
        await data.updatePayment(actor, id, { ...rest, amount_cents: toCents(amount_dollars) ?? undefined }),
      ),
    ),
  );

  server.registerTool(
    "delete_payment",
    {
      title: "Delete a payment",
      description: "Permanently delete a payment.",
      inputSchema: { id },
      annotations: DELETE,
    },
    guard(async ({ id }: { id: string }) => ({ deleted: (await data.deletePayment(actor, id)).label })),
  );

  return server;
}
