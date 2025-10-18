/**
 * social-share-buttons - Modern, lightweight social sharing library
 * No dependencies, no icons, just sharing functionality
 */

export type Theme = 'light' | 'dark' | 'auto';

export type PlatformName =
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
  | 'copy';

export interface ShareData {
  url?: string;
  title?: string;
  text?: string;
  description?: string;
  hashtags?: string[];
  via?: string;
  media?: string;
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
  container?: HTMLElement | string;
  nativeShare?: boolean;
  popup?: boolean;
  popupWidth?: number;
  popupHeight?: number;
  labels?: Partial<Record<PlatformName | 'copied', string>>;
  customPlatforms?: CustomPlatform[];
  onShare?: (platform: PlatformName, success: boolean) => void;
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
  share: (platform: PlatformName, data?: ShareData) => Promise<boolean>;
  shareNative: (data?: ShareData) => Promise<boolean>;
}
