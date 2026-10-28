import { cookies } from "next/headers";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Task } from "@/lib/planning/db";
import { COLLAPSED_COOKIE, TASK_STATUSES, type TaskStatus } from "@/lib/planning/stages";
import { KanbanBoard, type BoardCard } from "../../board";
import { PageHead, Seg } from "../../ui";

export const metadata = { title: "Board" };

const WHO = [
  ["all", "Everyone"],
  ["me", "Mine"],
  ["hannah", "Hannah"],
  ["james", "James"],
] as const;

const DONE_SHOWN = 12;

export default async function BoardPage({ searchParams }: PageProps<"/planning/board">) {
  const me = await requirePerson();
  const params = await searchParams;
  const who = WHO.some(([k]) => k === params.who) ? String(params.who) : "all";
  const person = who === "me" ? me : who;
  const collapsed = ((await cookies()).get(COLLAPSED_COOKIE)?.value ?? "")
    .split(",")
    .filter((s): s is TaskStatus => TASK_STATUSES.includes(s as TaskStatus));

  const all = await rows<Task[]>(db().from("wedding_tasks").select("*"));
  const tasks = all.filter(
    (t) => who === "all" || t.assignee === person || t.assignee === "both",
  );

  // Keep Done short: the most recently finished, with a link to the rest.
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const shown = [...tasks.filter((t) => t.status !== "done"), ...done.slice(0, DONE_SHOWN)];

  const cards: BoardCard[] = shown.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    assignee: t.assignee,
    due_date: t.due_date,
    context: t.notes,
  }));
  const inFlight = tasks.filter((t) => t.status === "doing" || t.status === "waiting").length;

  return (
    <div className="pl-page" style={{ maxWidth: 1400 }}>
      <PageHead
        kicker="Board"
        title={
          <>
            {inFlight} in flight, <em>{done.length} done</em>
          </>
        }
        lede="Drag tasks from stage to stage. Dropping an unassigned task into Assigned gives it to you; click a card to edit it, or a column’s name to fold it away."
      >
        <Seg path="/board" param="who" options={WHO} value={who} other={{}} />
      </PageHead>
      <KanbanBoard
        cards={cards}
        me={me}
        doneHidden={Math.max(0, done.length - DONE_SHOWN)}
        initialCollapsed={collapsed}
      />
    </div>
  );
}
