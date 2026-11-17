import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, value) => (error ? reject(error) : resolve(value)),
    ),
  );
}
@Injectable()
export class PasswordService {
  async hash(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
  }
  async verify(password: string, hash: string) {
    const [scheme, salt, encoded] = hash.split('$');
    if (scheme !== 'scrypt' || !salt || !encoded) return false;
    const stored = Buffer.from(encoded, 'hex');
    const candidate = await derive(password, salt);
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }
}
