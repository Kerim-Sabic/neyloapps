-- This service-only function never creates an identity and never trusts editable user metadata.
create function public.neylo_bootstrap_owner(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; begin
  if p_email <> 'kerim@horalix.com' then raise exception 'OWNER_EMAIL_MISMATCH'; end if;
  select id into strict v_user from auth.users where lower(email)=p_email and email_confirmed_at is not null;
  insert into public.admin_memberships(user_id,role) values(v_user,'operator') on conflict(user_id) do nothing;
  if found then
    insert into public.admin_audit_log(actor_id,action,target_id,reason) values(v_user,'owner_bootstrap',v_user::text,'Explicit owner email supplied by the project operator');
  end if;
  return v_user;
end; $$;
revoke all on function public.neylo_bootstrap_owner(text) from public,anon,authenticated;
grant execute on function public.neylo_bootstrap_owner(text) to service_role;
