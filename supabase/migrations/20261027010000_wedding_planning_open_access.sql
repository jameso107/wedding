-- The planning board has no password (see lib/planning/session.ts), so it
-- talks to Supabase with the publishable key. Let that key use the wedding_*
-- tables; nothing else in this project is opened up.

grant select, insert, update, delete on public.wedding_budget_categories, public.wedding_vendors,
  public.wedding_payments, public.wedding_decisions, public.wedding_tasks,
  public.wedding_activity to anon;
grant usage on sequence public.wedding_activity_id_seq to anon;

create policy "planning board" on public.wedding_budget_categories for all to anon using (true) with check (true);
create policy "planning board" on public.wedding_vendors for all to anon using (true) with check (true);
create policy "planning board" on public.wedding_payments for all to anon using (true) with check (true);
create policy "planning board" on public.wedding_decisions for all to anon using (true) with check (true);
create policy "planning board" on public.wedding_tasks for all to anon using (true) with check (true);
create policy "planning board" on public.wedding_activity for all to anon using (true) with check (true);
