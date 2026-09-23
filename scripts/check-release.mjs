#!/usr/bin/env node
// Run by `npm run pack:local` and `prepublishOnly`. Refuses a release that consumers could not install or that is
// not documented:
// - a dependency spec pointing at the local disk (file:, link:, a path or a local .tgz). `npm install <tarball>`
//   without --no-save writes one, and it would not resolve inside a consumer's node_modules;
// - the same in package-lock.json (a package resolved from file: or linked);
// - a -dev prerelease version;
// - no `## [x.y.z]` entry for the version in CHANGELOG.md.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];
const isLocalSpec = (spec) =>
  typeof spec === 'string' && (/^(file|link|portal|workspace):/.test(spec) || /^(\.{1,2}|~)?\//.test(spec) || /\.t(ar\.)?gz$/.test(spec));

for (const field of DEPENDENCY_FIELDS) {
  for (const [name, spec] of Object.entries(pkg[field] || {})) {
    if (isLocalSpec(spec)) problems.push(`package.json ${field}.${name} is "${spec}"; install local tarballs with --no-save`);
  }
}

const lockPath = join(root, 'package-lock.json');
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    if (path === '') continue;
    if (entry.link || (typeof entry.resolved === 'string' && /^file:/.test(entry.resolved))) {
      problems.push(`package-lock.json ${path} is resolved from the local disk (${entry.resolved})`);
    }
  }
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries((lock.packages?.[''] || {})[field] || {})) {
      if (isLocalSpec(spec)) problems.push(`package-lock.json ${field}.${name} is "${spec}"`);
    }
  }
}

if (/-dev\b/.test(pkg.version)) problems.push(`version ${pkg.version} is a -dev prerelease`);

const changelogPath = join(root, 'CHANGELOG.md');
const escaped = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (!existsSync(changelogPath)) {
  problems.push('CHANGELOG.md is missing');
} else if (!new RegExp(`^## \\[${escaped}\\]`, 'm').test(readFileSync(changelogPath, 'utf8'))) {
  problems.push(`CHANGELOG.md has no "## [${pkg.version}]" entry`);
}

if (problems.length > 0) {
  console.error(`check-release: ${pkg.name}@${pkg.version} is not ready\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-release: ${pkg.name}@${pkg.version} ok`);
