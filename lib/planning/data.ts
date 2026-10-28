import "server-only";
import { db, rows, type Assignee, type Task, type TaskStatus } from "./db";
import { personName } from "./format";
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
