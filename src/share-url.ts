import { getPlatform } from './platforms.ts';
import type { CustomPlatform, PlatformName, ShareData } from './types.ts';

/**
 * Build a link for an existing React, Vue, server-rendered, or plain HTML UI.
 * This helper never opens a window or reads browser globals. Returns undefined
 * for action-only platforms (copy/native), unknown names, and invalid URLs.
 * Custom builders must return an absolute HTTP(S) or mailto URL.
 */
export function getShareUrl(
  name: PlatformName,
  data: ShareData = {},
  customPlatforms: readonly CustomPlatform[] = [],
): string | undefined {
  if (name === 'copy' || name === 'native') return undefined;
  let platform = getPlatform(name);
  // Match the widget's last-definition-wins behavior without mutating a registry.
  for (const candidate of customPlatforms) {
    if (candidate.name === name) platform = candidate;
  }
  if (!platform) return undefined;

  try {
    const value = platform.getShareUrl(data);
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const url = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}
