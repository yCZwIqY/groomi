import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/prepare-release.mjs', import.meta.url));

test('release version advances from the latest tag and stays stable on rerun', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'groomi-release-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  const run = () => {
    execFileSync(process.execPath, [script], { cwd, stdio: 'pipe' });
    return JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')).version;
  };
  try {
    git('init');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release@example.invalid');
    writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ version: '1.8.1' }));
    git('add', 'package.json');
    git('commit', '-m', 'fixture');
    assert.equal(run(), '1.8.2');
    git('tag', 'v1.9.9');
    writeFileSync(path.join(cwd, 'fixture'), 'next merge');
    git('add', 'fixture');
    git('commit', '-m', 'next merge');
    assert.equal(run(), '1.9.10');
    git('tag', 'v1.9.10');
    assert.equal(run(), '1.9.10');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
