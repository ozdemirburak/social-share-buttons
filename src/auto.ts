import SocialShareButtons from './SocialShareButtons.ts';
import { defaultPlatforms } from './platforms.ts';
import type {
  ButtonLayout,
  ButtonSize,
  ButtonVariant,
  ShareData,
  SocialShareButtonsOptions,
  Theme,
} from './types.ts';

export interface ShareButtonsController {
  /** A snapshot of the instances owned by this controller. */
  readonly instances: SocialShareButtons[];
  /** Mount/update failures from the most recent refresh, without stopping other widgets. */
  readonly errors: { container: HTMLElement; cause: unknown }[];
  /** Mount added containers, update attributes, and release removed containers. */
  refresh(): SocialShareButtons[];
  /** Remove only this controller's widgets. Calling refresh afterwards is a no-op. */
  destroy(): void;
}

type Defaults = Omit<SocialShareButtonsOptions, 'container'>;
const selector = '[data-share-buttons]';
const owners = new WeakMap<HTMLElement, symbol>();

function enumAttribute<T extends string>(element: HTMLElement, name: string, values: readonly T[]): T | undefined {
  const value = element.getAttribute(`data-share-${name}`);
  return values.includes(value as T) ? value as T : undefined;
}

function booleanAttribute(element: HTMLElement, name: string): boolean | undefined {
  const value = element.getAttribute(`data-share-${name}`);
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function readAttributes(element: HTMLElement): ShareData {
  const data: ShareData = {};
  for (const key of ['title', 'text', 'description', 'via'] as const) {
    const value = element.getAttribute(`data-share-${key}`);
    if (value !== null) data[key] = value;
  }
  for (const key of ['url', 'media'] as const) {
    const value = element.getAttribute(`data-share-${key}`);
    if (value === null) continue;
    const url = new URL(value, element.ownerDocument.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error(`SocialShareButtons: data-share-${key} must resolve to an HTTP(S) URL without credentials`);
    }
    data[key] = url.href;
  }
  const instance = element.getAttribute('data-share-mastodon-instance');
  if (instance !== null) data.mastodonInstance = instance;
  const hashtags = element.getAttribute('data-share-hashtags');
  if (hashtags !== null) data.hashtags = hashtags.split(',').map(value => value.trim().replace(/^#/, '')).filter(Boolean);
  return data;
}

function optionsFor(element: HTMLElement, defaults: Defaults): SocialShareButtonsOptions {
  const options: SocialShareButtonsOptions = {
    ...defaults,
    container: element,
    platforms: defaults.platforms ?? defaultPlatforms,
    data: () => {
      const supplied = typeof defaults.data === 'function' ? defaults.data() : defaults.data;
      if (supplied && typeof supplied === 'object' && 'then' in supplied && typeof supplied.then === 'function') {
        // As with direct instances, consume rejected async results before
        // reporting that providers must preserve synchronous user activation.
        void Promise.resolve(supplied as PromiseLike<unknown>).catch(() => undefined);
      }
      if (supplied !== undefined && (
        supplied === null || typeof supplied !== 'object' || Array.isArray(supplied) || 'then' in supplied
      )) {
        throw new TypeError('SocialShareButtons: data must return a share data object synchronously');
      }
      return { ...supplied, ...readAttributes(element) };
    },
  };
  // An empty marker means "use the defaults"; an explicitly empty platforms
  // attribute means "render no platform buttons".
  const platforms = element.getAttribute('data-share-platforms') ?? element.getAttribute('data-share-buttons')?.trim();
  if (element.hasAttribute('data-share-platforms') || platforms) {
    options.platforms = (platforms ?? '').split(',').map(value => value.trim()).filter(Boolean);
  }
  const theme = enumAttribute<Theme>(element, 'theme', ['light', 'dark', 'auto']);
  const variant = enumAttribute<ButtonVariant>(element, 'variant', ['solid', 'outline', 'minimal']);
  const size = enumAttribute<ButtonSize>(element, 'size', ['sm', 'md', 'lg']);
  const layout = enumAttribute<ButtonLayout>(element, 'layout', ['horizontal', 'vertical']);
  // Include defaults explicitly so removing an attribute resets an existing
  // instance instead of retaining the previous value through a shallow merge.
  options.theme = theme ?? defaults.theme ?? 'light';
  options.variant = variant ?? defaults.variant ?? 'solid';
  options.size = size ?? defaults.size ?? 'md';
  options.layout = layout ?? defaults.layout ?? 'horizontal';
  const popup = booleanAttribute(element, 'popup');
  const nativeShare = booleanAttribute(element, 'native-share');
  options.popup = popup ?? defaults.popup ?? true;
  options.nativeShare = nativeShare ?? defaults.nativeShare ?? false;
  const ariaLabel = element.getAttribute('data-share-aria-label');
  options.ariaLabel = ariaLabel ?? defaults.ariaLabel;
  return options;
}

/**
 * Initialize CMS/article widgets marked with data-share-buttons.
 * Imports have no side effects. Call refresh after adding/removing containers or
 * changing their presentation attributes; share-data attributes are always live.
 */
export function initShareButtons(root?: ParentNode, defaults: Defaults = {}): ShareButtonsController {
  const scope = root ?? (typeof document === 'undefined' ? undefined : document);
  const token = Symbol('share-buttons-controller');
  const mounted = new Map<HTMLElement, SocialShareButtons>();
  let failures: { container: HTMLElement; cause: unknown }[] = [];
  let destroyed = false;

  const release = (element: HTMLElement, instance: SocialShareButtons): void => {
    instance.destroy();
    mounted.delete(element);
    if (owners.get(element) === token) owners.delete(element);
  };

  const controller: ShareButtonsController = {
    get instances() { return [...mounted.values()]; },
    get errors() { return [...failures]; },
    refresh() {
      if (destroyed || !scope) return [];
      failures = [];
      const elements: Element[] = [];
      // Avoid instanceof: callers may pass an element from another document.
      if ('nodeType' in scope && scope.nodeType === 1 && (scope as Element).matches(selector)) {
        elements.push(scope as Element);
      }
      elements.push(...scope.querySelectorAll(selector));
      const containers = new Set(elements.filter(element => element.namespaceURI === 'http://www.w3.org/1999/xhtml') as HTMLElement[]);
      for (const [element, instance] of mounted) {
        if (!containers.has(element)) release(element, instance);
      }
      for (const container of containers) {
        if (owners.has(container) && owners.get(container) !== token) continue;
        let created: SocialShareButtons | undefined;
        try {
          const instance = mounted.get(container);
          if (instance) {
            instance.updateOptions(optionsFor(container, defaults));
          } else {
            // Keep an instance handle before mounting so even a partial DOM
            // failure can be cleaned up without leaving a duplicate widget.
            created = new SocialShareButtons({ ...optionsFor(container, defaults), container: false });
            created.updateOptions({ container });
            mounted.set(container, created);
            owners.set(container, token);
          }
        } catch (cause) {
          created?.destroy();
          failures.push({ container, cause });
        }
      }
      return controller.instances;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const [element, instance] of mounted) release(element, instance);
      failures = [];
    },
  };
  controller.refresh();
  return controller;
}
