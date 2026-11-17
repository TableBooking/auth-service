import { generateKeyPairSync } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('keys');
const privatePath = resolve(directory, 'auth-private.pem');
const publicPath = resolve(directory, 'auth-public.pem');
for (const path of [privatePath, publicPath]) {
  try {
    await access(path);
    throw new Error('Keys already exist; refusing to overwrite');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await mkdir(directory, { recursive: true });
const pair = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
await writeFile(privatePath, pair.privateKey, { flag: 'wx', mode: 0o600 });
await writeFile(publicPath, pair.publicKey, { flag: 'wx', mode: 0o644 });
console.log('RSA keys generated in keys/. Share only the public key with Gateway/services.');
