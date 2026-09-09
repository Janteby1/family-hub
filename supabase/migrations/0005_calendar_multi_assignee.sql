alter table calendar_events add column assigned_member_ids uuid[] not null default '{}';

update calendar_events
set assigned_member_ids = array[assigned_member_id]
where assigned_member_id is not null;

alter table calendar_events drop column assigned_member_id;
