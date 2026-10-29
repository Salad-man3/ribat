import { describe, expect, it } from 'vitest';
import { reportCardWhatsappUrl } from './report-card-share';

describe('reportCardWhatsappUrl', () => {
  it('encodes message without embedding PII beyond the app URL', () => {
    const url = reportCardWhatsappUrl('https://app.example/r/1', 'Open: {{url}}');
    expect(url).toContain('wa.me');
    expect(url).toContain(encodeURIComponent('https://app.example/r/1'));
    expect(url).not.toContain('student');
  });
});
