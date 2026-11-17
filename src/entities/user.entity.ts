import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { Role } from '../constants/role.constant.js';

@Entity('users')
@Check('users_role_check', `role IN ('CUSTOMER','STAFF','MANAGER')`)
@Index('ux_user_email_ci', { synchronize: false })
export class UserEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'users_pkey' }) id!: string;
  @Column({ type: 'text' }) email!: string;
  @Column({ name: 'password_hash', type: 'text', select: false }) passwordHash!: string;
  @Column({ name: 'full_name', type: 'varchar', length: 150 }) fullName!: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 20 }) role!: Role;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}
