import { canTransition, isWritable } from './lifecycle';

describe('course lifecycle (OQ-1)', () => {
  it.each([
    ['DRAFT', 'ACTIVE', true],
    ['DRAFT', 'FINISHED', false],
    ['ACTIVE', 'PAUSED', true],
    ['PAUSED', 'ACTIVE', true],
    ['PAUSED', 'FINISHED', true],
    ['FINISHED', 'ACTIVE', false],
    ['FINISHED', 'ARCHIVED', true],
    ['ARCHIVED', 'DRAFT', false],
  ] as const)('%s → %s is %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it('only finished and archived courses are read-only', () => {
    expect(
      ['DRAFT', 'ACTIVE', 'PAUSED', 'FINISHED', 'ARCHIVED'].filter(
        (s) => !isWritable(s as never),
      ),
    ).toEqual(['FINISHED', 'ARCHIVED']);
  });
});
