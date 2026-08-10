-- Seed data for the Dweck family's own Supabase project (a completely
-- separate project/database from the Antebys' — this file is only ever run
-- against that new project, never against the shared one).
--
-- Run after creating Zeke and Vivian's auth.users accounts (Supabase
-- Dashboard > Authentication > Users), then paste their generated auth user
-- IDs in place of the placeholders below.

insert into family_members (auth_user_id, display_name, role, color, sort_order) values
  ('REPLACE_WITH_ZEKE_AUTH_USER_ID', 'Zeke', 'parent', '#2563eb', 0),
  ('REPLACE_WITH_VIVIAN_AUTH_USER_ID', 'Vivian', 'parent', '#db2777', 1);

insert into family_members (display_name, role, color, sort_order) values
  ('Steven', 'child', '#16a34a', 2),
  ('Joseph', 'child', '#9333ea', 3),
  ('Joanne', 'child', '#ea580c', 4);

-- A default grocery list so the Lists module has something to show on first load.
insert into lists (name, list_type) values ('Grocery List', 'grocery');
