import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { IngredientsService } from './ingredients.service';

interface CreateIngredientBody {
  name?: string;
  unit?: string;
  caloriesPerUnit?: number;
}

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @Roles('admin', 'nutricionista', 'cozinha')
  listIngredients() {
    return this.ingredientsService.listIngredients();
  }

  @Post()
  @Roles('admin')
  createIngredient(@Body() body: CreateIngredientBody) {
    return this.ingredientsService.createIngredient(body);
  }
}
