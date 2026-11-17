import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { RefreshSessionEntity } from '../entities/refresh-session.entity.js';
@Injectable()
export class RefreshSessionRepository {
  constructor(private readonly dataSource: DataSource) {}
  private repository(manager: EntityManager) {
    return manager.getRepository(RefreshSessionEntity);
  }
  findByHash(tokenHash: string, manager: EntityManager, lock = false) {
    const query = this.repository(manager)
      .createQueryBuilder('session')
      .where('session.tokenHash = :tokenHash', { tokenHash });
    if (lock) query.setLock('pessimistic_write');
    return query.getOne();
  }
  async insert(session: RefreshSessionEntity, manager: EntityManager) {
    await this.repository(manager).insert(session);
  }
  async consume(id: string, manager: EntityManager) {
    await this.repository(manager).update(
      { id },
      { revokedAt: new Date(), lastUsedAt: new Date() },
    );
  }
  async revokeFamily(familyId: string, manager: EntityManager) {
    await this.revoke('family_id', familyId, manager);
  }
  async revokeUser(userId: string, manager: EntityManager) {
    await this.revoke('user_id', userId, manager);
  }
  private async revoke(column: 'family_id' | 'user_id', value: string, manager: EntityManager) {
    await this.repository(manager)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: () => 'COALESCE(revoked_at, now())' })
      .where(`${column} = :value`, { value })
      .execute();
  }
  async isExpired(session: RefreshSessionEntity, manager: EntityManager) {
    // Compare against the database clock, including while holding a transaction lock.
    const row = await this.repository(manager)
      .createQueryBuilder('session')
      .select('session.expiresAt <= now()', 'expired')
      .where('session.id = :id', { id: session.id })
      .getRawOne<{ expired: boolean }>();
    return row?.expired ?? true;
  }
  async isReady() {
    await this.dataSource
      .getRepository(RefreshSessionEntity)
      .createQueryBuilder('session')
      .select('session.id')
      .limit(1)
      .getMany();
  }
}
