-- Run ONLY as project administrator in Supabase SQL Editor, after creating/inviting
-- the account in Authentication > Users. Replace the email and real display name.
-- No service-role credential is required by the application.
begin;
do $$
declare uid uuid;
begin
 select id into uid from auth.users where lower(email)=lower('REPLACE_WITH_CONSULTANT_EMAIL');
 if uid is null then raise exception 'Create this Auth user first'; end if;
 if exists(select 1 from public.consultant_assignments where patient_id=uid) or exists(select 1 from public.consultant_requests where patient_id=uid and status='pending') then
  raise exception 'Use a dedicated consultant account, not an assigned patient';
 end if;
 update public.profiles set role='consultant',full_name='REPLACE_WITH_REAL_NAME',updated_at=now() where user_id=uid;
 insert into public.consultants(user_id,verification_status) values(uid,'approved') on conflict(user_id) do update set verification_status='approved';
end $$;
select p.email,c.consultant_id,c.verification_status from public.consultants c join public.profiles p using(user_id) where p.email='REPLACE_WITH_CONSULTANT_EMAIL';
commit;
