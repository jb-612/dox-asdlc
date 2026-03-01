// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T11: Webhook settings
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F17-T11: Webhook settings', { timeout: 30000 }, () => {
  it('IPC channels include webhook settings', async () => {
    const { IPC_CHANNELS } = await import('../../src/shared/ipc-channels');
    expect(IPC_CHANNELS.SETTINGS_LOAD).toBeDefined();
    expect(IPC_CHANNELS.SETTINGS_SAVE).toBeDefined();
  });

  it('webhookPort defaults to 9480', async () => {
    const { DEFAULT_SETTINGS } = await import('../../src/shared/types/settings');
    expect(DEFAULT_SETTINGS.webhookPort).toBe(9480);
  });

  it('webhookSecret is defined in settings', async () => {
    const { DEFAULT_SETTINGS } = await import('../../src/shared/types/settings');
    expect(DEFAULT_SETTINGS).toHaveProperty('webhookSecret');
    expect(typeof DEFAULT_SETTINGS.webhookSecret).toBe('string');
  });
});
