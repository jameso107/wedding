"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/planning/auth";
import type { Assignee } from "@/lib/planning/db";
import * as data from "@/lib/planning/data";
import { SESSION_COOKIE, SESSION_DAYS, isPerson } from "@/lib/planning/session";
import { TASK_STATUSES, type TaskStatus } from "@/lib/planning/stages";

// Actions never call redirect(): Next renders the target inside the action
// request, skipping proxy.ts, so "/" would render the public site. Callers
// navigate on the client instead (ActionForm / ConfirmButton `then`).

// ---- form helpers ---------------------------------------------------------

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function required(form: FormData, key: string): string {
  const value = text(form, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function assignee(form: FormData, key: string): Assignee | null {
  const value = text(form, key);
  return value === "hannah" || value === "james" || value === "both"
    ? value
    : null;
}

function oneOf<T extends string>(
  form: FormData,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = text(form, key);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

async function actor(): Promise<data.Actor> {
  return { person: await requirePerson() };
}

function refresh() {
  revalidatePath("/planning", "layout");
}

// ---- session --------------------------------------------------------------

export async function login(
  _prev: { error?: string } | undefined,
  form: FormData,
): Promise<{ error?: string }> {
  const person = text(form, "person");
  if (!isPerson(person)) return { error: "Pick who you are first." };
  (await cookies()).set(SESSION_COOKIE, person, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return {};
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

// ---- tasks ----------------------------------------------------------------


export async function createTask(form: FormData) {
  await data.createTask(await actor(), {
    title: required(form, "title"),
    assignee: assignee(form, "assignee"),
    start_date: text(form, "start_date"),
    due_date: text(form, "due_date"),
  });
  refresh();
}

export async function updateTask(form: FormData) {
  await data.updateTask(await actor(), required(form, "id"), {
    title: required(form, "title"),
    notes: text(form, "notes"),
    assignee: assignee(form, "assignee"),
    status: oneOf(form, "status", TASK_STATUSES, "todo"),
    start_date: text(form, "start_date"),
    due_date: text(form, "due_date"),
  });
  refresh();
}

export async function toggleTask(form: FormData) {
  await data.updateTask(await actor(), required(form, "id"), {
    status: text(form, "done") === "true" ? "done" : "todo",
  });
  refresh();
}

// Kanban drag: move a task to another stage. Dropping an unassigned task
// into "Assigned" gives it to whoever moved it.
export async function moveTask(id: string, status: TaskStatus, claim = false) {
  const me = await actor();
  await data.updateTask(me, id, { status, ...(claim ? { assignee: me.person } : {}) });
  refresh();
}

export async function deleteTask(form: FormData) {
  await data.deleteTask(await actor(), required(form, "id"));
  refresh();
}
