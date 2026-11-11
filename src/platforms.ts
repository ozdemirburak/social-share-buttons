import type { Platform, ShareData } from './types.ts';

const getText = (data: ShareData): string | undefined =>
  data.text ?? data.title ?? data.description;

const composeText = (data: ShareData, separator = '\n\n'): string =>
  [getText(data), data.url].filter(Boolean).join(separator);

/** Some services accept only a link; without one they open a broken page. */
const requireUrl = (data: ShareData, label: string): string => {
  if (!data.url) throw new Error(`SocialShareButtons: ${label} needs a URL to share`);
  return data.url;
};

const getMastodonUrl = (data: ShareData): string => {
  const text = composeText(data);
  if (data.mastodonInstance === undefined) {
    // The official chooser lets visitors share through their own server.
    // https://github.com/mastodon/share/blob/main/src/Instructions.tsx
    return `https://share.joinmastodon.org/#text=${encodeURIComponent(text)}`;
  }

  const instance = new URL(data.mastodonInstance);
  if (
    instance.protocol !== 'https:' || instance.username || instance.password ||
    instance.pathname !== '/' || instance.search || instance.hash
  ) {
    throw new Error('SocialShareButtons: mastodonInstance must be an HTTPS origin');
  }

  const params = new URLSearchParams({ text });
  return `${instance.origin}/share?${params.toString()}`;
};

export const platforms: Record<string, Platform> = {
  x: {
    name: 'x',
    label: 'X',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams();
      if (data.url) params.set('url', data.url);
      const text = getText(data);
      if (text) params.set('text', text);
      if (data.hashtags?.length) params.set('hashtags', data.hashtags.join(','));
      if (data.via) params.set('via', data.via);
      return `https://x.com/intent/tweet?${params.toString()}`; // https://publish.x.com/
    },
    color: '#000000',
  },

  bluesky: {
    name: 'bluesky',
    label: 'Bluesky',
    getShareUrl: (data: ShareData) => {
      const text = composeText(data);
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      return `https://bsky.app/intent/compose?${params.toString()}`; // https://bsky.network/docs/intent-links/
    },
    color: '#1185fe',
  },

  threads: {
    name: 'threads',
    label: 'Threads',
    getShareUrl: (data: ShareData) => {
      // Threads documents url as the link attachment, so keep it out of the text.
      const params = new URLSearchParams();
      const text = getText(data);
      if (text) params.set('text', text);
      if (data.url) params.set('url', data.url);
      return `https://www.threads.com/intent/post?${params.toString()}`; // https://developers.facebook.com/docs/threads/threads-web-intents/
    },
    color: '#000000',
  },

  mastodon: {
    name: 'mastodon',
    label: 'Mastodon',
    getShareUrl: getMastodonUrl,
    color: '#6364ff',
  },

  facebook: {
    name: 'facebook',
    label: 'Facebook',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams({ u: requireUrl(data, 'Facebook') });
      return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
    },
    color: '#0866FF',
  },

  linkedin: {
    name: 'linkedin',
    label: 'LinkedIn',
    getShareUrl: (data: ShareData) => {
      const params = new URLSearchParams({ url: requireUrl(data, 'LinkedIn') });
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
      // https://core.telegram.org/widgets/share: url is required, text optional.
      const params = new URLSearchParams({ url: requireUrl(data, 'Telegram') });
      const text = getText(data);
      if (text) params.set('text', text);
      return `https://t.me/share/url?${params.toString()}`;
    },
    color: '#0088cc',
  },

  whatsapp: {
    name: 'whatsapp',
    label: 'WhatsApp',
    getShareUrl: (data: ShareData) => {
      const text = composeText(data, ' ');
      const params = new URLSearchParams();
      if (text) params.set('text', text);
      // Universal link works on mobile and desktop without user-agent sniffing.
      // https://faq.whatsapp.com/5913398998672934
      return `https://wa.me/?${params.toString()}`;
    },
    color: '#25d366',
  },

  email: {
    name: 'email',
    label: 'Email',
    getShareUrl: (data: ShareData) => {
      const subject = (data.title ?? data.text ?? '').replace(/[\r\n]+/g, ' ');
      const body = [data.text ?? data.description, data.url]
        .filter(Boolean).join('\r\n\r\n').replace(/\r\n|\r|\n/g, '\r\n');
      // RFC 6068 requires %20 for spaces and CRLF for body line breaks.
      const params: string[] = [];
      if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return `mailto:?${params.join('&')}`;
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
      const description = data.description ?? data.text ?? data.title;
      if (description) params.set('description', description);
      return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
    },
    color: '#bd081c',
  },

  copy: {
    name: 'copy',
    label: 'Copy',
    getShareUrl: (data: ShareData) => {
      return data.url ?? '';
    },
    color: '#6c757d',
  },
};

export const defaultPlatforms = ['x', 'facebook', 'whatsapp'];

export const getPlatform = (name: string): Platform | undefined => {
  return Object.prototype.hasOwnProperty.call(platforms, name) ? platforms[name] : undefined;
};
