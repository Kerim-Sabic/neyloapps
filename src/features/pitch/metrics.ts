import { z } from 'zod';

const count=z.number().int().nonnegative();
export const pitchMetricsSchema=z.object({
  asOf:z.iso.datetime({offset:true}),registered:count,neyloVerified:count,imported:count,otherVerified:count,
  independent:count,founderAssisted:count,founding:count,qualifiedReferrals:count,pilotInterest:count,handles:count,
  sources:z.object({direct:count,invitation:count,social:count,outreach:count,scc:count}).strict(),
}).strict().refine(value=>value.registered===value.neyloVerified+value.imported+value.otherVerified,'Verification provenance must reconcile')
  .refine(value=>value.registered===value.independent+value.founderAssisted,'Cohorts must reconcile')
  .refine(value=>value.registered===Object.values(value.sources).reduce((sum,n)=>sum+n,0),'Sources must reconcile');
export type PitchMetrics=z.infer<typeof pitchMetricsSchema>;

export function metricsAreStale(asOf:string,now:number){return now-Date.parse(asOf)>90_000;}

export function opportunityModel(monthlySenders:number,transfersEach:number,averageTransfer:number,feeBps:number){
  const values=[monthlySenders,transfersEach,averageTransfer,feeBps];
  if(values.some(n=>!Number.isSafeInteger(n)||n<0)||monthlySenders>1_000_000||transfersEach>20||averageTransfer>10000||feeBps>1000)throw new Error('Invalid model assumption');
  const volumeMinor=monthlySenders*transfersEach*averageTransfer*100;
  return {volumeMinor,revenueMinor:Math.floor(volumeMinor*feeBps/10_000)};
}
