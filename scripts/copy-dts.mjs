// Copies the hand-written src/index.d.ts to dist/index.d.ts (for `import`) and dist/index.d.cts (for `require`,
// checked by `attw` in `npm run lint:pkg`).
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'src/index.d.ts');

if (!existsSync(resolve(root, 'dist'))) {
  console.error('copy-dts: dist/ not found (run vite build first)');
  process.exit(1);
}
for (const name of ['index.d.ts', 'index.d.cts']) {
  copyFileSync(from, resolve(root, 'dist', name));
}
console.log('copy-dts: src/index.d.ts -> dist/index.d.ts, dist/index.d.cts');
