import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getShareUrl } from '../src/share-url.ts';
import { readShareData } from '../src/share-data.ts';
import type { CustomPlatform } from '../src/types.ts';

const data = { url: 'https://example.com/article?topic=caf%C3%A9&sort=new', title: 'Café & code' };

describe('getShareUrl in a server environment', () => {
  it('builds existing UI links without a DOM or opening a window', () => {
    const result = new URL(getShareUrl('x', data)!);
    assert.equal(result.origin, 'https://x.com');
    assert.equal(result.searchParams.get('url'), data.url);
    assert.equal(result.searchParams.get('text'), data.title);
  });

  it('accepts mailto links', () => {
    assert.match(getShareUrl('email', data)!, /^mailto:\?subject=Caf%C3%A9%20%26%20code/);
  });

  for (const platform of ['facebook', 'linkedin', 'telegram']) {
    it(`returns undefined for ${platform} without a URL instead of a broken link`, () => {
      assert.equal(getShareUrl(platform, { title: data.title }), undefined);
      assert.match(getShareUrl(platform, data)!, /^https:/);
    });
  }

  for (const platform of ['unknown', 'constructor', '__proto__', 'copy', 'native']) {
    it(`does not create a navigation link for ${platform}`, () => {
      assert.equal(getShareUrl(platform, data), undefined);
    });
  }

  it('supports instance-local custom builders without changing built-in builders', () => {
    const custom: CustomPlatform[] = [{ name: 'x', label: 'Our site', getShareUrl: ({ url }) => `https://example.com/save?url=${encodeURIComponent(url ?? '')}` }];
    assert.equal(new URL(getShareUrl('x', data, custom)!).hostname, 'example.com');
    assert.equal(new URL(getShareUrl('x', data)!).hostname, 'x.com');
  });

  it('uses the last duplicate custom definition, matching widget registration', () => {
    const custom: CustomPlatform[] = [
      { name: 'custom', label: 'Old', getShareUrl: () => 'https://old.example/' },
      { name: 'custom', label: 'New', getShareUrl: () => 'https://new.example/' },
    ];
    assert.equal(getShareUrl('custom', data, custom), 'https://new.example/');
  });

  for (const destination of ['javascript:alert(1)', 'data:text/html,test', 'vbscript:bad', 'file:///tmp/test', '/relative', '//example.com', '', 'http://[', 'https://user:password@example.com']) {
    it(`rejects unsafe or non-absolute custom destinations: ${destination}`, () => {
      assert.equal(getShareUrl('custom', data, [{ name: 'custom', label: 'Custom', getShareUrl: () => destination }]), undefined);
    });
  }

  it('does not throw when a custom builder fails', () => {
    assert.equal(getShareUrl('custom', data, [{ name: 'custom', label: 'Custom', getShareUrl: () => { throw new Error('Application error'); } }]), undefined);
  });

  it('does not throw when the Mastodon instance is invalid', () => {
    assert.equal(getShareUrl('mastodon', { ...data, mastodonInstance: 'http://example.social' }), undefined);
  });

  it('returns empty metadata when no document exists', () => {
    assert.deepEqual(readShareData(), {});
  });
});
