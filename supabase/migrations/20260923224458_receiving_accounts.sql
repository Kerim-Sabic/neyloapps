-- User-entered receiving destinations. No payment execution or ownership verification.
create table public.receiving_accounts (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  account_name text not null check (length(account_name) between 2 and 100),
  iban text not null check (iban ~ '^BA39[0-9]{16}$'),
  bank_name text not null check (length(bank_name) between 2 and 100),
  bic text not null default '' check (bic = '' or bic ~ '^[A-Z]{4}BA[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  discoverable boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.receiving_accounts enable row level security;
revoke all on public.receiving_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.receiving_accounts to service_role;

create table public.receiving_account_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(user_id) on delete cascade,
  target_id uuid not null references public.profiles(user_id) on delete cascade,
  action text not null check (action in ('saved','removed','instructions_revealed')),
  version uuid,
  created_at timestamptz not null default now()
);
alter table public.receiving_account_events enable row level security;
revoke all on public.receiving_account_events from public, anon, authenticated;
grant select, insert on public.receiving_account_events to service_role;
grant usage on sequence public.receiving_account_events_id_seq to service_role;

-- Invoker-only: no publicly callable security-definer function.
-- p_user_id is supplied exclusively by requireAccount() on the server.
create function public.neylo_receiving(p_user_id uuid, p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.receiving_accounts; v_handle text; v_target uuid; v_remainder integer := 0; v_digits text; i integer;
begin
  if not exists(select 1 from public.profiles where user_id=p_user_id) then raise exception 'ACCOUNT_REQUIRED'; end if;
  if p_action in ('save','remove') then
    perform 1 from public.profiles where user_id=p_user_id for update;
    select * into r from public.receiving_accounts where user_id=p_user_id for update;
    if r.version is distinct from (p_data->>'version')::uuid then raise exception 'DESTINATION_CHANGED'; end if;
    if p_action='remove' then
      delete from public.receiving_accounts where user_id=p_user_id;
      insert into public.receiving_account_events(actor_id,target_id,action,version) values(p_user_id,p_user_id,'removed',r.version);
      return null;
    end if;
    if p_data->>'iban' is null or p_data->>'iban' !~ '^BA39[0-9]{16}$' then raise exception 'INVALID_INPUT'; end if;
    v_digits := substring(p_data->>'iban' from 5) || '111039';
    for i in 1..length(v_digits) loop v_remainder := (v_remainder*10 + substring(v_digits from i for 1)::integer)%97; end loop;
    if v_remainder<>1 or p_data->>'accountName' ~ '[[:cntrl:]<>]' or p_data->>'bankName' ~ '[[:cntrl:]<>]' then raise exception 'INVALID_INPUT'; end if;
    insert into public.receiving_accounts(user_id,account_name,iban,bank_name,bic,discoverable)
    values(p_user_id,p_data->>'accountName',p_data->>'iban',p_data->>'bankName',coalesce(p_data->>'bic',''),(p_data->>'discoverable')::boolean)
    on conflict(user_id) do update set account_name=excluded.account_name,iban=excluded.iban,bank_name=excluded.bank_name,bic=excluded.bic,discoverable=excluded.discoverable,version=gen_random_uuid(),updated_at=now()
    returning * into r;
    insert into public.receiving_account_events(actor_id,target_id,action,version) values(p_user_id,p_user_id,'saved',r.version);
  elsif p_action='get' then
    select * into r from public.receiving_accounts where user_id=p_user_id;
  elsif p_action in ('lookup','prepare') then
    select p.user_id,p.handle into v_target,v_handle from public.profiles p
    join public.receiving_accounts a on a.user_id=p.user_id and a.discoverable
    where p.handle=p_data->>'handle' and p.user_id<>p_user_id and not p.review_required;
    if v_target is null then return null; end if;
    select * into r from public.receiving_accounts where user_id=v_target and discoverable for share;
    if r.user_id is null then return null; end if;
    if p_action='lookup' then
      return jsonb_build_object('handle',v_handle,'accountName',r.account_name,'bankName',r.bank_name,'last4',right(r.iban,4),'version',r.version,'verification','self_declared','currency','BAM');
    end if;
    if r.version is distinct from (p_data->>'version')::uuid then raise exception 'DESTINATION_CHANGED'; end if;
    insert into public.receiving_account_events(actor_id,target_id,action,version) values(p_user_id,v_target,'instructions_revealed',r.version);
  else raise exception 'INVALID_INPUT'; end if;
  if r.user_id is null then return null; end if;
  return jsonb_build_object('accountName',r.account_name,'iban',r.iban,'bankName',r.bank_name,'bic',r.bic,'discoverable',r.discoverable,'version',r.version,'verification','self_declared','currency','BAM');
end;
$$;
revoke all on function public.neylo_receiving(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.neylo_receiving(uuid,text,jsonb) to service_role;
