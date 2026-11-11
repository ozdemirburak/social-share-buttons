import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPlatform, platforms } from '../src/platforms.ts';

const page = 'https://example.com/a?query=one&other=two#résumé';
const message = 'Café & code + 100% #fun';

describe('sharing URL builders without browser globals', () => {
  // Public service routes checked against provider documentation and live
  // redirects on 2026-11-03. These assertions do not test remote posting.
  for (const [name, endpoint] of [
    ['x', 'https://x.com/intent/tweet'],
    ['bluesky', 'https://bsky.app/intent/compose'],
    ['threads', 'https://www.threads.com/intent/post'],
    ['mastodon', 'https://share.joinmastodon.org/'],
    ['facebook', 'https://www.facebook.com/sharer/sharer.php'],
    ['linkedin', 'https://www.linkedin.com/sharing/share-offsite/'],
    ['reddit', 'https://www.reddit.com/submit'],
    ['telegram', 'https://t.me/share/url'],
    ['whatsapp', 'https://wa.me/'],
    ['pinterest', 'https://www.pinterest.com/pin/create/button/'],
  ]) {
    it(`${name} targets its reviewed public sharing endpoint`, () => {
      const url = new URL(platforms[name].getShareUrl({ url: page, text: message }));
      assert.equal(url.origin + url.pathname, endpoint);
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    });
  }

  for (const name of ['facebook', 'linkedin']) {
    it(`${name} shares only the page URL instead of unsupported text or media parameters`, () => {
      const url = new URL(platforms[name].getShareUrl({ url: page, text: message, title: message, media: 'https://example.com/image.jpg' }));
      assert.deepEqual([...url.searchParams.keys()], [name === 'facebook' ? 'u' : 'url']);
    });
  }

  for (const name of ['x', 'facebook', 'linkedin', 'reddit', 'telegram', 'pinterest']) {
    it(`${name} preserves nested URLs and special characters`, () => {
      const url = new URL(platforms[name].getShareUrl({ url: page, text: message, title: message }));
      assert.equal(url.searchParams.get(name === 'facebook' ? 'u' : 'url'), page);
      assert.equal(url.protocol, 'https:');
    });
  }

  for (const name of ['x', 'telegram']) {
    it(`${name} uses title when explicit text is absent`, () => {
      const url = new URL(platforms[name].getShareUrl({ url: page, title: message }));
      assert.equal(url.searchParams.get('text'), message);
    });
  }

  it('bluesky composes text and a URL without losing encoding', () => {
    const url = new URL(platforms.bluesky.getShareUrl({ url: page, text: message }));
    assert.equal(url.searchParams.get('text'), `${message}\n\n${page}`);
  });

  it('threads sends the URL as its documented link attachment parameter', () => {
    const url = new URL(platforms.threads.getShareUrl({ url: page, text: message }));
    assert.deepEqual([...url.searchParams.keys()], ['text', 'url']);
    assert.equal(url.searchParams.get('text'), message);
    assert.equal(url.searchParams.get('url'), page);
    const titleOnly = new URL(platforms.threads.getShareUrl({ url: page, title: message }));
    assert.equal(titleOnly.searchParams.get('text'), message);
  });

  for (const name of ['facebook', 'linkedin', 'telegram']) {
    it(`${name} refuses to build a link without the URL it requires`, () => {
      assert.throws(() => platforms[name].getShareUrl({ text: message, title: message }), /needs a URL/);
      assert.throws(() => platforms[name].getShareUrl({ url: '', text: message }), /needs a URL/);
    });
  }

  it('uses the official Mastodon server chooser by default', () => {
    const url = new URL(platforms.mastodon.getShareUrl({ url: page, text: message }));
    assert.equal(url.origin, 'https://share.joinmastodon.org');
    assert.equal(decodeURIComponent(url.hash.slice('#text='.length)), `${message}\n\n${page}`);
  });

  it('supports a specified Mastodon server', () => {
    const url = new URL(platforms.mastodon.getShareUrl({ url: page, text: message, mastodonInstance: 'https://example.social/' }));
    assert.equal(url.origin + url.pathname, 'https://example.social/share');
    assert.equal(url.searchParams.get('text'), `${message}\n\n${page}`);
  });

  for (const mastodonInstance of ['http://example.social', 'https://user:pass@example.social', 'https://example.social/profile', 'https://example.social/?query=1', 'https://example.social/#hash', 'javascript:alert(1)']) {
    it(`rejects invalid Mastodon origin ${mastodonInstance}`, () => {
      assert.throws(() => platforms.mastodon.getShareUrl({ mastodonInstance }));
    });
  }

  it('uses the current Threads web intent domain', () => {
    assert.equal(new URL(platforms.threads.getShareUrl({})).hostname, 'www.threads.com');
  });

  it('uses a universal WhatsApp link without reading navigator', () => {
    const url = new URL(platforms.whatsapp.getShareUrl({ url: page, title: message }));
    assert.equal(url.origin + url.pathname, 'https://wa.me/');
    assert.equal(url.searchParams.get('text'), `${message} ${page}`);
  });

  it('preserves an explicit empty text instead of adding the title', () => {
    const url = new URL(platforms.bluesky.getShareUrl({ text: '', title: 'Do not add me', url: page }));
    assert.equal(url.searchParams.get('text'), page);
  });

  it('encodes X attribution and hashtags as individual query parameters', () => {
    const url = new URL(platforms.x.getShareUrl({ hashtags: ['typescript', 'café'], via: 'example', text: message }));
    assert.equal(url.searchParams.get('text'), message);
    assert.equal(url.searchParams.get('hashtags'), 'typescript,café');
    assert.equal(url.searchParams.get('via'), 'example');
  });

  it('encodes mail bodies using RFC 6068 spaces and CRLF newlines', () => {
    const result = platforms.email.getShareUrl({ title: 'Hello + friend', text: 'First line\nSecond & third', url: page });
    assert.ok(result.includes('subject=Hello%20%2B%20friend'));
    assert.ok(!result.includes('+'));
    const query = new URL(result).searchParams;
    assert.equal(query.get('body'), `First line\r\nSecond & third\r\n\r\n${page}`);
  });

  it('prevents mail subject newlines from becoming extra headers', () => {
    const result = platforms.email.getShareUrl({ title: 'Hello\r\nBcc: somebody@example.com' });
    assert.doesNotMatch(new URL(result).searchParams.get('subject')!, /[\r\n]/);
    assert.equal(new URL(result).searchParams.has('Bcc'), false);
  });

  it('preserves Pinterest media and description', () => {
    const url = new URL(platforms.pinterest.getShareUrl({ url: page, media: `${page}&image=1`, description: message }));
    assert.equal(url.searchParams.get('media'), `${page}&image=1`);
    assert.equal(url.searchParams.get('description'), message);
  });

  it('builds a copy URL without requiring a DOM', () => {
    assert.equal(platforms.copy.getShareUrl({ url: page }), page);
    assert.equal(platforms.copy.getShareUrl({}), '');
  });

  for (const name of ['toString', 'constructor', '__proto__', 'missing']) {
    it(`does not resolve inherited or unknown platform ${name}`, () => {
      assert.equal(getPlatform(name), undefined);
    });
  }
});
