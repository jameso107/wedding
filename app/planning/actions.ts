"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/planning/auth";
import type { Assignee } from "@/lib/planning/db";
import * as data from "@/lib/planning/data";
import { today } from "@/lib/planning/format";
import { SESSION_COOKIE, SESSION_DAYS, isPerson } from "@/lib/planning/session";

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

function cents(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (value === null) return null;
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
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

const TASK_STATUSES = ["todo", "doing", "done"] as const;

export async function createTask(form: FormData) {
  await data.createTask(await actor(), {
    title: required(form, "title"),
    assignee: assignee(form, "assignee"),
    start_date: text(form, "start_date"),
    due_date: text(form, "due_date"),
    vendor_id: text(form, "vendor_id"),
    decision_id: text(form, "decision_id"),
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
    vendor_id: text(form, "vendor_id"),
    decision_id: text(form, "decision_id"),
  });
  refresh();
}

export async function toggleTask(form: FormData) {
  await data.updateTask(await actor(), required(form, "id"), {
    status: text(form, "done") === "true" ? "done" : "todo",
  });
  refresh();
}

export async function deleteTask(form: FormData) {
  await data.deleteTask(await actor(), required(form, "id"));
  refresh();
}

// ---- decisions ------------------------------------------------------------

const DECISION_STATUSES = ["open", "leaning", "decided"] as const;

export async function createDecision(form: FormData) {
  const decision = await data.createDecision(await actor(), {
    title: required(form, "title"),
    owner: assignee(form, "owner"),
    decide_by: text(form, "decide_by"),
  });
  refresh();
  return decision.id;
}

export async function updateDecision(form: FormData) {
  await data.updateDecision(await actor(), required(form, "id"), {
    title: required(form, "title"),
    context: text(form, "context"),
    options: text(form, "options"),
    status: oneOf(form, "status", DECISION_STATUSES, "open"),
    outcome: text(form, "outcome"),
    rationale: text(form, "rationale"),
    owner: assignee(form, "owner"),
    decide_by: text(form, "decide_by"),
  });
  refresh();
}

export async function deleteDecision(form: FormData) {
  await data.deleteDecision(await actor(), required(form, "id"));
  refresh();
}

// ---- vendors --------------------------------------------------------------

const VENDOR_STATUSES = ["researching", "contacted", "quoted", "booked", "passed"] as const;

export async function createVendor(form: FormData) {
  const vendor = await data.createVendor(await actor(), {
    name: required(form, "name"),
    service: text(form, "service"),
    category_id: text(form, "category_id"),
  });
  refresh();
  return vendor.id;
}

export async function updateVendor(form: FormData) {
  await data.updateVendor(await actor(), required(form, "id"), {
    name: required(form, "name"),
    service: text(form, "service"),
    category_id: text(form, "category_id"),
    status: oneOf(form, "status", VENDOR_STATUSES, "researching"),
    owner: assignee(form, "owner"),
    contact_name: text(form, "contact_name"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    website: text(form, "website"),
    quote_cents: cents(form, "quote"),
    notes: text(form, "notes"),
  });
  refresh();
}

export async function deleteVendor(form: FormData) {
  await data.deleteVendor(await actor(), required(form, "id"));
  refresh();
}

// ---- budget & payments ----------------------------------------------------

export async function createPayment(form: FormData) {
  const amount = cents(form, "amount");
  if (amount === null) throw new Error("amount is required");
  await data.createPayment(await actor(), {
    label: required(form, "label"),
    amount_cents: amount,
    vendor_id: text(form, "vendor_id"),
    category_id: text(form, "category_id"),
    due_date: text(form, "due_date"),
    paid_on: text(form, "paid") ? today() : null,
  });
  refresh();
}

export async function togglePayment(form: FormData) {
  await data.updatePayment(await actor(), required(form, "id"), {
    paid_on: text(form, "paid") === "true" ? today() : null,
  });
  refresh();
}

export async function deletePayment(form: FormData) {
  await data.deletePayment(await actor(), required(form, "id"));
  refresh();
}

export async function createCategory(form: FormData) {
  await data.createCategory(await actor(), {
    name: required(form, "name"),
    planned_cents: cents(form, "planned") ?? 0,
  });
  refresh();
}

export async function updateCategory(form: FormData) {
  await data.updateCategory(await actor(), required(form, "id"), {
    name: required(form, "name"),
    planned_cents: cents(form, "planned") ?? 0,
  });
  refresh();
}

export async function deleteCategory(form: FormData) {
  await data.deleteCategory(await actor(), required(form, "id"));
  refresh();
}
