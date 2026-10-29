import { describe, expect, it } from 'vitest';
import {
  interpolateWhatsappSetupMessage,
  resolveWhatsappSetupTemplate,
  whatsappSetupChatUrl,
} from './whatsapp-setup';

describe('resolveWhatsappSetupTemplate', () => {
  it('uses the mosque override when present', () => {
    expect(resolveWhatsappSetupTemplate('en', '  Code {{code}}  ')).toBe('Code {{code}}');
  });

  it('falls back to the locale default', () => {
    expect(resolveWhatsappSetupTemplate('en', null)).toContain('{{code}}');
    expect(resolveWhatsappSetupTemplate('ar', '')).toContain('{{code}}');
  });

  it('builds a wa.me url without importing shared helpers', () => {
    const href = whatsappSetupChatUrl(
      '+963999123456',
      interpolateWhatsappSetupMessage(resolveWhatsappSetupTemplate('en', null), {
        mosqueName: 'Test',
        setupUrl: 'https://example.test/setup',
        phone: '+963999123456',
        code: 'AB23DEF4',
        expires: 'soon',
      }),
    );
    expect(href).toContain('https://wa.me/963999123456');
    expect(href).toContain('AB23DEF4');
  });
});
