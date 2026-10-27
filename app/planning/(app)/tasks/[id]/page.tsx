import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Decision, type Task, type Vendor } from "@/lib/planning/db";
import { formatDate, personName, timeAgo } from "@/lib/planning/format";
import { TASK_STAGES } from "@/lib/planning/stages";
import { deleteTask, updateTask } from "../../../actions";
import { ActionForm, ConfirmButton, SubmitButton } from "../../../client";
import {
  AssigneeSelect,
  BackLink,
  DecisionSelect,
  DueTag,
  Field,
  PersonTag,
  StatusTag,
  VendorSelect,
} from "../../../ui";

export const metadata = { title: "Task" };

export default async function TaskPage({ params }: PageProps<"/planning/tasks/[id]">) {
  await requirePerson();
  const { id } = await params;
  const { data: task } = await db().from("wedding_tasks").select("*").eq("id", id).maybeSingle<Task>();
  if (!task) notFound();

  const [vendors, decisions] = await Promise.all([
    rows<Pick<Vendor, "id" | "name">[]>(db().from("wedding_vendors").select("id, name").order("name")),
    rows<Pick<Decision, "id" | "title">[]>(db().from("wedding_decisions").select("id, title").order("title")),
  ]);

  return (
    <div className="pl-page">
      <BackLink href="/tasks">All tasks</BackLink>
      <div className="pl-detail">
        <ActionForm action={updateTask} then="/tasks" className="pl-card pl-form">
          <input type="hidden" name="id" value={task.id} />
          <Field label="Task">
            <input className="pl-input" name="title" defaultValue={task.title} required style={{ fontSize: 20 }} />
          </Field>
          <div className="pl-form-row">
            <Field label="Who">
              <AssigneeSelect name="assignee" value={task.assignee} />
            </Field>
            <Field label="Start">
              <input className="pl-input" type="date" name="start_date" defaultValue={task.start_date ?? ""} />
            </Field>
            <Field label="Due">
              <input className="pl-input" type="date" name="due_date" defaultValue={task.due_date ?? ""} />
            </Field>
            <Field label="Status">
              <select className="pl-select" name="status" defaultValue={task.status}>
                {TASK_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="pl-form-row">
            <Field label="Vendor">
              <VendorSelect vendors={vendors} value={task.vendor_id} />
            </Field>
            <Field label="Decision">
              <DecisionSelect decisions={decisions} value={task.decision_id} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="pl-textarea" name="notes" defaultValue={task.notes ?? ""} />
          </Field>
          <div className="pl-actions">
            <ConfirmButton action={deleteTask} then="/tasks" message={`Delete “${task.title}”?`}>
              Delete task
            </ConfirmButton>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
        </ActionForm>

        <aside className="pl-card pl-stack" style={{ gap: 14 }}>
          <div className="pl-row-meta" style={{ justifyContent: "flex-start" }}>
            <StatusTag status={task.status} />
            <PersonTag who={task.assignee} />
            <DueTag date={task.due_date} done={task.status === "done"} />
          </div>
          <p className="pl-small" style={{ margin: 0 }}>
            {task.due_date ? `Due ${formatDate(task.due_date, true)}. ` : "No due date. "}
            Added {task.created_by ? `by ${personName(task.created_by)} ` : ""}
            {timeAgo(task.created_at)}.
            {task.completed_at ? ` Finished ${timeAgo(task.completed_at)}.` : ""}
          </p>
        </aside>
      </div>
    </div>
  );
}
