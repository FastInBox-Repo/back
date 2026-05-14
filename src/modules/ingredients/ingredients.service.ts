import { BadRequestException, Injectable } from '@nestjs/common';
import type { IngredientRecord } from '../../common/types/domain.types';
import { createId } from '../../common/utils/id.util';
import { DataStoreService } from '../../infra/data-store.service';

interface CreateIngredientInput {
  name?: string;
  unit?: string;
  caloriesPerUnit?: number;
}

@Injectable()
export class IngredientsService {
  constructor(private readonly dataStoreService: DataStoreService) {}

  async listIngredients(): Promise<IngredientRecord[]> {
    const data = await this.dataStoreService.readData();
    return data.ingredients;
  }

  async createIngredient(
    payload: CreateIngredientInput,
  ): Promise<IngredientRecord> {
    if (!payload.name || !payload.unit) {
      throw new BadRequestException('name e unit sao obrigatorios.');
    }

    const ingredient: IngredientRecord = {
      id: createId('ing'),
      name: payload.name.trim(),
      unit: payload.unit.trim(),
      caloriesPerUnit: payload.caloriesPerUnit,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await this.dataStoreService.updateData((db) => {
      db.ingredients.push(ingredient);
    });

    return ingredient;
  }
}
