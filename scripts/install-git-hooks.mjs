#!/usr/bin/env node
import { chmodSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = join(root, '.git');

if (!existsSync(gitDir)) {
  process.exit(0);
}

const hooksDir = join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });

const guardScript = join(root, 'scripts/public-push-guard.mjs');
const prePushPath = join(hooksDir, 'pre-push');
const contents = `#!/bin/sh
# Installed by scripts/install-git-hooks.mjs (pnpm prepare). Do not edit by hand.
remote="$1"
exec node "${guardScript}" hook "$remote"
`;

writeFileSync(prePushPath, contents, { mode: 0o755 });
chmodSync(prePushPath, 0o755);
