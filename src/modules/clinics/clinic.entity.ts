export interface Clinic {
  id: string;
  slug: string;
  name: string;
  cnpj: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  status: 'active' | 'suspended';
  commissionTiers: { upToCents: number; rate: number }[];
  createdAt: Date;
  updatedAt: Date;
}
