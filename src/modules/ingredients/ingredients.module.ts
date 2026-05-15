import { Global, Module } from '@nestjs/common';

import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Global()
@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
