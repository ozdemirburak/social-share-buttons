import type { ShareData } from './types.ts';

const webUrl = (value: string | null | undefined, base: string): string | undefined => {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
};

/**
 * Read share-ready metadata without mounting a widget. A canonical URL avoids
 * sharing tracking parameters when the page declares its preferred address.
 * Pass a document explicitly to read another document; server calls return {}.
 */
export function readShareData(
  source: Document | undefined = typeof document === 'undefined' ? undefined : document,
): ShareData {
  if (!source) return {};
  const meta = (name: string): string | undefined => {
    const content = source.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute('content')?.trim();
    return content || undefined;
  };
  const base = source.baseURI;
  let canonical: string | undefined;
  for (const link of source.querySelectorAll<HTMLLinkElement>('link[rel~="canonical" i]')) {
    canonical = webUrl(link.getAttribute('href'), base);
    if (canonical) break;
  }

  return {
    url: canonical ?? webUrl(meta('og:url'), base) ?? webUrl(source.location?.href, base),
    title: meta('og:title') ?? (source.title.trim() || undefined),
    description: meta('og:description') ?? meta('description'),
    media: webUrl(meta('og:image'), base),
  };
}
