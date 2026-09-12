import { z } from 'zod';

export const origin = 'https://neylo.xyz';
export const reservedHandles = new Set(['neylo','support','admin','administrator','official','security','api','payments','account','signin','login','help','root','staff','team','founder','billing','abuse','null','undefined','www','judge']);
export const handleSchema = z.string().trim().transform(v => v.replace(/^@/, '').toLowerCase()).pipe(z.string().regex(/^[a-z0-9_]{3,20}$/, 'Use 3–20 letters, numbers, or underscores.').refine(v => !reservedHandles.has(v), 'This name is reserved.'));
export const emailSchema = z.email().max(254).transform(v => v.trim().toLowerCase());
export const codeSchema = z.string().regex(/^\d{6}$/, 'Enter the six-digit code from your email.');
export const invitationCodeSchema = z.string().regex(/^[a-f0-9]{36}$/);
export const cohortSchema = z.enum(['independent','founder_assisted','staff','test','compensated']);
export const sourceSchema = z.enum(['direct','scc','invitation','social','outreach']);

export function formatCredit(minor: number) {
  return `${new Intl.NumberFormat('bs-BA', { maximumFractionDigits: 2 }).format(minor / 100)} KM`;
}

export const campaignSchema = z.object({
  version: z.string(), open: z.boolean(), remaining: z.number().int(), region: z.string().nullable(), minimumAge: z.number(),
  terms: z.string(), privacy: z.string(), publishedAt: z.string().nullable(),
});
export type Campaign = z.infer<typeof campaignSchema>;
export const invitationSchema = z.object({handle:z.string(),code:invitationCodeSchema,mayEarn:z.boolean()});
export type Invitation = z.infer<typeof invitationSchema>;
export const pendingSchema = z.object({email:z.string(),handle:z.string(),expiresAt:z.string(),termsVersion:z.string(),finalized:z.boolean(),lastOtpAt:z.string().nullable()});

export const accountSchema = z.object({
  handle:z.string(),email:z.string(),completedAt:z.string(),cohort:cohortSchema,founderOrdinal:z.number().nullable(),
  eligibility:z.enum(['eligible','excluded','review_required']),termsVersion:z.string(),acceptedAt:z.string(),
  inviteCode:invitationCodeSchema,referralSlots:z.number(),totalMinor:z.number(),welcomeMinor:z.number(),referralMinor:z.number(),
  canInviteForReward:z.boolean(),analyticsConsent:z.boolean(),marketingConsent:z.boolean(),pilotInterest:z.boolean(),deletionStatus:z.string().nullable(),
  entries:z.array(z.object({id:z.string(),type:z.enum(['welcome','referral','reversal']),amountMinor:z.number(),createdAt:z.string()})),
  referrals:z.array(z.object({id:z.string(),status:z.enum(['pending','qualified','review_required','credited','ineligible']),reason:z.string().nullable(),createdAt:z.string()})),
});
export type Account = z.infer<typeof accountSchema>;
export const metricsSchema = z.object({
  asOf:z.string(),from:z.string(),to:z.string(),cohort:z.string(),verifiedCompleted:z.number(),lifetimeVerified:z.number(),
  finalizedHandles:z.number(),foundingAccounts:z.number(),qualifiedReferrals:z.number(),creditedReferrals:z.number(),
  pendingAttempts:z.number(),activeHolds:z.number(),reviewRequired:z.number(),pilotInterest:z.number(),reservedMinor:z.number(),
  grantedMinor:z.number(),reversedMinor:z.number(),configuredCeilingMinor:z.number(),remainingFounders:z.number(),paused:z.boolean(),demoCompletions:z.number(),
  sources:z.array(z.object({source:z.string(),accounts:z.number()})),cohorts:z.array(z.object({cohort:z.string(),accounts:z.number()})),
  recentEvents:z.array(z.object({name:z.string(),at:z.string()})),
});
export type Metrics = z.infer<typeof metricsSchema>;
export const metricsFilterSchema=z.object({
  from:z.iso.datetime().default('2026-01-01T00:00:00.000Z'),
  to:z.iso.datetime().default('2100-01-01T00:00:00.000Z'),
  cohort:z.enum(['participants','independent','founder_assisted','staff','test','compensated','all']).default('participants'),
}).refine(v=>v.from<v.to,'Start must precede end.');
export const startSchema=z.object({handle:handleSchema,email:emailSchema,termsVersion:z.string().max(100),accepted:z.literal(true),
  invitation:invitationCodeSchema.optional(),source:sourceSchema.default('direct'),campaignTag:z.string().max(80).regex(/^[a-zA-Z0-9_-]*$/).default(''),offerDisplayed:z.boolean()}).strict();
export const preferencesSchema=z.object({analytics:z.boolean(),marketing:z.boolean()}).strict();
export const qualificationSchema=z.object({pilot:z.boolean(),useCase:z.string().max(500).default(''),need:z.string().max(500).default('')}).strict();
export const errorSchema=z.object({error:z.object({code:z.string(),message:z.string(),requestId:z.string()})});
