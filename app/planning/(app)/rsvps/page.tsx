import { db, rows, type Rsvp } from "@/lib/planning/db";
import { timeAgo } from "@/lib/planning/format";
import { PageHead } from "../../ui";

export const metadata = { title: "RSVPs" };

export default async function RsvpsPage() {
  const all = await rows<Rsvp[]>(
    db().from("wedding_rsvps").select("*").order("created_at", { ascending: false }),
  );

  // Guests may answer more than once; their latest answer wins.
  const latest = new Map<string, Rsvp & { times: number }>();
  for (const r of all) {
    const key = r.name.trim().toLowerCase().replace(/\s+/g, " ");
    const seen = latest.get(key);
    if (seen) seen.times++;
    else latest.set(key, { ...r, times: 1 });
  }
  const guests = [...latest.values()];
  const coming = guests.filter((r) => r.attending);
  const declined = guests.filter((r) => !r.attending);

  return (
    <div className="pl-page">
      <PageHead
        kicker="Early RSVPs"
        title={
          <>
            {coming.length} coming, <em>{declined.length} can&rsquo;t make it</em>
          </>
        }
        lede="From the Start Your RSVP button on oosterhouse.wedding, ahead of the formal invitation."
      />

      <div className="pl-stats pl-stats-3">
        <div className="pl-stat">
          <span className="pl-stat-label">Responses</span>
          <span className="pl-stat-value">{guests.length}</span>
        </div>
        <div className="pl-stat">
          <span className="pl-stat-label">Planning on it</span>
          <span className="pl-stat-value">{coming.length}</span>
        </div>
        <div className="pl-stat">
          <span className="pl-stat-label">Can&rsquo;t make it</span>
          <span className="pl-stat-value">{declined.length}</span>
        </div>
      </div>

      <div className="pl-grid pl-grid-2">
        <RsvpList title="Planning on it" guests={coming} empty="No yeses yet." />
        <RsvpList title="Can’t make it" guests={declined} empty="Nobody has said no." />
      </div>
    </div>
  );
}

function RsvpList({
  title,
  guests,
  empty,
}: {
  title: string;
  guests: (Rsvp & { times: number })[];
  empty: string;
}) {
  return (
    <section className="pl-card">
      <div className="pl-section-head">
        <h2 className="pl-h2">
          {title} <span className="pl-small">{guests.length}</span>
        </h2>
      </div>
      {guests.length ? (
        <ul className="pl-list">
          {guests.map((r) => (
            <li key={r.id} className="pl-row pl-row-rsvp">
              <span className="pl-row-main">
                <span className="pl-row-title">{r.name}</span>
                {r.times > 1 ? (
                  <span className="pl-row-sub">Answered {r.times} times; showing the latest</span>
                ) : null}
              </span>
              <span className="pl-row-meta">
                <span className="pl-tag pl-tag-later">
                  <time dateTime={r.created_at}>{timeAgo(r.created_at)}</time>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pl-empty">{empty}</p>
      )}
    </section>
  );
}
