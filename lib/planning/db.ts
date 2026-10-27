import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Assignee = "hannah" | "james" | "both";
export type TaskStatus = "todo" | "doing" | "done";
export type VendorStatus =
  | "researching"
  | "contacted"
  | "quoted"
  | "booked"
  | "passed";
export type DecisionStatus = "open" | "leaning" | "decided";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  assignee: Assignee | null;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  vendor_id: string | null;
  decision_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Decision = {
  id: string;
  title: string;
  context: string | null;
  options: string | null;
  status: DecisionStatus;
  outcome: string | null;
  rationale: string | null;
  owner: Assignee | null;
  decide_by: string | null;
  decided_on: string | null;
  updated_at: string;
};

export type Vendor = {
  id: string;
  name: string;
  service: string | null;
  category_id: string | null;
  status: VendorStatus;
  owner: Assignee | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  quote_cents: number | null;
  notes: string | null;
};

export type BudgetCategory = {
  id: string;
  name: string;
  planned_cents: number;
  sort: number;
};

export type Payment = {
  id: string;
  label: string;
  vendor_id: string | null;
  category_id: string | null;
  amount_cents: number;
  due_date: string | null;
  paid_on: string | null;
};

export type Activity = {
  id: number;
  actor: string;
  summary: string;
  href: string | null;
  created_at: string;
};

let client: SupabaseClient | undefined;

// Server-side client. The wedding_* tables allow the publishable key (see
// supabase/migrations); a secret key also works if one is configured.
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Unwrap a Supabase response, surfacing errors instead of rendering empty.
export async function rows<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}
