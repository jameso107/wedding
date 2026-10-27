import { headers } from "next/headers";
import { requirePerson } from "@/lib/planning/auth";
import { personName } from "@/lib/planning/format";
import { PEOPLE } from "@/lib/planning/session";
import { CopyField } from "../../client";
import { PageHead } from "../../ui";

export const metadata = { title: "Connect Claude" };

const PROMPTS = [
  "What’s on my plate this month?",
  "Replace the starter tasks with our real list: …",
  "We booked Sarah Lee Photography for $4,800 with a $1,000 deposit due Dec 1. Add her and the deposit.",
  "Move everything about invitations two weeks later.",
  "We decided on a lakeside ceremony with the ballroom as the rain plan. Log it and add the follow-up tasks for James.",
  "How are we tracking against the budget?",
];

export default async function ConnectPage() {
  const me = await requirePerson();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "planning.oosterhouse.wedding";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const url = (who: string) => `${proto}://${host}/mcp/${who}`;
  const partner = PEOPLE.find((p) => p !== me)!;

  return (
    <div className="pl-page" style={{ maxWidth: 820 }}>
      <PageHead
        kicker="Connect Claude"
        title={
          <>
            Plan out loud, <em>{personName(me)}</em>
          </>
        }
        lede="Add the planning board to your Claude and it can read and change everything here: tasks, dates, decisions, vendors, and the budget. Anything it does shows up in the activity feed with your name."
      />

      <section className="pl-card pl-stack" style={{ gap: 18 }}>
        <CopyField label={`Your connector URL (${personName(me)})`} value={url(me)} />
        <ol className="pl-steps">
          <li>
            In Claude on the web or desktop, open <strong>Settings → Connectors</strong> and choose{" "}
            <strong>Add custom connector</strong>.
          </li>
          <li>
            Name it <em>Wedding planning</em>, paste the URL above, and click <strong>Add</strong>. There’s
            nothing to sign in to.
          </li>
          <li>
            In a chat, turn it on from the <strong>+</strong> menu (Connectors), then ask away. Connectors
            you add on the web also work in the Claude phone app.
          </li>
        </ol>
        <p className="pl-small" style={{ margin: 0 }}>
          In Claude Code, run:{" "}
          <code className="pl-code">claude mcp add --transport http wedding {url(me)}</code>
        </p>
      </section>

      <section className="pl-card" style={{ marginTop: 20 }}>
        <div className="pl-section-head">
          <h2 className="pl-h2">Things to ask</h2>
        </div>
        <ul className="pl-list">
          {PROMPTS.map((p) => (
            <li key={p} className="pl-row" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <span style={{ fontStyle: "italic" }}>“{p}”</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pl-card" style={{ marginTop: 20 }}>
        <CopyField label={`${personName(partner)}’s connector URL (send it over)`} value={url(partner)} />
        <p className="pl-small" style={{ margin: "12px 0 0" }}>
          Each URL acts as that person. There’s no password, so treat these links like the board itself and
          keep them between the two of you.
        </p>
      </section>
    </div>
  );
}
