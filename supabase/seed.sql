-- Seed family members. Run after creating Jack and Emily's auth.users
-- accounts (Supabase Dashboard > Authentication > Users), then paste their
-- generated auth user IDs in place of the placeholders below.

insert into family_members (auth_user_id, display_name, role, color, sort_order) values
  ('REPLACE_WITH_JACK_AUTH_USER_ID', 'Jack', 'parent', '#2563eb', 0),
  ('REPLACE_WITH_EMILY_AUTH_USER_ID', 'Emily', 'parent', '#db2777', 1);

insert into family_members (display_name, role, color, sort_order) values
  ('Abe', 'child', '#16a34a', 2),
  ('Victoria', 'child', '#9333ea', 3),
  ('Alan', 'child', '#ea580c', 4);

-- A default grocery list so the Lists module has something to show on first load.
insert into lists (name, list_type) values ('Grocery List', 'grocery');
