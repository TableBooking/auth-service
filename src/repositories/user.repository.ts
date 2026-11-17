import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { UserEntity } from '../entities/user.entity.js';
import { ROLE } from '../constants/role.constant.js';
import { ACCOUNT_STATUS_LOCK } from '../constants/auth.constant.js';
@Injectable()
export class UserRepository {
  constructor(private readonly dataSource: DataSource) {}
  private repository(manager = this.dataSource.manager) {
    return manager.getRepository(UserEntity);
  }
  findById(id: string, manager?: EntityManager) {
    return this.repository(manager).findOneBy({ id });
  }
  findCredentialsByEmail(email: string) {
    return this.repository()
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email: email.toLowerCase() })
      .getOne();
  }
  lockById(id: string, manager: EntityManager) {
    return this.repository(manager)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }
  async insert(user: UserEntity) {
    await this.repository().insert(user);
    return user;
  }
  async updateProfile(id: string, input: { fullName?: string; phone?: string }) {
    const changes = { ...input, updatedAt: new Date() };
    await this.repository().update({ id }, changes);
    return this.findById(id);
  }
  async updatePassword(id: string, passwordHash: string, manager: EntityManager) {
    await this.repository(manager).update({ id }, { passwordHash, updatedAt: new Date() });
  }
  listStaff(page: number, limit: number) {
    return this.repository().findAndCount({
      where: { role: ROLE.STAFF },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }
  countActiveManagers(manager: EntityManager) {
    return this.repository(manager).countBy({ role: ROLE.MANAGER, active: true });
  }
  async lockStatusChanges(manager: EntityManager) {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [ACCOUNT_STATUS_LOCK]);
  }
  async updateStatus(id: string, active: boolean, manager: EntityManager) {
    await this.repository(manager).update({ id }, { active, updatedAt: new Date() });
    return this.findById(id, manager);
  }
}
