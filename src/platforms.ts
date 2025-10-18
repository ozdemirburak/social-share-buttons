import type { Platform, ShareData } from './types';

export const platforms: Record<string, Platform> = {
  x: {
    name: 'x',
    label: 'X',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      if (data.text) params.set('text', data.text);
      if (data.hashtags?.length) params.set('hashtags', data.hashtags.join(','));
      if (data.via) params.set('via', data.via);
      return `https://x.com/intent/tweet?${params.toString()}`; // https://developer.x.com/en/docs/x-for-websites/web-intents/overview
    },
    color: '#000000',
  },

  bluesky: {
    name: 'bluesky',
    label: 'Bluesky',
    getShareUrl: (data: ShareData) => {
      const text = [data.text, data.url].filter(Boolean).join('\n\n');
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      return `https://bsky.app/intent/compose?${params.toString()}`; // https://docs.bsky.app/docs/advanced-guides/intent-links
    },
    color: '#1185fe',
  },

  threads: {
    name: 'threads',
    label: 'Threads',
    getShareUrl: (data: ShareData) => {
      const text = [data.text, data.url].filter(Boolean).join('\n\n');
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      return `https://www.threads.net/intent/post?${params.toString()}`; // https://developers.facebook.com/docs/threads/threads-web-intents/
    },
    color: '#000000',
  },

  mastodon: {
    name: 'mastodon',
    label: 'Mastodon',
    getShareUrl: (data: ShareData) => {
      const text = [data.text, data.url].filter(Boolean).join('\n\n');
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      // Note: Mastodon share requires instance selection, using default share interface
      return `https://mastodon.social/share?${params.toString()}`;
    },
    color: '#6364ff',
  },

  facebook: {
    name: 'facebook',
    label: 'Facebook',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('u', data.url);
      return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
    },
    color: '#0866FF',
  },

  linkedin: {
    name: 'linkedin',
    label: 'LinkedIn',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
    },
    color: '#0077b5',
  },

  reddit: {
    name: 'reddit',
    label: 'Reddit',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      if (data.title) params.set('title', data.title);
      return `https://www.reddit.com/submit?${params.toString()}`;
    },
    color: '#ff4500',
  },

  telegram: {
    name: 'telegram',
    label: 'Telegram',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      if (data.text) params.set('text', data.text);
      return `https://t.me/share/url?${params.toString()}`;
    },
    color: '#0088cc',
  },

  whatsapp: {
    name: 'whatsapp',
    label: 'WhatsApp',
    getShareUrl: (data: ShareData) => {
      const text = [data.text, data.url].filter(Boolean).join(' ');
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      // Auto-detect mobile vs desktop
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const baseUrl = isMobile ? 'whatsapp://send' : 'https://web.whatsapp.com/send';
      return `${baseUrl}?${params.toString()}`;
    },
    color: '#25d366',
  },

  email: {
    name: 'email',
    label: 'Email',
    getShareUrl: (data: ShareData) => {
      const subject = data.title || data.text || '';
      const body = [data.description, data.url].filter(Boolean).join('\n\n');
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (body) params.set('body', body);
      return `mailto:?${params.toString()}`;
    },
    color: '#7f7f7f',
  },

  pinterest: {
    name: 'pinterest',
    label: 'Pinterest',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      if (data.media) params.set('media', data.media);
      if (data.description) params.set('description', data.description);
      return `https://pinterest.com/pin/create/button/?${params.toString()}`;
    },
    color: '#bd081c',
  },

  copy: {
    name: 'copy',
    label: 'Copy',
    getShareUrl: (data: ShareData) => {
      return data.url || window.location.href;
    },
    color: '#6c757d',
  },
};

export const defaultPlatforms = ['x', 'facebook', 'whatsapp'];

export const getPlatform = (name: string): Platform | undefined => {
  return platforms[name];
};
