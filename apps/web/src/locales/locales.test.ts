import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';

/** NFR-01: every string exists in both languages. Arabic has more plural forms, so suffixes fold. */
function keys(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
const fold = (list: string[]) =>
  [...new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();

describe('translations', () => {
  it('Arabic and English have the same keys', () => {
    expect(fold(keys(ar))).toEqual(fold(keys(en)));
  });

  it('no Arabic string is left empty', () => {
    const empty = keys(ar).filter((k) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ar) === '');
    expect(empty).toEqual([]);
  });
});
