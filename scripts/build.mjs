import { build } from 'esbuild';
import { mkdir, copyFile, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
try {
  if ((await lstat(out)).isSymbolicLink()) throw new Error('Refusing to build into a linked directory.');
  try { await lstat(path.join(out, 'data')); throw new Error('Refusing to build over plugin data. Move it to a safe location first.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await Promise.all([
  build({ entryPoints: [path.join(root, 'src/main.js')], outfile: path.join(out, 'main.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' }),
  ...['manifest.json', 'README.md'].map(file => copyFile(path.join(root, file), path.join(out, file))),
]);
console.log(`Built ${out}`);
