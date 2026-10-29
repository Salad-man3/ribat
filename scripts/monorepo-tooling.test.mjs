import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePrePush,
  isPrivateRepoPath,
  isPublicRibatRemoteUrl,
  parsePrePushLine,
} from './public-push-guard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

describe('monorepo tooling', () => {
  it('serializes Prisma generate through Turbo instead of parallel script hooks', () => {
    const turbo = readJson('turbo.json');
    for (const task of ['build', 'dev', 'test', 'typecheck']) {
      assert.ok(
        turbo.tasks[task].dependsOn.includes('prisma:generate'),
        `${task} must depend on prisma:generate`,
      );
    }
    assert.equal(turbo.tasks['prisma:generate'].outputs[0], 'src/generated/prisma/**');
  });

  it('clears stale Ribat API listeners before api dev', () => {
    const api = readJson('apps/api/package.json');
    assert.match(api.scripts.dev, /kill-stale-api-dev\.mjs/);
  });

  it('keeps api scripts from invoking prisma generate directly', () => {
    const api = readJson('apps/api/package.json');
    assert.match(api.scripts['prisma:generate'], /^prisma generate/);
    for (const task of ['build', 'dev', 'test', 'typecheck', 'test:e2e']) {
      assert.doesNotMatch(
        api.scripts[task],
        /prisma generate/,
        `${task} must not run prisma generate (Turbo runs prisma:generate once)`,
      );
    }
  });

  it('scopes root dev to api and web so demo does not pull api#build', () => {
    const pkg = readJson('package.json');
    assert.match(pkg.scripts.dev, /--filter=api/);
    assert.match(pkg.scripts.dev, /--filter=web/);
    assert.doesNotMatch(pkg.scripts.dev, /--filter=demo/);
  });

  it('installs the public-push guard on pnpm prepare', () => {
    const pkg = readJson('package.json');
    assert.match(pkg.scripts.prepare, /install-git-hooks\.mjs/);
  });
});

describe('public push guard', () => {
  it('recognises the public GitHub remote only', () => {
    assert.equal(isPublicRibatRemoteUrl('git@github.com:Salad-man3/ribat.git'), true);
    assert.equal(isPublicRibatRemoteUrl('https://github.com/Salad-man3/ribat'), true);
    assert.equal(isPublicRibatRemoteUrl('git@github.com:Salad-man3/ribat-demo.git'), false);
  });

  it('flags private-only repo paths', () => {
    assert.equal(isPrivateRepoPath('apps/demo/package.json'), true);
    assert.equal(isPrivateRepoPath('docs/product/01-scope.md'), true);
    assert.equal(isPrivateRepoPath('abrar/foo.md'), true);
    assert.equal(isPrivateRepoPath('.github/workflows/demo-deploy.yml'), true);
    assert.equal(isPrivateRepoPath('apps/api/src/main.ts'), false);
  });

  it('parses pre-push lines', () => {
    const parsed = parsePrePushLine(
      'refs/heads/main abcdef0123456789012345678901234567890 refs/heads/main 0000000000000000000000000000000000000000',
    );
    assert.equal(parsed?.localSha, 'abcdef0123456789012345678901234567890');
    assert.equal(parsed?.remoteSha, '0000000000000000000000000000000000000000');
  });

  it('does not block pushes to ribat-demo', () => {
    const result = evaluatePrePush('ribat-demo', [
      'refs/heads/main abcdef0123456789012345678901234567890 refs/heads/main 0000000000000000000000000000000000000000',
    ]);
    assert.equal(result.blocked, false);
  });
});
