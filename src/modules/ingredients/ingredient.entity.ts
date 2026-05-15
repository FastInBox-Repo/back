export type IngredientCategory =
  | 'protein'
  | 'carb'
  | 'vegetable'
  | 'fat'
  | 'extra';
export type UnitOfMeasure = 'g' | 'ml' | 'un';

export interface Ingredient {
  id: string;
  clinicId: string;
  name: string;
  slug: string;
  category: IngredientCategory;
  unitPriceCents: number;
  unitOfMeasure: UnitOfMeasure;
  baseQuantity: number;
  isAvailable: boolean;
  effectiveAt: Date;
  archivedAt?: Date;
  nutritionalInfo?: {
    kcal?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export interface Composition {
  id: string;
  clinicId: string;
  name: string;
  description: string;
  basePriceCents: number;
  items: {
    ingredientId: string;
    quantity: number;
    replaceable: boolean;
    mandatory: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Packaging {
  id: string;
  clinicId: string;
  name: string;
  capacityMl: number;
  unitCostCents: number;
}
