import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFillWidthPct } from './fill-width';

function Bar({ pct }: { pct: number }) {
  const ref = useFillWidthPct<HTMLSpanElement>(pct);
  return createElement('span', {
    ref,
    'data-testid': 'bar',
    className: 'w-(--fill)',
  });
}

describe('useFillWidthPct', () => {
  it('sets --fill for w-(--fill) bars', async () => {
    const { getByTestId, rerender } = render(createElement(Bar, { pct: 40 }));
    const el = getByTestId('bar') as HTMLSpanElement;
    await waitFor(() => {
      expect(el.style.getPropertyValue('--fill')).toBe('40%');
    });
    rerender(createElement(Bar, { pct: 75 }));
    await waitFor(() => {
      expect(el.style.getPropertyValue('--fill')).toBe('75%');
    });
  });
});
