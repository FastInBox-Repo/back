import type { Request } from 'express';
import type { SafeUser } from './domain.types';

export interface AuthenticatedRequest extends Request {
  currentUser?: SafeUser;
  authToken?: string;
}
