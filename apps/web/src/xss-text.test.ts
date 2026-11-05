import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) walk(path, acc);
    else if (
      /\.(tsx|ts|jsx|js)$/.test(name.name) &&
      !name.name.endsWith('.test.ts')
    ) {
      acc.push(path);
    }
  }
  return acc;
}

describe('XSS surface', () => {
  it('does not use dangerouslySetInnerHTML under src', () => {
    const root = join(import.meta.dirname);
    const hits: string[] = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      if (text.includes('dangerouslySetInnerHTML')) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it('escapes HTML in static text nodes', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(
      React.createElement('p', { dir: 'auto' }, payload),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
