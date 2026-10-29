import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultWhatsappSetupTemplate,
  interpolateWhatsappSetupMessage,
  WhatsappSetupTemplateSchema,
  whatsappSetupChatUrl,
} from './whatsapp-setup.js';

test('interpolates placeholders', () => {
  const body = interpolateWhatsappSetupMessage(defaultWhatsappSetupTemplate('en'), {
    mosqueName: 'Masjid',
    setupUrl: 'https://app.example/setup',
    phone: '+963999001001',
    code: 'AB12CD34',
    expires: '2026-10-30',
  });
  assert.ok(body.includes('Masjid'));
  assert.ok(body.includes('AB12CD34'));
  assert.ok(body.includes('+963999001001'));
});

test('builds wa.me link with encoded code', () => {
  const url = whatsappSetupChatUrl(
    '+963999001001',
    interpolateWhatsappSetupMessage('Code: {{code}}', {
      mosqueName: 'M',
      setupUrl: 'https://x/setup',
      phone: '+963999001001',
      code: 'AB12CD34',
      expires: 'x',
    }),
  );
  assert.ok(url.startsWith('https://wa.me/963999001001?text='));
  assert.ok(decodeURIComponent(url.split('text=')[1] ?? '').includes('AB12CD34'));
});

test('rejects custom template without code placeholder', () => {
  assert.equal(WhatsappSetupTemplateSchema.safeParse('Hello only').success, false);
  assert.equal(WhatsappSetupTemplateSchema.safeParse('Your code {{code}}').success, true);
});
