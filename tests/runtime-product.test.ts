import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { installDOM, restoreGlobals, stubGlobal } from './dom.mjs';
import SocialShareButtons from '../src/SocialShareButtons.ts';
import type { ShareDataSource, SocialShareButtonsOptions } from '../src/types.ts';

installDOM();

const instances: SocialShareButtons[] = [];
let open: ReturnType<typeof mock.fn>;
const make = (options: ConstructorParameters<typeof SocialShareButtons>[0] = {}) => {
  const instance = new SocialShareButtons({ container: '#share', ...options });
  instances.push(instance);
  return instance;
};
const capability = (name: string, value: unknown) =>
  Object.defineProperty(navigator, name, { configurable: true, value });
const button = (name: string) => document.querySelector<HTMLButtonElement>(`button[data-platform="${name}"]`)!;
const simulateDisabledBlur = (target: HTMLButtonElement) => {
  // jsdom ignores blur() on a disabled button; browsers already blur on disable.
  target.disabled = false;
  target.blur();
  target.disabled = true;
  assert.equal(document.activeElement, document.body);
};

beforeEach(() => {
  document.head.innerHTML = '<title>Current article</title>';
  document.body.innerHTML = '<main id="share"></main>';
  capability('share', undefined);
  capability('canShare', undefined);
  capability('clipboard', { writeText: mock.fn(async () => undefined) });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: mock.fn(() => false) });
  open = mock.fn(() => null);
  stubGlobal('open', open);
});

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
  mock.timers.reset();
  restoreGlobals();
  mock.reset();
});

describe('text-only presentation controls', () => {
  it('exposes supported presentation options and renders visible text', () => {
    make({ platforms: ['copy'], variant: 'outline', size: 'lg', layout: 'vertical' });
    const widget = document.querySelector<HTMLElement>('.social-share')!;
    assert.partialDeepStrictEqual({ ...widget.dataset }, { variant: 'outline', size: 'lg', layout: 'vertical' });
    assert.equal(widget.hasAttribute('data-display'), false);
    assert.equal(button('copy').textContent, 'Copy');
    assert.equal(button('copy').querySelector('svg, img, canvas'), null);
  });

  it('renders custom labels as text without interpreting embedded markup', () => {
    const label = '<svg onload="bad()">Copy article</svg>';
    make({ platforms: ['copy'], labels: { copy: label } });
    assert.equal(button('copy').textContent, label);
    assert.equal(button('copy').querySelector('svg, script, img'), null);
    assert.equal(button('copy').querySelector('.social-share-label')?.textContent, label);
  });

  it('ignores removed graphical options from untyped callers, including after updates', () => {
    const path = mock.fn(() => { throw new Error('Artwork must never be read'); });
    const legacy = {
      display: 'icon',
      icons: { copy: { get path() { return path(); } } },
    } as unknown as SocialShareButtonsOptions;
    const instance = make({ ...legacy, platforms: ['copy', 'x'], labels: { copy: 'Copy article URL' } });
    instance.updateOptions({ ...legacy, variant: 'minimal' });
    assert.equal(path.mock.callCount(), 0);
    assert.equal(button('copy').textContent, 'Copy article URL');
    assert.equal(button('x').textContent, 'X');
    assert.equal(document.querySelector('svg, img, canvas, [data-icon-only], [data-display]'), null);
  });

  it('restores the visible localized label after plain-text copy feedback', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const instance = make({ platforms: ['copy'], labels: { copy: 'Copy article URL', copied: '<b>Copied</b>' }, copiedDuration: 200 });
    await instance.share('copy');
    assert.equal(button('copy').textContent, '<b>Copied</b>');
    assert.equal(button('copy').querySelector('b, svg, img'), null);
    mock.timers.tick(200);
    await Promise.resolve();
    assert.equal(button('copy').textContent, 'Copy article URL');
    assert.equal(button('copy').querySelector('.social-share-label')?.textContent, 'Copy article URL');
  });
});

describe('current and per-card share content', () => {
  it('evaluates data providers only at the time of sharing and once per action', async () => {
    let article = 'first';
    const provider = mock.fn(() => ({ url: `https://example.org/${article}`, title: article }));
    const instance = make({ platforms: ['reddit'], data: provider });
    assert.equal(provider.mock.callCount(), 0);
    await instance.share('reddit');
    article = 'second';
    await instance.share('reddit', { title: 'Overridden' });
    assert.equal(provider.mock.callCount(), 2);
    const urls = open.mock.calls.map(({ arguments: [url] }) => new URL(String(url)));
    assert.equal(urls[0].searchParams.get('url'), 'https://example.org/first');
    assert.equal(urls[1].searchParams.get('url'), 'https://example.org/second');
    assert.equal(urls[1].searchParams.get('title'), 'Overridden');
  });

  it('uses canonical article metadata, and setData updates content without rebuilding buttons', async () => {
    document.head.innerHTML += '<link rel="canonical" href="https://example.org/canonical"><meta property="og:title" content="Article heading">';
    const instance = make({ platforms: ['reddit'] });
    const original = button('reddit');
    original.focus();
    await instance.share('reddit');
    const url = new URL(String(open.mock.calls[0].arguments[0]));
    assert.equal(url.searchParams.get('url'), 'https://example.org/canonical');
    assert.equal(url.searchParams.get('title'), 'Article heading');
    instance.setData({ url: 'https://example.org/product', title: 'Product' });
    assert.equal(button('reddit'), original);
    assert.equal(document.activeElement, original);
    await instance.share('reddit');
    assert.equal(new URL(String(open.mock.calls[1].arguments[0])).searchParams.get('url'), 'https://example.org/product');
  });

  it('evaluates a provider only once when nativeShare redirects an action', async () => {
    const native = mock.fn(async () => undefined);
    capability('share', native);
    const provider = mock.fn(() => ({ url: 'https://example.org/article' }));
    const instance = make({ data: provider, nativeShare: true });
    await instance.share('x');
    assert.equal(provider.mock.callCount(), 1);
    assert.equal(native.mock.calls[0].arguments[0].url, 'https://example.org/article');
  });

  it('contains provider errors and reports the reason once', async () => {
    const cause = new Error('Article is unavailable');
    const onError = mock.fn();
    const onShare = mock.fn();
    const instance = make({ data: () => { throw cause; }, onError, onShare });
    assert.equal(await instance.share('x'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'x', code: 'data-failed', cause }]]);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['x', false]]);
    assert.equal(open.mock.callCount(), 0);
  });

  it('rejects asynchronous data providers without silently sharing stale metadata', async () => {
    const onError = mock.fn();
    const provider = (() => Promise.resolve({ title: 'Too late' })) as unknown as ShareDataSource;
    const instance = make({ data: provider, onError });
    assert.equal(await instance.share('x'), false);
    assert.equal(onError.mock.calls[0].arguments[0].code, 'data-failed');
    assert.equal(open.mock.callCount(), 0);
  });

  it('handles rejected async providers without leaking an unhandled rejection', async () => {
    const onError = mock.fn();
    const provider = (() => Promise.reject(new Error('Async failure'))) as unknown as ShareDataSource;
    const instance = make({ data: provider, onError });
    assert.equal(await instance.share('x'), false);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(onError.mock.callCount(), 1);
    assert.equal(onError.mock.calls[0].arguments[0].code, 'data-failed');
  });

  it('does not accept content updates after destruction', () => {
    const instance = make();
    instance.destroy();
    assert.throws(() => instance.setData({ title: 'Gone' }), /destroyed/);
  });
});

describe('dedicated native action and pending operations', () => {
  it('restores keyboard focus after the browser blurs a pending copy button', async () => {
    let finish!: () => void;
    capability('clipboard', { writeText: () => new Promise<void>(resolve => { finish = resolve; }) });
    const instance = make({ platforms: ['copy'] });
    const copy = button('copy');
    copy.focus();
    const pending = instance.share('copy');
    simulateDisabledBlur(copy);
    finish();
    await pending;
    assert.equal(document.activeElement, copy);
  });

  it('does not steal focus when a user moves to another control during copying', async () => {
    let finish!: () => void;
    capability('clipboard', { writeText: () => new Promise<void>(resolve => { finish = resolve; }) });
    const instance = make({ platforms: ['copy', 'x'] });
    button('copy').focus();
    const pending = instance.share('copy');
    button('x').focus();
    finish();
    await pending;
    assert.equal(document.activeElement, button('x'));
  });

  it('restores focus to a replacement button after a widget is rebuilt while copying', async () => {
    let finish!: () => void;
    capability('clipboard', { writeText: () => new Promise<void>(resolve => { finish = resolve; }) });
    const instance = make({ platforms: ['copy'] });
    const original = button('copy');
    original.focus();
    const pending = instance.share('copy');
    simulateDisabledBlur(original);
    instance.updateOptions({ variant: 'minimal' });
    finish();
    await pending;
    assert.notEqual(button('copy'), original);
    assert.equal(document.activeElement, button('copy'));
  });

  it('does not restore a removed button after destruction', async () => {
    let finish!: () => void;
    capability('clipboard', { writeText: () => new Promise<void>(resolve => { finish = resolve; }) });
    const instance = make({ platforms: ['copy'] });
    button('copy').focus();
    const pending = instance.share('copy');
    instance.destroy();
    finish();
    await pending;
    assert.equal(document.activeElement, document.body);
    assert.equal(document.querySelector('.social-share'), null);
  });

  it('restores a focused native trigger after a share-sheet cancellation', async () => {
    let cancel!: (error: unknown) => void;
    capability('share', () => new Promise<void>((_, reject) => { cancel = reject; }));
    const instance = make({ platforms: ['native'] });
    const native = button('native');
    native.focus();
    const pending = instance.share('native');
    simulateDisabledBlur(native);
    cancel(new DOMException('Cancelled', 'AbortError'));
    await pending;
    assert.equal(document.activeElement, native);
  });

  it('preserves a new focus target when native sharing completes', async () => {
    let finish!: () => void;
    capability('share', () => new Promise<void>(resolve => { finish = resolve; }));
    const instance = make({ platforms: ['native', 'copy'] });
    button('native').focus();
    const pending = instance.shareNative();
    button('copy').focus();
    finish();
    await pending;
    assert.equal(document.activeElement, button('copy'));
  });

  it('hides the native action if unsupported while keeping platform-specific actions', async () => {
    const onError = mock.fn();
    const instance = make({ platforms: ['native', 'x'], onError });
    assert.equal(button('native'), null);
    assert.notEqual(button('x'), null);
    assert.equal(await instance.share('native'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'native', code: 'unsupported' }]]);
  });

  it('offers the native action separately from platform sharing', async () => {
    const native = mock.fn(async () => undefined);
    capability('share', native);
    const instance = make({ platforms: ['native', 'x'] });
    assert.equal(button('native').textContent, 'Share');
    await instance.share('native');
    await instance.share('x');
    assert.equal(native.mock.callCount(), 1);
    assert.equal(open.mock.callCount(), 1);
  });

  it('prevents duplicate copies and re-enables controls when copying finishes', async () => {
    let finish!: () => void;
    const copy = mock.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    capability('clipboard', { writeText: copy });
    const onError = mock.fn();
    const instance = make({ platforms: ['copy', 'x'], onError });
    const pending = instance.share('copy');
    assert.equal(button('copy').disabled, true);
    assert.equal(button('copy').getAttribute('aria-busy'), 'true');
    assert.equal(button('x').disabled, false);
    assert.equal(await instance.share('copy'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'copy', code: 'busy' }]]);
    button('copy').click();
    assert.equal(copy.mock.callCount(), 1);
    finish();
    assert.equal(await pending, true);
    assert.equal(button('copy').disabled, false);
    assert.equal(button('copy').getAttribute('aria-busy'), null);
  });

  it('keeps pending state across presentation updates without leaking old feedback', async () => {
    let finish!: () => void;
    capability('clipboard', { writeText: () => new Promise<void>(resolve => { finish = resolve; }) });
    const instance = make({ platforms: ['copy'] });
    const pending = instance.share('copy');
    instance.updateOptions({ variant: 'minimal', labels: { copy: 'New copy' } });
    assert.equal(button('copy').disabled, true);
    finish();
    await pending;
    assert.equal(button('copy').disabled, false);
    assert.equal(button('copy').textContent, 'New copy');
  });

  it('locks native-sharing buttons during an open share sheet and reports cancellation', async () => {
    let cancel!: (error: unknown) => void;
    const native = mock.fn(() => new Promise<void>((_, reject) => { cancel = reject; }));
    capability('share', native);
    const onError = mock.fn();
    const instance = make({ platforms: ['native', 'x', 'copy'], nativeShare: true, labels: { cancelled: 'Share cancelled by you.' }, onError });
    const pending = instance.share('x');
    assert.equal(button('native').disabled, true);
    assert.equal(button('x').disabled, true);
    assert.equal(button('copy').disabled, false);
    assert.equal(await instance.shareNative(), false);
    assert.equal(native.mock.callCount(), 1);
    cancel(new DOMException('Cancelled', 'AbortError'));
    assert.equal(await pending, false);
    assert.deepEqual(onError.mock.calls.map(({ arguments: [error] }) => error.code), ['busy', 'cancelled']);
    assert.equal(button('x').disabled, false);
    assert.equal(document.querySelector('[role="status"]')?.textContent, 'Share cancelled by you.');
    assert.equal(open.mock.callCount(), 0);
  });
});

describe('actionable failure feedback', () => {
  it('contains unexpected clipboard capability errors and releases the busy button', async () => {
    const cause = new Error('Clipboard access denied');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => { throw cause; } });
    const onError = mock.fn();
    const instance = make({ platforms: ['copy'], onError });
    assert.equal(await instance.share('copy'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'copy', code: 'clipboard-failed', cause }]]);
    assert.equal(button('copy').disabled, false);
  });

  it('clears old success feedback if a subsequent copy fails', async () => {
    const instance = make({ platforms: ['copy'] });
    await instance.share('copy');
    assert.equal(button('copy').textContent, 'Copied!');
    capability('clipboard', undefined);
    assert.equal(await instance.share('copy'), false);
    assert.equal(button('copy').textContent, 'Copy');
    assert.ok((document.querySelector('[role="status"]')?.textContent)?.includes('could not be completed'));
  });

  it('announces configured plain-text copy failures and preserves the original label', async () => {
    capability('clipboard', undefined);
    const onError = mock.fn();
    const instance = make({ platforms: ['copy'], labels: { failed: 'Copy unavailable. Select the URL instead.' }, onError });
    assert.equal(await instance.share('copy'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'copy', code: 'clipboard-failed' }]]);
    assert.equal(document.querySelector('[role="status"]')?.textContent, 'Copy unavailable. Select the URL instead.');
    assert.equal(button('copy').textContent, 'Copy');
    assert.equal(button('copy').disabled, false);
  });

  it('distinguishes unknown destinations, unsafe URLs, and browser failures', async () => {
    const onError = mock.fn();
    const instance = make({ customPlatforms: [{ name: 'unsafe', label: 'Unsafe', getShareUrl: () => 'javascript:alert(1)' }], onError });
    await instance.share('missing');
    await instance.share('unsafe');
    open.mock.mockImplementation(() => { throw new Error('Denied'); });
    await instance.share('x');
    assert.deepEqual(onError.mock.calls.map(({ arguments: [error] }) => error.code), ['unknown-platform', 'invalid-url', 'share-failed']);
  });

  it('rejects custom destinations containing embedded credentials', async () => {
    const onError = mock.fn();
    const instance = make({ customPlatforms: [{ name: 'credentials', label: 'Credentials', getShareUrl: () => 'https://user:password@example.org/share' }], onError });
    assert.equal(await instance.share('credentials'), false);
    assert.deepEqual(onError.mock.calls.map(call => call.arguments), [[{ platform: 'credentials', code: 'invalid-url' }]]);
    assert.equal(open.mock.callCount(), 0);
  });

  it('isolates error callbacks from the action result and standard callback', async () => {
    const onError = mock.fn(() => { throw new Error('Telemetry unavailable'); });
    const onShare = mock.fn();
    const instance = make({ onError, onShare });
    assert.equal(await instance.share('missing'), false);
    assert.equal(onError.mock.callCount(), 1);
    assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['missing', false]]);
  });
});
