import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';

/** Walk leaf strings. JSON keys may contain dots (permissions.members.manage). */
function leaves(tree: object, prefix = ''): { key: string; value: string }[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const key = `${prefix}${k}`;
    return typeof v === 'object' && v !== null
      ? leaves(v, `${key}.`)
      : [{ key, value: String(v) }];
  });
}

/** NFR-01: every string exists in both languages. Arabic has more plural forms, so suffixes fold. */
const fold = (list: string[]) =>
  [...new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();

describe('translations', () => {
  it('Arabic and English have the same keys', () => {
    expect(fold(leaves(ar).map((l) => l.key))).toEqual(
      fold(leaves(en).map((l) => l.key)),
    );
  });

  it('no Arabic string is left empty', () => {
    const empty = leaves(ar).filter((l) => l.value === '').map((l) => l.key);
    expect(empty).toEqual([]);
  });
});
