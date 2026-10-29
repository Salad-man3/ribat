#!/usr/bin/env node
/**
 * Blocks pushes to the public Ribat repo when they would publish private-only paths.
 * Installed as .git/hooks/pre-push via `pnpm install` (prepare script).
 */
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const ZERO_SHA = '0'.repeat(40);

/** @param {string} url */
export function isPublicRibatRemoteUrl(url) {
  const normalized = url.trim().replace(/\.git$/i, '');
  return /(?:[/:])Salad-man3\/ribat$/i.test(normalized);
}

/** @param {string} filePath */
export function isPrivateRepoPath(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (p === '.github/workflows/demo-deploy.yml') return true;
  if (p.startsWith('apps/demo/')) return true;
  if (p.startsWith('docs/')) return true;
  if (p.startsWith('abrar/')) return true;
  return false;
}

/** @param {string} localSha @param {string} remoteSha */
export function changedPathsBetween(localSha, remoteSha) {
  const range = `${remoteSha}..${localSha}`;
  const out = execFileSync('git', ['diff', '--name-only', range], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** @param {string} line */
export function parsePrePushLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const [, localSha, , remoteSha] = parts;
  if (!localSha || !remoteSha) return null;
  return { localSha, remoteSha };
}

/** @param {string} remoteName @param {Iterable<string>} lines */
export function evaluatePrePush(remoteName, lines) {
  let remoteUrl = '';
  try {
    remoteUrl = execFileSync('git', ['remote', 'get-url', remoteName], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return { blocked: false, violations: [] };
  }

  if (!isPublicRibatRemoteUrl(remoteUrl)) {
    return { blocked: false, violations: [] };
  }

  /** @type {string[]} */
  const violations = [];

  for (const line of lines) {
    const parsed = parsePrePushLine(line);
    if (!parsed) continue;
    const { localSha, remoteSha } = parsed;
    if (remoteSha !== ZERO_SHA && localSha === remoteSha) continue;

    const paths = changedPathsBetween(localSha, remoteSha);
    for (const path of paths) {
      if (isPrivateRepoPath(path)) violations.push(path);
    }
  }

  return { blocked: violations.length > 0, violations: [...new Set(violations)] };
}

async function runHook(remoteName) {
  if (!remoteName) process.exit(0);

  const lines = [];
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) lines.push(line);

  const { blocked, violations } = evaluatePrePush(remoteName, lines);
  if (!blocked) process.exit(0);

  console.error(
    `\nRefusing push to public remote "${remoteName}" (Salad-man3/ribat).\n` +
      'These private-only paths would be published:\n' +
      violations.map((p) => `  - ${p}`).join('\n') +
      '\n\nPush to ribat-demo instead, or use git push --no-verify to override.\n',
  );
  process.exit(1);
}

if (process.argv[2] === 'hook') {
  void runHook(process.argv[3] ?? '');
}
