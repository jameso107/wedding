-- Kanban stages: backlog → todo ("Assigned") → doing → waiting → done.
-- Unassigned to-dos start in the backlog.
alter table public.wedding_tasks drop constraint if exists wedding_tasks_status_check;
alter table public.wedding_tasks add constraint wedding_tasks_status_check
  check (status in ('backlog', 'todo', 'doing', 'waiting', 'done'));
alter table public.wedding_tasks alter column status set default 'backlog';
update public.wedding_tasks set status = 'backlog' where status = 'todo' and assignee is null;
