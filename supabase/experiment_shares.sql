-- Table to track experiments shared with other users
create table if not exists experiment_shares (
    id uuid primary key default gen_random_uuid(),
    experiment_id uuid not null references experiments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz default now()
);

-- Enable row level security
alter table experiment_shares enable row level security;

-- Allow experiment owners to share with other users
drop policy if exists "Owners can share experiments" on experiment_shares;
create policy "Owners can share experiments" on experiment_shares
for insert with check (
    auth.uid() = (select user_id from experiments where id = experiment_id)
);

-- Allow owners and recipients to view share records
drop policy if exists "View share records" on experiment_shares;
create policy "View share records" on experiment_shares
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() = user_id
);

-- Allow owners to remove shares
drop policy if exists "Owners can remove shares" on experiment_shares;
create policy "Owners can remove shares" on experiment_shares
for delete using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
);

-- ---------------------------------------------------------
-- Base policies to allow users to manage their own records
-- ---------------------------------------------------------

drop policy if exists "Users manage own experiments" on experiments;
create policy "Users manage own experiments" on experiments
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own experiment tags" on experiment_tags;
create policy "Users manage own experiment tags" on experiment_tags
for all
using (auth.uid() = (select user_id from experiments where id = experiment_id))
with check (auth.uid() = (select user_id from experiments where id = experiment_id));

drop policy if exists "Users manage own protocols" on protocols;
create policy "Users manage own protocols" on protocols
for all
using (auth.uid() = (select user_id from experiments where id = experiment_id))
with check (auth.uid() = (select user_id from experiments where id = experiment_id));

drop policy if exists "Users manage own files" on files;
create policy "Users manage own files" on files
for all
using (auth.uid() = (select user_id from experiments where id = experiment_id))
with check (auth.uid() = (select user_id from experiments where id = experiment_id));

drop policy if exists "Users manage own results" on results;
create policy "Users manage own results" on results
for all
using (auth.uid() = (select user_id from experiments where id = experiment_id))
with check (auth.uid() = (select user_id from experiments where id = experiment_id));

drop policy if exists "Users manage own tags" on tags;
create policy "Users manage own tags" on tags
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Additional policies so shared experiments are readable
-- ---------------------------------------------------------

drop policy if exists "View own or shared experiments" on experiments;
create policy "View own or shared experiments" on experiments
for select using (
    user_can_access_experiment(id)
);

drop policy if exists "View shared protocols" on protocols;
create policy "View shared protocols" on protocols
for select using (
    user_can_access_experiment(experiment_id)
);

drop policy if exists "View shared files" on files;
create policy "View shared files" on files
for select using (
    user_can_access_experiment(experiment_id)
);

drop policy if exists "View shared results" on results;
create policy "View shared results" on results
for select using (
    user_can_access_experiment(experiment_id)
);

drop policy if exists "View shared experiment tags" on experiment_tags;
create policy "View shared experiment tags" on experiment_tags
for select using (
    user_can_access_experiment(experiment_id)
);

drop policy if exists "View shared tags" on tags;
create policy "View shared tags" on tags
for select using (
    auth.uid() = user_id
    or exists (
        select 1
        from experiment_tags et
        where et.tag_id = tags.id
          and user_can_access_experiment(et.experiment_id)
    )
);

-- Helper function to lookup a user id by email
create or replace function get_user_id_by_email(user_email text)
returns uuid
language sql
security definer
set search_path = auth
as $$
  select id from users where email = user_email;
$$;

grant execute on function get_user_id_by_email to authenticated;

-- Allow experiments to store a custom experiment date
alter table experiments
  add column if not exists experiment_date date default now();
