import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { SafeUser } from '../../common/types/domain.types';
import { toSafeUser } from '../../common/utils/user.util';
import { DataStoreService } from '../../infra/data-store.service';
import { AuditService } from '../audit/audit.service';

export interface LoginResponse {
  token: string;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataStoreService: DataStoreService,
    private readonly auditService: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const data = await this.dataStoreService.readData();
    const user = data.users.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail && item.password === password,
    );

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const token = randomBytes(24).toString('hex');
    const createdAt = new Date().toISOString();
    await this.dataStoreService.updateData((db) => {
      db.sessions = db.sessions.filter((session) => session.userId !== user.id);
      db.sessions.push({ token, userId: user.id, createdAt });
    });

    await this.auditService.logEvent({
      type: 'login',
      actorUserId: user.id,
      metadata: { email: user.email },
    });

    return {
      token,
      user: toSafeUser(user),
    };
  }
}
