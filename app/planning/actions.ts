"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Assignee } from "@/lib/planning/db";
import { personName, today } from "@/lib/planning/format";
import { SESSION_COOKIE, SESSION_DAYS, isPerson, type Person } from "@/lib/planning/session";

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

async function log(actor: Person, summary: string, href?: string) {
  await db().from("wedding_activity").insert({ actor, summary, href });
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
  const me = await requirePerson();
  const title = required(form, "title");
  const task = await rows<{ id: string }>(
    db()
      .from("wedding_tasks")
      .insert({
        title,
        assignee: assignee(form, "assignee"),
        due_date: text(form, "due_date"),
        vendor_id: text(form, "vendor_id"),
        decision_id: text(form, "decision_id"),
        created_by: me,
      })
      .select("id")
      .single(),
  );
  const who = assignee(form, "assignee");
  await log(
    me,
    who && who !== me
      ? `added “${title}” for ${personName(who)}`
      : `added “${title}”`,
    `/tasks/${task.id}`,
  );
  refresh();
}

export async function updateTask(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const status = oneOf(form, "status", TASK_STATUSES, "todo");
  const before = await rows<{ status: string; assignee: string | null }>(
    db().from("wedding_tasks").select("status, assignee").eq("id", id).single(),
  );
  const title = required(form, "title");
  const next = assignee(form, "assignee");
  await rows(
    db()
      .from("wedding_tasks")
      .update({
        title,
        notes: text(form, "notes"),
        assignee: next,
        status,
        due_date: text(form, "due_date"),
        vendor_id: text(form, "vendor_id"),
        decision_id: text(form, "decision_id"),
        completed_at:
          status === "done"
            ? before.status === "done"
              ? undefined
              : new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
  if (status === "done" && before.status !== "done") {
    await log(me, `finished “${title}”`, `/tasks/${id}`);
  } else if (next && next !== before.assignee && next !== me) {
    await log(me, `handed “${title}” to ${personName(next)}`, `/tasks/${id}`);
  }
  refresh();
}

export async function toggleTask(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const done = text(form, "done") === "true";
  const task = await rows<{ title: string }>(
    db()
      .from("wedding_tasks")
      .update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("title")
      .single(),
  );
  if (done) await log(me, `finished “${task.title}”`, `/tasks/${id}`);
  refresh();
}

export async function deleteTask(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const task = await rows<{ title: string }>(
    db().from("wedding_tasks").delete().eq("id", id).select("title").single(),
  );
  await log(me, `removed task “${task.title}”`);
  refresh();
}

// ---- decisions ------------------------------------------------------------

const DECISION_STATUSES = ["open", "leaning", "decided"] as const;

export async function createDecision(form: FormData) {
  const me = await requirePerson();
  const title = required(form, "title");
  const decision = await rows<{ id: string }>(
    db()
      .from("wedding_decisions")
      .insert({
        title,
        owner: assignee(form, "owner"),
        decide_by: text(form, "decide_by"),
      })
      .select("id")
      .single(),
  );
  await log(me, `opened a decision: “${title}”`, `/decisions/${decision.id}`);
  refresh();
  return decision.id;
}

export async function updateDecision(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const title = required(form, "title");
  const status = oneOf(form, "status", DECISION_STATUSES, "open");
  const before = await rows<{ status: string; decided_on: string | null }>(
    db()
      .from("wedding_decisions")
      .select("status, decided_on")
      .eq("id", id)
      .single(),
  );
  await rows(
    db()
      .from("wedding_decisions")
      .update({
        title,
        context: text(form, "context"),
        options: text(form, "options"),
        status,
        outcome: text(form, "outcome"),
        rationale: text(form, "rationale"),
        owner: assignee(form, "owner"),
        decide_by: text(form, "decide_by"),
        decided_on:
          status === "decided" ? (before.decided_on ?? today()) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
  if (status === "decided" && before.status !== "decided") {
    const outcome = text(form, "outcome");
    await log(
      me,
      outcome ? `decided “${title}”: ${outcome}` : `decided “${title}”`,
      `/decisions/${id}`,
    );
  }
  refresh();
}

export async function deleteDecision(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const decision = await rows<{ title: string }>(
    db()
      .from("wedding_decisions")
      .delete()
      .eq("id", id)
      .select("title")
      .single(),
  );
  await log(me, `removed decision “${decision.title}”`);
  refresh();
}

// ---- vendors --------------------------------------------------------------

const VENDOR_STATUSES = [
  "researching",
  "contacted",
  "quoted",
  "booked",
  "passed",
] as const;

export async function createVendor(form: FormData) {
  const me = await requirePerson();
  const name = required(form, "name");
  const vendor = await rows<{ id: string }>(
    db()
      .from("wedding_vendors")
      .insert({
        name,
        service: text(form, "service"),
        category_id: text(form, "category_id"),
      })
      .select("id")
      .single(),
  );
  await log(me, `added vendor ${name}`, `/vendors/${vendor.id}`);
  refresh();
  return vendor.id;
}

export async function updateVendor(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const name = required(form, "name");
  const status = oneOf(form, "status", VENDOR_STATUSES, "researching");
  const before = await rows<{ status: string }>(
    db().from("wedding_vendors").select("status").eq("id", id).single(),
  );
  await rows(
    db()
      .from("wedding_vendors")
      .update({
        name,
        service: text(form, "service"),
        category_id: text(form, "category_id"),
        status,
        owner: assignee(form, "owner"),
        contact_name: text(form, "contact_name"),
        email: text(form, "email"),
        phone: text(form, "phone"),
        website: text(form, "website"),
        quote_cents: cents(form, "quote"),
        notes: text(form, "notes"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
  if (status !== before.status) {
    await log(me, `moved ${name} to ${status}`, `/vendors/${id}`);
  }
  refresh();
}

export async function deleteVendor(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const vendor = await rows<{ name: string }>(
    db().from("wedding_vendors").delete().eq("id", id).select("name").single(),
  );
  await log(me, `removed vendor ${vendor.name}`);
  refresh();
}

// ---- budget & payments ----------------------------------------------------

export async function createPayment(form: FormData) {
  const me = await requirePerson();
  const label = required(form, "label");
  const amount = cents(form, "amount");
  if (amount === null) throw new Error("amount is required");
  const vendorId = text(form, "vendor_id");
  await rows(
    db()
      .from("wedding_payments")
      .insert({
        label,
        amount_cents: amount,
        vendor_id: vendorId,
        category_id: text(form, "category_id"),
        due_date: text(form, "due_date"),
        paid_on: text(form, "paid") ? today() : null,
      }),
  );
  await log(
    me,
    `added a payment: ${label}`,
    vendorId ? `/vendors/${vendorId}` : "/budget",
  );
  refresh();
}

export async function togglePayment(form: FormData) {
  const me = await requirePerson();
  const id = required(form, "id");
  const paid = text(form, "paid") === "true";
  const payment = await rows<{ label: string }>(
    db()
      .from("wedding_payments")
      .update({ paid_on: paid ? today() : null })
      .eq("id", id)
      .select("label")
      .single(),
  );
  if (paid) await log(me, `paid ${payment.label}`, "/budget");
  refresh();
}

export async function deletePayment(form: FormData) {
  await requirePerson();
  await rows(
    db().from("wedding_payments").delete().eq("id", required(form, "id")),
  );
  refresh();
}

export async function createCategory(form: FormData) {
  await requirePerson();
  const existing = await rows<{ sort: number }[]>(
    db()
      .from("wedding_budget_categories")
      .select("sort")
      .order("sort", { ascending: false })
      .limit(1),
  );
  await rows(
    db()
      .from("wedding_budget_categories")
      .insert({
        name: required(form, "name"),
        planned_cents: cents(form, "planned") ?? 0,
        sort: (existing[0]?.sort ?? 0) + 1,
      }),
  );
  refresh();
}

export async function updateCategory(form: FormData) {
  await requirePerson();
  await rows(
    db()
      .from("wedding_budget_categories")
      .update({
        name: required(form, "name"),
        planned_cents: cents(form, "planned") ?? 0,
      })
      .eq("id", required(form, "id")),
  );
  refresh();
}

export async function deleteCategory(form: FormData) {
  await requirePerson();
  await rows(
    db()
      .from("wedding_budget_categories")
      .delete()
      .eq("id", required(form, "id")),
  );
  refresh();
}
