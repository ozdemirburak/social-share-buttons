# Social Share Buttons

Sharing controls for article footers, compact toolbars, and CMS pages. Use the ready-made widget, initialize containers from HTML, or build your own interface with pure share URLs.

- No runtime dependencies or social-network scripts.
- Text labels, three button styles, three sizes, and horizontal or vertical layouts.
- Per-article data, canonical URL detection, live data providers, native sharing, and clipboard feedback.
- Accessible names, keyboard focus, 44px minimum targets, reduced motion, and light/dark themes.
- TypeScript, ESM, CommonJS, browser bundles, and server-safe imports.

The package intentionally ships text-based controls without bundled icons, fonts, or artwork.

## Quick start

```sh
npm install social-share-buttons
```

Add `<div id="share-buttons"></div>` to your page, then initialize after it exists:

```js
import SocialShareButtons from 'social-share-buttons';
import 'social-share-buttons/styles';

const share = new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['bluesky', 'linkedin', 'email', 'copy', 'native'],
  variant: 'outline',
  data: {
    url: 'https://example.com/article',
    title: 'An article worth sharing',
    text: 'A short introduction to the article.',
  },
});

// When your component or page is removed:
// share.destroy();
```

Omit `data` to use page metadata. The `native` button appears only when the browser exposes the Web Share API; it leaves the other platform buttons working normally.

Run `npm run dev` from this repository for an interactive playground with presets, platform selection, and copyable integration code.

## Choose a style

```js
share.updateOptions({
  variant: 'minimal',   // 'solid' | 'outline' | 'minimal'
  theme: 'auto',        // 'light' | 'dark' | 'auto'
  size: 'sm',           // 'sm' | 'md' | 'lg'
  layout: 'horizontal', // 'horizontal' | 'vertical'
});
```

Every button keeps its visible platform label. Use `labels` to translate or customize that text.

## HTML setup for blogs and CMS pages

Give each container its own article data. One initializer handles the whole page:

```html
<article>
  <h2>A useful article</h2>
  <div data-share-buttons="bluesky,whatsapp,copy"
       data-share-url="https://example.com/article"
       data-share-title="A useful article"
       data-share-variant="outline"></div>
</article>
```

```js
import { initShareButtons } from 'social-share-buttons/auto';
import 'social-share-buttons/styles';

const widgets = initShareButtons(document, { size: 'sm' });

// After adding/removing cards or changing appearance attributes:
widgets.refresh();

// Inspect mount/update failures without stopping other widgets:
console.log(widgets.errors);

// Remove widgets owned by this initializer:
// widgets.destroy();
```

`initShareButtons(root?, defaults?)` also accepts a section or individual container. Repeated initialization does not duplicate widgets already owned by another initializer. Imports have no automatic DOM side effects; call the initializer when the containers exist. The controller exposes `instances`, `errors`, `refresh()`, and `destroy()`.

| HTML attribute | Values |
| --- | --- |
| `data-share-buttons` | Empty for defaults, or comma-separated platform keys |
| `data-share-platforms` | Explicit platform list; overrides the marker value |
| `data-share-url`, `data-share-media` | HTTP(S) URLs; relative paths resolve against the document |
| `data-share-title`, `data-share-text`, `data-share-description` | Plain-text content |
| `data-share-hashtags`, `data-share-via` | Comma-separated hashtags and X attribution |
| `data-share-mastodon-instance` | HTTPS server origin |
| `data-share-theme`, `data-share-variant`, `data-share-size` | Same values as widget options |
| `data-share-layout` | `'horizontal'` or `'vertical'` |
| `data-share-popup`, `data-share-native-share` | Literal `true` or `false` |
| `data-share-aria-label` | Accessible group label |

Share-data attributes are read when clicked, so changes to an article URL or title do not require rebuilding its buttons. Call `refresh()` for container or appearance changes; no background observer is installed.

## Use your own interface

The `core` entry generates URLs without a widget, CSS, browser globals, or popup behavior. It works in server-rendered templates and React, Vue, or other components:

```js
import { getShareUrl } from 'social-share-buttons/core';

const href = getShareUrl('bluesky', {
  url: 'https://example.com/article',
  text: 'Worth a read',
});
```

For example, in React:

```jsx
import { getShareUrl } from 'social-share-buttons/core';

export function ShareArticle({ url, title }) {
  const href = getShareUrl('linkedin', { url, title });
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      Share on LinkedIn
    </a>
  ) : null;
}
```

`getShareUrl(platform, data?, customPlatforms?)` returns an absolute HTTP(S) or `mailto:` URL, or `undefined` for `copy`, `native`, unknown platforms, unsafe URLs, and builder failures. Custom builders for this pure API must return absolute URLs. `readShareData(document?)` is also exported from `core` and the main entry; without a document it returns an empty object.

## Keep share content current

Default metadata is read for each action. URL selection is **canonical link → `og:url` → current location**. Titles prefer `og:title` then the document title; descriptions prefer `og:description` then the description meta tag. Relative canonical links and `og:image` URLs are resolved. Unsafe metadata URLs are ignored.

Instance `data` overrides metadata; data passed to `share()` or `shareNative()` overrides both. For a client-side application, use a synchronous provider:

```js
const share = new SocialShareButtons({
  container: '#share-buttons',
  data: () => ({ url: currentArticle.url, title: currentArticle.title }),
});

// Or replace the data without rebuilding buttons or moving keyboard focus:
share.setData({ url: nextArticle.url, title: nextArticle.title });
```

Providers must return a plain share-data object synchronously. An asynchronous provider would lose the user gesture needed by popup and native-sharing APIs.

```ts
interface ShareData {
  url?: string;
  title?: string;
  text?: string;
  description?: string;
  hashtags?: string[];       // X; omit the leading #
  via?: string;              // X username; omit @
  media?: string;            // Pinterest image URL
  mastodonInstance?: string; // HTTPS origin, e.g. https://mastodon.social
}
```

Text-based platforms use `text`, then `title`, then `description`; use `text: ''` to suppress fallback. The destination service controls the final post's appearance.

## Platforms and native sharing

Supported keys: `x`, `bluesky`, `threads`, `mastodon`, `facebook`, `linkedin`, `reddit`, `telegram`, `whatsapp`, `email`, `pinterest`, `copy`, and `native`.

Mastodon opens the official server chooser by default. Set `data.mastodonInstance` to a valid HTTPS origin to use a specific server. WhatsApp uses a universal mobile/desktop link. Email opens the mail handler. Pinterest accepts `media` and `description`.

Facebook and LinkedIn receive only the page URL; the library does not send their composers custom text or images. For Pinterest, provide a public image URL in `data.media` or the page's `og:image`; the direct Pin form is not an image picker. See the [Pinterest button documentation](https://developer.pinterest.com/docs/web-features/buttons/).

Text is preserved rather than silently truncated. Keep it within the destination's limits; for example, [Bluesky allows 300 Unicode grapheme clusters](https://bsky.network/docs/intent-links/). Login, installed apps, browser permissions, and the destination service can affect the final flow. Native sharing requires a supported secure context and a user gesture; see the [Web Share specification](https://www.w3.org/TR/web-share/).

Use `container: false` for programmatic actions without rendering:

```js
const share = new SocialShareButtons({ container: false });

myButton.addEventListener('click', async () => {
  const success = await share.shareNative({ url: 'https://example.com/article' });
  console.log(success);
});
```

`share(platform, data?)` and `shareNative(data?)` return `Promise<boolean>`. For links, success means the request was dispatched; opener protection means a returned window handle cannot reliably detect a popup blocker. It does not confirm publication. Clipboard success confirms copying; native success means the native API resolved. Cancellation returns `false`.

The legacy `nativeShare: true` option prefers the device share sheet for every non-copy button, falling back to the selected platform when native sharing cannot handle the data. Cancellation does not trigger a second dialog. Prefer the dedicated `native` action when users should retain a clear choice between platforms and their device share sheet.

## Feedback and errors

```js
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['copy', 'native'],
  labels: {
    copy: 'Copy article link',
    copied: 'Link copied',
    failed: 'Could not share. Please try again.',
    cancelled: 'Sharing cancelled.',
  },
  onShare: (platform, success) => console.log(platform, success),
  onError: ({ platform, code, cause }) => console.log(platform, code, cause),
});
```

Labels are plain text. A live region announces clipboard and failure feedback. Pending copy/native actions disable their affected controls and show a progress indicator. Concurrent repeated requests return `false` with `busy`.

Error codes: `unknown-platform`, `unsupported`, `invalid-url`, `cancelled`, `clipboard-failed`, `share-failed`, `data-failed`, and `busy`. Callback exceptions do not change the action's result. Clipboard API failures attempt the browser's legacy copy mechanism before reporting failure.

## Configuration reference

| Option | Default | Purpose |
| --- | --- | --- |
| `container` | `document.body` | Element, selector, or `false` |
| `platforms` | `['x', 'facebook', 'whatsapp']` | Built-in or custom keys; duplicates removed |
| `data` | Page metadata | Share-data object or synchronous provider |
| `variant`, `size`, `layout` | `'solid'`, `'md'`, `'horizontal'` | Button appearance |
| `theme` | `'light'` | `'light'`, `'dark'`, or `'auto'` |
| `nativeShare` | `false` | Prefer native sharing for non-copy actions |
| `popup` | `true` | Request a popup; `false` requests a new tab |
| `popupWidth`, `popupHeight` | `550`, `420` | Popup dimensions |
| `labels` | Built-in labels | Button names plus `copied`, `failed`, `cancelled` |
| `copiedDuration` | `2000` | Feedback duration in milliseconds; accepts zero |
| `customPlatforms` | `[]` | Per-instance platform definitions |
| `onShare`, `onError` | None | Result and typed error callbacks |
| `className` | None | Additional widget classes |
| `ariaLabel` | `'Social sharing buttons'` | Group accessible name |

`updateOptions()` shallowly merges options, rebuilds the widget, and preserves focus when possible. Supplying `data`, `labels`, or `customPlatforms` replaces that whole option. `setData()` changes only the data. `destroy()` cleans up listeners, timers, and DOM; repeated calls are safe. After destruction, sharing returns `false`, and updates throw.

## Custom platforms and themes

```js
new SocialShareButtons({
  container: '#share-buttons',
  platforms: ['readinglist', 'copy'],
  customPlatforms: [{
    name: 'readinglist',
    label: 'Save for later',
    color: '#284b63',
    getShareUrl: ({ url = '' }) =>
      `https://example.com/save?url=${encodeURIComponent(url)}`,
  }],
  className: 'article-share',
});
```

Definitions are isolated per instance. `copy` and `native` retain their built-in action behavior. Executable URL schemes and credentials in share destinations are rejected.

```css
.article-share {
  --social-share-buttons-radius: 999px;
  --social-share-buttons-gap: 0.75rem;
  --social-share-buttons-text: #172a3a;
  --social-share-buttons-bg: #fff;
  --social-share-buttons-border: #8797a3;
}
.article-share [data-platform="readinglist"] {
  --social-share-buttons-foreground: #fff;
}
```

Styles are scoped to the widget and do not reset the host page. Brand backgrounds use `--social-share-buttons-color`; custom backgrounds may need an explicit foreground for adequate contrast. Outline and minimal variants use theme colors.

## Browser bundles and server use

CommonJS: `const { SocialShareButtons } = require('social-share-buttons')`.

For plain HTML, serve the package's `dist` files locally or from a CDN pinned to your release:

```html
<link rel="stylesheet" href="./dist/social-share-buttons.css">
<div data-share-buttons="bluesky,email,copy"></div>
<script src="./dist/social-share-buttons.auto.iife.js"></script>
<script>SocialShareButtonsAuto.initShareButtons();</script>
```

The main browser bundle exposes `SocialShareButtons.SocialShareButtons`. The package provides the main widget, `core`, `auto`, and `styles` entry points. All JavaScript entry points include ESM/CommonJS declarations. Imports and constructors are safe during server rendering; they render nothing without a document. Initialize in the browser after the container exists.

JavaScript targets ES2020. Native sharing and clipboard support depend on browser capabilities, permissions, and a secure context. No third-party scripts or tracking are loaded by the library.

## Development

Development uses Node.js 24 (24.15.0 or newer within the 24.x release line). `.nvmrc` selects Node 24 for version managers and CI, and `devEngines` enforces the supported range. This development requirement is not an engine restriction on applications consuming the browser library.

```sh
npm ci
npm run dev             # Interactive local playground
npm run check           # Types, source tests, build, and packed-package checks
npm run build           # Main, core, auto, CSS, and declarations
```

There are three development dependencies: TypeScript for type checking and declarations, Vite for builds and the local playground, and jsdom for DOM tests. Tests use Node's built-in test runner. The library has no runtime dependencies.

`src/` contains the library, `examples/` contains the single playground, and `tests/` contains regression and package checks. `scripts/build.mjs` generates `dist/`; generated files are not committed. The npm package includes only `dist/`, `package.json`, this README, and the license. Source maps embed the original source for debugging. Examples, tests, development scripts, and local backups are excluded from npm.

For a GitHub source checkout, run `npm ci` and `npm run build` before using the `dist/` files. Packages installed from npm already contain the built files.

CI uses Node 24; Dependabot tracks packages and GitHub Actions. Before packing, the build and packed-archive checks run automatically, including checks for excluded artwork and stale assets.

## Migration notes

- Labels and copy feedback are plain text; replace HTML label strings with readable text.
- Custom platform definitions are local to each instance.
- Callbacks report failures, and native actions use the `native` target.
- Default share URLs now prefer canonical/`og:url` metadata; specify `data.url` to override.
- Use `container: false` for programmatic helpers. The browser default still renders into the body.
- Browser script tags use the documented namespace; CommonJS uses the `.cjs` entry automatically.

## License and support

MIT © [Burak Özdemir](https://ozdemir.dev). [Report an issue](https://github.com/ozdemirburak/social-share-buttons/issues) or contribute a pull request. Package contact: [ext@ozdemir.dev](mailto:ext@ozdemir.dev).
