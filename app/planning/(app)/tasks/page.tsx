import Link from "next/link";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Task } from "@/lib/planning/db";
import { monthLabel, personName, today } from "@/lib/planning/format";
import { createTask } from "../../actions";
import { SubmitButton, TaskCheck } from "../../client";
import { AssigneeSelect, DueTag, PageHead, PersonTag, Seg, StatusTag } from "../../ui";

export const metadata = { title: "Tasks" };

type Row = Task & {
  vendor: { name: string } | null;
  decision: { title: string } | null;
};

const WHO = [
  ["all", "Everyone"],
  ["me", "Mine"],
  ["hannah", "Hannah"],
  ["james", "James"],
  ["none", "Unassigned"],
] as const;

const SHOW = [
  ["open", "Open"],
  ["late", "Overdue"],
  ["done", "Done"],
  ["all", "All"],
] as const;

export default async function TasksPage({ searchParams }: PageProps<"/planning/tasks">) {
  const me = await requirePerson();
  const params = await searchParams;
  const who = WHO.some(([k]) => k === params.who) ? String(params.who) : "all";
  const show = SHOW.some(([k]) => k === params.show) ? String(params.show) : "open";
  const now = today();

  const all = await rows<Row[]>(
    db()
      .from("wedding_tasks")
      .select("*, vendor:wedding_vendors(name), decision:wedding_decisions(title)")
      .order("due_date", { nullsFirst: false })
      .order("created_at"),
  );

  const person = who === "me" ? me : who;
  const tasks = all
    .filter((t) => {
      if (who === "all") return true;
      if (who === "none") return !t.assignee;
      return t.assignee === person || t.assignee === "both";
    })
    .filter((t) => {
      if (show === "open") return t.status !== "done";
      if (show === "done") return t.status === "done";
      if (show === "late") return t.status !== "done" && !!t.due_date && t.due_date < now;
      return true;
    });

  if (show === "done") {
    tasks.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  }

  const groups = new Map<string, { late?: boolean; tasks: Row[] }>();
  for (const t of tasks) {
    const key =
      show === "done"
        ? "Finished"
        : !t.due_date
          ? "Someday"
          : t.due_date < now && t.status !== "done"
            ? "Overdue"
            : monthLabel(t.due_date);
    if (!groups.has(key)) groups.set(key, { late: key === "Overdue", tasks: [] });
    groups.get(key)!.tasks.push(t);
  }
  // Overdue first, Someday last.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "Overdue" ? -1 : b === "Overdue" ? 1 : a === "Someday" ? 1 : b === "Someday" ? -1 : 0,
  );

  const openCount = all.filter((t) => t.status !== "done").length;
  const doneCount = all.length - openCount;

  return (
    <div className="pl-page">
      <PageHead
        kicker="Tasks & deadlines"
        title={
          <>
            {openCount} to go, <em>{doneCount} done</em>
          </>
        }
        lede="Hand things to each other, set a date, and check them off together."
      />

      <form action={createTask} className="pl-quick">
        <input
          className="pl-input"
          name="title"
          placeholder="Add a task, e.g. Ask Bay Pointe about a rain plan"
          aria-label="New task"
          required
        />
        <AssigneeSelect name="assignee" value={who === "hannah" || who === "james" ? who : who === "me" ? me : null} />
        <input className="pl-input" type="date" name="due_date" aria-label="Due date" />
        <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      </form>

      <div className="pl-filters">
        <Seg path="/tasks" param="who" options={WHO} value={who} other={{ show }} />
        <Seg path="/tasks" param="show" options={SHOW} value={show} other={{ who }} />
      </div>

      {ordered.length ? (
        ordered.map(([label, group]) => (
          <section key={label} className="pl-group">
            <h2 className={`pl-group-title ${group.late ? "is-late" : ""}`}>
              {label} <span className="pl-small">{group.tasks.length}</span>
            </h2>
            <ul className="pl-list">
              {group.tasks.map((t) => (
                <li key={t.id} className={`pl-row ${t.status === "done" ? "is-done" : ""}`}>
                  <TaskCheck id={t.id} done={t.status === "done"} title={t.title} />
                  <Link href={`/tasks/${t.id}`} className="pl-row-main">
                    <span className="pl-row-title">{t.title}</span>
                    {t.notes || t.vendor || t.decision ? (
                      <span className="pl-row-sub">
                        {[t.vendor?.name, t.decision ? `Decision: ${t.decision.title}` : null, t.notes]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </Link>
                  <span className="pl-row-meta">
                    {t.status === "doing" || t.status === "waiting" ? <StatusTag status={t.status} /> : null}
                    <PersonTag who={t.assignee} />
                    <DueTag date={t.due_date} done={t.status === "done"} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="pl-empty">
          {show === "late"
            ? "Nothing overdue."
            : who === "none"
              ? "Everything has an owner."
              : `No tasks here${who !== "all" ? ` for ${who === "me" ? "you" : personName(who)}` : ""}.`}
        </p>
      )}
    </div>
  );
}
