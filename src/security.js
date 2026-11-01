import { randomBytes, scrypt as callbackScrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(callbackScrypt);
const base64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [salt, hex] = (encoded || '').split(':');
  if (!salt || !hex || !/^[a-f\d]{128}$/i.test(hex)) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(hex, 'hex'), actual);
}
export function signToken(user, secret) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ sub: user.id, role: user.papel, jti: randomBytes(16).toString('hex'), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, iss: 'facilita-rebuild', aud: 'facilita-web' });
  const message = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(message).digest('base64url');
  return `${message}.${signature}`;
}
export function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  let received;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const meta = JSON.parse(Buffer.from(header, 'base64url').toString());
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return meta.alg === 'HS256' && meta.typ === 'JWT' && claims.iss === 'facilita-rebuild' && claims.aud === 'facilita-web' && Number.isInteger(claims.iat) && claims.iat <= Math.floor(Date.now() / 1000) && Number.isInteger(claims.exp) && claims.exp > claims.iat && claims.exp > Math.floor(Date.now() / 1000) && typeof claims.sub === 'string' && claims.sub.length > 0 ? claims : null;
  } catch { return null; }
}
