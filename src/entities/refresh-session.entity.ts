import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('refresh_sessions')
@Unique('refresh_sessions_token_hash_key', ['tokenHash'])
@Index('ix_sessions_user', ['userId', 'expiresAt'])
@Index('ix_sessions_family', ['familyId'])
export class RefreshSessionEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'refresh_sessions_pkey' }) id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'refresh_sessions_user_id_fkey' })
  user!: Relation<UserEntity>;
  @Column({ name: 'token_hash', type: 'text', select: false }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ name: 'device_label', type: 'text', nullable: true }) deviceLabel!: string | null;
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true }) lastUsedAt!: Date | null;
  @Column({ name: 'family_id', type: 'uuid' }) familyId!: string;
}
