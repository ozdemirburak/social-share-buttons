/**
 * social-share-buttons - Modern, lightweight social sharing library
 * Zero runtime dependencies, with text labels and framework helpers
 */

export type Theme = 'light' | 'dark' | 'auto';
export type ButtonVariant = 'solid' | 'outline' | 'minimal';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonLayout = 'horizontal' | 'vertical';

export type BuiltInPlatformName =
  | 'x'
  | 'bluesky'
  | 'threads'
  | 'mastodon'
  | 'facebook'
  | 'linkedin'
  | 'reddit'
  | 'telegram'
  | 'whatsapp'
  | 'email'
  | 'pinterest'
  | 'copy'
  | 'native';

/** Built-in keys retain autocomplete while custom platforms may use any name. */
export type PlatformName = BuiltInPlatformName | (string & {});
export type ShareTarget = PlatformName | 'native';

export type ShareDataSource = ShareData | (() => ShareData);

export interface ShareError {
  platform: ShareTarget;
  code: 'unknown-platform' | 'unsupported' | 'invalid-url' | 'cancelled' |
    'clipboard-failed' | 'share-failed' | 'data-failed' | 'busy';
  cause?: unknown;
}

export interface ShareData {
  url?: string;
  title?: string;
  text?: string;
  description?: string;
  hashtags?: string[];
  via?: string;
  media?: string;
  /** HTTPS origin of the Mastodon server, e.g. https://mastodon.social. */
  mastodonInstance?: string;
}

export interface Platform {
  name: PlatformName;
  label: string;
  getShareUrl: (data: ShareData) => string;
  color?: string;
}

export interface SocialShareButtonsOptions {
  platforms?: PlatformName[];
  theme?: Theme;
  /** Use false for programmatic sharing without rendering a widget. */
  container?: HTMLElement | string | false;
  /** Defaults for each action; per-call data takes precedence. */
  data?: ShareDataSource;
  variant?: ButtonVariant;
  size?: ButtonSize;
  layout?: ButtonLayout;
  nativeShare?: boolean;
  popup?: boolean;
  popupWidth?: number;
  popupHeight?: number;
  labels?: Partial<Record<PlatformName | 'copied' | 'failed' | 'cancelled', string>>;
  customPlatforms?: CustomPlatform[];
  /** Success means the action was dispatched, not that a post was published. */
  onShare?: (platform: ShareTarget, success: boolean) => void;
  onError?: (error: ShareError) => void;
  className?: string;
  ariaLabel?: string;
  copiedDuration?: number;
}

export interface CustomPlatform extends Platform {
  name: PlatformName;
}

export interface SocialShareButtonsInstance {
  destroy: () => void;
  updateOptions: (options: Partial<SocialShareButtonsOptions>) => void;
  setData: (data: ShareDataSource) => void;
  share: (platform: PlatformName, data?: ShareData) => Promise<boolean>;
  shareNative: (data?: ShareData) => Promise<boolean>;
}
