import type { Currency } from './international';

export type ApprovedCorridor = { senderCountry:string; recipientCountry:string; bankCountry:string; currency:Currency };
/** Contract for a future server-side adapter. Never implement execution in the UI. */
export type ProviderCapabilities = {
  providerId: string;
  /** Legacy display hint; execution authorization uses exact corridors. */
  domesticBamP2P: boolean;
  corridors: readonly ApprovedCorridor[];
  funding: readonly ('bank_authorization' | 'hosted_card' | 'partner_wallet')[];
  payout: readonly ('bank_account' | 'partner_wallet')[];
  recipientVerification: boolean;
  execution: boolean;
};

export const paymentCapabilities: ProviderCapabilities = Object.freeze({
  providerId: 'not_connected', domesticBamP2P: false, corridors:Object.freeze([]),
  funding: Object.freeze([]), payout: Object.freeze([]),
  recipientVerification: false, execution: false,
});

export type ProviderPaymentStatus = 'awaiting_authorization' | 'processing' | 'unknown' | 'completed' | 'failed' | 'refund_pending' | 'refunded';
export type ApprovedPayment = {
  orderId: string;
  idempotencyKey: string;
  senderCustomerId: string;
  verifiedRecipientId: string;
  quoteId: string;
  amountMinor: number;
  currency: Currency;
  corridor: ApprovedCorridor;
};
export type ProviderResult = {
  providerReference: string;
  status: ProviderPaymentStatus;
  /** Required evidence for completed: usable recipient funds, not just API acceptance. */
  recipientAvailableAt?: string;
};
export interface PaymentProvider {
  readonly capabilities: ProviderCapabilities;
  authorize(payment: ApprovedPayment): Promise<{ providerReference: string; authorizationUrl: string }>;
  getStatus(providerReference: string): Promise<ProviderResult>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<{ eventId: string; result: ProviderResult }>;
}

/** Fail closed, including when someone adds an execution environment variable. */
export function assertExecutionAvailable(capabilities = paymentCapabilities, corridor:ApprovedCorridor={senderCountry:'BA',recipientCountry:'BA',bankCountry:'BA',currency:'BAM'}): void {
  if (!capabilities.execution || !capabilities.corridors.some(c=>c.senderCountry===corridor.senderCountry&&c.recipientCountry===corridor.recipientCountry&&c.bankCountry===corridor.bankCountry&&c.currency===corridor.currency) || !capabilities.recipientVerification || !capabilities.funding.length || !capabilities.payout.length) {
    throw new Error('Integrated payments are not available.');
  }
}
