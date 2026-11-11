import { after } from 'node:test';
import { JSDOM } from 'jsdom';

const originalGlobals = new Map();
const stubs = new Map();
let dom;

function replace(target, name, value, originals) {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(target, name));
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function restore(target, originals) {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete target[name];
  }
  originals.clear();
}

// Each test file runs in its own Node process. Keep DOM fixtures out of SSR tests.
export function installDOM() {
  if (dom) return dom.window;
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost:3000/',
    pretendToBeVisual: true,
  });
  for (const name of [
    'window', 'document', 'navigator', 'location', 'history',
    'Node', 'Element', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement',
    'HTMLTextAreaElement', 'Document', 'DocumentFragment', 'ShadowRoot',
    'EventTarget', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
    'FocusEvent', 'DOMException', 'MutationObserver', 'AbortController', 'AbortSignal',
  ]) {
    replace(globalThis, name, dom.window[name], originalGlobals);
  }
  for (const name of ['open', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    replace(globalThis, name, dom.window[name].bind(dom.window), originalGlobals);
  }
  after(() => {
    restoreGlobals();
    dom.window.close();
    restore(globalThis, originalGlobals);
  });
  return dom.window;
}

export function stubGlobal(name, value) {
  for (const target of [globalThis, dom?.window].filter(Boolean)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    // jsdom's window/document accessors are fixed; their global aliases can still be stubbed.
    if (descriptor && !descriptor.configurable) continue;
    if (!stubs.has(target)) stubs.set(target, new Map());
    replace(target, name, value, stubs.get(target));
  }
}

export function restoreGlobals() {
  for (const [target, originals] of stubs) restore(target, originals);
  stubs.clear();
}
