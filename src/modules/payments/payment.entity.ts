export type PaymentIntentStatus =
  | 'pending'
  | 'authorized'
  | 'approved'
  | 'failed'
  | 'refunded'
  | 'expired';

export interface PaymentIntent {
  id: string;
  providerIntentId: string;
  orderId: string;
  amountCents: number;
  currency: 'BRL';
  status: PaymentIntentStatus;
  redirectUrl: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  processingResult: 'pending' | 'processed' | 'failed_terminal' | 'duplicated';
  processedAt?: Date;
  attempts: number;
  createdAt: Date;
}
