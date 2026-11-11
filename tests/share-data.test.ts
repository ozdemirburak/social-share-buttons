import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { installDOM } from './dom.mjs';
import { readShareData } from '../src/share-data.ts';

installDOM();

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/articles?utm_source=campaign#intro');
});

const origin = () => window.location.origin;

describe('readShareData', () => {
  it('prefers the declared canonical address to tracking parameters and Open Graph URLs', () => {
    document.head.innerHTML = '<link rel="canonical" href="/articles"><meta property="og:url" content="https://example.com/other">';
    assert.equal(readShareData().url, `${origin()}/articles`);
  });

  it('understands canonical rel tokens and relative URLs resolved through base href', () => {
    document.head.innerHTML = '<base href="https://content.example.com/posts/"><link rel="alternate Canonical" href="story"><meta property="og:image" content="images/cover.jpg">';
    assert.partialDeepStrictEqual(readShareData(), {
      url: 'https://content.example.com/posts/story',
      media: 'https://content.example.com/posts/images/cover.jpg',
    });
  });

  it('falls back to og:url when a canonical link is missing', () => {
    document.head.innerHTML = '<meta property="og:url" content="/clean-article">';
    assert.equal(readShareData().url, `${origin()}/clean-article`);
  });

  it('retains location parameters when no canonical address is provided', () => {
    assert.equal(readShareData().url, window.location.href);
  });

  for (const url of ['javascript:alert(1)', 'data:text/html,example', 'https://user:password@example.com/private', 'http://[']) {
    it(`ignores unsafe or invalid metadata URLs: ${url}`, () => {
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = url;
      document.head.append(canonical);
      const image = document.createElement('meta');
      image.setAttribute('property', 'og:image');
      image.content = url;
      document.head.append(image);
      assert.equal(readShareData().url, window.location.href);
      assert.equal(readShareData().media, undefined);
    });
  }

  it('skips invalid canonical candidates in favor of a valid one', () => {
    document.head.innerHTML = '<link rel="canonical" href="javascript:bad"><link rel="canonical" href="/good">';
    assert.equal(readShareData().url, `${origin()}/good`);
  });

  it('uses Open Graph title and description while treating them as plain text', () => {
    document.title = 'Site navigation title';
    document.head.insertAdjacentHTML('beforeend', '<meta property="og:title" content=" The article &amp; more "><meta property="og:description" content=" &lt;b&gt;Description&lt;/b&gt; ">');
    assert.partialDeepStrictEqual(readShareData(), { title: 'The article & more', description: '<b>Description</b>' });
  });

  it('uses document title and standard description when Open Graph metadata is empty', () => {
    document.title = 'Article title';
    document.head.insertAdjacentHTML('beforeend', '<meta property="og:title" content=" "><meta property="og:description" content=""><meta name="description" content="Plain description">');
    assert.partialDeepStrictEqual(readShareData(), { title: 'Article title', description: 'Plain description' });
  });

  it('reads changes each time instead of caching metadata', () => {
    document.title = 'Before navigation';
    assert.equal(readShareData().title, 'Before navigation');
    document.title = 'After navigation';
    window.history.replaceState({}, '', '/next');
    assert.partialDeepStrictEqual(readShareData(), { title: 'After navigation', url: `${origin()}/next` });
  });

  it('reads an explicitly supplied document without using the current page', () => {
    document.title = 'Current page';
    const other = document.implementation.createHTMLDocument('Other page');
    other.head.insertAdjacentHTML('beforeend', '<link rel="canonical" href="https://other.example/article"><meta property="og:image" content="https://other.example/cover.png">');
    assert.partialDeepStrictEqual(readShareData(other), { title: 'Other page', url: 'https://other.example/article', media: 'https://other.example/cover.png' });
  });
});
