import 'server-only';
import { database } from '@/core/supabase';
import { rpcResult } from '@/core/rpc';
import { pitchMetricsSchema,type PitchMetrics } from './metrics';

// Per-isolate request coalescing keeps a presentation audience from fanning out
// identical reads. A failed refresh never changes the age of the last snapshot.
let cached:PitchMetrics|undefined;
let pending:Promise<PitchMetrics>|undefined;
export async function publicPitchMetrics():Promise<PitchMetrics>{
  if(cached&&Date.now()-Date.parse(cached.asOf)<15_000)return cached;
  if(pending)return pending;
  pending=rpcResult(database().rpc('neylo_pitch_metrics'),pitchMetricsSchema).then(value=>{cached=value;return value;}).finally(()=>{pending=undefined;});
  return pending;
}
