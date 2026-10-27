-- Wedding planning dashboard (planning.oosterhouse.wedding).
-- Lives alongside the retired trivia-bot tables, so everything is prefixed
-- wedding_. RLS is on with no policies: only the server-side secret key can
-- read or write; the publishable/anon key sees nothing.

create table public.wedding_budget_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  planned_cents bigint not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.wedding_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service text,
  category_id uuid references public.wedding_budget_categories on delete set null,
  status text not null default 'researching'
    check (status in ('researching', 'contacted', 'quoted', 'booked', 'passed')),
  owner text check (owner in ('hannah', 'james', 'both')),
  contact_name text,
  email text,
  phone text,
  website text,
  quote_cents bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_payments (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  vendor_id uuid references public.wedding_vendors on delete cascade,
  category_id uuid references public.wedding_budget_categories on delete set null,
  amount_cents bigint not null,
  due_date date,
  paid_on date,
  created_at timestamptz not null default now()
);

create table public.wedding_decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  context text,
  options text,
  status text not null default 'open'
    check (status in ('open', 'leaning', 'decided')),
  outcome text,
  rationale text,
  owner text check (owner in ('hannah', 'james', 'both')),
  decide_by date,
  decided_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  assignee text check (assignee in ('hannah', 'james', 'both')),
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  due_date date,
  vendor_id uuid references public.wedding_vendors on delete set null,
  decision_id uuid references public.wedding_decisions on delete set null,
  created_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_activity (
  id bigint generated always as identity primary key,
  actor text not null,
  summary text not null,
  href text,
  created_at timestamptz not null default now()
);

create index on public.wedding_tasks (due_date);
create index on public.wedding_tasks (vendor_id);
create index on public.wedding_tasks (decision_id);
create index on public.wedding_payments (vendor_id);
create index on public.wedding_payments (category_id);
create index on public.wedding_vendors (category_id);
create index on public.wedding_activity (created_at desc);

alter table public.wedding_budget_categories enable row level security;
alter table public.wedding_vendors enable row level security;
alter table public.wedding_payments enable row level security;
alter table public.wedding_decisions enable row level security;
alter table public.wedding_tasks enable row level security;
alter table public.wedding_activity enable row level security;

revoke all on public.wedding_budget_categories, public.wedding_vendors,
  public.wedding_payments, public.wedding_decisions, public.wedding_tasks,
  public.wedding_activity from anon, authenticated;
