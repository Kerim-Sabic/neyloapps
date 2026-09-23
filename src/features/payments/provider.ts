/** Contract for a future server-side adapter. Never implement execution in the UI. */
export type ProviderCapabilities = {
  providerId: string;
  domesticBamP2P: boolean;
  funding: readonly ('bank_authorization' | 'hosted_card' | 'partner_wallet')[];
  payout: readonly ('bank_account' | 'partner_wallet')[];
  recipientVerification: boolean;
  execution: boolean;
};

export const paymentCapabilities: ProviderCapabilities = Object.freeze({
  providerId: 'not_connected', domesticBamP2P: false,
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
  currency: 'BAM';
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
export function assertExecutionAvailable(capabilities = paymentCapabilities): void {
  if (!capabilities.execution || !capabilities.domesticBamP2P || !capabilities.recipientVerification || !capabilities.funding.length || !capabilities.payout.length) {
    throw new Error('Integrated payments are not available.');
  }
}
