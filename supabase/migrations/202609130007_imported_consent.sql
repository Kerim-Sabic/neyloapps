-- Administrative imports can lack a campaign acceptance record. Preserve that
-- absence rather than inventing consent. Ordinary signup still records consent
-- in neylo_hold/finalize; no imported account can become eligible without it.
alter table public.enrollments alter column accepted_at drop not null;
alter table public.enrollments add constraint enrollment_consent_before_eligibility
  check (accepted_at is not null or (eligibility <> 'eligible' and founder_ordinal is null));
