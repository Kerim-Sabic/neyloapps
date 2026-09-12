-- Contact details are available only to verified operators through the server.
-- Presenter metrics and exports remain aggregate-only.
create function public.neylo_registered_accounts(
  p_actor uuid, p_search text default '', p_cohort text default 'all',
  p_page integer default 1, p_page_size integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform public.neylo_require_admin(p_actor, true);
  if p_search is null or length(p_search)>254 or p_page is null or p_page<1 or p_page>1000000
    or p_page_size is null or p_page_size<1 or p_page_size>100
    or p_cohort is null or p_cohort not in ('all','participants','independent','founder_assisted','staff','test','compensated')
  then raise exception 'INVALID_INPUT'; end if;
  with matched as materialized (
    select p.user_id, p.handle, u.email, p.completed_at, p.cohort, p.source
    from public.profiles p join auth.users u on u.id=p.user_id
    where u.email_confirmed_at is not null and u.email is not null
      and (p_cohort='all' or (p_cohort='participants' and p.cohort in ('independent','founder_assisted')) or p.cohort::text=p_cohort)
      and (btrim(p_search)='' or strpos(lower(p.handle),lower(btrim(p_search)))>0 or strpos(lower(u.email),lower(btrim(p_search)))>0)
  ), page_rows as (
    select * from matched order by completed_at desc,user_id
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object('asOf',now(),'search',btrim(p_search),'cohort',p_cohort,'page',p_page,'pageSize',p_page_size,
    'total',(select count(*) from matched),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'handle',handle,'email',email,
      'completedAt',completed_at,'cohort',cohort,'source',source) order by completed_at desc,user_id) from page_rows),'[]'::jsonb)) into v_result;
  return v_result;
end; $$;
revoke all on function public.neylo_registered_accounts(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.neylo_registered_accounts(uuid,text,text,integer,integer) to service_role;
