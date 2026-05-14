import { randomUUID } from 'node:crypto';

export function createId(prefix: string): string {
  const compactUuid = randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${compactUuid}`;
}
