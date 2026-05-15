export type UserRole = 'admin' | 'nutritionist' | 'kitchen' | 'patient';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  clinicId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
