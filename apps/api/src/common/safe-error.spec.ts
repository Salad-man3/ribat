import { safeErrorStack, safeErrorSummary } from './safe-error';

describe('safeError (NFR-08)', () => {
  it('drops the arguments Prisma prints in its message', () => {
    const error = Object.assign(
      new Error('\nInvalid `prisma.member.create()` invocation:\n{ data: { firstName: "Layla", phone: "+963999001040" } }'),
      { name: 'PrismaClientKnownRequestError', code: 'P2002' },
    );
    const text = safeErrorStack(error);
    expect(text).toMatch(/^PrismaClientKnownRequestError P2002/);
    expect(text).not.toContain('+963999001040');
    expect(text).not.toContain('Layla');
    expect(text).toContain('at ');
  });

  it('keeps our own one-line messages', () => {
    expect(safeErrorSummary(new Error('No handler named notify.x'))).toBe('Error: No handler named notify.x');
  });
});
