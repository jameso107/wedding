import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Decision, type Task } from "@/lib/planning/db";
import { formatDate } from "@/lib/planning/format";
import { createTask, deleteDecision, updateDecision } from "../../../actions";
import { ActionForm, ConfirmButton, SubmitButton, TaskCheck } from "../../../client";
import { AssigneeSelect, BackLink, DueTag, Field, PersonTag } from "../../../ui";

export const metadata = { title: "Decision" };

export default async function DecisionPage({ params }: PageProps<"/planning/decisions/[id]">) {
  await requirePerson();
  const { id } = await params;
  const { data: d } = await db().from("wedding_decisions").select("*").eq("id", id).maybeSingle<Decision>();
  if (!d) notFound();
  const tasks = await rows<Task[]>(
    db().from("wedding_tasks").select("*").eq("decision_id", id).order("due_date", { nullsFirst: false }),
  );

  return (
    <div className="pl-page">
      <BackLink href="/decisions">All decisions</BackLink>
      <div className="pl-detail">
        <ActionForm action={updateDecision} then="/decisions" className="pl-card pl-form">
          <input type="hidden" name="id" value={d.id} />
          <Field label="The question">
            <input className="pl-input" name="title" defaultValue={d.title} required style={{ fontSize: 20 }} />
          </Field>
          <div className="pl-form-row">
            <Field label="Status">
              <select className="pl-select" name="status" defaultValue={d.status}>
                <option value="open">Open</option>
                <option value="leaning">Leaning</option>
                <option value="decided">Decided</option>
              </select>
            </Field>
            <Field label="Owner">
              <AssigneeSelect name="owner" value={d.owner} />
            </Field>
            <Field label="Decide by">
              <input className="pl-input" type="date" name="decide_by" defaultValue={d.decide_by ?? ""} />
            </Field>
          </div>
          <Field label="Context">
            <textarea
              className="pl-textarea"
              name="context"
              defaultValue={d.context ?? ""}
              placeholder="What's driving this, constraints, who else has opinions…"
            />
          </Field>
          <Field label="Options we're weighing (one per line)">
            <textarea
              className="pl-textarea"
              name="options"
              defaultValue={d.options ?? ""}
              placeholder={"Lakeside lawn: best view, needs a tent\nIndoor ballroom: weatherproof"}
              style={{ minHeight: 120 }}
            />
          </Field>
          <div className="pl-form-row">
            <Field label="What we chose">
              <input className="pl-input" name="outcome" defaultValue={d.outcome ?? ""} />
            </Field>
          </div>
          <Field label="Why">
            <textarea className="pl-textarea" name="rationale" defaultValue={d.rationale ?? ""} />
          </Field>
          <div className="pl-actions">
            <ConfirmButton action={deleteDecision} then="/decisions" message={`Delete “${d.title}”?`}>
              Delete decision
            </ConfirmButton>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
          {d.decided_on ? (
            <p className="pl-small" style={{ margin: 0 }}>
              Decided {formatDate(d.decided_on, true)}.
            </p>
          ) : null}
        </ActionForm>

        <aside className="pl-card">
          <div className="pl-section-head">
            <h2 className="pl-h2" style={{ fontSize: 20 }}>
              Follow-up tasks
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
          ) : (
            <p className="pl-empty" style={{ paddingTop: 0 }}>
              None yet.
            </p>
          )}
          <form action={createTask} className="pl-form" style={{ gap: 8, marginTop: 14 }}>
            <input type="hidden" name="decision_id" value={d.id} />
            <input className="pl-input" name="title" placeholder="Add a follow-up…" aria-label="New follow-up task" required />
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
  );
}
