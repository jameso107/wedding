-- Tasks can span a window (start → due) so the timeline can draw them as bars.
alter table public.wedding_tasks add column start_date date;
alter table public.wedding_tasks add constraint wedding_tasks_dates_ordered
  check (start_date is null or due_date is null or start_date <= due_date);
