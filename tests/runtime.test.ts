import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { installDOM, restoreGlobals, stubGlobal } from './dom.mjs';
import SocialShareButtons from '../src/SocialShareButtons.ts';
import { getPlatform } from '../src/platforms.ts';

installDOM();

const instances: SocialShareButtons[] = [];
const make = (options: ConstructorParameters<typeof SocialShareButtons>[0] = {}) => {
  const instance = new SocialShareButtons(options);
  instances.push(instance);
  return instance;
};

let media: MediaQueryList;
let writeText: ReturnType<typeof mock.fn>;
let open: ReturnType<typeof mock.fn>;
let execCommand: ReturnType<typeof mock.fn>;
let addThemeListener: ReturnType<typeof mock.fn>;
let removeThemeListener: ReturnType<typeof mock.fn>;

function browserCapability(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

beforeEach(() => {
  document.head.innerHTML = '<title>Current page</title><meta name="description" content="Current description">';
  document.body.innerHTML = '<main id="first"></main><aside id="second"></aside>';
  history.replaceState(null, '', '/initial?one=1');
  writeText = mock.fn(async () => undefined);
  browserCapability('clipboard', { writeText });
  browserCapability('share', undefined);
  browserCapability('canShare', undefined);
  stubGlobal('isSecureContext', true);
  open = mock.fn(() => null);
  stubGlobal('open', open);
  const events = new EventTarget();
  addThemeListener = mock.fn(events.addEventListener.bind(events));
  removeThemeListener = mock.fn(events.removeEventListener.bind(events));
  media = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: addThemeListener,
    removeEventListener: removeThemeListener,
    dispatchEvent: events.dispatchEvent.bind(events),
    addListener: mock.fn(),
    removeListener: mock.fn(),
  } as MediaQueryList;
  stubGlobal('matchMedia', mock.fn(() => media));
  execCommand = mock.fn(() => true);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
});

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
  mock.timers.reset();
  mock.reset();
  restoreGlobals();
});

describe('rendering and lifecycle', () => {
  it('renders semantic buttons and visible custom labels as accessible names', () => {
    make({ container: '#first', platforms: ['x', 'copy'], labels: { x: 'Post this page' } });
    const buttons = document.querySelectorAll<HTMLButtonElement>('#first button');
    assert.equal((buttons).length, 2);
    assert.equal(buttons[0].type, 'button');
    assert.equal(buttons[0].textContent, 'Post this page');
    assert.ok((buttons[0].getAttribute('aria-label') ?? buttons[0].textContent)?.includes('Post this page'));
  });

  it('deduplicates platforms and ignores inherited platform names', () => {
    make({ container: '#first', platforms: ['x', 'x', 'constructor', '__proto__'] });
    assert.equal((document.querySelectorAll('#first button')).length, 1);
  });

  it('does not render labels as HTML', () => {
    make({ container: '#first', platforms: ['x'], labels: { x: '<img src=x onerror=alert(1)>' } });
    assert.equal(document.querySelector('#first img'), null);
    assert.ok((document.querySelector('#first button')?.textContent)?.includes('<img'));
  });

  it('keeps buttons interactive after updating options', async () => {
    const instance = make({ container: '#first', platforms: ['x'] });
    instance.updateOptions({ theme: 'dark', platforms: ['facebook'] });
    document.querySelector<HTMLButtonElement>('#first button')!.click();
    await Promise.resolve();
    assert.equal(open.mock.callCount(), 1);
    assert.equal(new URL(open.mock.calls[0].arguments[0]).hostname, 'www.facebook.com');
  });

  it('moves the widget when its container changes and preserves surrounding content', () => {
    const first = document.querySelector('#first')!;
    first.innerHTML = '<p>Keep me</p>';
    const instance = make({ container: '#first' });
    instance.updateOptions({ container: '#second' });
    assert.equal(first.querySelector('.social-share'), null);
    assert.equal(first.textContent, 'Keep me');
    assert.equal((document.querySelectorAll('#second .social-share')).length, 1);
    instance.destroy();
    assert.equal(document.querySelector('#second .social-share'), null);
  });

  it('keeps the current widget functional if an update targets a missing container', async () => {
    const instance = make({ container: '#first', platforms: ['x'] });
    assert.throws(() => instance.updateOptions({ container: '#does-not-exist' }));
    document.querySelector<HTMLButtonElement>('#first button')!.click();
    await Promise.resolve();
    assert.equal(open.mock.callCount(), 1);
  });

  it('preserves keyboard focus when a focused platform survives an update', () => {
    const instance = make({ container: '#first', platforms: ['x', 'copy'] });
    document.querySelector<HTMLButtonElement>('[data-platform="copy"]')!.focus();
    instance.updateOptions({ theme: 'dark' });
    assert.equal((document.activeElement as HTMLElement).dataset.platform, 'copy');
  });

  it('keeps separate instances interactive when one is destroyed', async () => {
    const first = make({ container: '#first', platforms: ['x'] });
    make({ container: '#second', platforms: ['facebook'] });
    first.destroy();
    document.querySelector<HTMLButtonElement>('#second button')!.click();
    await Promise.resolve();
    assert.equal(open.mock.callCount(), 1);
    assert.equal(new URL(open.mock.calls[0].arguments[0]).hostname, 'www.facebook.com');
  });

  it('supports a programmatic instance without creating a widget', async () => {
    const instance = make({ container: false });
    assert.equal(document.querySelector('.social-share'), null);
    assert.equal(await instance.share('x'), true);
    assert.equal(open.mock.callCount(), 1);
  });

  it('keeps custom platforms local to their instance', async () => {
    const custom = make({ container: '#first', platforms: ['custom'], customPlatforms: [{ name: 'custom', label: 'Custom', getShareUrl: () => 'https://example.org/share' }] });
    const ordinary = make({ container: '#second', platforms: ['custom'] });
    assert.equal((document.querySelectorAll('#first button')).length, 1);
    assert.equal((document.querySelectorAll('#second button')).length, 0);
    assert.equal(getPlatform('custom'), undefined);
    assert.equal(await custom.share('custom'), true);
    assert.equal(await ordinary.share('custom'), false);
    assert.equal(open.mock.callCount(), 1);
  });

  it('registers newly supplied custom platforms during updates', async () => {
    const instance = make({ container: '#first', platforms: [] });
    instance.updateOptions({ platforms: ['custom'], customPlatforms: [{ name: 'custom', label: 'Custom', getShareUrl: () => 'https://example.org/custom' }] });
    document.querySelector<HTMLButtonElement>('#first button')!.click();
    await Promise.resolve();
    assert.equal(open.mock.callCount(), 1);
    assert.equal(open.mock.calls[0].arguments[0], 'https://example.org/custom');
  });

  it('updates auto theme and detaches its observer after switching themes', () => {
    const instance = make({ container: '#first', theme: 'auto' });
    assert.equal(addThemeListener.mock.callCount(), 1);
    Object.defineProperty(media, 'matches', { value: true, configurable: true });
    media.dispatchEvent(new Event('change'));
    assert.equal(document.querySelector('.social-share')?.getAttribute('data-theme'), 'dark');
    instance.updateOptions({ theme: 'light' });
    assert.equal(removeThemeListener.mock.callCount(), 1);
    media.dispatchEvent(new Event('change'));
    assert.equal(document.querySelector('.social-share')?.getAttribute('data-theme'), 'light');
  });

  it('starts observing system theme when auto is enabled during an update', () => {
    const instance = make({ container: '#first', theme: 'light' });
    instance.updateOptions({ theme: 'auto' });
    Object.defineProperty(media, 'matches', { value: true, configurable: true });
    media.dispatchEvent(new Event('change'));
    assert.equal(document.querySelector('.social-share')?.getAttribute('data-theme'), 'dark');
    assert.equal(addThemeListener.mock.callCount(), 1);
  });

  it('cleans up listeners, DOM and future operations on destroy', async () => {
    const instance = make({ container: '#first', theme: 'auto' });
    instance.destroy();
    instance.destroy();
    assert.equal(removeThemeListener.mock.callCount(), 1);
    assert.equal(document.querySelector('.social-share'), null);
    assert.equal(await instance.share('x'), false);
    assert.equal(await instance.shareNative(), false);
    assert.throws(() => instance.updateOptions({ theme: 'light' }));
    assert.equal(open.mock.callCount(), 0);
  });
});

describe('share dispatch and data', () => {
  it('refreshes page data after client-side navigation', async () => {
    const instance = make({ container: false });
    history.replaceState(null, '', '/new-page?ref=next');
    document.title = 'A new page';
    await instance.share('reddit');
    const url = new URL(open.mock.calls[0].arguments[0]);
    assert.equal(url.searchParams.get('url'), window.location.href);
    assert.equal(url.searchParams.get('title'), 'A new page');
  });

  it('merges configured share data and per-call overrides', async () => {
    const instance = make({ container: false, data: { url: 'https://example.org/configured', title: 'Configured title' } });
    await instance.share('reddit', { title: 'Call title' });
    const url = new URL(open.mock.calls[0].arguments[0]);
    assert.equal(url.searchParams.get('url'), 'https://example.org/configured');
    assert.equal(url.searchParams.get('title'), 'Call title');
  });

  it('opens isolated browsing contexts and treats noopener null handles as dispatched', async () => {
    const onShare = mock.fn();
    const instance = make({ container: false, onShare });
    assert.equal(await instance.share('x'), true);
    assert.equal(open.mock.calls[0].arguments[1], '_blank');
    assert.ok((open.mock.calls[0].arguments[2])?.includes('noopener'));
    assert.ok((open.mock.calls[0].arguments[2])?.includes('noreferrer'));
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['x', true]]);
  });

  it('disables popup sizing when popup is false', async () => {
    const instance = make({ container: false, popup: false });
    await instance.share('facebook');
    assert.ok(!(open.mock.calls[0].arguments[2])?.includes('width='));
    assert.ok((open.mock.calls[0].arguments[2])?.includes('noopener'));
  });

  it('keeps the default popup when a wrapper forwards popup as undefined', async () => {
    const instance = make({ container: false, popup: undefined });
    await instance.share('x');
    instance.updateOptions({ popup: undefined });
    await instance.share('x');
    for (const call of open.mock.calls) assert.ok(call.arguments[2]?.includes('width=550'));
  });

  it('centers popups over the opener window, including on monitors with negative coordinates', async () => {
    stubGlobal('screenX', -1920);
    stubGlobal('screenY', -300);
    stubGlobal('outerWidth', 1200);
    stubGlobal('outerHeight', 901);
    const instance = make({ container: false });
    await instance.share('x');
    const features = new Map(String(open.mock.calls[0].arguments[2]).split(',').map(item => item.split('=') as [string, string]));
    assert.equal(features.get('left'), String(-1920 + (1200 - 550) / 2));
    assert.equal(features.get('top'), String(Math.round(-300 + (901 - 420) / 2)));
  });

  for (const destination of ['javascript:alert(1)', 'data:text/html,evil', 'file:///etc/passwd']) {
    it(`rejects unsafe custom share destination ${destination}`, async () => {
      const onShare = mock.fn();
      const instance = make({ container: false, customPlatforms: [{ name: 'unsafe', label: 'Unsafe', getShareUrl: () => destination }], onShare });
      assert.equal(await instance.share('unsafe'), false);
      assert.equal(open.mock.callCount(), 0);
      assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['unsafe', false]]);
    });
  }

  it('reports a throwing URL builder as failure', async () => {
    const onShare = mock.fn();
    const instance = make({ container: false, customPlatforms: [{ name: 'broken', label: 'Broken', getShareUrl: () => { throw new Error('Broken URL builder'); } }], onShare });
    assert.equal(await instance.share('broken'), false);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['broken', false]]);
  });

  it('reports window-opening errors as failure', async () => {
    open.mock.mockImplementation(() => { throw new Error('Browser denied open'); });
    const onShare = mock.fn();
    const instance = make({ container: false, onShare });
    assert.equal(await instance.share('x'), false);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['x', false]]);
  });

  it('isolates consumer callback exceptions from successful sharing', async () => {
    const onShare = mock.fn(() => { throw new Error('Consumer error'); });
    const instance = make({ container: false, onShare });
    assert.equal(await instance.share('x'), true);
    assert.equal(onShare.mock.callCount(), 1);
  });

  it('treats undefined data fields as omitted, so page metadata still applies', async () => {
    document.head.innerHTML = '<title>Page</title><link rel="canonical" href="https://example.org/canonical">';
    const instance = make({ container: false, data: { url: undefined, title: 'Configured' } });
    await instance.share('facebook');
    await instance.share('reddit', { url: undefined, title: undefined });
    assert.equal(new URL(open.mock.calls[0].arguments[0]).searchParams.get('u'), 'https://example.org/canonical');
    const reddit = new URL(open.mock.calls[1].arguments[0]).searchParams;
    assert.equal(reddit.get('url'), 'https://example.org/canonical');
    assert.equal(reddit.get('title'), 'Configured');
  });

  it('does not attach this page\'s metadata to a share for a different URL', async () => {
    document.head.innerHTML = '<title>List page</title><link rel="canonical" href="https://example.org/list">'
      + '<meta property="og:description" content="List description"><meta property="og:image" content="https://example.org/list.jpg">';
    const instance = make({ container: false, data: { url: 'https://example.org/article', text: 'About the article' } });
    await instance.share('pinterest');
    await instance.share('reddit');
    const pin = new URL(open.mock.calls[0].arguments[0]).searchParams;
    assert.equal(pin.get('url'), 'https://example.org/article');
    assert.equal(pin.get('description'), 'About the article');
    assert.equal(pin.has('media'), false);
    assert.equal(new URL(open.mock.calls[1].arguments[0]).searchParams.has('title'), false);
  });

  it('still fills gaps from metadata when the given URL is this page', async () => {
    document.head.innerHTML = '<title>Page</title><link rel="canonical" href="https://example.org/same">'
      + '<meta property="og:image" content="https://example.org/same.jpg">';
    const instance = make({ container: false, data: { url: 'https://example.org/same', text: 'Text' } });
    await instance.share('pinterest');
    const pin = new URL(open.mock.calls[0].arguments[0]).searchParams;
    assert.equal(pin.get('media'), 'https://example.org/same.jpg');
  });
});

describe('option updates from framework wrappers', () => {
  it('keeps the current container when container is forwarded as undefined', () => {
    make({ container: '#first' });
    instances[0].updateOptions({ container: undefined, variant: 'outline' });
    assert.equal(document.querySelector('.social-share')!.parentElement!.id, 'first');
  });

  it('does not apply built-in label colors to a custom platform that reuses a built-in name', () => {
    make({ container: '#first', platforms: ['email'], customPlatforms: [{ name: 'email', label: 'Mail', color: '#222222', getShareUrl: () => 'mailto:?subject=x' }] });
    const button = document.querySelector<HTMLButtonElement>('[data-platform="email"]')!;
    assert.equal(button.style.getPropertyValue('--_ss-brand-foreground'), 'var(--_ss-text)');
    make({ container: '#second', platforms: ['email'] });
    assert.equal(document.querySelector<HTMLButtonElement>('#second [data-platform="email"]')!.style.getPropertyValue('--_ss-brand-foreground'), '');
  });
});

describe('clipboard', () => {
  it('copies the URL and renders feedback as plain text', async () => {
    const onShare = mock.fn();
    const instance = make({ container: '#first', platforms: ['copy'], labels: { copied: '<img src=x onerror=alert(1)>' }, onShare });
    assert.equal(await instance.share('copy', { url: 'https://example.org/copy?a=1&b=2' }), true);
    assert.deepEqual(writeText.mock.calls.map(call => call.arguments), [['https://example.org/copy?a=1&b=2']]);
    assert.equal(document.querySelector('#first img'), null);
    assert.ok((document.querySelector('#first button')?.textContent)?.includes('<img'));
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['copy', true]]);
  });

  it('resets repeated copy feedback to the original label after the latest copy', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const instance = make({ container: '#first', platforms: ['copy'], labels: { copy: 'Copy link' }, copiedDuration: 1000 });
    await instance.share('copy');
    mock.timers.tick(600);
    await Promise.resolve();
    await instance.share('copy');
    mock.timers.tick(600);
    await Promise.resolve();
    assert.equal(document.querySelector('#first button')?.textContent, 'Copied!');
    mock.timers.tick(400);
    await Promise.resolve();
    assert.equal(document.querySelector('#first button')?.textContent, 'Copy link');
  });

  it('falls back after modern clipboard rejection and restores input focus and selection', async () => {
    writeText.mock.mockImplementation(async () => { throw new Error('Permission denied'); });
    const input = document.createElement('input');
    input.value = 'selected text';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(2, 7);
    const instance = make({ container: false });
    assert.equal(await instance.share('copy'), true);
    assert.ok(execCommand.mock.calls.some(call => isDeepStrictEqual(call.arguments, ['copy'])));
    assert.equal(document.activeElement, input);
    assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 7]);
    assert.equal(document.querySelector('textarea'), null);
  });

  it('reports false when the legacy clipboard command fails', async () => {
    browserCapability('clipboard', undefined);
    execCommand.mock.mockImplementation(() => false);
    const onShare = mock.fn();
    const instance = make({ container: '#first', platforms: ['copy'], onShare });
    assert.equal(await instance.share('copy'), false);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['copy', false]]);
    assert.equal(document.querySelector('#first button')?.textContent, 'Copy');
    assert.equal(document.querySelector('textarea'), null);
  });

  it('clears feedback timers on destroy', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const instance = make({ container: '#first', platforms: ['copy'] });
    await instance.share('copy');
    const detachedButton = document.querySelector<HTMLButtonElement>('#first button')!;
    assert.equal(detachedButton.textContent, 'Copied!');
    instance.destroy();
    mock.timers.tick(2000);
    assert.equal(document.querySelector('.social-share'), null);
    // An uncancelled feedback callback would change even the detached button.
    assert.equal(detachedButton.textContent, 'Copied!');
  });

  it('does not revive a widget when a pending copy finishes after destruction', async () => {
    let resolveCopy!: () => void;
    writeText.mock.mockImplementation(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
    const instance = make({ container: '#first', platforms: ['copy'] });
    const pending = instance.share('copy');
    instance.destroy();
    resolveCopy();
    await pending;
    assert.equal(document.querySelector('.social-share'), null);
  });

  it('does not apply an old copy result to a widget rebuilt while copying', async () => {
    let resolveCopy!: () => void;
    writeText.mock.mockImplementation(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
    const instance = make({ container: '#first', platforms: ['copy'] });
    const pending = instance.share('copy');
    instance.updateOptions({ labels: { copy: 'New copy label' } });
    resolveCopy();
    await pending;
    assert.equal(document.querySelector('#first button')?.textContent, 'New copy label');
  });

  it('announces successful copies through a polite live region', async () => {
    const instance = make({ container: '#first', platforms: ['copy'], labels: { copied: 'Link ready' } });
    await instance.share('copy');
    const status = document.querySelector('#first [role="status"]');
    assert.equal(status?.getAttribute('aria-live'), 'polite');
    assert.equal(status?.textContent, 'Link ready');
  });
});

describe('native sharing', () => {
  it('supports browsers with share but no canShare API', async () => {
    const native = mock.fn(async () => undefined);
    browserCapability('share', native);
    const onShare = mock.fn();
    const instance = make({ container: false, nativeShare: true, onShare });
    assert.equal(await instance.share('x', { text: 'Native text' }), true);
    assert.equal(native.mock.callCount(), 1);
    assert.equal(native.mock.calls[0].arguments[0].text, 'Native text');
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['native', true]]);
    assert.equal(open.mock.callCount(), 0);
  });

  it('reports user cancellation once without opening a fallback popup', async () => {
    const native = mock.fn(async () => { throw new DOMException('User canceled', 'AbortError'); });
    browserCapability('share', native);
    const onShare = mock.fn();
    const instance = make({ container: false, nativeShare: true, onShare });
    assert.equal(await instance.share('x'), false);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['native', false]]);
    assert.equal(open.mock.callCount(), 0);
  });

  it('still copies when native sharing is enabled', async () => {
    const native = mock.fn(async () => undefined);
    browserCapability('share', native);
    const instance = make({ container: false, nativeShare: true });
    assert.equal(await instance.share('copy'), true);
    assert.equal(native.mock.callCount(), 0);
    assert.equal(writeText.mock.callCount(), 1);
  });

  it('returns false from shareNative when the API is unavailable', async () => {
    const onShare = mock.fn();
    const instance = make({ container: false, onShare });
    assert.equal(await instance.shareNative(), false);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['native', false]]);
  });

  it('falls back to the platform when canShare rejects the requested data', async () => {
    const native = mock.fn(async () => undefined);
    browserCapability('share', native);
    browserCapability('canShare', mock.fn(() => false));
    const instance = make({ container: false, nativeShare: true });
    assert.equal(await instance.share('x'), true);
    assert.equal(native.mock.callCount(), 0);
    assert.equal(open.mock.callCount(), 1);
  });
});
