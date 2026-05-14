export type UserRole = 'admin' | 'nutricionista' | 'paciente' | 'cozinha';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  patientId?: string;
  kitchenId?: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface PatientRecord {
  id: string;
  ownerNutritionistId: string;
  name: string;
  email: string;
  dietaryNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientRecord {
  id: string;
  name: string;
  unit: string;
  caloriesPerUnit?: number;
  active: boolean;
  createdAt: string;
}

export interface OrderItemRecord {
  ingredientId: string;
  quantity: number;
  notes?: string;
}

export interface OrderStatusHistoryRecord {
  status: string;
  changedAt: string;
  changedByUserId: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  createdByNutritionistId: string;
  patientId: string;
  kitchenId: string;
  status: string;
  items: OrderItemRecord[];
  notes?: string;
  confirmedByPatient: boolean;
  statusHistory: OrderStatusHistoryRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventRecord {
  id: string;
  type: 'login' | 'patient_created' | 'order_created' | 'order_status_changed';
  actorUserId?: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface DatabaseSchema {
  users: UserRecord[];
  sessions: SessionRecord[];
  patients: PatientRecord[];
  ingredients: IngredientRecord[];
  orders: OrderRecord[];
  auditEvents: AuditEventRecord[];
}

export type SafeUser = Omit<UserRecord, 'password'>;
