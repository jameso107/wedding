import Link from "next/link";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type Decision } from "@/lib/planning/db";
import { formatDate, personName } from "@/lib/planning/format";
import { createDecision } from "../../actions";
import { ActionForm, SubmitButton } from "../../client";
import { AssigneeSelect, DueTag, PageHead, StatusTag } from "../../ui";

export const metadata = { title: "Decisions" };

export default async function DecisionsPage() {
  await requirePerson();
  const decisions = await rows<Decision[]>(
    db().from("wedding_decisions").select("*").order("decide_by", { nullsFirst: false }),
  );
  const open = decisions.filter((d) => d.status !== "decided");
  const decided = decisions
    .filter((d) => d.status === "decided")
    .sort((a, b) => (b.decided_on ?? "").localeCompare(a.decided_on ?? ""));

  return (
    <div className="pl-page">
      <PageHead
        kicker="Decisions log"
        title={
          <>
            {open.length} open, <em>{decided.length} made</em>
          </>
        }
        lede="Track the big calls: what we weighed, what we chose, and why. Future us will thank us."
      />

      <ActionForm action={createDecision} then="/decisions/:id" className="pl-quick">
        <input
          className="pl-input"
          name="title"
          placeholder="A question to settle, e.g. Live band or DJ?"
          aria-label="New decision"
          required
        />
        <AssigneeSelect name="owner" emptyLabel="Owner…" />
        <input className="pl-input" type="date" name="decide_by" aria-label="Decide by" />
        <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      </ActionForm>

      <section className="pl-group">
        <h2 className="pl-group-title">
          Still deciding <span className="pl-small">{open.length}</span>
        </h2>
        {open.length ? (
          <div className="pl-grid pl-grid-3" style={{ marginTop: 14 }}>
            {open.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        ) : (
          <p className="pl-empty">Nothing open. Add the next question above.</p>
        )}
      </section>

      {decided.length ? (
        <section className="pl-group">
          <h2 className="pl-group-title">
            Decided <span className="pl-small">{decided.length}</span>
          </h2>
          <div className="pl-grid pl-grid-3" style={{ marginTop: 14 }}>
            {decided.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DecisionCard({ decision: d }: { decision: Decision }) {
  const optionCount = d.options?.split("\n").filter((l) => l.trim()).length ?? 0;
  return (
    <Link href={`/decisions/${d.id}`} className="pl-card pl-decision">
      <div className="pl-decision-top">
        <StatusTag status={d.status} />
        {d.status === "decided" ? (
          d.decided_on ? (
            <span className="pl-small">{formatDate(d.decided_on, true)}</span>
          ) : null
        ) : (
          <DueTag date={d.decide_by} />
        )}
      </div>
      <h3>{d.title}</h3>
      {d.status === "decided" && d.outcome ? (
        <p className="pl-outcome">{d.outcome}</p>
      ) : d.context ? (
        <p>{d.context}</p>
      ) : null}
      <p className="pl-small" style={{ marginTop: 12 }}>
        {personName(d.owner)}
        {optionCount && d.status !== "decided" ? ` · ${optionCount} option${optionCount === 1 ? "" : "s"}` : ""}
      </p>
    </Link>
  );
}
