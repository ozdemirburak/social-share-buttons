# Social Share Buttons

Modern, lightweight social sharing library with zero dependencies.

[![npm version](https://img.shields.io/npm/v/social-share-buttons.svg)](https://www.npmjs.com/package/social-share-buttons)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/social-share-buttons)](https://bundlephobia.com/package/social-share-buttons)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- **Zero Dependencies** - No jQuery, no React, no any other framework requirements
- **Modern Platforms** - Support for X (Twitter), Bluesky, Threads, Mastodon, and more
- **Native Share API** - Optional support for device share sheet on mobile
- **Fully Typed** - Written in TypeScript with complete type definitions
- **Lightweight** - ~3.5KB minified, tree-shakeable
- **Accessible** - ARIA labels, keyboard navigation, and semantic HTML
- **Customizable** - Themes (light/dark/auto), custom labels, custom styling
- **Multiple Formats** - ES modules, UMD, and IIFE builds included

## 📦 Installation

```bash
npm install social-share-buttons
```

## 🚀 Quick Start

For a given HTML:

```html
<div id="share-buttons"></div>
```

Initialize it with JavaScript:

```javascript
import SocialShareButtons from 'social-share-buttons';
import 'social-share-buttons/styles';

// Basic usage with default platforms
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'facebook', 'whatsapp']
});
```

That's it! The library will automatically detect the page title, URL, and description from meta tags.

## 🎯 Supported Platforms

| Platform          | Key         |
|-------------------|-------------|
| X (Twitter)       | `x`         |
| Bluesky           | `bluesky`   |
| Threads           | `threads`   |
| Mastodon          | `mastodon`  |
| Facebook          | `facebook`  |
| LinkedIn          | `linkedin`  |
| Reddit            | `reddit`    |
| Telegram          | `telegram`  |
| WhatsApp          | `whatsapp`  |
| Email             | `email`     |
| Pinterest         | `pinterest` |
| Copy to Clipboard | `copy`      |

**Popup behavior:** By default, all share links open in a popup window (550×420). You can disable popups globally with `popup: false` to open links in new tabs instead, or customize popup dimensions with `popupWidth` and `popupHeight` options.

## 📖 Usage Examples

### All Platforms

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: [
    'x', 'bluesky', 'threads', 'mastodon',
    'facebook', 'linkedin', 'reddit', 'telegram',
    'whatsapp', 'email', 'pinterest', 'copy'
  ]
});
```

### Custom Share Data

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'facebook', 'linkedin']
});

// Share with custom data
const shareButton = document.querySelector('#custom-share');
shareButton.addEventListener('click', async () => {
  const instance = new SocialShareButtons();
  await instance.share('x', {
    url: 'https://example.com',
    title: 'Check this out!',
    text: 'Amazing content',
    hashtags: ['webdev', 'javascript']
  });
});
```

### Custom Labels

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'facebook', 'linkedin', 'copy'],
  labels: {
    x: '𝕏 Post',
    facebook: 'Share on FB',
    linkedin: 'Post to LinkedIn',
    copy: '📋 Copy Link'
  }
});
```

### Dark Theme

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'facebook', 'linkedin'],
  theme: 'dark' // 'light', 'dark', or 'auto'
});
```

### Disable Popups

Open all share links in new tabs instead of popup windows:

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'facebook', 'linkedin'],
  popup: false // Disable popups, open in new tabs instead
});
```

### Native Share API (Mobile)

Enable native share sheet on supported devices.

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  nativeShare: true, // Enable native share sheet instead of platform URLs
  platforms: ['x', 'facebook', 'copy'],
  onShare: (platform, success) => {
    console.log(`Shared via ${platform}: ${success}`);
  }
});
```

**Note:** When enabled, clicking any platform button will trigger the device's native share dialog instead of opening the platform-specific URL.

**When to use:**
- ✅ Use `nativeShare: true` for a generic "share this page" widget
- ✅ Better UX on mobile (users can choose their preferred app)
- ❌ Don't use if you want direct platform-specific sharing (e.g., "Tweet this")

**Default behavior** (`nativeShare: false`): Each button opens the specific platform's share URL.

### Copy Button Feedback

Customize the "Copied!" feedback text and duration. You can include SVG icons directly in the text:

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['copy'],
  labels: {
    copy: 'Copy Link',
    copied: '<svg>...</svg> Link Copied!' // Custom feedback with icon
  },
  copiedDuration: 3000                    // Duration in milliseconds (default: 2000)
});
```

**Default behavior** (no customization needed):
```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['copy']
});
// Shows "Copied!" for 2 seconds automatically
```

### Custom Styling

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  className: 'my-custom-theme'
});
```

Then customize the appearance with your own CSS:

```css
.my-custom-theme .social-share-button {
  border-radius: 2rem;
  background: linear-gradient(135deg, #666eee 0%, #777bbb 100%);
  box-shadow: 0 4px 15px rgba(93, 72, 216, 0.33);
}

.my-custom-theme .social-share-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(93, 72, 216, 0.66);
}
```

### Custom Platform

```javascript
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['x', 'mycustom'],
  customPlatforms: [{
    name: 'mycustom',
    label: 'My Platform',
    getShareUrl: (data) => {
      return `https://myplatform.com/share?url=${encodeURIComponent(data.url)}`;
    },
    color: '#ff6b6b'
  }]
});
```

### Update Options Dynamically

```javascript
const share = new SocialShareButtons({
  container: '#share-buttons',
  theme: 'light'
});

// Later, update the theme
share.updateOptions({ theme: 'dark' });

// Clean up when done
share.destroy();
```

## ⚙️ Configuration Options

| Option            | Type                                       | Default                         | Description                                                                                          |
|-------------------|--------------------------------------------|---------------------------------|------------------------------------------------------------------------------------------------------|
| `container`       | `HTMLElement \| string`                    | `document.body`                 | Container element or selector where buttons will be rendered                                         |
| `platforms`       | `PlatformName[]`                           | `['x', 'facebook', 'whatsapp']` | Array of platform keys to display                                                                    |
| `theme`           | `'light' \| 'dark' \| 'auto'`              | `'auto'`                        | Color theme (auto detects system preference)                                                         |
| `nativeShare`     | `boolean`                                  | `false`                         | Use native share sheet instead of platform-specific URLs (mobile only)                               |
| `popup`           | `boolean`                                  | `true`                          | Open share links in popup windows (true) or new tabs (false)                                         |
| `popupWidth`      | `number`                                   | `550`                           | Popup width in pixels                                                                                |
| `popupHeight`     | `number`                                   | `420`                           | Popup height in pixels                                                                               |
| `labels`          | `Record<PlatformName \| 'copied', string>` | `undefined`                     | Custom labels for platform buttons and copy feedback (e.g., `{ copy: 'Copy', copied: '✓ Copied!' }`) |
| `customPlatforms` | `CustomPlatform[]`                         | `undefined`                     | Add your own custom sharing platforms                                                                |
| `onShare`         | `(platform, success) => void`              | `undefined`                     | Callback fired when share action completes                                                           |
| `className`       | `string`                                   | `undefined`                     | Additional CSS class for custom styling                                                              |
| `ariaLabel`       | `string`                                   | `'Social sharing buttons'`      | ARIA label for the widget container                                                                  |
| `copiedDuration`  | `number`                                   | `2000`                          | Duration (in milliseconds) to show copy feedback                                                     |

## 🎨 Styling & Theming

The library includes minimal, beautiful default styles. Each button has a `data-platform` attribute for custom styling:

```css
/* Target specific platforms */
.social-share-button[data-platform="x"] {
  /* Custom styles for X button */
}

/* Use CSS custom properties */
:root {
  --social-share-buttons-color: #1da1f2;
}
```

Each platform button automatically sets a `--social-share-buttons-color` CSS variable based on the platform's brand color.

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with Web Share API support

The library uses modern JavaScript features (ES2020) and gracefully degrades when features aren't available.

## 📚 API Reference

### Methods

#### `share(platform, data?)`
Programmatically trigger a share action.

```javascript
await share.share('x', {
  url: 'https://example.com',
  title: 'My Title',
  text: 'My description',
  hashtags: ['example']
});
```

**Parameters:**
- `platform` (PlatformName): The platform to share on
- `data` (ShareData, optional): Custom share data

**Returns:** `Promise<boolean>` - True if share was successful

#### `shareNative(data?)`
Trigger native share sheet (mobile only).

```javascript
await share.shareNative({
  url: 'https://example.com',
  title: 'My Title'
});
```

**Parameters:**
- `data` (ShareData, optional): Custom share data

**Returns:** `Promise<boolean>` - True if share was successful

#### `updateOptions(options)`
Update widget options dynamically.

```javascript
share.updateOptions({
  theme: 'dark',
  platforms: ['x', 'facebook']
});
```

**Parameters:**
- `options` (Partial<SocialShareButtonsOptions>): Options to update

#### `destroy()`
Remove the widget from the DOM and clean up event listeners.

```javascript
share.destroy();
```

### Types

#### `ShareData`
```typescript
interface ShareData {
  url?: string;           // URL to share
  title?: string;         // Title/headline
  text?: string;          // Description text
  description?: string;   // Alternative description
  hashtags?: string[];    // Hashtags (without #)
  via?: string;           // Twitter via attribution
  media?: string;         // Image URL (Pinterest)
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [Burak Özdemir](https://ozdemir.dev)

## 📮 Support

- [Report Issues](https://github.com/ozdemirburak/social-share-buttons/issues)
- [Request Features](https://github.com/ozdemirburak/social-share-buttons/issues/new)

---

**Note:** This library does not include social media icons due to trademark and branding guidelines. You can add your own icons using libraries like [Lucide](https://github.com/lucide-icons/lucide), [Simple Icons](https://simpleicons.org), or custom SVGs.
