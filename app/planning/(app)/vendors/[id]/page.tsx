import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type BudgetCategory, type Payment, type Task, type Vendor } from "@/lib/planning/db";
import { money } from "@/lib/planning/format";
import {
  createPayment,
  createTask,
  deletePayment,
  deleteVendor,
  togglePayment,
  updateVendor,
} from "../../../actions";
import { ConfirmButton, SubmitButton, TaskCheck } from "../../../client";
import { AssigneeSelect, BackLink, CategorySelect, DueTag, Field, PersonTag, StatusTag } from "../../../ui";

export const metadata = { title: "Vendor" };

export default async function VendorPage({ params }: PageProps<"/planning/vendors/[id]">) {
  await requirePerson();
  const { id } = await params;
  const { data: v } = await db().from("wedding_vendors").select("*").eq("id", id).maybeSingle<Vendor>();
  if (!v) notFound();

  const [categories, payments, tasks] = await Promise.all([
    rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*").order("sort")),
    rows<Payment[]>(db().from("wedding_payments").select("*").eq("vendor_id", id).order("due_date", { nullsFirst: false })),
    rows<Task[]>(db().from("wedding_tasks").select("*").eq("vendor_id", id).order("due_date", { nullsFirst: false })),
  ]);
  const total = payments.reduce((s, p) => s + Number(p.amount_cents), 0);
  const paid = payments.filter((p) => p.paid_on).reduce((s, p) => s + Number(p.amount_cents), 0);

  return (
    <div className="pl-page">
      <BackLink href="/vendors">All vendors</BackLink>
      <div className="pl-detail">
        <form action={updateVendor} className="pl-card pl-form">
          <input type="hidden" name="id" value={v.id} />
          <div className="pl-form-row">
            <Field label="Name">
              <input className="pl-input" name="name" defaultValue={v.name} required style={{ fontSize: 20 }} />
            </Field>
            <Field label="Service">
              <input className="pl-input" name="service" defaultValue={v.service ?? ""} />
            </Field>
          </div>
          <div className="pl-form-row">
            <Field label="Stage">
              <select className="pl-select" name="status" defaultValue={v.status}>
                <option value="researching">Researching</option>
                <option value="contacted">Reached out</option>
                <option value="quoted">Have a quote</option>
                <option value="booked">Booked</option>
                <option value="passed">Passed</option>
              </select>
            </Field>
            <Field label="Point person">
              <AssigneeSelect name="owner" value={v.owner} />
            </Field>
            <Field label="Budget category">
              <CategorySelect categories={categories} value={v.category_id} />
            </Field>
            <Field label="Quote ($)">
              <input
                className="pl-input"
                name="quote"
                inputMode="decimal"
                defaultValue={v.quote_cents != null ? (v.quote_cents / 100).toString() : ""}
              />
            </Field>
          </div>
          <div className="pl-form-row">
            <Field label="Contact">
              <input className="pl-input" name="contact_name" defaultValue={v.contact_name ?? ""} />
            </Field>
            <Field label="Email">
              <input className="pl-input" type="email" name="email" defaultValue={v.email ?? ""} />
            </Field>
            <Field label="Phone">
              <input className="pl-input" type="tel" name="phone" defaultValue={v.phone ?? ""} />
            </Field>
          </div>
          <Field label="Website">
            <input className="pl-input" type="url" name="website" defaultValue={v.website ?? ""} />
          </Field>
          <Field label="Notes">
            <textarea className="pl-textarea" name="notes" defaultValue={v.notes ?? ""} />
          </Field>
          <div className="pl-actions">
            <ConfirmButton action={deleteVendor} then="/vendors" message={`Delete ${v.name} and its payments?`}>
              Delete vendor
            </ConfirmButton>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
        </form>

        <div className="pl-stack" style={{ gap: 20 }}>
          <aside className="pl-card">
            <div className="pl-decision-top" style={{ marginBottom: 12 }}>
              <StatusTag status={v.status} />
              {v.website ? (
                <a href={v.website} target="_blank" rel="noreferrer" className="pl-link">
                  Website ↗
                </a>
              ) : null}
            </div>
            <div className="pl-section-head">
              <h2 className="pl-h2" style={{ fontSize: 20 }}>
                Payments
              </h2>
              <span className="pl-small">
                {money(paid)} of {money(total)} paid
              </span>
            </div>
            {payments.length ? (
              <ul className="pl-list">
                {payments.map((p) => (
                  <li key={p.id} className={`pl-row ${p.paid_on ? "is-done" : ""}`}>
                    <form action={togglePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paid" value={String(!p.paid_on)} />
                      <button
                        type="submit"
                        className="pl-check"
                        role="checkbox"
                        aria-checked={!!p.paid_on}
                        aria-label={p.paid_on ? `Mark ${p.label} unpaid` : `Mark ${p.label} paid`}
                      >
                        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6.2l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="14" />
                        </svg>
                      </button>
                    </form>
                    <span className="pl-row-main">
                      <span className="pl-row-title">{p.label}</span>
                      <span className="pl-row-sub">{money(p.amount_cents, true)}</span>
                    </span>
                    <span className="pl-row-meta">
                      {p.paid_on ? <span className="pl-small">Paid</span> : <DueTag date={p.due_date} />}
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="pl-icon-btn" aria-label={`Remove ${p.label}`}>
                          ✕
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pl-empty" style={{ paddingTop: 0 }}>
                No deposits or payments yet.
              </p>
            )}
            <form action={createPayment} className="pl-form" style={{ gap: 8, marginTop: 14 }}>
              <input type="hidden" name="vendor_id" value={v.id} />
              <input type="hidden" name="category_id" value={v.category_id ?? ""} />
              <input className="pl-input" name="label" placeholder="e.g. Deposit" aria-label="Payment" required />
              <div className="pl-form-row" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="pl-input" name="amount" placeholder="Amount ($)" inputMode="decimal" aria-label="Amount" required />
                <input className="pl-input" type="date" name="due_date" aria-label="Due date" />
              </div>
              <label className="pl-small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="paid" value="1" /> Already paid
              </label>
              <SubmitButton className="pl-btn pl-btn-quiet" pendingLabel="Adding…">
                Add payment
              </SubmitButton>
            </form>
          </aside>

          <aside className="pl-card">
            <div className="pl-section-head">
              <h2 className="pl-h2" style={{ fontSize: 20 }}>
                Tasks
              </h2>
            </div>
            {tasks.length ? (
              <ul className="pl-list">
                {tasks.map((t) => (
                  <li key={t.id} className={`pl-row ${t.status === "done" ? "is-done" : ""}`}>
                    <TaskCheck id={t.id} done={t.status === "done"} title={t.title} />
                    <Link href={`/tasks/${t.id}`} className="pl-row-main">
                      <span className="pl-row-title">{t.title}</span>
                    </Link>
                    <span className="pl-row-meta">
                      <PersonTag who={t.assignee} />
                      <DueTag date={t.due_date} done={t.status === "done"} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={createTask} className="pl-form" style={{ gap: 8, marginTop: tasks.length ? 14 : 0 }}>
              <input type="hidden" name="vendor_id" value={v.id} />
              <input className="pl-input" name="title" placeholder={`e.g. Send ${v.name} our timeline`} aria-label="New task" required />
              <div className="pl-form-row" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <AssigneeSelect name="assignee" />
                <input className="pl-input" type="date" name="due_date" aria-label="Due date" />
              </div>
              <SubmitButton className="pl-btn pl-btn-quiet" pendingLabel="Adding…">
                Add task
              </SubmitButton>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
