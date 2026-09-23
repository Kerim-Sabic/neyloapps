import 'server-only';
import { z } from 'zod';
import { database } from '@/core/supabase';
import { requireAccount } from '@/features/account/service';
import { limit, requireRecentAuth } from '@/core/security';
import { rpcResult } from '@/core/rpc';
import { AppError } from '@/lib/errors';
import { destinationInputSchema, destinationSchema, handleLookupSchema, recipientSchema } from './receiving-domain';
import type { Json } from '@/lib/database.generated';

async function userFor(operation: string) {
  const { user } = await requireAccount();
  if (process.env.RECEIVING_ACCOUNTS_ENABLED !== 'true') throw new AppError('RECEIVING_UNAVAILABLE', 503);
  await limit(`receiving:${operation}`, user.id, operation === 'lookup' ? 20 : 10, 60);
  return user;
}
function operation(userId: string, action: string, data: Json = {}) {
  return database().rpc('neylo_receiving', { p_user_id: userId, p_action: action, p_data: data });
}
export async function getReceivingAccount() {
  const user = await userFor('get');
  return { destination: await rpcResult(operation(user.id, 'get'), destinationSchema.nullable()) };
}
export async function saveReceivingAccount(input: unknown) {
  const user = await userFor('save');
  await requireRecentAuth(user.id);
  const data = destinationInputSchema.parse(input);
  return { destination: await rpcResult(operation(user.id, 'save', data), destinationSchema) };
}
export async function removeReceivingAccount(input: unknown) {
  const user = await userFor('remove');
  await requireRecentAuth(user.id);
  const data = z.object({version:z.uuid()}).strict().parse(input);
  await rpcResult(operation(user.id, 'remove', data), z.null());
  return { destination: null };
}
export async function lookupRecipient(input: unknown) {
  const user = await userFor('lookup');
  const data = handleLookupSchema.parse(input);
  return { recipient: await rpcResult(operation(user.id, 'lookup', data), recipientSchema.nullable()) };
}
export async function prepareRecipient(input: unknown) {
  const user = await userFor('prepare');
  const data = z.object({handle:z.string().regex(/^[a-z0-9_]{3,20}$/),version:z.uuid()}).strict().parse(input);
  const destination = await rpcResult(operation(user.id, 'prepare', data), destinationSchema.nullable());
  if (!destination) throw new AppError('RECIPIENT_UNAVAILABLE', 409);
  return { destination };
}
