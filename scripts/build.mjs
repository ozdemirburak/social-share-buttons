import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [
  { entry: 'index', name: 'SocialShareButtons', suffix: '' },
  { entry: 'core', name: 'SocialShareCore', suffix: '.core' },
  { entry: 'auto', name: 'SocialShareButtonsAuto', suffix: '.auto' },
];

for (const { entry, name, suffix } of entries) {
  const base = `social-share-buttons${suffix}`;
  await build({
    root,
    configFile: false,
    css: { postcss: {} },
    build: {
      target: 'es2020',
      emptyOutDir: suffix === '',
      lib: {
        entry: join(root, `src/${entry}.ts`),
        name,
        formats: ['es', 'cjs', 'umd', 'iife'],
        cssFileName: 'social-share-buttons',
        fileName: format => format === 'es' ? `${base}.js`
          : format === 'cjs' ? `${base}.cjs` : `${base}.${format}.js`,
      },
      rolldownOptions: { output: { exports: 'named' } },
      sourcemap: true,
      minify: 'oxc',
    },
  });
}

const require = createRequire(import.meta.url);
const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
execFileSync(process.execPath, [compiler], { cwd: root, stdio: 'inherit' });

// Match declaration extensions to Node's ESM and CommonJS resolvers.
const directory = new URL('../dist/', import.meta.url);
for (const file of await readdir(directory)) {
  if (!file.endsWith('.d.ts')) continue;
  const source = (await readFile(new URL(file, directory), 'utf8'))
    .replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
  const esm = source.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
    (_, prefix, path, suffix) => `${prefix}${path.replace(/\.ts$/, '.js')}${suffix}`);
  await writeFile(new URL(file, directory), esm);
  const cjs = esm.replace(/(from\s+['"]\.\.?\/[^'"]+)\.js(['"])/g, '$1.cjs$2');
  await writeFile(new URL(file.replace(/\.d\.ts$/, '.d.cts'), directory), cjs);
}
await writeFile(new URL('styles.d.ts', directory), 'export {};\n');
