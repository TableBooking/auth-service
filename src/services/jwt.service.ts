import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import { AUTH_CONFIG, type AuthConfig } from '../config/env.config.js';
import { USER_ROLES as roles } from '../constants/role.constant.js';
import type { UserEntity } from '../entities/user.entity.js';
import { unauthorized } from '../utils/auth-error.util.js';

@Injectable()
export class JwtService implements OnModuleInit {
  private privateKey!: Awaited<ReturnType<typeof importPKCS8>>;
  private publicKey!: Awaited<ReturnType<typeof importSPKI>>;
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  async onModuleInit() {
    try {
      const privatePem = await readFile(this.config.JWT_PRIVATE_KEY_PATH, 'utf8');
      const privateObject = createPrivateKey(privatePem);
      if (
        privateObject.asymmetricKeyType !== 'rsa' ||
        (privateObject.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
      )
        throw new Error('Invalid RSA private key');
      const publicPem = createPublicKey(privateObject)
        .export({ type: 'spki', format: 'pem' })
        .toString();
      this.privateKey = await importPKCS8(privatePem, 'RS256');
      this.publicKey = await importSPKI(publicPem, 'RS256');
    } catch {
      throw new Error(
        'JWT_PRIVATE_KEY_PATH must contain an RSA PKCS8 private key of at least 2048 bits',
      );
    }
  }
  issue(user: UserEntity) {
    return new SignJWT({ role: user.role, email: user.email })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.privateKey);
  }
  async verify(authorization?: string) {
    const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? '')?.[1];
    if (!token) throw unauthorized();
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        requiredClaims: ['sub', 'role', 'exp'],
      });
      if (
        !payload.sub ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ||
        !roles.includes(payload.role as (typeof roles)[number])
      )
        throw unauthorized();
      return { id: payload.sub, role: payload.role as (typeof roles)[number] };
    } catch {
      throw unauthorized();
    }
  }
}
