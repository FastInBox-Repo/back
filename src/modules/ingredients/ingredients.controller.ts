import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ForbiddenDomainError } from '../../common/domain-errors';
import { IngredientsService } from './ingredients.service';

interface AuthedRequest extends Request {
  user?: { clinicId?: string };
}

@Controller()
export class IngredientsController {
  constructor(private readonly catalog: IngredientsService) {}

  @Get('ingredients')
  listIngredients(@Req() req: AuthedRequest, @Query('q') q?: string) {
    if (!req.user?.clinicId) throw new ForbiddenDomainError('TENANT_REQUIRED');
    return this.catalog.listIngredients(req.user.clinicId, { q });
  }

  @Get('compositions')
  listCompositions(@Req() req: AuthedRequest) {
    if (!req.user?.clinicId) throw new ForbiddenDomainError('TENANT_REQUIRED');
    return this.catalog.listCompositions(req.user.clinicId);
  }

  @Get('packagings')
  listPackagings(@Req() req: AuthedRequest) {
    if (!req.user?.clinicId) throw new ForbiddenDomainError('TENANT_REQUIRED');
    return this.catalog.listPackagings(req.user.clinicId);
  }
}
