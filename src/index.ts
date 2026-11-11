/**
 * social-share-buttons
 * Modern, lightweight social sharing library
 *
 * @author Burak Özdemir
 * @license MIT
 */

import './social-share-buttons.css';

export { SocialShareButtons, default } from './SocialShareButtons.ts';
export * from './types.ts';
export * from './platforms.ts';
export { getShareUrl } from './share-url.ts';
export { readShareData } from './share-data.ts';
export { initShareButtons } from './auto.ts';
export type { ShareButtonsController } from './auto.ts';
