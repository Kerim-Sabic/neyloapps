-- International instruction formats, not live payment corridors or residency eligibility.
create table public.payment_bank_formats(country text primary key, iban_pattern text not null);
create table public.payment_currency_formats(currency text primary key, minor_digits integer not null check(minor_digits between 0 and 4));
alter table public.payment_bank_formats enable row level security;
alter table public.payment_currency_formats enable row level security;
revoke all on public.payment_bank_formats,public.payment_currency_formats from public,anon,authenticated;
grant select on public.payment_bank_formats,public.payment_currency_formats to service_role;
insert into public.payment_bank_formats values
('BA','^BA39[0-9]{16}$'),
('AT','^AT[0-9]{18}$'),
('CH','^CH[0-9]{7}[A-Z0-9]{12}$'),
('CZ','^CZ[0-9]{22}$'),
('DE','^DE[0-9]{20}$'),
('DK','^DK[0-9]{16}$'),
('FR','^FR[0-9]{12}[A-Z0-9]{11}[0-9]{2}$'),
('GB','^GB[0-9]{2}[A-Z]{4}[0-9]{14}$'),
('HR','^HR[0-9]{19}$'),
('NL','^NL[0-9]{2}[A-Z]{4}[0-9]{10}$'),
('NO','^NO[0-9]{13}$'),
('PL','^PL[0-9]{26}$'),
('SE','^SE[0-9]{22}$'),
('SI','^SI[0-9]{17}$');
insert into public.payment_currency_formats values
('AED',2),
('AFN',2),
('ALL',2),
('AMD',2),
('AOA',2),
('ARS',2),
('AUD',2),
('AWG',2),
('AZN',2),
('BAM',2),
('BBD',2),
('BDT',2),
('BHD',3),
('BIF',0),
('BMD',2),
('BND',2),
('BOB',2),
('BRL',2),
('BSD',2),
('BTN',2),
('BWP',2),
('BYN',2),
('BZD',2),
('CAD',2),
('CDF',2),
('CHF',2),
('CLP',0),
('CNY',2),
('COP',2),
('CRC',2),
('CUP',2),
('CVE',2),
('CZK',2),
('DJF',0),
('DKK',2),
('DOP',2),
('DZD',2),
('EGP',2),
('ERN',2),
('ETB',2),
('EUR',2),
('FJD',2),
('FKP',2),
('GBP',2),
('GEL',2),
('GHS',2),
('GIP',2),
('GMD',2),
('GNF',0),
('GTQ',2),
('GYD',2),
('HKD',2),
('HNL',2),
('HTG',2),
('HUF',2),
('IDR',2),
('ILS',2),
('INR',2),
('IQD',3),
('IRR',2),
('ISK',0),
('JMD',2),
('JOD',3),
('JPY',0),
('KES',2),
('KGS',2),
('KHR',2),
('KMF',0),
('KPW',2),
('KRW',0),
('KWD',3),
('KYD',2),
('KZT',2),
('LAK',2),
('LBP',2),
('LKR',2),
('LRD',2),
('LYD',3),
('MAD',2),
('MDL',2),
('MGA',2),
('MKD',2),
('MMK',2),
('MNT',2),
('MOP',2),
('MRU',2),
('MUR',2),
('MVR',2),
('MWK',2),
('MXN',2),
('MYR',2),
('MZN',2),
('NAD',2),
('NGN',2),
('NIO',2),
('NOK',2),
('NPR',2),
('NZD',2),
('OMR',3),
('PAB',2),
('PEN',2),
('PGK',2),
('PHP',2),
('PKR',2),
('PLN',2),
('PYG',0),
('QAR',2),
('RON',2),
('RSD',2),
('RUB',2),
('RWF',0),
('SAR',2),
('SBD',2),
('SCR',2),
('SDG',2),
('SEK',2),
('SGD',2),
('SHP',2),
('SLE',2),
('SOS',2),
('SRD',2),
('SSP',2),
('STN',2),
('SYP',2),
('SZL',2),
('THB',2),
('TJS',2),
('TMT',2),
('TND',3),
('TOP',2),
('TRY',2),
('TTD',2),
('TWD',2),
('TZS',2),
('UAH',2),
('UGX',0),
('USD',2),
('UYU',2),
('UZS',2),
('VES',2),
('VND',0),
('VUV',0),
('WST',2),
('XAF',0),
('XCD',2),
('XCG',2),
('XOF',0),
('XPF',0),
('YER',2),
('ZAR',2),
('ZMW',2),
('ZWG',2);

alter table public.receiving_accounts add column bank_country text not null default 'BA' references public.payment_bank_formats(country);
alter table public.receiving_accounts add column currency text not null default 'BAM' references public.payment_currency_formats(currency);
alter table public.receiving_accounts drop constraint receiving_accounts_iban_check;
alter table public.receiving_accounts drop constraint receiving_accounts_bic_check;
alter table public.receiving_accounts add constraint receiving_accounts_bic_check check(bic='' or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$');

create function public.neylo_valid_iban(p_iban text,p_country text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_raw text; v_digits text:=''; v_char text; v_remainder integer:=0; i integer;
begin
  select iban_pattern into v_pattern from public.payment_bank_formats where country=p_country;
  if p_iban is null or v_pattern is null or p_iban !~ v_pattern then return false; end if;
  v_raw:=substring(p_iban from 5)||substring(p_iban from 1 for 4);
  for i in 1..length(v_raw) loop
    v_char:=substring(v_raw from i for 1);
    v_digits:=v_digits||case when v_char ~ '[A-Z]' then (ascii(v_char)-55)::text else v_char end;
  end loop;
  for i in 1..length(v_digits) loop v_remainder:=(v_remainder*10+substring(v_digits from i for 1)::integer)%97; end loop;
  return v_remainder=1;
end;$$;
revoke all on function public.neylo_valid_iban(text,text) from public,anon,authenticated;
grant execute on function public.neylo_valid_iban(text,text) to service_role;
alter table public.receiving_accounts add constraint receiving_accounts_iban_check check(public.neylo_valid_iban(iban,bank_country));

create or replace function public.neylo_receiving(p_user_id uuid, p_action text, p_data jsonb default '{}')
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
    if not public.neylo_valid_iban(p_data->>'iban',coalesce(p_data->>'bankCountry','BA')) or p_data->>'accountName' ~ '[[:cntrl:]<>]' or p_data->>'bankName' ~ '[[:cntrl:]<>]' then raise exception 'INVALID_INPUT'; end if;
    insert into public.receiving_accounts(user_id,account_name,iban,bank_name,bic,discoverable,bank_country,currency)
    values(p_user_id,p_data->>'accountName',p_data->>'iban',p_data->>'bankName',coalesce(p_data->>'bic',''),(p_data->>'discoverable')::boolean,coalesce(p_data->>'bankCountry','BA'),coalesce(p_data->>'currency','BAM'))
    on conflict(user_id) do update set account_name=excluded.account_name,iban=excluded.iban,bank_name=excluded.bank_name,bic=excluded.bic,discoverable=excluded.discoverable,bank_country=excluded.bank_country,currency=excluded.currency,version=gen_random_uuid(),updated_at=now()
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
      return jsonb_build_object('handle',v_handle,'accountName',r.account_name,'bankName',r.bank_name,'last4',right(r.iban,4),'version',r.version,'verification','self_declared','currency',r.currency,'bankCountry',r.bank_country);
    end if;
    if r.version is distinct from (p_data->>'version')::uuid then raise exception 'DESTINATION_CHANGED'; end if;
    insert into public.receiving_account_events(actor_id,target_id,action,version) values(p_user_id,v_target,'instructions_revealed',r.version);
  else raise exception 'INVALID_INPUT'; end if;
  if r.user_id is null then return null; end if;
  return jsonb_build_object('accountName',r.account_name,'iban',r.iban,'bankName',r.bank_name,'bic',r.bic,'discoverable',r.discoverable,'version',r.version,'verification','self_declared','currency',r.currency,'bankCountry',r.bank_country);
end;
$$;
revoke all on function public.neylo_receiving(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.neylo_receiving(uuid,text,jsonb) to service_role;

