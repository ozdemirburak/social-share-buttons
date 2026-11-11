import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { installDOM, stubGlobal, restoreGlobals } from './dom.mjs';
import { initShareButtons, type ShareButtonsController } from '../src/auto.ts';
import type { ShareDataSource, SocialShareButtonsOptions } from '../src/types.ts';

installDOM();

const controllers: ShareButtonsController[] = [];
const mount = (...args: Parameters<typeof initShareButtons>) => {
  const controller = initShareButtons(...args);
  controllers.push(controller);
  return controller;
};
let open: ReturnType<typeof mock.fn>;
const button = (root: ParentNode = document) => root.querySelector<HTMLButtonElement>('button')!;

beforeEach(() => {
  document.head.innerHTML = '<title>Page title</title>';
  document.body.innerHTML = '';
  open = mock.fn(() => null);
  stubGlobal('open', open);
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  mock.reset();
  restoreGlobals();
});

describe('declarative setup', () => {
  it('does nothing until initialization is explicitly requested', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    assert.equal(document.querySelector('button'), null);
    assert.equal(mount().instances.length, 1);
    assert.equal(button().dataset.platform, 'x');
  });

  it('scans a passed container itself and its descendants', () => {
    document.body.innerHTML = '<main data-share-buttons="x"><aside data-share-buttons="email"></aside></main><div data-share-buttons="copy"></div>';
    const main = document.querySelector('main')!;
    assert.equal(mount(main).instances.length, 2);
    assert.equal(document.querySelectorAll('.social-share').length, 2);
    assert.equal(document.querySelector('body > div button'), null);
  });

  it('supports detached roots without immediately destroying their widgets', () => {
    const root = document.createElement('section');
    root.setAttribute('data-share-buttons', 'x');
    const controller = mount(root);
    assert.equal(controller.refresh().length, 1);
    assert.equal(root.querySelectorAll('.social-share').length, 1);
  });

  it('supports fragments and shadow roots', () => {
    const fragment = document.createDocumentFragment();
    const node = document.createElement('div');
    node.setAttribute('data-share-buttons', 'x');
    fragment.append(node);
    assert.equal(mount(fragment).instances.length, 1);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div data-share-buttons="email"></div>';
    assert.equal(mount(shadow).instances.length, 1);
    assert.equal(button(shadow).dataset.platform, 'email');
  });

  it('ignores non-HTML marker elements', () => {
    document.body.innerHTML = '<svg data-share-buttons="x"></svg><div data-share-buttons="x"></div>';
    assert.equal(mount().instances.length, 1);
  });

  it('uses defaults for an empty marker and explicit platforms in preference to shorthand', () => {
    document.body.innerHTML = '<div id="default" data-share-buttons></div><div id="override" data-share-buttons="x" data-share-platforms="email, copy, email"></div>';
    mount(undefined, { platforms: ['bluesky'] });
    assert.equal(button(document.querySelector('#default')!).dataset.platform, 'bluesky');
    assert.deepEqual([...document.querySelectorAll<HTMLElement>('#override button')].map(node => node.dataset.platform), ['email', 'copy']);
  });

  it('honors an explicitly empty platform list', () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-platforms=""></div>';
    mount();
    assert.equal(document.querySelectorAll('.social-share').length, 1);
    assert.equal(document.querySelectorAll('button').length, 0);
  });

  it('applies validated presentation and accessible label attributes', () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-theme="dark" data-share-variant="outline" data-share-size="sm" data-share-layout="vertical" data-share-aria-label="Share this article"></div>';
    mount();
    const widget = document.querySelector<HTMLElement>('.social-share')!;
    assert.partialDeepStrictEqual({ ...widget.dataset }, { theme: 'dark', variant: 'outline', size: 'sm', layout: 'vertical' });
    assert.equal(widget.getAttribute('aria-label'), 'Share this article');
  });

  it('falls back to provided defaults for invalid presentation attributes', () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-theme="bogus" data-share-variant="bogus" data-share-size="bogus" data-share-layout="bogus"></div>';
    mount(undefined, { theme: 'dark', variant: 'minimal', size: 'lg', layout: 'vertical' });
    assert.partialDeepStrictEqual({ ...document.querySelector<HTMLElement>('.social-share')!.dataset }, { theme: 'dark', variant: 'minimal', size: 'lg', layout: 'vertical' });
  });

  it('ignores removed graphical attributes and defaults while retaining readable labels', () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-display="icon"></div>';
    const legacy = { display: 'icon', icons: { x: { path: 'unused' } } } as unknown as SocialShareButtonsOptions;
    const controller = mount(undefined, legacy);
    controller.refresh();
    assert.equal(button().textContent, 'X');
    assert.equal(document.querySelector('.social-share')?.hasAttribute('data-display'), false);
    assert.equal(document.querySelector('svg, img, canvas, [data-icon-only]'), null);
  });

  for (const [value, popup] of [['false', false], ['true', true], ['', true], ['invalid', true]] as const) {
    it(`parses popup=${value} explicitly`, async () => {
      document.body.innerHTML = `<div data-share-buttons="x" data-share-popup="${value}"></div>`;
      const controller = mount();
      await controller.instances[0].share('x');
      assert.equal(open.mock.calls[0].arguments[2].includes('width='), popup);
    });
  }
});

describe('live article data', () => {
  it('shares each article URL rather than the surrounding feed URL', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-url="https://example.com/one" data-share-title="First"></div><div data-share-buttons="x" data-share-url="https://example.com/two" data-share-title="Second"></div>';
    const controller = mount();
    await controller.instances[0].share('x');
    await controller.instances[1].share('x');
    assert.equal(new URL(open.mock.calls[0].arguments[0]).searchParams.get('url'), 'https://example.com/one');
    assert.equal(new URL(open.mock.calls[1].arguments[0]).searchParams.get('text'), 'Second');
  });

  it('reads changed and removed data attributes without refresh', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-title="First"></div>';
    const element = document.querySelector('div')!;
    const controller = mount(undefined, { data: { title: 'Fallback', url: 'https://example.com/article' } });
    await controller.instances[0].share('x');
    element.setAttribute('data-share-title', 'Second');
    await controller.instances[0].share('x');
    element.removeAttribute('data-share-title');
    await controller.instances[0].share('x');
    assert.deepEqual(open.mock.calls.map(({ arguments: args }) => new URL(args[0]).searchParams.get('text')), ['First', 'Second', 'Fallback']);
  });

  it('evaluates the defaults provider on every action and allows per-call overrides', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-title="Attribute title"></div>';
    let url = 'https://example.com/one';
    const data = mock.fn(() => ({ url, title: 'Provider title' }));
    const controller = mount(undefined, { data });
    assert.equal(data.mock.callCount(), 0);
    await controller.instances[0].share('x');
    url = 'https://example.com/two';
    await controller.instances[0].share('x', { title: 'Call title' });
    assert.equal(data.mock.callCount(), 2);
    assert.equal(new URL(open.mock.calls[1].arguments[0]).searchParams.get('url'), url);
    assert.equal(new URL(open.mock.calls[1].arguments[0]).searchParams.get('text'), 'Call title');
  });

  it('resolves relative article URLs and image paths against the document base', async () => {
    document.head.innerHTML += '<base href="https://example.com/blog/">';
    document.body.innerHTML = '<div data-share-buttons="pinterest" data-share-url="article" data-share-media="../image.jpg" data-share-description="Description"></div>';
    await mount().instances[0].share('pinterest');
    const params = new URL(open.mock.calls[0].arguments[0]).searchParams;
    assert.equal(params.get('url'), 'https://example.com/blog/article');
    assert.equal(params.get('media'), 'https://example.com/image.jpg');
    assert.equal(params.get('description'), 'Description');
  });

  for (const [name, provider] of [
    ['async resolution', () => Promise.resolve({ url: 'https://example.com' })],
    ['async rejection', () => Promise.reject(new Error('Fetch failed'))],
    ['null', () => null],
    ['an array', () => []],
    ['a primitive', () => 'https://example.com'],
  ] as const) {
    it(`rejects defaults providers returning ${name} without sharing or an unhandled rejection`, async () => {
      document.body.innerHTML = '<div data-share-buttons="x" data-share-title="Article"></div>';
      const onError = mock.fn();
      const onShare = mock.fn();
      const controller = mount(undefined, { data: provider as ShareDataSource, onError, onShare });
      assert.equal(await controller.instances[0].share('x'), false);
      assert.equal(onError.mock.callCount(), 1);
      assert.equal(onError.mock.calls[0].arguments.length, 1);
      assert.partialDeepStrictEqual(onError.mock.calls[0].arguments[0], { platform: 'x', code: 'data-failed' });
      assert.deepEqual(onShare.mock.calls.map(call => call.arguments), [['x', false]]);
      assert.equal(open.mock.callCount(), 0);
      // Let a rejected provider's promise settle; the test runner also checks unhandled rejections.
      await Promise.resolve();
    });
  }

  it('preserves explicit empty text and does not inject attribute values as markup', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-text="" data-share-title="&lt;img src=x onerror=alert(1)&gt;"></div>';
    await mount().instances[0].share('x');
    assert.equal(new URL(open.mock.calls[0].arguments[0]).searchParams.has('text'), false);
    assert.equal(document.querySelector('img'), null);
  });

  it('supports hashtags and via metadata', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-hashtags="#web, testing, ,#分享" data-share-via="example"></div>';
    await mount().instances[0].share('x');
    const params = new URL(open.mock.calls[0].arguments[0]).searchParams;
    assert.equal(params.get('hashtags'), 'web,testing,分享');
    assert.equal(params.get('via'), 'example');
  });

  it('reports invalid attribute URLs through the runtime and can recover on the next action', async () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-url="javascript:alert(1)"></div>';
    const onError = mock.fn();
    const controller = mount(undefined, { onError });
    assert.equal(await controller.instances[0].share('x'), false);
    assert.equal(onError.mock.callCount(), 1);
    assert.equal(onError.mock.calls[0].arguments.length, 1);
    assert.partialDeepStrictEqual(onError.mock.calls[0].arguments[0], { code: 'data-failed' });
    assert.equal(open.mock.callCount(), 0);
    document.querySelector('div')!.setAttribute('data-share-url', 'https://example.com/fixed');
    assert.equal(await controller.instances[0].share('x'), true);
  });
});

describe('ownership and refresh', () => {
  it('refreshes in place without duplicating instances or widgets', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    const instance = controller.instances[0];
    assert.deepEqual(controller.refresh(), [instance]);
    assert.deepEqual(controller.refresh(), [instance]);
    assert.equal(document.querySelectorAll('.social-share').length, 1);
  });

  it('reapplies presentation changes on refresh', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    const element = document.querySelector('div')!;
    element.setAttribute('data-share-theme', 'dark');
    element.setAttribute('data-share-platforms', 'email');
    controller.refresh();
    assert.equal(document.querySelector<HTMLElement>('.social-share')!.dataset.theme, 'dark');
    assert.equal(button().dataset.platform, 'email');
  });

  it('mounts added containers and cleans removed containers without affecting their other content', () => {
    document.body.innerHTML = '<div data-share-buttons="x"><p>Keep me</p></div>';
    const controller = mount();
    const original = document.querySelector('div')!;
    original.remove();
    document.body.innerHTML = '<div data-share-buttons="email"></div>';
    controller.refresh();
    assert.equal(controller.instances.length, 1);
    assert.equal(original.querySelector('.social-share'), null);
    assert.equal(original.textContent, 'Keep me');
    assert.equal(button().dataset.platform, 'email');
  });

  it('restores defaults when presentation attributes are removed', async () => {
    document.body.innerHTML = '<div data-share-buttons data-share-platforms="email" data-share-theme="dark" data-share-popup="false" data-share-aria-label="Article"></div>';
    const controller = mount(undefined, { platforms: ['x'] });
    const element = document.querySelector('div')!;
    for (const attribute of ['platforms', 'theme', 'popup', 'aria-label']) element.removeAttribute(`data-share-${attribute}`);
    controller.refresh();
    assert.equal(button().dataset.platform, 'x');
    assert.equal(document.querySelector<HTMLElement>('.social-share')!.dataset.theme, 'light');
    assert.equal(document.querySelector('.social-share')!.getAttribute('aria-label'), 'Social sharing buttons');
    await controller.instances[0].share('x');
    assert.ok(open.mock.calls[0].arguments[2].includes('width='));
  });

  it('releases a container when its marker is removed', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    document.querySelector('div')!.removeAttribute('data-share-buttons');
    controller.refresh();
    assert.equal(controller.instances.length, 0);
    assert.equal(document.querySelector('button'), null);
  });

  it('prevents overlapping controllers from mounting or destroying someone else’s widget', async () => {
    document.body.innerHTML = '<main><div data-share-buttons="x"></div></main>';
    const first = mount();
    const second = mount(document.querySelector('main')!);
    assert.equal(second.instances.length, 0);
    second.destroy();
    assert.equal(document.querySelectorAll('.social-share').length, 1);
    assert.equal(await first.instances[0].share('x'), true);
  });

  it('allows another controller to claim a released container', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const first = mount();
    const second = mount();
    first.destroy();
    assert.equal(second.refresh().length, 1);
    assert.equal(document.querySelectorAll('.social-share').length, 1);
  });

  it('returns instance snapshots and makes destroy terminal and idempotent', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    controller.instances.pop();
    assert.equal(controller.instances.length, 1);
    controller.destroy();
    controller.destroy();
    assert.equal(controller.instances.length, 0);
    assert.deepEqual(controller.refresh(), []);
    assert.equal(document.querySelector('button'), null);
  });

  it('isolates mount failures, reports them, and clears errors after recovery', () => {
    document.body.innerHTML = '<div id="bad" data-share-buttons="x"></div><div id="good" data-share-buttons="email"></div>';
    const bad = document.querySelector<HTMLElement>('#bad')!;
    const original = bad.appendChild.bind(bad);
    const append = mock.method(bad, 'appendChild', () => { throw new Error('Cannot mount'); });
    const controller = mount();
    assert.equal(controller.instances.length, 1);
    assert.equal(controller.errors.length, 1);
    assert.equal(controller.errors[0].container, bad);
    assert.equal(button(document.querySelector('#good')!).dataset.platform, 'email');
    append.mock.mockImplementation(original);
    controller.refresh();
    assert.equal(controller.instances.length, 2);
    assert.deepEqual(controller.errors, []);
  });

  it('is safe without document and has no delayed automatic initialization', () => {
    stubGlobal('document', undefined);
    const controller = mount();
    assert.deepEqual(controller.instances, []);
    assert.deepEqual(controller.refresh(), []);
    assert.deepEqual(controller.errors, []);
    controller.destroy();
  });

  it('cleans a partially mounted widget if a browser capability throws', () => {
    document.body.innerHTML = '<div data-share-buttons="x" data-share-theme="auto"></div>';
    stubGlobal('matchMedia', mock.fn(() => { throw new Error('Theme query unavailable'); }));
    const controller = mount();
    assert.equal(controller.errors.length, 1);
    assert.equal(controller.instances.length, 0);
    assert.equal(document.querySelector('.social-share'), null);
    document.querySelector('div')!.setAttribute('data-share-theme', 'light');
    assert.equal(controller.refresh().length, 1);
    assert.deepEqual(controller.errors, []);
  });
});

describe('refresh stability', () => {
  it('keeps unchanged widgets, including copy feedback, when refresh runs', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mock.fn(async () => undefined) } });
    document.body.innerHTML = '<div data-share-buttons="copy" data-share-url="https://example.org/a"></div>';
    const controller = mount();
    const widget = document.querySelector('.social-share');
    button().click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(button().textContent, 'Copied!');
    controller.refresh();
    assert.equal(document.querySelector('.social-share'), widget);
    assert.equal(button().textContent, 'Copied!');
  });

  it('rebuilds a widget when its presentation attributes change', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    const widget = document.querySelector('.social-share');
    document.querySelector('div')!.setAttribute('data-share-variant', 'outline');
    controller.refresh();
    assert.notEqual(document.querySelector('.social-share'), widget);
    assert.equal(document.querySelector<HTMLElement>('.social-share')!.dataset.variant, 'outline');
  });

  it('remounts a widget that page code removed from its container', () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const controller = mount();
    document.querySelector('[data-share-buttons]')!.replaceChildren();
    controller.refresh();
    assert.equal(document.querySelectorAll('.social-share').length, 1);
  });

  it('does not duplicate widgets when two copies of the module initialize the same page', async () => {
    document.body.innerHTML = '<div data-share-buttons="x"></div>';
    const copy = await import('../src/auto.ts?second-copy') as typeof import('../src/auto.ts');
    mount();
    controllers.push(copy.initShareButtons());
    assert.equal(document.querySelectorAll('.social-share').length, 1);
  });
});
