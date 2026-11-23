-- Auto-onboarding: when a new auth user is created, provision their app profile,
-- a default workspace, and an owner membership — so RLS works immediately without
-- any manual setup or the DEV_API_KEY path.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  ws_id uuid;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  -- 1) App profile (mirrors auth.users).
  insert into public.users (id, email, full_name)
  values (new.id, new.email, display_name)
  on conflict (id) do nothing;

  -- 2) Default workspace + owner membership (only if they have none yet).
  if not exists (
    select 1 from public.workspace_members where user_id = new.id
  ) then
    insert into public.workspaces (name, owner_id)
    values (display_name || '''s Workspace', new.id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
