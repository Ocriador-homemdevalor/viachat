-- Run once in the SQL Editor of your Supabase project.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'version' = '1'),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update on public.workspaces to authenticated;

drop policy if exists "Read own workspace" on public.workspaces;
create policy "Read own workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Create own workspace" on public.workspaces;
create policy "Create own workspace" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own workspace" on public.workspaces;
create policy "Update own workspace" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Used for optimistic concurrency: stale devices cannot silently overwrite newer data.
create or replace function public.set_workspace_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
drop trigger if exists workspace_updated_at on public.workspaces;
create trigger workspace_updated_at before update on public.workspaces
  for each row execute function public.set_workspace_updated_at();
