#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'apps/android');
const manifestPath = join(androidDir, 'twa-manifest.json');
const webDist = join(root, 'apps/web/dist');
const PLACEHOLDER = 'REPLACE_WITH_PRODUCTION_HOST';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.host === PLACEHOLDER) {
  console.error(
    `Set host in ${manifestPath} to your production hostname (no https://), then deploy the site before building.`,
  );
  process.exit(1);
}

if (!existsSync(webDist)) {
  console.error('Build the PWA first: pnpm --filter web build');
  process.exit(1);
}

function serveDist(port) {
  const types = { '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  return createServer((req, res) => {
    const path = join(webDist, (req.url ?? '/').split('?')[0]);
    if (!path.startsWith(webDist) || !existsSync(path)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    createReadStream(path).pipe(res);
  }).listen(port);
}

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['dlx', '@bubblewrap/cli@1.27.0', ...args], { cwd, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`bubblewrap exited ${code}`))));
  });
}

const server = serveDist(0);
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;
const tmp = mkdtempSync(join(androidDir, '.build-'));
const buildManifest = join(tmp, 'twa-manifest.json');
const m = { ...manifest };
m.iconUrl = `http://127.0.0.1:${port}/icons/icon-512.png`;
m.maskableIconUrl = `http://127.0.0.1:${port}/icons/icon-512-maskable.png`;
m.webManifestUrl = `http://127.0.0.1:${port}/manifest.webmanifest`;
writeFileSync(buildManifest, JSON.stringify(m, null, 2));

try {
  await run(['update', '--skipVersionUpgrade', `--manifest=${buildManifest}`], androidDir);
  await run(['build', '--skipPwaValidation', `--manifest=${buildManifest}`], androidDir);
  console.log('Signed outputs: apps/android/app-release-signed.apk and app-release-bundle.aab');
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
