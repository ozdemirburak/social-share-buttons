import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import SocialShareButtons from '../src/SocialShareButtons.ts';

describe('server-side usage', () => {
  it('constructs without browser globals and reports unavailable browser actions', async () => {
    const onShare = mock.fn();
    const instance = new SocialShareButtons({ onShare });
    assert.equal(await instance.share('x'), false);
    assert.equal(await instance.share('copy'), false);
    assert.equal(await instance.shareNative(), false);
    instance.destroy();
  });
});
