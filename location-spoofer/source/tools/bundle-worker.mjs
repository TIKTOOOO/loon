import { build } from '../location-picker/worker/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints: [resolve(root, 'location-picker/worker/src/index.js')], bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8', legalComments: 'inline',
  outfile: resolve(root, 'location-picker/cloudflare-webui/worker.js'),
  banner: { js: '// TIKTOOOO maintained Worker, 2026-10-31. AGPL-3.0. Sources: https://github.com/TIKTOOOO/loon/tree/main/location-spoofer/source' },
});
console.log('Cloudflare 网页编辑器单文件已生成。');
