import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const parseVersion = (value) => /^(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const base = parseVersion(pkg.version);
if (!base) throw new Error('package.json must have a stable semantic version');

// A rerun uses the version already assigned to this merge commit.
const existing = git('tag', '--points-at', 'HEAD')
  .split('\n')
  .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
  .sort((a, b) => compare(parseVersion(b.slice(1)), parseVersion(a.slice(1))))[0];
const versions = git('tag', '--list', 'v*')
  .split('\n')
  .map((tag) => parseVersion(tag.slice(1)))
  .filter(Boolean);
const latest = [base, ...versions].sort(compare).at(-1);
const version = existing ? existing.slice(1) : `${latest[0]}.${latest[1]}.${latest[2] + 1}`;
pkg.version = version;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
}
console.log(`Release version: ${version}`);
