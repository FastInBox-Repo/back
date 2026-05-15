import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../modules/users/user.entity';

export const PUBLIC_KEY = 'route:public';
export const ROLES_KEY = 'route:roles';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
