import Link from "next/link";
import type { CSSProperties } from "react";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Task } from "@/lib/planning/db";
import {
  WEDDING_DAY,
  addDays,
  daysBetween,
  formatDate,
  personName,
  today,
} from "@/lib/planning/format";
import { PageHead, Seg } from "../../ui";

export const metadata = { title: "Timeline" };

const WHO = [
  ["all", "Everyone"],
  ["hannah", "Hannah"],
  ["james", "James"],
] as const;

type Bar = {
  key: string;
  href: string;
  label: string;
  sub: string;
  start: string | null;
  end: string;
  tone: string;
  done: boolean;
  late: boolean;
};

function firstOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function nextMonth(date: string) {
  const [y, m] = date.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export default async function TimelinePage({ searchParams }: PageProps<"/planning/timeline">) {
  await requirePerson();
  const params = await searchParams;
  const who = WHO.some(([k]) => k === params.who) ? String(params.who) : "all";
  const now = today();

  const allTasks = await rows<Task[]>(db().from("wedding_tasks").select("*"));

  const tasks = allTasks
    .filter((t) => t.due_date && (who === "all" || t.assignee === who || t.assignee === "both"))
    .sort((a, b) => (a.start_date ?? a.due_date!).localeCompare(b.start_date ?? b.due_date!));
  const undated = allTasks.filter((t) => !t.due_date && t.status !== "done").length;

  const bar = (t: Task): Bar => ({
    key: t.id,
    href: `/tasks/${t.id}`,
    label: t.title,
    sub: `${personName(t.assignee)} · due ${formatDate(t.due_date!)}`,
    start: t.start_date,
    end: t.due_date!,
    tone: t.assignee ?? "none",
    done: t.status === "done",
    late: t.status !== "done" && t.due_date! < now,
  });

  // One lane per owner, so it's easy to see who's carrying what, when.
  const lanes = [
    { title: "Hannah", rows: tasks.filter((t) => t.assignee === "hannah").map(bar) },
    { title: "James", rows: tasks.filter((t) => t.assignee === "james").map(bar) },
    { title: "Both of us", rows: tasks.filter((t) => t.assignee === "both").map(bar) },
    { title: "Unassigned", rows: tasks.filter((t) => !t.assignee).map(bar) },
  ].filter((lane) => lane.rows.length);

  // Range: the month we're in through the end of the wedding month.
  const dates = [now, WEDDING_DAY, ...tasks.flatMap((t) => [t.start_date ?? t.due_date!, t.due_date!])];
  const rangeStart = firstOfMonth(dates.reduce((a, b) => (a < b ? a : b)));
  const rangeEnd = nextMonth(dates.reduce((a, b) => (a > b ? a : b)));
  const span = daysBetween(rangeStart, rangeEnd);
  const at = (date: string) => (daysBetween(rangeStart, date) / span) * 100;

  const months: { label: string; left: number; width: number }[] = [];
  for (let m = rangeStart; m < rangeEnd; m = nextMonth(m)) {
    const left = at(m);
    const month = new Date(`${m}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
    months.push({
      label: m.slice(5, 7) === "01" || m === rangeStart ? `${month} ’${m.slice(2, 4)}` : month,
      left,
      width: at(nextMonth(m)) - left,
    });
  }

  const weeksLeft = Math.floor(daysBetween(now, WEDDING_DAY) / 7);

  return (
    <div className="pl-page" style={{ maxWidth: 1280 }}>
      <PageHead
        kicker="Timeline"
        title={
          <>
            {weeksLeft} weeks, <em>start to aisle</em>
          </>
        }
        lede="Every task laid out against the calendar, grouped by who owns it. Bars run from start to due date; diamonds are single-day deadlines. Click anything to open it."
      >
        <Seg path="/timeline" param="who" options={WHO} value={who} other={{}} />
      </PageHead>

      <div className="pl-gantt-legend pl-small">
        <span><i className="pl-gkey pl-gbar-hannah" /> Hannah</span>
        <span><i className="pl-gkey pl-gbar-james" /> James</span>
        <span><i className="pl-gkey pl-gbar-both" /> Both</span>
        <span><i className="pl-gkey pl-gbar-none" /> Unassigned</span>
        <span><i className="pl-gkey pl-gmile-key" /> Deadline</span>
      </div>

      <div className="pl-gantt-scroll">
        <div className="pl-gantt" style={{ "--today": `${at(now)}%`, "--wedding": `${at(WEDDING_DAY)}%` } as CSSProperties}>
          <div className="pl-gantt-head">
            <div className="pl-gantt-corner" />
            <div className="pl-gantt-months">
              {months.map((m) => (
                <span key={m.left} style={{ left: `${m.left}%`, width: `${m.width}%` }}>
                  {m.label}
                </span>
              ))}
              <b className="pl-gantt-flag pl-gantt-flag-today" style={{ left: "var(--today)" }}>
                Today
              </b>
              <b className="pl-gantt-flag pl-gantt-flag-wedding" style={{ left: "var(--wedding)" }}>
                July 4
              </b>
            </div>
          </div>

          <div className="pl-gantt-body">
            <div className="pl-gantt-grid" aria-hidden="true">
              {months.map((m) => (
                <i key={m.left} style={{ left: `${m.left}%` }} />
              ))}
              <i className="pl-gantt-today" style={{ left: "var(--today)" }} />
              <i className="pl-gantt-wedding" style={{ left: "var(--wedding)" }} />
            </div>

            {lanes.length ? (
              lanes.map((lane) => <Section key={lane.title} title={lane.title} rows={lane.rows} at={at} />)
            ) : (
              <Section title="Tasks" rows={[]} at={at} empty="No dated tasks here." />
            )}
          </div>
        </div>
      </div>

      {undated ? (
        <p className="pl-small" style={{ marginTop: 16 }}>
          {undated} open task{undated === 1 ? " has" : "s have"} no due date and {undated === 1 ? "isn’t" : "aren’t"} shown.{" "}
          <Link href="/tasks" className="pl-link">
            Give them dates
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  rows,
  at,
  empty,
}: {
  title: string;
  rows: Bar[];
  at: (date: string) => number;
  empty?: string;
}) {
  return (
    <>
      <div className="pl-gantt-section">
        <span>{title}</span>
        <span className="pl-small">{rows.length || ""}</span>
      </div>
      {rows.length ? (
        rows.map((r) => {
          const end = at(addDays(r.end, 1));
          const start = r.start ? at(r.start) : null;
          const cls = [r.done ? "is-done" : "", r.late ? "is-late" : ""].join(" ");
          const tip = `${r.label}\n${r.sub}`;
          return (
            <div key={r.key} className={`pl-gantt-row ${cls}`}>
              <Link href={r.href} className="pl-gantt-label">
                <span className="pl-row-title">{r.label}</span>
                <span className="pl-row-sub">{r.sub}</span>
              </Link>
              <div className="pl-gantt-track">
                {start !== null && end - start > 0.4 ? (
                  <Link
                    href={r.href}
                    title={tip}
                    className={`pl-gbar pl-gbar-${r.tone}`}
                    style={{ left: `${start}%`, width: `${end - start}%` }}
                  >
                    {end - start > 8 ? <span>{r.label}</span> : null}
                  </Link>
                ) : (
                  <Link
                    href={r.href}
                    title={tip}
                    className={`pl-gmile pl-gbar-${r.tone}`}
                    style={{ left: `${(at(r.end) + end) / 2}%` }}
                    aria-label={r.label}
                  />
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="pl-gantt-row">
          <p className="pl-empty pl-gantt-label" style={{ padding: "10px 0" }}>
            {empty}
          </p>
          <div className="pl-gantt-track" />
        </div>
      )}
    </>
  );
}
