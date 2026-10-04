import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (!output.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) {
  throw new Error('Refusing to build outside the project dist directory.');
}

const requiredFiles = [
  'index.html',
  'assets/site.css',
  'assets/site.js',
  'assets/project.js',
  'assets/algorithms.js',
  'assets/favicon.svg',
  'projects/revertpay.html',
  'projects/algoviz.html',
  'projects/voyager.html',
  'projects/edu2job.html',
  'admin/inbox.html',
  'admin/admin.css',
  'admin/admin.js',
  'robots.txt',
  'sitemap.xml',
];

for (const relative of requiredFiles) {
  const file = join(root, relative);
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Required static asset is missing: ${relative}`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const relative of ['index.html', 'assets', 'projects', 'admin', 'robots.txt', 'sitemap.xml']) {
  cpSync(join(root, relative), join(output, relative), { recursive: true });
}
const publicDirectory = join(root, 'public');
if (existsSync(publicDirectory)) {
  for (const entry of readdirSync(publicDirectory)) {
    cpSync(join(publicDirectory, entry), join(output, entry), { recursive: true });
  }
}

process.stdout.write(`Static build complete: ${requiredFiles.length} required files copied to dist/.\n`);
