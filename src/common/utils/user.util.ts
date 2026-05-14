import type { SafeUser, UserRecord } from '../types/domain.types';

export function toSafeUser(user: UserRecord): SafeUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
