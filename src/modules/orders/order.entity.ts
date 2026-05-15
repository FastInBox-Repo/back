export type OrderStatus =
  | 'DRAFT'
  | 'AWAITING_PATIENT_REVIEW'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'PAID'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'approved'
  | 'failed'
  | 'refunded'
  | 'disputed';

export interface OrderItemCustomization {
  ingredientId: string;
  quantity: number;
  replacedFromIngredientId?: string;
}

export interface OrderItem {
  id: string;
  compositionId?: string;
  packagingId: string;
  quantity: number;
  unitPriceCents: number;
  customizations: OrderItemCustomization[];
  priceVersionSnapshot: { effectiveAt: string; pricingRulesVersion: string };
}

export interface Order {
  id: string;
  code: string;
  clinicId: string;
  nutritionistId: string;
  patientId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  kitchenId?: string;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  commissionCents: number;
  totalCents: number;
  deliveryWindow?: { date: string; slot: string; regionCode?: string };
  notes?: string;
  confirmedAt?: Date;
  paidAt?: Date;
  producedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  eventType: string;
  actorId?: string;
  actorRole?: string;
  previousStatus?: OrderStatus;
  nextStatus?: OrderStatus;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export interface OrderCodeRecord {
  code: string;
  orderId: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
}

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['AWAITING_PATIENT_REVIEW', 'CANCELLED'],
  AWAITING_PATIENT_REVIEW: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['AWAITING_PAYMENT', 'CANCELLED'],
  PAID: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
