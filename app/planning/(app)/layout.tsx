import Link from "next/link";
import { requirePerson } from "@/lib/planning/auth";
import { db } from "@/lib/planning/db";
import { WEDDING_DAY, daysBetween, personName, today } from "@/lib/planning/format";
import { LogoutButton, Nav } from "../client";
import { Avatar } from "../ui";

export default async function AppLayout({ children }: LayoutProps<"/planning">) {
  const me = await requirePerson();
  const now = today();
  const [mine, openDecisions] = await Promise.all([
    db()
      .from("wedding_tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done")
      .in("assignee", [me, "both"]),
    db()
      .from("wedding_decisions")
      .select("id", { count: "exact", head: true })
      .neq("status", "decided"),
  ]);
  const days = daysBetween(now, WEDDING_DAY);

  return (
    <div className="pl-shell">
      <aside className="pl-side">
        <Link href="/" className="pl-lockup">
          <span className="pl-lockup-names">Hannah &amp; James</span>
          <span className="pl-lockup-kicker">Planning board</span>
        </Link>
        <Nav
          counts={{
            "/tasks": mine.count ?? undefined,
            "/decisions": openDecisions.count ?? undefined,
          }}
        />
        <div className="pl-side-foot">
          <div className="pl-countdown">
            <strong>{days > 0 ? days : "Today"}</strong>
            <span>{days > 0 ? "days to July 4" : "is the day"}</span>
          </div>
          <div className="pl-whoami">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar who={me} />
              {personName(me)}
            </span>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="pl-main">{children}</main>
    </div>
  );
}
