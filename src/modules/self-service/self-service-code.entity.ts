export interface SelfServiceCode {
  code: string;
  clinicId: string;
  nutritionistId: string;
  active: boolean;
  expiresAt: Date;
  createdAt: Date;
  usageCount: number;
}
