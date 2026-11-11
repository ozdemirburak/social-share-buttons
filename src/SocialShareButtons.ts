import type {
  SocialShareButtonsOptions,
  SocialShareButtonsInstance,
  ShareData,
  ShareTarget,
  Platform,
  PlatformName,
  ShareDataSource,
  ShareError,
} from './types.ts';
import { defaultPlatforms, getPlatform } from './platforms.ts';
import { readShareData } from './share-data.ts';

const DEFAULT_OPTIONS = {
  platforms: defaultPlatforms,
  theme: 'light' as const,
  nativeShare: false,
  popup: true,
  popupWidth: 550,
  popupHeight: 420,
  copiedDuration: 2000,
  variant: 'solid' as const,
  size: 'md' as const,
  layout: 'horizontal' as const,
};

/** A dependency-free sharing widget, also usable without rendering any buttons. */
export class SocialShareButtons implements SocialShareButtonsInstance {
  private options: SocialShareButtonsOptions;
  private widget: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private customPlatforms = new Map<string, Platform>();
  private mediaQuery: MediaQueryList | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  private generation = 0;
  private pending = new Set<string>();

  constructor(options: SocialShareButtonsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.customPlatforms = this.collectCustomPlatforms(this.options);
    this.mount(this.resolveContainer(this.options));
  }

  private collectCustomPlatforms(options: SocialShareButtonsOptions): Map<string, Platform> {
    return new Map((options.customPlatforms ?? []).map(platform => {
      if (!platform.name || typeof platform.getShareUrl !== 'function') {
        throw new Error('SocialShareButtons: Custom platforms need a name and getShareUrl function');
      }
      return [platform.name, { ...platform }];
    }));
  }

  private getPlatform(name: PlatformName): Platform | undefined {
    if (name === 'native') return { name, label: 'Share', getShareUrl: () => '' };
    return this.customPlatforms.get(name) ?? getPlatform(name);
  }

  private resolveContainer(options: SocialShareButtonsOptions): HTMLElement | null {
    // Importing and constructing the library is safe during server rendering.
    if (typeof document === 'undefined' || options.container === false) return null;
    const container = typeof options.container === 'string'
      ? document.querySelector<HTMLElement>(options.container)
      : options.container ?? document.body;
    if (!container) throw new Error('SocialShareButtons: Container not found');
    return container;
  }

  private mount(container: HTMLElement | null): void {
    if (!container) return;
    const document = container.ownerDocument;
    const widget = document.createElement('div');
    widget.className = ['social-share', this.options.className].filter(Boolean).join(' ');
    widget.setAttribute('role', 'group');
    widget.setAttribute('aria-label', this.options.ariaLabel ?? 'Social sharing buttons');
    widget.dataset.variant = this.options.variant ?? 'solid';
    widget.dataset.size = this.options.size ?? 'md';
    widget.dataset.layout = this.options.layout ?? 'horizontal';

    const buttons = document.createElement('div');
    buttons.className = 'social-share-buttons';
    for (const name of new Set(this.options.platforms ?? defaultPlatforms)) {
      if (name === 'native' && !this.hasNativeShare()) continue;
      const platform = this.getPlatform(name);
      if (!platform) continue;
      const button = document.createElement('button');
      button.className = 'social-share-button';
      button.type = 'button';
      button.dataset.platform = name;
      this.renderButtonContent(button, name, platform.label);
      if (platform.color) button.style.setProperty('--social-share-buttons-color', platform.color);
      buttons.appendChild(button);
    }

    this.status = document.createElement('span');
    this.status.className = 'social-share-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.setAttribute('aria-atomic', 'true');
    widget.append(buttons, this.status);
    widget.addEventListener('click', this.handleClick);
    this.widget = widget;
    container.appendChild(widget);
    this.refreshPending();
    this.attachThemeListener();
    this.updateTheme();
  }

  private renderButtonContent(button: HTMLButtonElement, name: PlatformName, defaultLabel: string): void {
    const text = button.ownerDocument.createElement('span');
    text.className = 'social-share-label';
    text.textContent = this.options.labels?.[name] ?? defaultLabel;
    button.replaceChildren(text);
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target as Element | null;
    const button = target?.closest?.<HTMLButtonElement>('button.social-share-button[data-platform]');
    if (!button || button.disabled || !this.widget?.contains(button)) return;
    event.preventDefault();
    void this.share(button.dataset.platform!);
  };

  private getShareData(data?: ShareData): ShareData {
    const supplied = typeof this.options.data === 'function' ? this.options.data() : this.options.data;
    if (supplied && typeof supplied === 'object' && 'then' in supplied && typeof supplied.then === 'function') {
      // Async providers cannot preserve a browser's user activation. Consume a
      // rejected promise before reporting the synchronous API contract violation.
      void Promise.resolve(supplied as PromiseLike<unknown>).catch(() => undefined);
    }
    if (supplied !== undefined && (
      supplied === null || typeof supplied !== 'object' || Array.isArray(supplied) || 'then' in supplied
    )) {
      throw new TypeError('SocialShareButtons: data must return a share data object synchronously');
    }
    return { ...readShareData(this.widget?.ownerDocument), ...supplied, ...data };
  }

  /** Replace share data without rebuilding buttons or disturbing keyboard focus. */
  public setData(data: ShareDataSource): void {
    if (this.destroyed) throw new Error('SocialShareButtons: Cannot update a destroyed instance');
    this.options = { ...this.options, data };
  }

  private refreshPending(): void {
    for (const button of this.widget?.querySelectorAll<HTMLButtonElement>('[data-platform]') ?? []) {
      const name = button.dataset.platform!;
      const busy = this.pending.has(name) || (
        this.pending.has('native') && !!this.options.nativeShare && name !== 'copy'
      );
      button.disabled = busy;
      if (busy) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    }
  }

  private startPending(action: string): () => void {
    const document = this.widget?.ownerDocument;
    const active = document?.activeElement as HTMLElement | null;
    const platform = active && this.widget?.contains(active) ? active.dataset.platform : undefined;
    const restorePlatform = platform && (
      platform === action || (action === 'native' && this.options.nativeShare && platform !== 'copy')
    ) ? platform : undefined;
    this.pending.add(action);
    this.refreshPending();
    return () => {
      this.pending.delete(action);
      this.refreshPending();
      // Disabling a focused button blurs it in browsers. Restore its current
      // equivalent only while focus remains unclaimed, including after a rebuild.
      if (!restorePlatform || !document || this.destroyed || this.widget?.ownerDocument !== document) return;
      const current = document.activeElement;
      if (current && current !== document.body && current !== document.documentElement) return;
      const button = Array.from(this.widget.querySelectorAll<HTMLButtonElement>('button[data-platform]'))
        .find(candidate => candidate.dataset.platform === restorePlatform);
      if (button && !button.disabled && button.isConnected) button.focus({ preventScroll: true });
    };
  }

  private fail(platform: ShareTarget, code: ShareError['code'], cause?: unknown, announce = true): false {
    if (this.destroyed) return false;
    if (announce && this.status) {
      this.status.textContent = code === 'cancelled'
        ? this.options.labels?.cancelled ?? 'Sharing cancelled.'
        : this.options.labels?.failed ?? 'Sharing could not be completed. Please try again.';
    }
    try {
      this.options.onError?.({ platform, code, ...(cause === undefined ? {} : { cause }) });
    } catch {
      // Application telemetry must not prevent failure callbacks or cleanup.
    }
    this.report(platform, false);
    return false;
  }

  private report(platform: ShareTarget, success: boolean): boolean {
    // Consumer callbacks must not turn a completed action into a rejected promise,
    // or trigger a second failure notification when they throw.
    try {
      this.options.onShare?.(platform, success);
    } catch {
      // The action's result is independent of application callback errors.
    }
    return success;
  }

  public async share(platformName: PlatformName, data?: ShareData): Promise<boolean> {
    if (this.destroyed) return false;
    if (platformName === 'native') return this.shareNative(data);
    const platform = this.getPlatform(platformName);
    if (!platform) return this.fail(platformName, 'unknown-platform');
    if (typeof window === 'undefined') return this.fail(platformName, 'unsupported');
    let shareData: ShareData;
    try {
      shareData = this.getShareData(data);
    } catch (error) {
      return this.fail(platformName, 'data-failed', error);
    }
    if (platformName === 'copy') {
      if (this.pending.has('copy')) return this.fail('copy', 'busy', undefined, false);
      const generation = this.generation;
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = undefined;
      const copyButton = this.widget?.querySelector<HTMLButtonElement>('[data-platform="copy"]');
      if (copyButton) this.renderButtonContent(copyButton, 'copy', this.getPlatform('copy')?.label ?? 'Copy');
      if (this.status) this.status.textContent = '';
      const finishPending = this.startPending('copy');
      try {
        const success = await this.copyToClipboard(shareData.url ?? window.location.href);
        if (this.destroyed) return success;
        if (!success) return this.fail('copy', 'clipboard-failed', undefined, generation === this.generation);
        if (generation === this.generation) this.showCopyFeedback();
        return this.report('copy', true);
      } catch (error) {
        return this.fail('copy', 'clipboard-failed', error, generation === this.generation);
      } finally {
        finishPending();
      }
    }
    if (this.options.nativeShare && this.canUseNativeShare(shareData)) {
      return this.performNativeShare(shareData);
    }

    let url: URL;
    try {
      const shareUrl = platform.getShareUrl(shareData);
      if (typeof shareUrl !== 'string' || !shareUrl.trim()) return this.fail(platformName, 'invalid-url');
      url = new URL(shareUrl, window.location.href);
      // Custom platforms may build URLs, but cannot execute scripts or data URLs.
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) {
        return this.fail(platformName, 'invalid-url');
      }
    } catch (error) {
      return this.fail(platformName, 'invalid-url', error);
    }
    try {
      const features = ['noopener', 'noreferrer'];
      // Framework wrappers often forward unset props as undefined; keep the default.
      if ((this.options.popup ?? true) && url.protocol !== 'mailto:') {
        const width = this.positiveNumber(this.options.popupWidth, 550);
        const height = this.positiveNumber(this.options.popupHeight, 420);
        // Center over the opener window. Secondary monitors can have negative
        // screen coordinates, so do not clamp; browsers keep popups on screen.
        const left = Math.round(window.screenX + ((window.outerWidth || window.innerWidth) - width) / 2);
        const top = Math.round(window.screenY + ((window.outerHeight || window.innerHeight) - height) / 2);
        features.push(`width=${width}`, `height=${height}`, `left=${left}`, `top=${top}`, 'scrollbars=yes', 'resizable=yes');
      }
      // noopener deliberately makes the returned handle unreliable. Success means
      // the request was dispatched; it does not prove that a post was published.
      window.open(url.href, '_blank', features.join(','));
      return this.report(platformName, true);
    } catch (error) {
      return this.fail(platformName, 'share-failed', error);
    }
  }

  private positiveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.max(1, Math.round(value)) : fallback;
  }

  private nativeData(data: ShareData): globalThis.ShareData {
    const native: globalThis.ShareData = {};
    if (data.title) native.title = data.title;
    if (data.text ?? data.description) native.text = data.text ?? data.description;
    if (data.url) native.url = data.url;
    return native;
  }

  private canUseNativeShare(data: ShareData): boolean {
    if (!this.hasNativeShare()) return false;
    try {
      return typeof navigator.canShare !== 'function' || navigator.canShare(this.nativeData(data));
    } catch {
      return false;
    }
  }

  private hasNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  public async shareNative(data?: ShareData): Promise<boolean> {
    if (this.destroyed) return false;
    let shareData: ShareData;
    try {
      shareData = this.getShareData(data);
    } catch (error) {
      return this.fail('native', 'data-failed', error);
    }
    return this.performNativeShare(shareData);
  }

  private async performNativeShare(shareData: ShareData): Promise<boolean> {
    if (!this.canUseNativeShare(shareData)) return this.fail('native', 'unsupported');
    if (this.pending.has('native')) return this.fail('native', 'busy', undefined, false);
    const generation = this.generation;
    if (this.status) this.status.textContent = '';
    const finishPending = this.startPending('native');
    try {
      await navigator.share(this.nativeData(shareData));
      return this.destroyed ? true : this.report('native', true);
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      return this.fail('native', cancelled ? 'cancelled' : 'share-failed', error, generation === this.generation);
    } finally {
      finishPending();
    }
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Permissions or browser policy can reject even an available Clipboard API.
      }
    }
    if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') return false;
    const active = document.activeElement as HTMLElement | null;
    const selection = document.getSelection();
    const ranges: Range[] = [];
    for (let i = 0; selection && i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
    try {
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
      try {
        active?.focus({ preventScroll: true });
        if (selection) {
          selection.removeAllRanges();
          for (const range of ranges) selection.addRange(range);
        }
      } catch {
        // A copy handler may have removed the previously focused DOM nodes.
      }
    }
  }

  private showCopyFeedback(): void {
    const button = this.widget?.querySelector<HTMLButtonElement>('[data-platform="copy"]');
    if (!button) return;
    clearTimeout(this.feedbackTimer);
    const feedback = this.options.labels?.copied ?? 'Copied!';
    button.textContent = feedback;
    if (this.status) this.status.textContent = feedback;
    const duration = this.options.copiedDuration;
    this.feedbackTimer = setTimeout(() => {
      this.renderButtonContent(button, 'copy', this.getPlatform('copy')?.label ?? 'Copy');
      if (this.status) this.status.textContent = '';
      this.feedbackTimer = undefined;
    }, typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 ? duration : 2000);
  }

  private attachThemeListener(): void {
    if (this.options.theme !== 'auto' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof this.mediaQuery.addEventListener === 'function') {
      this.mediaQuery.addEventListener('change', this.updateTheme);
    } else {
      this.mediaQuery.addListener(this.updateTheme);
    }
  }

  private readonly updateTheme = (): void => {
    if (!this.widget) return;
    const theme = this.options.theme === 'auto'
      ? this.mediaQuery?.matches ? 'dark' : 'light'
      : this.options.theme ?? 'light';
    this.widget.dataset.theme = theme;
  };

  private unmount(): void {
    this.generation++;
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = undefined;
    if (this.mediaQuery) {
      if (typeof this.mediaQuery.removeEventListener === 'function') {
        this.mediaQuery.removeEventListener('change', this.updateTheme);
      } else {
        this.mediaQuery.removeListener(this.updateTheme);
      }
      this.mediaQuery = null;
    }
    this.widget?.removeEventListener('click', this.handleClick);
    this.widget?.remove();
    this.widget = null;
    this.status = null;
  }

  public updateOptions(options: Partial<SocialShareButtonsOptions>): void {
    if (this.destroyed) throw new Error('SocialShareButtons: Cannot update a destroyed instance');
    const next = { ...this.options, ...options };
    // Resolve and validate before removing the working widget.
    const container = this.resolveContainer(next);
    const customPlatforms = this.collectCustomPlatforms(next);
    const active = this.widget?.ownerDocument.activeElement as HTMLElement | null;
    const focusedPlatform = active && this.widget?.contains(active) ? active.dataset.platform : undefined;
    this.unmount();
    this.options = next;
    this.customPlatforms = customPlatforms;
    this.mount(container);
    if (focusedPlatform) {
      const button = Array.from(this.widget?.querySelectorAll<HTMLButtonElement>('[data-platform]') ?? [])
        .find(candidate => candidate.dataset.platform === focusedPlatform);
      button?.focus();
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.unmount();
  }
}

export default SocialShareButtons;
