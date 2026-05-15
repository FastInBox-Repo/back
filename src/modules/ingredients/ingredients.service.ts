import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import type { Composition, Ingredient, Packaging } from './ingredient.entity';

@Injectable()
export class IngredientsService {
  private readonly ingredients = new Map<string, Ingredient>();
  private readonly compositions = new Map<string, Composition>();
  private readonly packagings = new Map<string, Packaging>();

  createIngredient(input: Omit<Ingredient, 'id' | 'effectiveAt'>): Ingredient {
    const ingredient: Ingredient = {
      ...input,
      id: newId(),
      effectiveAt: nowUtc(),
    };
    this.ingredients.set(ingredient.id, ingredient);
    return ingredient;
  }

  listIngredients(
    clinicId: string,
    filter: { category?: string; isAvailable?: boolean; q?: string } = {},
  ): Ingredient[] {
    return [...this.ingredients.values()]
      .filter((i) => i.clinicId === clinicId && !i.archivedAt)
      .filter((i) => !filter.category || i.category === filter.category)
      .filter(
        (i) =>
          filter.isAvailable === undefined ||
          i.isAvailable === filter.isAvailable,
      )
      .filter(
        (i) =>
          !filter.q || i.name.toLowerCase().includes(filter.q.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  findIngredient(id: string): Ingredient {
    const i = this.ingredients.get(id);
    if (!i) throw new NotFoundDomainError('INGREDIENT_NOT_FOUND');
    return i;
  }

  createComposition(
    input: Omit<Composition, 'id' | 'createdAt' | 'updatedAt'>,
  ): Composition {
    const now = nowUtc();
    const composition: Composition = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    this.compositions.set(composition.id, composition);
    return composition;
  }

  listCompositions(clinicId: string): Composition[] {
    return [...this.compositions.values()].filter(
      (c) => c.clinicId === clinicId,
    );
  }

  findComposition(id: string): Composition {
    const c = this.compositions.get(id);
    if (!c) throw new NotFoundDomainError('COMPOSITION_NOT_FOUND');
    return c;
  }

  createPackaging(input: Omit<Packaging, 'id'>): Packaging {
    const pack: Packaging = { ...input, id: newId() };
    this.packagings.set(pack.id, pack);
    return pack;
  }

  listPackagings(clinicId: string): Packaging[] {
    return [...this.packagings.values()].filter((p) => p.clinicId === clinicId);
  }

  findPackaging(id: string): Packaging {
    const p = this.packagings.get(id);
    if (!p) throw new NotFoundDomainError('PACKAGING_NOT_FOUND');
    return p;
  }
}
