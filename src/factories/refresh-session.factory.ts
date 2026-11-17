import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { RefreshSessionEntity } from '../entities/refresh-session.entity.js';
import { hashToken } from '../utils/token.util.js';
@Injectable()
export class RefreshSessionFactory {
  create(userId: string, familyId: string, ttlSeconds: number) {
    const token = randomBytes(32).toString('base64url');
    const entity = Object.assign(new RefreshSessionEntity(), {
      id: randomUUID(),
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      createdAt: new Date(),
      revokedAt: null,
      lastUsedAt: null,
      deviceLabel: null,
    });
    return { token, entity };
  }
}
