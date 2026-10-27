import Link from "next/link";
import { requirePerson } from "@/lib/planning/auth";
import { db, rows, type BudgetCategory, type Vendor, type VendorStatus } from "@/lib/planning/db";
import { money } from "@/lib/planning/format";
import { createVendor } from "../../actions";
import { ActionForm, SubmitButton } from "../../client";
import { CategorySelect, PageHead, PersonTag } from "../../ui";

export const metadata = { title: "Vendors" };

const COLUMNS: [VendorStatus, string][] = [
  ["researching", "Researching"],
  ["contacted", "Reached out"],
  ["quoted", "Have a quote"],
  ["booked", "Booked"],
  ["passed", "Passed"],
];

export default async function VendorsPage() {
  await requirePerson();
  const [vendors, categories] = await Promise.all([
    rows<Vendor[]>(db().from("wedding_vendors").select("*").order("name")),
    rows<BudgetCategory[]>(db().from("wedding_budget_categories").select("*").order("sort")),
  ]);
  const booked = vendors.filter((v) => v.status === "booked").length;

  return (
    <div className="pl-page" style={{ maxWidth: 1280 }}>
      <PageHead
        kicker="Vendors"
        title={
          <>
            {booked} booked, <em>{vendors.length - booked} in the works</em>
          </>
        }
        lede="From first search to signed contract. Open a vendor to log contacts, quotes, and deposits."
      />

      <ActionForm action={createVendor} then="/vendors/:id" className="pl-quick">
        <input className="pl-input" name="name" placeholder="Vendor name" aria-label="Vendor name" required />
        <input className="pl-input" name="service" placeholder="Service, e.g. Florist" aria-label="Service" />
        <CategorySelect categories={categories} />
        <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      </ActionForm>

      <div className="pl-board">
        {COLUMNS.map(([status, label]) => {
          const list = vendors.filter((v) => v.status === status);
          return (
            <section key={status} className="pl-col">
              <header className="pl-col-head">
                <h2>{label}</h2>
                <span className="pl-small">{list.length}</span>
              </header>
              {list.map((v) => (
                <Link key={v.id} href={`/vendors/${v.id}`} className="pl-vcard">
                  <span className="pl-small">{v.service ?? "Vendor"}</span>
                  <strong>{v.name}</strong>
                  <span className="pl-row-meta">
                    {v.owner ? <PersonTag who={v.owner} /> : null}
                    {v.quote_cents != null ? <span className="pl-tag">{money(v.quote_cents)}</span> : null}
                  </span>
                </Link>
              ))}
              {!list.length ? <p className="pl-empty" style={{ paddingTop: 4 }}>—</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
