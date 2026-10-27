import Image from "next/image";
import Link from "next/link";
import bayPointe from "@/public/images/bay-pointe.jpg";
import { requirePerson } from "@/lib/planning/auth";
import {
  db,
  rows,
  type Activity,
  type BudgetCategory,
  type Decision,
  type Payment,
  type Task,
  type Vendor,
} from "@/lib/planning/db";
import { budgetTotals } from "@/lib/planning/budget";
import {
  WEDDING_DAY,
  daysBetween,
  money,
  personName,
  timeAgo,
  today,
} from "@/lib/planning/format";
import { TaskCheck } from "../client";
import { Avatar, DueTag, PersonTag, StatusTag } from "../ui";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const me = await requirePerson();
  const now = today();

  const [tasks, decisions, allPayments, categories, vendors, activity] = await Promise.all([
    rows<Task[]>(db().from("wedding_tasks").select("*").order("due_date", { nullsFirst: false })),
    rows<Decision[]>(
      db()
        .from("wedding_decisions")
        .select("*")
        .neq("status", "decided")
        .order("decide_by", { nullsFirst: false }),
    ),
    rows<(Payment & { vendor: { name: string } | null })[]>(
      db()
        .from("wedding_payments")
        .select("*, vendor:wedding_vendors(name)")
        .order("due_date", { nullsFirst: false }),
    ),
    rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*")),
    rows<Vendor[]>(db().from("wedding_vendors").select("id, status, quote_cents, category_id")),
    rows<Activity[]>(
      db().from("wedding_activity").select("*").order("created_at", { ascending: false }).limit(8),
    ),
  ]);

  const payments = allPayments.filter((p) => !p.paid_on);
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.length - open.length;
  const late = open.filter((t) => t.due_date && t.due_date < now);
  const attention = open.filter((t) => t.due_date).slice(0, 6);
  const mine = open
    .filter((t) => t.assignee === me || t.assignee === "both")
    .filter((t) => !attention.includes(t))
    .slice(0, 6);
  const unassigned = open.filter((t) => !t.assignee).length;

  const { planned, committed, paid } = budgetTotals(categories, vendors, allPayments);

  const days = daysBetween(now, WEDDING_DAY);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const greeting = personName(me);

  return (
    <div className="pl-page">
      <section className="pl-hero">
        <Image
          src={bayPointe}
          alt="Watercolor of Bay Pointe Inn on Gun Lake"
          fill
          preload
          placeholder="blur"
          sizes="(max-width: 820px) 100vw, 1080px"
          className="pl-hero-img"
        />
        <div className="pl-hero-row">
          <div>
            <p className="pl-kicker">Bay Pointe Inn · Gun Lake</p>
            <h1>
              Good to see you, <em>{greeting}</em>.
            </h1>
          </div>
          <p className="pl-hero-count">
            <strong>{days}</strong>
            days until July 4
          </p>
        </div>
      </section>

      <div className="pl-stats">
        <Link href="/tasks" className="pl-stat">
          <span className="pl-stat-label">Tasks done</span>
          <span className="pl-stat-value">
            {done} <small>of {tasks.length}</small>
          </span>
          <div className="pl-progress" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
        </Link>
        <Link href="/tasks?show=late" className={`pl-stat ${late.length ? "pl-stat-late" : ""}`}>
          <span className="pl-stat-label">Overdue</span>
          <span className="pl-stat-value">{late.length}</span>
        </Link>
        <Link href="/decisions" className="pl-stat">
          <span className="pl-stat-label">Open decisions</span>
          <span className="pl-stat-value">{decisions.length}</span>
        </Link>
        <Link href="/budget" className="pl-stat">
          <span className="pl-stat-label">Committed</span>
          <span className="pl-stat-value">
            {money(committed)}
            {planned ? <small> / {money(planned)}</small> : null}
          </span>
          {planned ? (
            <div className={`pl-progress ${committed > planned ? "is-over" : ""}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (committed / planned) * 100)}%` }} />
            </div>
          ) : null}
        </Link>
      </div>

      <div className="pl-grid pl-grid-2">
        <section className="pl-card">
          <div className="pl-section-head">
            <h2 className="pl-h2">Up next</h2>
            <Link href="/tasks">All tasks</Link>
          </div>
          {attention.length ? (
            <ul className="pl-list">
              {attention.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          ) : (
            <p className="pl-empty">Nothing with a date on it. Enjoy the quiet.</p>
          )}
        </section>

        <section className="pl-card">
          <div className="pl-section-head">
            <h2 className="pl-h2">On your plate</h2>
            <Link href="/tasks?who=me">Yours</Link>
          </div>
          {mine.length ? (
            <ul className="pl-list">
              {mine.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          ) : (
            <p className="pl-empty">
              Nothing assigned to you yet.
              {unassigned ? (
                <>
                  {" "}
                  <Link href="/tasks?who=none" className="pl-link">
                    {unassigned} unassigned
                  </Link>
                </>
              ) : null}
            </p>
          )}
        </section>

        <section className="pl-card">
          <div className="pl-section-head">
            <h2 className="pl-h2">Decisions waiting</h2>
            <Link href="/decisions">All decisions</Link>
          </div>
          {decisions.length ? (
            <ul className="pl-list">
              {decisions.slice(0, 5).map((d) => (
                <li key={d.id} className="pl-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <Link href={`/decisions/${d.id}`} className="pl-row-main">
                    <span className="pl-row-title">{d.title}</span>
                    <span className="pl-row-sub">{personName(d.owner)}</span>
                  </Link>
                  <span className="pl-row-meta">
                    {d.status === "leaning" ? <StatusTag status="leaning" /> : null}
                    <DueTag date={d.decide_by} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-empty">Every open question has an answer.</p>
          )}
        </section>

        <section className="pl-card">
          <div className="pl-section-head">
            <h2 className="pl-h2">Money going out</h2>
            <Link href="/budget">Budget</Link>
          </div>
          {payments.length ? (
            <ul className="pl-list">
              {payments.slice(0, 5).map((p) => (
                <li key={p.id} className="pl-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span className="pl-row-main">
                    <span className="pl-row-title">{p.label}</span>
                    <span className="pl-row-sub">
                      {money(p.amount_cents, true)}
                      {p.vendor ? ` · ${p.vendor.name}` : ""}
                    </span>
                  </span>
                  <span className="pl-row-meta">
                    {p.due_date ? <DueTag date={p.due_date} /> : <span className="pl-small">No date</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-empty">
              No payments scheduled. Add deposits from a vendor’s page. {paid ? `${money(paid)} paid so far.` : ""}
            </p>
          )}
        </section>
      </div>

      <section className="pl-card" style={{ marginTop: 20 }}>
        <div className="pl-section-head">
          <h2 className="pl-h2">Lately</h2>
        </div>
        <ul className="pl-list pl-activity">
          {activity.map((a) => (
            <li key={a.id}>
              <Avatar who={a.actor} />
              <span>
                <strong style={{ fontWeight: 500 }}>
                  {a.actor === "system" ? "" : personName(a.actor)}
                </strong>{" "}
                {a.href ? <Link href={a.href}>{a.summary}</Link> : a.summary}{" "}
                <span className="pl-small">· {timeAgo(a.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li className="pl-row">
      <TaskCheck id={task.id} done={task.status === "done"} title={task.title} />
      <Link href={`/tasks/${task.id}`} className="pl-row-main">
        <span className="pl-row-title">{task.title}</span>
      </Link>
      <span className="pl-row-meta">
        <PersonTag who={task.assignee} />
        <DueTag date={task.due_date} />
      </span>
    </li>
  );
}
