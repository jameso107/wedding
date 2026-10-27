import Link from "next/link";
import type { Assignee, BudgetCategory, Decision, Vendor } from "@/lib/planning/db";
import { personName, relativeDue } from "@/lib/planning/format";

export function PageHead({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="pl-head">
      <div>
        <p className="pl-kicker">{kicker}</p>
        <h1 className="pl-title">{title}</h1>
        {lede ? <p className="pl-lede">{lede}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function PersonTag({ who }: { who: Assignee | null }) {
  if (!who) return <span className="pl-tag">Unassigned</span>;
  return (
    <span className={`pl-tag pl-tag-${who}`}>
      {who === "both" ? "Both" : personName(who)}
    </span>
  );
}

export function DueTag({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return null;
  const due = relativeDue(date);
  return (
    <span className={`pl-tag pl-tag-${done ? "later" : due.tone}`}>
      <time dateTime={date}>{due.text}</time>
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Assigned",
  doing: "In progress",
  waiting: "Waiting",
  done: "Done",
  open: "Open",
  leaning: "Leaning",
  decided: "Decided",
  researching: "Researching",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  passed: "Passed",
};

export function StatusTag({ status }: { status: string }) {
  return (
    <span className={`pl-tag pl-tag-${status}`}>
      <span className="pl-dot" aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Avatar({ who }: { who: string }) {
  const letter = who === "hannah" ? "H" : who === "james" ? "J" : "✦";
  return (
    <span className={`pl-avatar pl-avatar-${who}`} aria-hidden="true">
      {letter}
    </span>
  );
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className="pl-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span className="pl-label">{label}</span>
      {children}
    </label>
  );
}

export function AssigneeSelect({
  name,
  value,
  emptyLabel = "Unassigned",
}: {
  name: string;
  value?: Assignee | null;
  emptyLabel?: string;
}) {
  return (
    <select className="pl-select" name={name} defaultValue={value ?? ""}>
      <option value="">{emptyLabel}</option>
      <option value="hannah">Hannah</option>
      <option value="james">James</option>
      <option value="both">Both of us</option>
    </select>
  );
}

export function CategorySelect({
  categories,
  value,
}: {
  categories: BudgetCategory[];
  value?: string | null;
}) {
  return (
    <select className="pl-select" name="category_id" defaultValue={value ?? ""}>
      <option value="">No budget category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function VendorSelect({
  vendors,
  value,
}: {
  vendors: Pick<Vendor, "id" | "name">[];
  value?: string | null;
}) {
  return (
    <select className="pl-select" name="vendor_id" defaultValue={value ?? ""}>
      <option value="">No vendor</option>
      {vendors.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}

export function DecisionSelect({
  decisions,
  value,
}: {
  decisions: Pick<Decision, "id" | "title">[];
  value?: string | null;
}) {
  return (
    <select className="pl-select" name="decision_id" defaultValue={value ?? ""}>
      <option value="">No decision</option>
      {decisions.map((d) => (
        <option key={d.id} value={d.id}>
          {d.title}
        </option>
      ))}
    </select>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="pl-link pl-back">
      ← {children}
    </Link>
  );
}

export function Seg({
  path,
  param,
  options,
  value,
  other,
}: {
  path: string;
  param: string;
  options: readonly (readonly [string, string])[];
  value: string;
  other: Record<string, string>;
}) {
  return (
    <div className="pl-seg" role="group">
      {options.map(([key, label]) => {
        const q = new URLSearchParams({ ...other, [param]: key });
        return (
          <Link key={key} href={`${path}?${q}`} aria-current={key === value ? "true" : undefined} scroll={false}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
