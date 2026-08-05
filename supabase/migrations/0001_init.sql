-- Family Hub initial schema

create table family_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) unique,   -- null for kids
  display_name text not null,
  role text not null check (role in ('parent','child')),
  color text not null,
  avatar_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean default false,
  assigned_member_id uuid references family_members(id),
  created_by uuid references family_members(id),
  source text default 'manual' check (source in ('manual','photo_import')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chore_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assigned_member_id uuid references family_members(id),  -- null = up-for-grabs
  is_up_for_grabs boolean default false,
  recurrence text not null default 'daily' check (recurrence in ('daily','weekdays','weekends','weekly','none')),
  recurrence_meta jsonb,
  category text,
  star_value int default 1,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table chore_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references chore_templates(id) on delete cascade,
  occurrence_date date not null,
  claimed_by_member_id uuid references family_members(id),
  completed boolean default false,
  completed_at timestamptz,
  completed_by_member_id uuid references family_members(id),
  unique (template_id, occurrence_date)
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  list_type text default 'general',   -- 'grocery' flagged for recipe pushes
  owner_member_id uuid references family_members(id),
  created_at timestamptz default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text,
  image_url text,
  steps jsonb not null default '[]',
  servings text,
  created_by uuid references family_members(id),
  created_at timestamptz default now()
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  label text not null,
  normalized_label text,
  quantity text,
  checked boolean default false,
  added_by_member_id uuid references family_members(id),
  source text default 'manual' check (source in ('manual','recipe_import')),
  source_recipe_id uuid references recipes(id),
  created_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  raw_text text not null,
  quantity text,
  unit text,
  name text,
  sort_order int default 0
);

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid references recipes(id),
  free_text text,
  unique (plan_date, meal_slot)
);

create table star_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references family_members(id) not null,
  delta int not null,
  reason text not null check (reason in ('chore_completed','redeemed')),
  chore_instance_id uuid references chore_instances(id),
  created_by uuid references family_members(id),
  created_at timestamptz default now()
);

create view star_balances as
  select member_id, coalesce(sum(delta), 0) as balance
  from star_ledger
  group by member_id;

create table module_last_seen (
  auth_user_id uuid references auth.users(id) not null,
  module text not null check (module in ('calendar','tasks','lists','meals','recipes','rewards')),
  last_seen_at timestamptz not null default now(),
  primary key (auth_user_id, module)
);

-- Star ledger: auto-award stars when a chore instance is marked completed,
-- and reverse the award if it's un-checked. Keeps the ledger correct without
-- relying on the client to remember to write a second row.
create or replace function handle_chore_completion() returns trigger as $$
declare
  v_star_value int;
begin
  if (new.completed = true and (old.completed is distinct from true)) then
    select star_value into v_star_value from chore_templates where id = new.template_id;
    insert into star_ledger (member_id, delta, reason, chore_instance_id, created_by)
    values (coalesce(new.completed_by_member_id, new.claimed_by_member_id), coalesce(v_star_value, 1), 'chore_completed', new.id, new.completed_by_member_id);
  elsif (new.completed = false and old.completed = true) then
    delete from star_ledger where chore_instance_id = new.id and reason = 'chore_completed';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger chore_instance_completion
  after update on chore_instances
  for each row
  execute function handle_chore_completion();

-- Row Level Security: everyone in family_members (i.e. Jack and Emily) can
-- read/write everything. This is a closed 2-user household app, not a
-- multi-tenant product, so per-row ownership checks are deliberately skipped.
create or replace function is_household_member() returns boolean as $$
  select exists (select 1 from family_members where auth_user_id = auth.uid());
$$ language sql security definer stable;

alter table family_members enable row level security;
create policy "household can read members" on family_members
  for select using (is_household_member());
create policy "household can update members" on family_members
  for update using (is_household_member()) with check (is_household_member());
-- No insert/delete policy: adding/removing a family member goes through the
-- service role (seed script / admin task), not the open client.

alter table calendar_events enable row level security;
create policy "household read/write" on calendar_events
  for all using (is_household_member()) with check (is_household_member());

alter table chore_templates enable row level security;
create policy "household read/write" on chore_templates
  for all using (is_household_member()) with check (is_household_member());

alter table chore_instances enable row level security;
create policy "household read/write" on chore_instances
  for all using (is_household_member()) with check (is_household_member());

alter table lists enable row level security;
create policy "household read/write" on lists
  for all using (is_household_member()) with check (is_household_member());

alter table list_items enable row level security;
create policy "household read/write" on list_items
  for all using (is_household_member()) with check (is_household_member());

alter table recipes enable row level security;
create policy "household read/write" on recipes
  for all using (is_household_member()) with check (is_household_member());

alter table recipe_ingredients enable row level security;
create policy "household read/write" on recipe_ingredients
  for all using (is_household_member()) with check (is_household_member());

alter table meal_plan_entries enable row level security;
create policy "household read/write" on meal_plan_entries
  for all using (is_household_member()) with check (is_household_member());

alter table star_ledger enable row level security;
create policy "household read/write" on star_ledger
  for all using (is_household_member()) with check (is_household_member());

alter table module_last_seen enable row level security;
create policy "user manages own last_seen rows" on module_last_seen
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Realtime: enable replication on tables that need live cross-device sync
alter publication supabase_realtime add table calendar_events;
alter publication supabase_realtime add table chore_instances;
alter publication supabase_realtime add table list_items;
alter publication supabase_realtime add table meal_plan_entries;
alter publication supabase_realtime add table star_ledger;
