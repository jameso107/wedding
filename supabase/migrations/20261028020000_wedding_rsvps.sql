-- Early RSVPs from the public save-the-date page (oosterhouse.wedding), ahead
-- of the formal invitation. The site writes them with the publishable key, so
-- anon may insert and read (for the planning board) but never edit or delete.

create table public.wedding_rsvps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  attending boolean not null,
  created_at timestamptz not null default now()
);

alter table public.wedding_rsvps enable row level security;

grant select, insert on public.wedding_rsvps to anon;

create policy "public rsvp" on public.wedding_rsvps for insert to anon with check (true);
create policy "planning board" on public.wedding_rsvps for select to anon using (true);
