import { sanitizeCustomValues } from '@ribat/shared';
import { CustomFieldsService } from './custom-fields.service';

describe('custom fields', () => {
  it('sanitizeCustomValues strips unknown keys and bad types', () => {
    const defs = [
      { key: 'score', type: 'NUMBER' as const },
      { key: 'note', type: 'TEXT' as const },
    ];
    expect(
      sanitizeCustomValues(defs, { score: 'x', note: 'ok', extra: 1 }),
    ).toEqual({ note: 'ok' });
  });

  it('archive throws when row is missing', async () => {
    const prisma = {
      forOrganization: () => ({
        customFieldDefinition: {
          updateMany: async () => ({ count: 0 }),
        },
      }),
    };
    const service = new CustomFieldsService(prisma as never);
    await expect(
      service.archive('org', '00000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow();
  });
});
