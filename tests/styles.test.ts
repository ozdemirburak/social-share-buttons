import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const css = await readFile(new URL('../src/social-share-buttons.css', import.meta.url), 'utf8');

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
const token = (block: string, name: string): string =>
  new RegExp(`--_ss-${name}: var\\(--social-share-buttons-${name}, (#[0-9a-f]{6})\\)`, 'i').exec(block)![1];

describe('stylesheet accessibility', () => {
  it('gives button borders at least 3:1 contrast against the theme background', () => {
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const block of [light, dark]) {
      assert.ok(contrast(token(block, 'border'), token(block, 'bg')) >= 3);
    }
  });

  it('keeps busy button labels in the accessibility tree', () => {
    const rule = /\[aria-busy="true"\] > \* \{([^}]*)\}/.exec(css)![1];
    assert.doesNotMatch(rule, /visibility\s*:\s*hidden|display\s*:\s*none/);
  });
});
