import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { newId, nowUtc } from '../../common/ids';
import type { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  private readonly users = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

  hashPassword(plain: string): string {
    return createHash('sha256').update(`fastinbox:${plain}`).digest('hex');
  }

  verifyPassword(plain: string, hash: string): boolean {
    return this.hashPassword(plain) === hash;
  }

  create(input: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    clinicId?: string;
  }): User {
    const email = input.email.toLowerCase().trim();
    if (this.emailIndex.has(email)) {
      throw new Error(`USER_EMAIL_TAKEN:${email}`);
    }
    const now = nowUtc();
    const user: User = {
      id: newId(),
      email,
      passwordHash: this.hashPassword(input.password),
      fullName: input.fullName,
      role: input.role,
      clinicId: input.clinicId,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.emailIndex.set(email, user.id);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findByEmail(email: string): User | undefined {
    const id = this.emailIndex.get(email.toLowerCase().trim());
    return id ? this.users.get(id) : undefined;
  }

  list(filter: { clinicId?: string; role?: UserRole } = {}): User[] {
    return [...this.users.values()].filter((u) => {
      if (u.deletedAt) return false;
      if (filter.clinicId && u.clinicId !== filter.clinicId) return false;
      if (filter.role && u.role !== filter.role) return false;
      return true;
    });
  }

  update(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): User {
    const u = this.users.get(id);
    if (!u) throw new Error('USER_NOT_FOUND');
    const next: User = { ...u, ...patch, updatedAt: nowUtc() };
    this.users.set(id, next);
    return next;
  }

  toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clinicId: user.clinicId,
    };
  }
}
