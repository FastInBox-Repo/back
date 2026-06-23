export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type SubscriptionCadence = 'weekly' | 'biweekly' | 'monthly';

export interface SubscriptionItem {
  compositionId?: string;
  packagingId: string;
  quantity: number;
}

export interface Subscription {
  id: string;
  clinicId: string;
  nutritionistId: string;
  patientId: string;
  status: SubscriptionStatus;
  cadence: SubscriptionCadence;
  items: SubscriptionItem[];
  deliveryWindow: { slot: string; regionCode?: string };
  estimatedTotalCents: number;
  startDate: string; // ISO yyyy-mm-dd
  nextRunDate: string; // ISO yyyy-mm-dd
  lastRunDate?: string;
  generatedOrderIds: string[];
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}

export const CADENCE_DAYS: Record<SubscriptionCadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};
