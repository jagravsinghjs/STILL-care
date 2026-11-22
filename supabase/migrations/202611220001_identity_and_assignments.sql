begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (char_length(full_name)<=120),
 email text not null, role text not null default 'patient' check(role in ('patient','consultant')),
 avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.consultants (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 consultant_id text not null unique default ('STILL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 verification_status text not null default 'pending' check(verification_status in ('pending','approved','revoked')),
 professional_description text not null default '' check(char_length(professional_description)<=1000)
);
create table public.consultant_requests (
 request_id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.profiles(user_id) on delete cascade,
 consultant_id text not null references public.consultants(consultant_id),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index one_pending_request on public.consultant_requests(patient_id) where status='pending';
create index consultant_request_inbox on public.consultant_requests(consultant_id,created_at desc);
create table public.consultant_assignments (
 patient_id uuid primary key references public.profiles(user_id) on delete cascade,
 consultant_id text not null references public.consultants(consultant_id), approved_at timestamptz not null default now()
);
create index consultant_caseload on public.consultant_assignments(consultant_id);
create table public.notifications (
 notification_id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(user_id) on delete cascade,
 notification_type text not null check(notification_type in ('assignment_request','accepted','rejected')),
 related_record_id uuid not null references public.consultant_requests(request_id) on delete cascade,
 read_at timestamptz, created_at timestamptz not null default now(),
 unique(recipient_id,notification_type,related_record_id)
);
create index notification_inbox on public.notifications(recipient_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.consultants enable row level security;
alter table public.consultant_requests enable row level security;
alter table public.consultant_assignments enable row level security;
alter table public.notifications enable row level security;
-- Writes only through narrow RPCs or administrative SQL. JWT user_metadata never grants a role.
revoke all on public.profiles,public.consultants,public.consultant_requests,public.consultant_assignments,public.notifications from anon,authenticated;
grant select on public.profiles,public.consultants,public.consultant_requests,public.consultant_assignments,public.notifications to authenticated;
create policy own_profile on public.profiles for select to authenticated using(user_id=auth.uid());
create policy own_consultant on public.consultants for select to authenticated using(user_id=auth.uid());
create policy own_requests on public.consultant_requests for select to authenticated using(patient_id=auth.uid() or consultant_id in (select consultant_id from public.consultants where user_id=auth.uid() and verification_status='approved'));
create policy own_assignments on public.consultant_assignments for select to authenticated using(patient_id=auth.uid() or consultant_id in (select consultant_id from public.consultants where user_id=auth.uid() and verification_status='approved'));
create policy own_notifications on public.notifications for select to authenticated using(recipient_id=auth.uid());

create function public.valid_consultant(code text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.consultants c join public.profiles p on p.user_id=c.user_id where c.consultant_id=code and c.verification_status='approved' and p.role='consultant');
$$;

create function public.handle_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare cid text; rid uuid; consultant_user uuid;
begin
 if TG_OP='INSERT' then
  insert into public.profiles(user_id,email) values(new.id,coalesce(new.email,''));
 else
  update public.profiles set email=coalesce(new.email,''),updated_at=now() where user_id=new.id;
 end if;
 -- Confirmed identity creates a single request, never an assignment. Metadata contains only a requested ID.
 if new.email_confirmed_at is not null and (TG_OP='INSERT' or old.email_confirmed_at is null) then
  cid := new.raw_user_meta_data->>'consultant_id';
  if cid is not null and public.valid_consultant(cid) then
   select user_id into consultant_user from public.consultants where consultant_id=cid;
   insert into public.consultant_requests(patient_id,consultant_id) values(new.id,cid) returning request_id into rid;
   insert into public.notifications(recipient_id,notification_type,related_record_id) values(consultant_user,'assignment_request',rid);
  end if;
 end if;
 return new;
end $$;
create trigger still_identity after insert or update of email,email_confirmed_at on auth.users for each row execute function public.handle_identity();
-- Existing Auth accounts receive patient roles only; approval is an explicit administrator action.
insert into public.profiles(user_id,email) select id,coalesce(email,'') from auth.users on conflict do nothing;

create function public.identity_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; c public.consultants; result jsonb;
begin
 select * into p from public.profiles where user_id=auth.uid();
 if p.user_id is null then raise exception 'Profile unavailable' using errcode='42501'; end if;
 select * into c from public.consultants where user_id=p.user_id and verification_status='approved' and p.role='consultant';
 if p.role='consultant' and c.user_id is null then raise exception 'Consultant approval required' using errcode='42501'; end if;
 result := jsonb_build_object('profile',to_jsonb(p),'consultant',to_jsonb(c));
 return result || jsonb_build_object(
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('display_identifier',coalesce(nullif(pp.full_name,''),pp.email))) from public.consultant_assignments a join public.profiles pp on pp.user_id=a.patient_id where a.patient_id=p.user_id or a.consultant_id=c.consultant_id),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('display_identifier',coalesce(nullif(pp.full_name,''),pp.email))) from public.consultant_requests r join public.profiles pp on pp.user_id=r.patient_id where r.patient_id=p.user_id or r.consultant_id=c.consultant_id),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('consultant_id',cc.consultant_id,'display_name',cp.full_name,'email',cp.email)) from public.consultants cc join public.profiles cp on cp.user_id=cc.user_id where cc.verification_status='approved' and (cc.user_id=p.user_id or cc.consultant_id in (select consultant_id from public.consultant_assignments where patient_id=p.user_id union select consultant_id from public.consultant_requests where patient_id=p.user_id))),'[]'::jsonb)
 );
end $$;

create function public.review_request(identifier uuid, accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.consultant_requests; cid text; outcome text;
begin
 select c.consultant_id into cid from public.consultants c join public.profiles p on p.user_id=c.user_id where c.user_id=auth.uid() and c.verification_status='approved' and p.role='consultant';
 select * into r from public.consultant_requests where request_id=identifier and consultant_id=cid for update;
 if r.request_id is null then raise exception 'Request unavailable' using errcode='42501'; end if;
 if r.status<>'pending' then raise exception 'Already reviewed' using errcode='23505'; end if;
 outcome := case when accept then 'accepted' else 'rejected' end;
 if accept then insert into public.consultant_assignments(patient_id,consultant_id) values(r.patient_id,cid); end if;
 update public.consultant_requests set status=outcome,reviewed_at=now() where request_id=identifier;
 update public.notifications set read_at=now() where recipient_id=auth.uid() and related_record_id=identifier;
 insert into public.notifications(recipient_id,notification_type,related_record_id) values(r.patient_id,outcome,identifier);
 return jsonb_build_object('status',outcome);
end $$;

create function public.save_identity(name text, description text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if char_length(name)>120 or (description is not null and char_length(description)>1000) then raise exception 'Invalid profile' using errcode='22023'; end if;
 update public.profiles set full_name=trim(name),updated_at=now() where user_id=auth.uid();
 if description is not null then
  update public.consultants set professional_description=description where user_id=auth.uid() and verification_status='approved';
  if not found then raise exception 'Approval required' using errcode='42501'; end if;
 end if;
end $$;
create function public.read_notification(identifier uuid) returns void language sql security definer set search_path='' as $$
 update public.notifications set read_at=now() where notification_id=identifier and recipient_id=auth.uid();
$$;
revoke all on function public.handle_identity() from public,anon,authenticated;
revoke all on function public.valid_consultant(text),public.identity_snapshot(),public.review_request(uuid,boolean),public.save_identity(text,text),public.read_notification(uuid) from public,anon,authenticated;
grant execute on function public.valid_consultant(text) to anon,authenticated;
grant execute on function public.identity_snapshot(),public.review_request(uuid,boolean),public.save_identity(text,text),public.read_notification(uuid) to authenticated;
commit;
