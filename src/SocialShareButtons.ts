import type {
  SocialShareButtonsOptions,
  SocialShareButtonsInstance,
  ShareData,
  PlatformName,
} from './types';
import { platforms, defaultPlatforms, getPlatform } from './platforms';

const DEFAULT_OPTIONS: Required<Omit<SocialShareButtonsOptions, 'container' | 'labels' | 'customPlatforms' | 'onShare' | 'className' | 'ariaLabel'>> = {
  platforms: defaultPlatforms as PlatformName[],
  theme: 'light',
  nativeShare: false,
  popup: true,
  popupWidth: 550,
  popupHeight: 420,
  copiedDuration: 2000,
};

export class SocialShareButtons implements SocialShareButtonsInstance {
  private options: SocialShareButtonsOptions;
  private container: HTMLElement | null = null;
  private widget: HTMLElement | null = null;
  private shareData: ShareData;

  constructor(options: SocialShareButtonsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.shareData = this.getDefaultShareData();

    // Add custom platforms if provided
    if (this.options.customPlatforms) {
      this.options.customPlatforms.forEach(platform => {
        platforms[platform.name] = platform;
      });
    }

    this.init();
  }

  private init(): void {
    // Find or create container
    if (this.options.container) {
      if (typeof this.options.container === 'string') {
        this.container = document.querySelector(this.options.container);
      } else {
        this.container = this.options.container;
      }
    } else {
      this.container = document.body;
    }

    if (!this.container) {
      throw new Error('SocialShareButtons: Container not found');
    }

    this.createWidget();
    this.attachEventListeners();
    this.updateTheme();
  }

  private getDefaultShareData(): ShareData {
    // Try to get data from meta tags
    const getMeta = (name: string): string | undefined => {
      const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      return meta?.getAttribute('content') || undefined;
    };

    return {
      url: window.location.href,
      title: document.title,
      description: getMeta('og:description') || getMeta('description'),
      media: getMeta('og:image'),
    };
  }

  private createWidget(): void {
    const widget = document.createElement('div');
    widget.className = `social-share ${this.options.className || ''}`;
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', this.options.ariaLabel || 'Social sharing buttons');
    widget.setAttribute('data-theme', this.options.theme || 'auto');

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'social-share-buttons';

    // Add platform buttons
    this.options.platforms?.forEach(platformName => {
      const platform = getPlatform(platformName);
      if (!platform) return;

      const button = this.createButton(platform.name, platform.label);
      buttonContainer.appendChild(button);
    });

    widget.appendChild(buttonContainer);
    this.container?.appendChild(widget);
    this.widget = widget;
  }

  private createButton(platformName: PlatformName, label: string): HTMLElement {
    const button = document.createElement('button');
    button.className = 'social-share-button';
    button.setAttribute('data-platform', platformName);
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', `Share on ${label}`);

    const customLabel = this.options.labels?.[platformName];
    const displayLabel = customLabel || label;

    button.textContent = displayLabel;

    // Set custom property for theming
    const platform = getPlatform(platformName);
    if (platform?.color) {
      button.style.setProperty('--social-share-buttons-color', platform.color);
    }

    return button;
  }

  private attachEventListeners(): void {
    this.widget?.addEventListener('click', this.handleClick.bind(this));

    // Handle theme changes
    if (this.options.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => this.updateTheme());
    }
  }

  private async handleClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const button = target.closest('[data-platform]') as HTMLElement;

    if (!button) return;

    event.preventDefault();
    const platformName = button.getAttribute('data-platform') as PlatformName;

    await this.share(platformName, this.shareData);
  }

  public async share(platformName: PlatformName, data?: ShareData): Promise<boolean> {
    const shareData = { ...this.shareData, ...data };

    // Try native share first if enabled and available
    if (
      this.options.nativeShare &&
      platformName !== 'copy' &&
      this.canUseNativeShare()
    ) {
      return this.shareNative(shareData);
    }

    // Handle copy specially
    if (platformName === 'copy') {
      return this.copyToClipboard(shareData.url || window.location.href);
    }

    const platform = getPlatform(platformName);
    if (!platform) {
      console.warn(`SocialShareButtons: Platform "${platformName}" not found`);
      return false;
    }

    const shareUrl = platform.getShareUrl(shareData);

    // Open share URL
    if (this.options.popup) {
      this.openPopup(shareUrl);
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }

    // Trigger callback
    this.options.onShare?.(platformName, true);

    return true;
  }

  private openPopup(url: string): void {
    const width = this.options.popupWidth || 550;
    const height = this.options.popupHeight || 420;
    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;

    const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    window.open(url, 'share-popup', features);
  }

  public async shareNative(data?: ShareData): Promise<boolean> {
    if (!this.canUseNativeShare()) {
      console.warn('SocialShareButtons: Native share API not available');
      return false;
    }

    const shareData = { ...this.shareData, ...data };

    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.text || shareData.description,
        url: shareData.url,
      });

      this.options.onShare?.('native' as PlatformName, true);
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('SocialShareButtons: Native share failed', error);
      }
      return false;
    }
  }

  private canUseNativeShare(): boolean {
    return 'share' in navigator && navigator.canShare !== undefined;
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Visual feedback
      const copyButton = this.widget?.querySelector('[data-platform="copy"]');
      if (copyButton) {
        const originalContent = copyButton.innerHTML;
        const feedbackText = this.options.labels?.copied || 'Copied!';
        copyButton.innerHTML = feedbackText;
        setTimeout(() => {
          copyButton.innerHTML = originalContent;
        }, this.options.copiedDuration || 2000);
      }

      this.options.onShare?.('copy', true);
      return true;
    } catch (error) {
      console.error('SocialShareButtons: Copy to clipboard failed', error);
      return false;
    }
  }

  private updateTheme(): void {
    if (!this.widget) return;

    if (this.options.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.widget.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      this.widget.setAttribute('data-theme', this.options.theme || 'light');
    }
  }

  public updateOptions(options: Partial<SocialShareButtonsOptions>): void {
    this.options = { ...this.options, ...options };

    // Recreate widget with new options
    if (this.widget) {
      this.widget.remove();
      this.createWidget();
      this.updateTheme();
    }
  }

  public destroy(): void {
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
    }
  }
}

export default SocialShareButtons;
