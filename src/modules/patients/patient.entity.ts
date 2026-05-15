export interface Patient {
  id: string;
  clinicId: string;
  nutritionistId: string;
  fullName: string;
  cpf: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  notes?: string;
  preferences?: string[];
  restrictions?: string[];
  preferredDeliveryWindow?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
