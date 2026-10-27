import "server-only";
import {
  db,
  rows,
  type Assignee,
  type BudgetCategory,
  type Decision,
  type DecisionStatus,
  type Payment,
  type Task,
  type TaskStatus,
  type Vendor,
  type VendorStatus,
} from "./db";
import { personName, today } from "./format";
import type { Person } from "./session";

// Every write to the planning board goes through here, from both the web
// forms (app/planning/actions.ts) and the MCP server (app/planning/mcp).
// Inputs are patches: a missing key leaves the field alone, null clears it.

export type Actor = { person: Person; via?: "claude" };

async function log(actor: Actor, summary: string, href?: string) {
  await db()
    .from("wedding_activity")
    .insert({
      actor: actor.person,
      summary: actor.via === "claude" ? `${summary} (via Claude)` : summary,
      href,
    });
}

const now = () => new Date().toISOString();

function defined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function checkWindow(start: string | null | undefined, due: string | null | undefined) {
  if (start && due && start > due) {
    throw new Error(`Start date ${start} is after the due date ${due}.`);
  }
}

// ---- tasks ----------------------------------------------------------------

export type TaskInput = {
  title?: string;
  notes?: string | null;
  assignee?: Assignee | null;
  status?: TaskStatus;
  start_date?: string | null;
  due_date?: string | null;
  vendor_id?: string | null;
  decision_id?: string | null;
};

export async function createTask(actor: Actor, input: TaskInput & { title: string }) {
  checkWindow(input.start_date, input.due_date);
  const task = await rows<Task>(
    db()
      .from("wedding_tasks")
      .insert({
        ...defined(input),
        status: input.status ?? (input.assignee ? "todo" : "backlog"),
        created_by: actor.person,
        completed_at: input.status === "done" ? now() : null,
      })
      .select()
      .single(),
  );
  await log(
    actor,
    task.assignee && task.assignee !== actor.person
      ? `added “${task.title}” for ${personName(task.assignee)}`
      : `added “${task.title}”`,
    `/tasks/${task.id}`,
  );
  return task;
}

export async function updateTask(actor: Actor, id: string, patch: TaskInput) {
  const before = await rows<Task>(db().from("wedding_tasks").select("*").eq("id", id).single());
  checkWindow(
    patch.start_date === undefined ? before.start_date : patch.start_date,
    patch.due_date === undefined ? before.due_date : patch.due_date,
  );
  const status = patch.status ?? before.status;
  const task = await rows<Task>(
    db()
      .from("wedding_tasks")
      .update({
        ...defined(patch),
        completed_at:
          status !== "done" ? null : before.status === "done" ? before.completed_at : now(),
        updated_at: now(),
      })
      .eq("id", id)
      .select()
      .single(),
  );
  if (task.status === "done" && before.status !== "done") {
    await log(actor, `finished “${task.title}”`, `/tasks/${id}`);
  } else if (task.assignee && task.assignee !== before.assignee && task.assignee !== actor.person) {
    await log(actor, `handed “${task.title}” to ${personName(task.assignee)}`, `/tasks/${id}`);
  } else if (task.status === "doing" && before.status !== "doing") {
    await log(actor, `started “${task.title}”`, `/tasks/${id}`);
  } else if (task.status === "waiting" && before.status !== "waiting") {
    await log(actor, `is waiting on others for “${task.title}”`, `/tasks/${id}`);
  } else if (task.assignee === actor.person && before.assignee !== actor.person) {
    await log(actor, `picked up “${task.title}”`, `/tasks/${id}`);
  } else if (actor.via === "claude") {
    await log(actor, `updated “${task.title}”`, `/tasks/${id}`);
  }
  return task;
}

export async function deleteTask(actor: Actor, id: string) {
  const task = await rows<Task>(db().from("wedding_tasks").delete().eq("id", id).select().single());
  await log(actor, `removed task “${task.title}”`);
  return task;
}

// ---- decisions ------------------------------------------------------------

export type DecisionInput = {
  title?: string;
  context?: string | null;
  options?: string | null;
  status?: DecisionStatus;
  outcome?: string | null;
  rationale?: string | null;
  owner?: Assignee | null;
  decide_by?: string | null;
};

export async function createDecision(actor: Actor, input: DecisionInput & { title: string }) {
  const decision = await rows<Decision>(
    db()
      .from("wedding_decisions")
      .insert({
        ...defined(input),
        decided_on: input.status === "decided" ? today() : null,
      })
      .select()
      .single(),
  );
  await log(actor, `opened a decision: “${decision.title}”`, `/decisions/${decision.id}`);
  return decision;
}

export async function updateDecision(actor: Actor, id: string, patch: DecisionInput) {
  const before = await rows<Decision>(
    db().from("wedding_decisions").select("*").eq("id", id).single(),
  );
  const status = patch.status ?? before.status;
  const decision = await rows<Decision>(
    db()
      .from("wedding_decisions")
      .update({
        ...defined(patch),
        decided_on: status === "decided" ? (before.decided_on ?? today()) : null,
        updated_at: now(),
      })
      .eq("id", id)
      .select()
      .single(),
  );
  if (decision.status === "decided" && before.status !== "decided") {
    await log(
      actor,
      decision.outcome
        ? `decided “${decision.title}”: ${decision.outcome}`
        : `decided “${decision.title}”`,
      `/decisions/${id}`,
    );
  } else if (actor.via === "claude") {
    await log(actor, `updated decision “${decision.title}”`, `/decisions/${id}`);
  }
  return decision;
}

export async function deleteDecision(actor: Actor, id: string) {
  const decision = await rows<Decision>(
    db().from("wedding_decisions").delete().eq("id", id).select().single(),
  );
  await log(actor, `removed decision “${decision.title}”`);
  return decision;
}

// ---- vendors --------------------------------------------------------------

export type VendorInput = {
  name?: string;
  service?: string | null;
  category_id?: string | null;
  status?: VendorStatus;
  owner?: Assignee | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  quote_cents?: number | null;
  notes?: string | null;
};

export async function createVendor(actor: Actor, input: VendorInput & { name: string }) {
  const vendor = await rows<Vendor>(
    db().from("wedding_vendors").insert(defined(input)).select().single(),
  );
  await log(actor, `added vendor ${vendor.name}`, `/vendors/${vendor.id}`);
  return vendor;
}

export async function updateVendor(actor: Actor, id: string, patch: VendorInput) {
  const before = await rows<Vendor>(db().from("wedding_vendors").select("*").eq("id", id).single());
  const vendor = await rows<Vendor>(
    db()
      .from("wedding_vendors")
      .update({ ...defined(patch), updated_at: now() })
      .eq("id", id)
      .select()
      .single(),
  );
  if (vendor.status !== before.status) {
    await log(actor, `moved ${vendor.name} to ${vendor.status}`, `/vendors/${id}`);
  } else if (actor.via === "claude") {
    await log(actor, `updated vendor ${vendor.name}`, `/vendors/${id}`);
  }
  return vendor;
}

export async function deleteVendor(actor: Actor, id: string) {
  const vendor = await rows<Vendor>(
    db().from("wedding_vendors").delete().eq("id", id).select().single(),
  );
  await log(actor, `removed vendor ${vendor.name}`);
  return vendor;
}

// ---- payments -------------------------------------------------------------

export type PaymentInput = {
  label?: string;
  amount_cents?: number;
  vendor_id?: string | null;
  category_id?: string | null;
  due_date?: string | null;
  paid_on?: string | null;
};

export async function createPayment(
  actor: Actor,
  input: PaymentInput & { label: string; amount_cents: number },
) {
  let categoryId = input.category_id;
  if (categoryId === undefined && input.vendor_id) {
    const vendor = await rows<Pick<Vendor, "category_id">>(
      db().from("wedding_vendors").select("category_id").eq("id", input.vendor_id).single(),
    );
    categoryId = vendor.category_id;
  }
  const payment = await rows<Payment>(
    db()
      .from("wedding_payments")
      .insert(defined({ ...input, category_id: categoryId }))
      .select()
      .single(),
  );
  await log(
    actor,
    `added a payment: ${payment.label}`,
    payment.vendor_id ? `/vendors/${payment.vendor_id}` : "/budget",
  );
  return payment;
}

export async function updatePayment(actor: Actor, id: string, patch: PaymentInput) {
  const before = await rows<Payment>(db().from("wedding_payments").select("*").eq("id", id).single());
  const payment = await rows<Payment>(
    db().from("wedding_payments").update(defined(patch)).eq("id", id).select().single(),
  );
  if (payment.paid_on && !before.paid_on) {
    await log(actor, `paid ${payment.label}`, "/budget");
  } else if (actor.via === "claude") {
    await log(actor, `updated payment ${payment.label}`, "/budget");
  }
  return payment;
}

export async function deletePayment(actor: Actor, id: string) {
  const payment = await rows<Payment>(
    db().from("wedding_payments").delete().eq("id", id).select().single(),
  );
  if (actor.via === "claude") await log(actor, `removed payment ${payment.label}`, "/budget");
  return payment;
}

// ---- budget categories ----------------------------------------------------

export async function createCategory(actor: Actor, input: { name: string; planned_cents?: number }) {
  const last = await rows<{ sort: number }[]>(
    db().from("wedding_budget_categories").select("sort").order("sort", { ascending: false }).limit(1),
  );
  const category = await rows<BudgetCategory>(
    db()
      .from("wedding_budget_categories")
      .insert({
        name: input.name,
        planned_cents: input.planned_cents ?? 0,
        sort: (last[0]?.sort ?? 0) + 1,
      })
      .select()
      .single(),
  );
  if (actor.via === "claude") await log(actor, `added budget category ${category.name}`, "/budget");
  return category;
}

export async function updateCategory(
  actor: Actor,
  id: string,
  patch: { name?: string; planned_cents?: number },
) {
  const category = await rows<BudgetCategory>(
    db().from("wedding_budget_categories").update(defined(patch)).eq("id", id).select().single(),
  );
  if (actor.via === "claude") await log(actor, `updated budget for ${category.name}`, "/budget");
  return category;
}

export async function deleteCategory(actor: Actor, id: string) {
  const category = await rows<BudgetCategory>(
    db().from("wedding_budget_categories").delete().eq("id", id).select().single(),
  );
  if (actor.via === "claude") await log(actor, `removed budget category ${category.name}`, "/budget");
  return category;
}
