// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T08: HMAC-SHA256 auth
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

describe('F17-T08: HMAC-SHA256 auth', { timeout: 30000 }, () => {
  const SECRET = 'test-secret-key';
  const BODY = '{"action":"push","ref":"refs/heads/main"}';

  function sign(body: string, secret: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  }

  it('valid signature returns true', async () => {
    const { verifyHmac } = await import('../../src/cli/hmac-auth');
    const sig = sign(BODY, SECRET);
    expect(verifyHmac(BODY, sig, SECRET)).toBe(true);
  });

  it('tampered body returns false', async () => {
    const { verifyHmac } = await import('../../src/cli/hmac-auth');
    const sig = sign(BODY, SECRET);
    expect(verifyHmac(BODY + 'tampered', sig, SECRET)).toBe(false);
  });

  it('wrong secret returns false', async () => {
    const { verifyHmac } = await import('../../src/cli/hmac-auth');
    const sig = sign(BODY, 'wrong-secret');
    expect(verifyHmac(BODY, sig, SECRET)).toBe(false);
  });

  it('rejects invalid signature format', async () => {
    const { verifyHmac } = await import('../../src/cli/hmac-auth');
    expect(verifyHmac(BODY, 'not-sha256-format', SECRET)).toBe(false);
  });

  it('accepts sha256=hex format', async () => {
    const { verifyHmac } = await import('../../src/cli/hmac-auth');
    const sig = sign(BODY, SECRET);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyHmac(BODY, sig, SECRET)).toBe(true);
  });
});
