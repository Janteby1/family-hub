-- Badge/notification counters: track "new since I last looked" per module.

-- chore_instances and meal_plan_entries didn't need a created_at column
-- until now (badge counting needs to know what's new).
alter table chore_instances add column created_at timestamptz not null default now();
alter table meal_plan_entries add column created_at timestamptz not null default now();

create or replace function get_badge_counts()
returns table (module text, count bigint)
language plpgsql
security definer
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_current_member_id uuid;
  v_calendar_last timestamptz;
  v_tasks_last timestamptz;
  v_lists_last timestamptz;
  v_meals_last timestamptz;
  v_recipes_last timestamptz;
begin
  -- security definer bypasses RLS on purpose (it needs to aggregate across
  -- the household), so guard explicitly against an unauthenticated caller
  -- rather than relying on the underlying tables' policies.
  if v_auth_user_id is null then
    return;
  end if;

  select id into v_current_member_id from family_members where auth_user_id = v_auth_user_id;
  if v_current_member_id is null then
    return;
  end if;

  select last_seen_at into v_calendar_last from module_last_seen where auth_user_id = v_auth_user_id and module = 'calendar';
  select last_seen_at into v_tasks_last from module_last_seen where auth_user_id = v_auth_user_id and module = 'tasks';
  select last_seen_at into v_lists_last from module_last_seen where auth_user_id = v_auth_user_id and module = 'lists';
  select last_seen_at into v_meals_last from module_last_seen where auth_user_id = v_auth_user_id and module = 'meals';
  select last_seen_at into v_recipes_last from module_last_seen where auth_user_id = v_auth_user_id and module = 'recipes';

  return query
  select 'calendar'::text, count(*)
    from calendar_events
    where created_at > coalesce(v_calendar_last, 'epoch'::timestamptz)
      and created_by is distinct from v_current_member_id
  union all
  select 'tasks'::text, count(*)
    from chore_instances ci
    join chore_templates ct on ct.id = ci.template_id
    where ci.occurrence_date = current_date
      and ci.created_at > coalesce(v_tasks_last, 'epoch'::timestamptz)
      and not ci.completed
      and (ct.assigned_member_id = v_current_member_id or ct.is_up_for_grabs)
  union all
  select 'lists'::text, count(*)
    from list_items
    where created_at > coalesce(v_lists_last, 'epoch'::timestamptz)
      and added_by_member_id is distinct from v_current_member_id
  union all
  select 'meals'::text, count(*)
    from meal_plan_entries
    where created_at > coalesce(v_meals_last, 'epoch'::timestamptz)
  union all
  select 'recipes'::text, count(*)
    from recipes
    where created_at > coalesce(v_recipes_last, 'epoch'::timestamptz)
      and created_by is distinct from v_current_member_id;
end;
$$;

revoke execute on function get_badge_counts() from public, anon;
grant execute on function get_badge_counts() to authenticated;
