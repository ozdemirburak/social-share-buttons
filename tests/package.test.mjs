import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let temporary;
let packageDirectory;
let manifest;
let packageFiles;

before(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'social-share-buttons-package-'));
  const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
  }));
  packageFiles = result[0].files.map(file => file.path);
  packageDirectory = join(temporary, 'node_modules', 'social-share-buttons');
  await mkdir(packageDirectory, { recursive: true });
  execFileSync('tar', ['-xf', join(temporary, result[0].filename), '-C', packageDirectory, '--strip-components=1']);
  manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
});

after(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

test('the packed package resolves and works in both ESM and CommonJS consumers', async () => {
  const consumer = join(temporary, 'consumer.mjs');
  await writeFile(consumer, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import SocialShareButtons, { SocialShareButtons as Named, getPlatform } from 'social-share-buttons';
    import { getShareUrl } from 'social-share-buttons/core';
    import { initShareButtons } from 'social-share-buttons/auto';
    const require = createRequire(import.meta.url);
    const commonjs = require('social-share-buttons');
    assert.equal(typeof SocialShareButtons, 'function');
    assert.equal(SocialShareButtons, Named);
    assert.equal(typeof commonjs.SocialShareButtons, 'function');
    assert.equal(commonjs.default, commonjs.SocialShareButtons);
    assert.equal(typeof getPlatform, 'function');
    assert.match(getShareUrl('x', { url: 'https://example.org/' }), /^https:/);
    assert.equal(initShareButtons().instances.length, 0);
    assert.equal(typeof require('social-share-buttons/core').getShareUrl, 'function');
    assert.throws(() => require('social-share-buttons/icons'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    await assert.rejects(import('social-share-buttons/icons'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    assert.equal(typeof require('social-share-buttons/auto').initShareButtons, 'function');
    assert.equal(typeof require('social-share-buttons/package.json').version, 'string');
    const instance = new SocialShareButtons({ container: false });
    assert.equal(await instance.share('x'), false);
    instance.destroy();
  `);
  execFileSync(process.execPath, [consumer], { cwd: temporary, stdio: 'pipe' });
});

test('all package entry points and styles exist in the tarball', async () => {
  const paths = [manifest.main, manifest.module, manifest.types, manifest.exports['./styles'].types, manifest.exports['./styles'].default];
  for (const name of ['.', './core', './auto']) {
    for (const format of ['import', 'require']) {
      paths.push(manifest.exports[name][format].types, manifest.exports[name][format].default);
    }
  }
  for (const entry of paths) {
    assert.equal(typeof entry, 'string');
    await access(join(packageDirectory, entry));
  }
  assert.match(manifest.main, /\.cjs$/);
  assert.match(await readFile(join(packageDirectory, manifest.types), 'utf8'), /SocialShareButtons/);
  assert.match(await readFile(join(packageDirectory, manifest.exports['./styles'].default), 'utf8'), /social-share-button/);
});

test('browser bundles expose the documented namespace without requiring a DOM during import', async () => {
  for (const [suffix, namespace, entry] of [
    ['', 'SocialShareButtons', 'SocialShareButtons'],
    ['.core', 'SocialShareCore', 'getShareUrl'],
    ['.auto', 'SocialShareButtonsAuto', 'initShareButtons'],
  ]) {
    for (const format of ['iife', 'umd']) {
      const source = await readFile(join(packageDirectory, `dist/social-share-buttons${suffix}.${format}.js`), 'utf8');
      const context = vm.createContext({ URL, URLSearchParams });
      vm.runInContext(source, context);
      assert.equal(typeof context[namespace][entry], 'function');
      if (!suffix) {
        assert.equal(context[namespace].default, context[namespace].SocialShareButtons);
      } else if (suffix === '.core') {
        assert.match(context[namespace].getShareUrl('x', { url: 'https://example.org/' }), /^https:/);
      } else {
        assert.equal(context[namespace].initShareButtons().instances.length, 0);
      }
    }
  }
});

test('NodeNext consumers resolve ESM and CommonJS declarations, including custom platform names', async () => {
  const source = `
    import 'social-share-buttons/styles';
    import { getShareUrl } from 'social-share-buttons/core';
    import { initShareButtons } from 'social-share-buttons/auto';
    import SocialShareButtons, { type PlatformName, type SocialShareButtonsOptions } from 'social-share-buttons';
    const customName: PlatformName = 'my-platform';
    const options: SocialShareButtonsOptions = {
      container: false,
      variant: 'outline',
      size: 'sm',
      layout: 'horizontal',
      platforms: [customName, 'x'],
      data: { url: 'https://example.com', mastodonInstance: 'https://example.social' },
      customPlatforms: [{ name: customName, label: 'Custom', getShareUrl: data => data.url ?? 'https://example.com' }],
      onShare: (platform, success) => { const name: string = platform; const result: boolean = success; void name; void result; },
    };
    const instance = new SocialShareButtons(options);
    instance.setData(() => ({ url: 'https://example.org/current' }));
    const url: string | undefined = getShareUrl('x', { title: 'Example' });
    const controller = initShareButtons(undefined, { variant: 'outline', size: 'sm' });
    controller.refresh();
    controller.destroy();
    void url;
    const result: Promise<boolean> = instance.share(customName);
    void result;
  `;
  const esmPath = join(temporary, 'types.mts');
  const cjsPath = join(temporary, 'types.cts');
  await writeFile(esmPath, source);
  await writeFile(cjsPath, source);
  const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  execFileSync(process.execPath, [compiler, '--noEmit', '--strict', '--target', 'ES2020', '--lib', 'ES2020,DOM', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', esmPath, cjsPath], { cwd: temporary, stdio: 'pipe' });
});

test('framework helpers tree-shake without bundling the widget', async () => {
  const consumer = join(temporary, 'small-consumer.mjs');
  await writeFile(consumer, `
    export { getShareUrl } from 'social-share-buttons/core';
  `);
  const result = await build({
    configFile: false,
    root: temporary,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry: consumer, formats: ['es'] } },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
  const code = output.filter(item => item.type === 'chunk').map(chunk => chunk.code).join('\n');
  assert.doesNotMatch(code, /class SocialShareButtons|createElement|createElementNS/);
  assert.match(code, /getShareUrl/);
});

test('the actual packed archive contains no bundled artwork, icon tooling, or stale icon artifacts', async () => {
  assert.ok(packageFiles.length > 0);
  assert.ok(packageFiles.some(path => path.endsWith('.map')), 'Check source maps as well as executable files');
  assert.equal(manifest.author.email, 'ext@ozdemir.dev');
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), [], 'Keep the runtime dependency-free');
  assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './auto', './core', './package.json', './styles']);
  assert.ok(!Object.keys(manifest.scripts).some(name => /icon/i.test(name)), 'No artwork generation tooling');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      assert.doesNotMatch(name, /(?:icon|fontawesome|fortawesome|lucide|heroicons)/i, `Unexpected artwork dependency: ${name}`);
    }
  }

  const textDecoder = new TextDecoder('utf-8', { fatal: true });
  const excludedContent = [
    /\b(?:simple-icons|shareIcons|ShareIcon|SocialShareIcons|lucide|fontawesome|fortawesome)\b/i,
    /<(?:svg|path)\b/i,
    /data:(?:image\/|font\/|application\/(?:font|x-font))/i,
    /@font-face\b/i,
    // Long quoted SVG command sequences catch raw path datasets, including in maps.
    // This contains no actual artwork; it describes the path command alphabet.
    /["'`][Mm][MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]{32,}["'`]/,
  ];
  for (const path of packageFiles) {
    // Examples, tests, scripts, source duplicates, review notes, screenshots, and
    // recovery data belong in the checkout or local storage, not the release.
    assert.match(path, /^(?:dist\/|package\.json$|README\.md$|LICENSE\.md$)/, `Unexpected published file: ${path}`);
    assert.doesNotMatch(path, /(?:^|[./_-])icons?(?:[./_-]|$)/i, `Stale icon artifact: ${path}`);
    assert.doesNotMatch(path, /\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i, `Artwork or font asset: ${path}`);
    assert.match(path, /\.(?:ts|cts|js|cjs|css|map|json|md)$/, `Unexpected binary/artwork format: ${path}`);
    const bytes = await readFile(join(packageDirectory, path));
    assert.ok(!bytes.includes(0), `Binary content in ${path}`);
    const content = textDecoder.decode(bytes);
    for (const pattern of excludedContent) {
      assert.doesNotMatch(content, pattern, `Excluded artwork content in ${path}`);
    }
    if (path.endsWith('.map')) {
      const map = JSON.parse(content);
      assert.ok(map.sources.length > 0, `Missing source paths in ${path}`);
      assert.equal(map.sourcesContent?.length, map.sources.length, `Source text must stay embedded in ${path}`);
      assert.ok(map.sourcesContent.every(source => typeof source === 'string'), `Missing embedded source text in ${path}`);
      for (const source of map.sourcesContent ?? []) {
        for (const pattern of excludedContent) {
          assert.doesNotMatch(source ?? '', pattern, `Excluded embedded source in ${path}`);
        }
      }
    }
  }
});
