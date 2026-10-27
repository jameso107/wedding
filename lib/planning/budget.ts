import type { BudgetCategory, Payment, Vendor } from "./db";

export type CategoryTotals = {
  category: BudgetCategory | null;
  planned: number;
  committed: number;
  paid: number;
};

// A booked vendor counts for whichever is larger: its quote or the payments
// logged against it. Payments without a vendor count as-is. Everything rolls
// up to the vendor's category when there is a vendor, else the payment's own.
export function budgetTotals(
  categories: BudgetCategory[],
  vendors: Pick<Vendor, "id" | "status" | "quote_cents" | "category_id">[],
  payments: Pick<Payment, "vendor_id" | "category_id" | "amount_cents" | "paid_on">[],
) {
  const byCategory = new Map<string | null, CategoryTotals>();
  const bucket = (id: string | null) => {
    const key = id && categories.some((c) => c.id === id) ? id : null;
    if (!byCategory.has(key)) {
      const category = categories.find((c) => c.id === key) ?? null;
      byCategory.set(key, {
        category,
        planned: Number(category?.planned_cents ?? 0),
        committed: 0,
        paid: 0,
      });
    }
    return byCategory.get(key)!;
  };
  categories.forEach((c) => bucket(c.id));

  const vendorPayments = new Map<string, number>();
  for (const p of payments) {
    const vendor = vendors.find((v) => v.id === p.vendor_id);
    const row = bucket(vendor ? vendor.category_id : p.category_id);
    const amount = Number(p.amount_cents);
    if (p.paid_on) row.paid += amount;
    if (vendor) vendorPayments.set(vendor.id, (vendorPayments.get(vendor.id) ?? 0) + amount);
    else row.committed += amount;
  }
  for (const v of vendors) {
    const logged = vendorPayments.get(v.id) ?? 0;
    const quote = v.status === "booked" ? Number(v.quote_cents ?? 0) : 0;
    bucket(v.category_id).committed += Math.max(logged, quote);
  }

  const rows = categories.map((c) => byCategory.get(c.id)!);
  const uncategorized = byCategory.get(null);
  if (uncategorized && (uncategorized.committed || uncategorized.paid)) rows.push(uncategorized);

  const sum = (k: "planned" | "committed" | "paid") => rows.reduce((s, r) => s + r[k], 0);
  return { rows, planned: sum("planned"), committed: sum("committed"), paid: sum("paid") };
}
