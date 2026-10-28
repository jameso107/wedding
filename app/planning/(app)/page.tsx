import Image from "next/image";
import Link from "next/link";
import bayPointe from "@/public/images/bay-pointe.jpg";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Activity, type Task } from "@/lib/planning/db";
import { WEDDING_DAY, daysBetween, personName, timeAgo, today } from "@/lib/planning/format";
import { TaskCheck } from "../client";
import { Avatar, DueTag, PersonTag } from "../ui";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const me = await requirePerson();
  const now = today();

  const [tasks, activity] = await Promise.all([
    rows<Task[]>(db().from("wedding_tasks").select("*").order("due_date", { nullsFirst: false })),
    rows<Activity[]>(
      db().from("wedding_activity").select("*").order("created_at", { ascending: false }).limit(8),
    ),
  ]);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.length - open.length;
  const late = open.filter((t) => t.due_date && t.due_date < now);
  const inFlight = open.filter((t) => t.status === "doing" || t.status === "waiting").length;
  const unassigned = open.filter((t) => !t.assignee).length;
  const attention = open.filter((t) => t.due_date).slice(0, 6);
  const mine = open
    .filter((t) => t.assignee === me || t.assignee === "both")
    .filter((t) => !attention.includes(t))
    .slice(0, 6);

  const days = daysBetween(now, WEDDING_DAY);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

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
              Good to see you, <em>{personName(me)}</em>.
            </h1>
          </div>
          <p className="pl-hero-count">
            <strong>{days}</strong>
            days until July 4
          </p>
        </div>
      </section>

      <div className="pl-stats">
        <Link href="/tasks?show=done" className="pl-stat">
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
        <Link href="/board" className="pl-stat">
          <span className="pl-stat-label">In flight</span>
          <span className="pl-stat-value">{inFlight}</span>
        </Link>
        <Link href="/tasks?who=none" className="pl-stat">
          <span className="pl-stat-label">Unassigned</span>
          <span className="pl-stat-value">{unassigned}</span>
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
              Nothing else assigned to you.
              {unassigned ? (
                <>
                  {" "}
                  <Link href="/board" className="pl-link">
                    Pick something up from the backlog
                  </Link>
                </>
              ) : null}
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
                {a.href?.startsWith("/tasks/") ? <Link href={a.href}>{a.summary}</Link> : a.summary}{" "}
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
