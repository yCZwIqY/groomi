import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public/licenses');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const entries = [];
const visited = new Set();
const warnings = [];
await fs.mkdir(output, { recursive: true });
for (const file of await fs.readdir(output)) {
  if (/^(?:\d+\.(?:txt|html)|index\.json|LICENSES\.chromium\.html)$/.test(file)) {
    const generatedFile = path.join(output, file);
    if ((await fs.lstat(generatedFile)).isFile()) await fs.unlink(generatedFile);
  }
}

async function checkIcons(directory) {
  for (const file of await fs.readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, file.name);
    if (file.isDirectory()) await checkIcons(source);
    else if (/\.tsx?$/.test(file.name)) {
      const code = await fs.readFile(source, 'utf8');
      if (/['"]react-icons\/(?!tb['"])/.test(code)) {
        throw new Error(`Only MIT-licensed Tabler icons are permitted: ${source}`);
      }
    }
  }
}
await checkIcons(path.join(root, 'app'));

async function add(name, version, license, source, text, requiresReview = false) {
  const file = `${entries.length}.txt`;
  await fs.writeFile(path.join(output, file), text);
  entries.push({ name, version, license, source, file, requiresReview });
}

function sourceUrl(pkg) {
  const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  let source = (repository || pkg.homepage || `https://www.npmjs.com/package/${pkg.name}`)
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github.com:/, 'https://github.com/')
    .replace(/^git\+ssh:\/\/git@github.com\//, 'https://github.com/')
    .replace(/^ssh:\/\/git@github.com\//, 'https://github.com/')
    .replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(source)) source = `https://github.com/${source}`;
  return source.startsWith('https://') ? source : `https://www.npmjs.com/package/${pkg.name}`;
}

async function visit(name, parent, optional = false) {
  const require = createRequire(path.join(parent, 'package.json'));
  let directory;
  for (const lookup of require.resolve.paths('groomi-license-lookup') ?? []) {
    const candidate = path.join(lookup, name);
    try {
      await fs.access(path.join(candidate, 'package.json'));
      directory = await fs.realpath(candidate);
      break;
    } catch {}
  }
  if (!directory) {
    if (optional) return;
    throw new Error(`Cannot locate license for dependency ${name} from ${parent}`);
  }
  if (visited.has(directory)) return;
  visited.add(directory);
  const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
  const notices = [];
  for (const file of (await fs.readdir(directory)).sort()) {
    if (!/^(licen[sc]e|copying|notice|copyright)([.-]|$)/i.test(file)) continue;
    if (!(await fs.stat(path.join(directory, file))).isFile()) continue;
    let text = await fs.readFile(path.join(directory, file), 'utf8');
    // Only Tabler is used; other icon collections are excluded from the packaged app.
    if (pkg.name === 'react-icons') text = text.split(/\r?\n---/)[0];
    notices.push(`${file}\n\n${text}`);
  }
  const supplemental = path.join(root, 'assets/licenses', `${pkg.name.replaceAll('/', '__')}.txt`);
  try {
    notices.push(await fs.readFile(supplemental, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const requiresReview = !notices.length;
  if (requiresReview) {
    warnings.push(`${pkg.name}@${pkg.version}`);
    notices.push(
      `배포 패키지에 별도 라이선스 원문·저작권 고지가 없습니다. 아래는 package.json의 선언과 표준 라이선스이며, 저작권자 고지는 추가 확인이 필요합니다.\n\nDeclared license: ${pkg.license || 'Not specified'}\nAuthor (package metadata): ${typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || 'Not specified'}\nSource: ${sourceUrl(pkg)}\n\n${pkg.license === 'MIT' ? await fs.readFile(path.join(root, 'assets/licenses/mit-template.txt'), 'utf8') : 'Refer to the source repository for the applicable terms.'}`,
    );
  }
  await add(
    pkg.name,
    pkg.version,
    pkg.license || 'See notices',
    sourceUrl(pkg),
    notices.join('\n\n'),
    requiresReview,
  );
  for (const dependency of Object.keys(pkg.dependencies ?? {}).sort()) {
    await visit(dependency, directory, dependency in (pkg.optionalDependencies ?? {}));
  }
  for (const dependency of Object.keys(pkg.optionalDependencies ?? {}).sort()) {
    await visit(dependency, directory, true);
  }
}

for (const name of Object.keys(manifest.dependencies).sort()) await visit(name, root);
await add(
  'Tabler Icons',
  '',
  'MIT',
  'https://github.com/tabler/tabler-icons',
  await fs.readFile(path.join(root, 'assets/licenses/tabler-icons.txt'), 'utf8'),
);
await add(
  'SUIT',
  '',
  'OFL-1.1',
  'https://github.com/sun-typeface/SUIT',
  await fs.readFile(path.join(root, 'assets/fonts/LICENSE'), 'utf8'),
);
const electron = JSON.parse(
  await fs.readFile(path.join(root, 'node_modules/electron/package.json'), 'utf8'),
);
await add(
  'Electron',
  electron.version,
  'MIT',
  'https://github.com/electron/electron',
  await fs.readFile(path.join(root, 'node_modules/electron/dist/LICENSE'), 'utf8'),
);
const chromiumHtml = await fs.readFile(
  path.join(root, 'node_modules/electron/dist/LICENSES.chromium.html'),
  'utf8',
);
await fs.writeFile(path.join(output, 'LICENSES.chromium.html'), chromiumHtml);
const chromiumText = chromiumHtml
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<\/(?:pre|p|div|h[1-6])>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(
    /&(?:lt|gt|amp|quot|apos|#39|nbsp);/g,
    (entity) =>
      ({
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': ' ',
      })[entity],
  )
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)));
await add(
  'Chromium and third-party components',
  '',
  'Multiple licenses',
  'https://www.chromium.org',
  chromiumText,
);
entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
await fs.writeFile(path.join(output, 'index.json'), JSON.stringify({ entries }, null, 2));
console.log(`Generated ${entries.length} license notices in public/licenses.`);
if (warnings.length) console.warn(`Publisher license text requires review: ${warnings.join(', ')}`);
