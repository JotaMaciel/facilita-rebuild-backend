import { randomBytes, createHash } from 'node:crypto';
export const randomToken = () => randomBytes(32).toString('base64url');
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
export const expiresAt = minutes => new Date(Date.now() + minutes * 60000);
