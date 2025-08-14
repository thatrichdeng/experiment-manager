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
create policy "Owners can share experiments" on experiment_shares
for insert with check (
    auth.uid() = (select user_id from experiments where id = experiment_id)
);

-- Allow owners and recipients to view share records
create policy "View share records" on experiment_shares
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() = user_id
);

-- Allow owners to remove shares
create policy "Owners can remove shares" on experiment_shares
for delete using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
);

-- Allow users to view experiments shared with them
create policy "View own or shared experiments" on experiments
for select using (
    auth.uid() = user_id
    or auth.uid() in (select user_id from experiment_shares where experiment_id = id)
);

-- Allow users to view related data of shared experiments
create policy "View shared protocols" on protocols
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() in (select user_id from experiment_shares where experiment_id = protocols.experiment_id)
);

create policy "View shared files" on files
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() in (select user_id from experiment_shares where experiment_id = files.experiment_id)
);

create policy "View shared results" on results
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() in (select user_id from experiment_shares where experiment_id = results.experiment_id)
);

create policy "View shared experiment tags" on experiment_tags
for select using (
    auth.uid() = (select user_id from experiments where id = experiment_id)
    or auth.uid() in (select user_id from experiment_shares where experiment_id = experiment_tags.experiment_id)
);

create policy "View shared tags" on tags
for select using (
    auth.uid() = user_id
    or auth.uid() in (
        select es.user_id
        from experiment_shares es
        join experiment_tags et on es.experiment_id = et.experiment_id
        where et.tag_id = tags.id
    )
);
