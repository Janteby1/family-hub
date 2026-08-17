-- Grocery (and other) list items auto-expire 24h after being checked off.
alter table list_items add column if not exists checked_at timestamptz;

-- Meal planner: replace the breakfast/lunch/dinner grid with a kids/adults
-- dinner split. Drop whatever check constraint currently restricts
-- meal_slot (found dynamically rather than by a guessed name) and replace
-- it with one that also allows the two new slot values.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'meal_plan_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%meal_slot%'
  loop
    execute format('alter table meal_plan_entries drop constraint %I', con.conname);
  end loop;
end $$;

alter table meal_plan_entries add constraint meal_plan_entries_meal_slot_check
  check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'dinner_kids', 'dinner_adults'));

-- Preserve anything already planned under the old generic "dinner" slot by
-- moving it into the new Adults Dinner row — nothing is lost, just
-- re-categorized. Move any individual entry to Kids Dinner by hand
-- afterward if that's actually a better fit for it.
update meal_plan_entries set meal_slot = 'dinner_adults' where meal_slot = 'dinner';
