import { z } from 'zod';
import { cohortSchema,sourceSchema } from '@/lib/domain';
export const accountsFilterSchema=z.object({
  search:z.string().trim().max(254).default(''),
  cohort:z.enum(['all','participants','independent','founder_assisted','staff','test','compensated']).default('all'),
  page:z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const registeredAccountsSchema=z.object({
  asOf:z.string(),search:z.string(),cohort:z.string(),page:z.number(),pageSize:z.number(),total:z.number(),
  accounts:z.array(z.object({id:z.uuid(),handle:z.string(),email:z.email(),completedAt:z.string(),cohort:cohortSchema,source:sourceSchema})),
});
export type RegisteredAccounts=z.infer<typeof registeredAccountsSchema>;
