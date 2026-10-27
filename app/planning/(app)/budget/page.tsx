import Link from "next/link";
import { requirePerson } from "@/lib/planning/auth";
import { budgetTotals } from "@/lib/planning/budget";
import { db, rows, type BudgetCategory, type Payment, type Vendor } from "@/lib/planning/db";
import { money } from "@/lib/planning/format";
import {
  createCategory,
  createPayment,
  deleteCategory,
  deletePayment,
  togglePayment,
  updateCategory,
} from "../../actions";
import { ConfirmButton, SubmitButton } from "../../client";
import { CategorySelect, DueTag, PageHead } from "../../ui";

export const metadata = { title: "Budget" };

export default async function BudgetPage() {
  await requirePerson();
  const [categories, vendors, payments] = await Promise.all([
    rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*").order("sort")),
    rows<Vendor[]>(db().from("wedding_vendors").select("*")),
    rows<Payment[]>(db().from("wedding_payments").select("*").order("due_date", { nullsFirst: false })),
  ]);
  const totals = budgetTotals(categories, vendors, payments);
  const left = totals.planned - totals.committed;
  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name;

  return (
    <div className="pl-page">
      <PageHead
        kicker="Budget"
        title={
          totals.planned ? (
            <>
              {money(totals.committed)} committed, <em>{money(Math.abs(left))} {left >= 0 ? "left" : "over"}</em>
            </>
          ) : (
            <>
              Set the plan, <em>then track it</em>
            </>
          )
        }
        lede="Type a planned amount into each category. Committed counts booked vendors’ quotes (or what you’ve scheduled with them, if more) plus other payments."
      />

      <div className="pl-stats pl-stats-3">
        <div className="pl-stat">
          <span className="pl-stat-label">Planned</span>
          <span className="pl-stat-value">{money(totals.planned)}</span>
        </div>
        <div className={`pl-stat ${left < 0 ? "pl-stat-late" : ""}`}>
          <span className="pl-stat-label">Committed</span>
          <span className="pl-stat-value">{money(totals.committed)}</span>
          {totals.planned ? (
            <div className={`pl-progress ${left < 0 ? "is-over" : ""}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (totals.committed / totals.planned) * 100)}%` }} />
            </div>
          ) : null}
        </div>
        <div className="pl-stat">
          <span className="pl-stat-label">Paid</span>
          <span className="pl-stat-value">{money(totals.paid)}</span>
        </div>
      </div>

      <section className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Planned</th>
                <th>Committed</th>
                <th>Paid</th>
                <th>Left</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {totals.rows.map((r) => {
                const rowLeft = r.planned - r.committed;
                const formId = r.category ? `cat-${r.category.id}` : undefined;
                return (
                  <tr key={r.category?.id ?? "none"}>
                    <td>
                      {r.category ? (
                        <form id={formId} action={updateCategory} className="pl-inline-form">
                          <input type="hidden" name="id" value={r.category.id} />
                          <input
                            className="pl-input"
                            name="name"
                            defaultValue={r.category.name}
                            aria-label="Category name"
                            style={{ minWidth: 180, border: "1px solid transparent", background: "transparent" }}
                            required
                          />
                        </form>
                      ) : (
                        <span className="pl-muted" style={{ fontStyle: "italic" }}>
                          Uncategorized
                        </span>
                      )}
                    </td>
                    <td>
                      {r.category ? (
                        <input
                          form={formId}
                          className="pl-input pl-money-input"
                          name="planned"
                          inputMode="decimal"
                          defaultValue={r.planned ? String(r.planned / 100) : ""}
                          placeholder="$0"
                          aria-label={`Planned for ${r.category.name}`}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{r.committed ? money(r.committed) : <span className="pl-muted">—</span>}</td>
                    <td>{r.paid ? money(r.paid) : <span className="pl-muted">—</span>}</td>
                    <td className={rowLeft < 0 ? "is-over" : ""}>{r.planned || r.committed ? money(rowLeft) : ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.category ? (
                        <span className="pl-inline-form" style={{ justifyContent: "flex-end" }}>
                          <button type="submit" form={formId} className="pl-icon-btn" style={{ color: "var(--lake)" }}>
                            Save
                          </button>
                          <form action={deleteCategory}>
                            <input type="hidden" name="id" value={r.category.id} />
                            <ConfirmButton
                              action={deleteCategory}
                              message={`Remove the “${r.category.name}” category? Vendors and payments stay, uncategorized.`}
                              className="pl-icon-btn"
                            >
                              ✕
                            </ConfirmButton>
                          </form>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{money(totals.planned)}</td>
                <td>{money(totals.committed)}</td>
                <td>{money(totals.paid)}</td>
                <td className={left < 0 ? "is-over" : ""}>{money(left)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <form action={createCategory} className="pl-inline-form" style={{ marginTop: 16, flexWrap: "wrap" }}>
          <input className="pl-input" name="name" placeholder="New category" aria-label="New category" required style={{ maxWidth: 260 }} />
          <input className="pl-input pl-money-input" name="planned" placeholder="Planned $" inputMode="decimal" aria-label="Planned amount" />
          <SubmitButton className="pl-btn pl-btn-quiet">Add category</SubmitButton>
        </form>
      </section>

      <section className="pl-card">
        <div className="pl-section-head">
          <h2 className="pl-h2">Payment schedule</h2>
          <span className="pl-small">Deposits and balances, by due date</span>
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
                  <span className="pl-row-title">
                    {p.label}
                    {p.vendor_id ? (
                      <>
                        {" · "}
                        <Link href={`/vendors/${p.vendor_id}`} className="pl-muted">
                          {vendorName(p.vendor_id)}
                        </Link>
                      </>
                    ) : null}
                  </span>
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
            Nothing scheduled. Vendor deposits added on a vendor’s page show up here too.
          </p>
        )}
        <form action={createPayment} className="pl-quick pl-quick-5" style={{ marginTop: 16, marginBottom: 0 }}>
          <input className="pl-input" name="label" placeholder="Other expense, e.g. Marriage license" aria-label="Payment" required />
          <input className="pl-input" name="amount" placeholder="$" inputMode="decimal" aria-label="Amount" required />
          <CategorySelect categories={categories} />
          <input className="pl-input" type="date" name="due_date" aria-label="Due date" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
      </section>
    </div>
  );
}
