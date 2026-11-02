alter table recipes add column if not exists category text;
alter table recipes add column if not exists kosher_type text check (kosher_type in ('meat','dairy','parve'));
alter table recipes add column if not exists notes text;

create index if not exists recipes_category_idx on recipes (category);
create index if not exists recipes_kosher_type_idx on recipes (kosher_type);
