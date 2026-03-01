import { createHmac, timingSafeEqual } from 'crypto';

export function verifyHmac(body: string, signature: string, secret: string): boolean {
  if (!secret) return false;
  if (!signature.startsWith('sha256=')) return false;

  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
