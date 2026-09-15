#!/usr/bin/env node
// Builds the OHIF Viewer from source with the FHIR viewer extension and its
// bundled mode linked in, at the commits pinned in upstream.json. Output:
//
//   out/ohif-viewer.tar.gz         the built viewer, contents at the archive root
//   out/ohif-viewer.tar.gz.sha256  its SHA-256, as `sha256sum` prints it
//   out/site/                      the same tree, for this repo's GitHub Pages
//
// The steps mirror the extension's quick start (https://ohif.org/modes/fhir-viewer)
// with two deliberate differences: the extension and mode are registered by
// writing `directory` entries into OHIF's pluginConfig.json (the out-of-tree
// mechanism OHIF's build supports) instead of the yarn-based `cli link-*`
// commands, and PUBLIC_URL is `./` so the bundle serves from any path.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstreamDir = join(repoRoot, 'upstream')
const outDir = join(repoRoot, 'out')
const pins = JSON.parse(readFileSync(join(repoRoot, 'upstream.json'), 'utf8'))

const log = (message) => process.stdout.write(`\n==> ${message}\n`)

const run = (command, args, options = {}) => {
  process.stdout.write(`$ ${command} ${args.join(' ')}\n`)
  execFileSync(command, args, { stdio: 'inherit', ...options })
}

const pnpm = (cwd, args, env = {}) =>
  run('npx', ['--yes', `pnpm@${pins.pnpm}`, ...args], { cwd, env: { ...process.env, ...env } })

/** Shallow-fetches one pinned commit into `dir`, reusing the checkout if it is already there. */
const fetchPinned = (dir, { repo, commit }) => {
  if (existsSync(join(dir, '.git'))) {
    const head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    if (head === commit) {
      log(`${repo} already at ${commit}`)
      return
    }
    rmSync(dir, { recursive: true, force: true })
  }
  log(`Fetching ${repo} @ ${commit}`)
  mkdirSync(dir, { recursive: true })
  run('git', ['init', '-q', dir])
  run('git', ['-C', dir, 'remote', 'add', 'origin', repo])
  run('git', ['-C', dir, 'fetch', '-q', '--depth', '1', 'origin', commit])
  run('git', ['-C', dir, 'checkout', '-q', 'FETCH_HEAD'])
}

const viewersDir = join(upstreamDir, 'Viewers')
const extensionDir = join(upstreamDir, 'ohif-fhir-viewer')
fetchPinned(viewersDir, pins.viewers)
fetchPinned(extensionDir, pins.fhirViewer)

log('Installing OHIF Viewers dependencies')
pnpm(viewersDir, ['install', '--frozen-lockfile'])

log('Installing the extension dependencies (peers resolve from the OHIF build)')
pnpm(extensionDir, ['install', '--frozen-lockfile', '--config.auto-install-peers=false'])

log('Registering @ohif/fhir-viewer and its bundled mode in pluginConfig.json')
const appDir = join(viewersDir, 'platform', 'app')
const pluginConfigPath = join(appDir, 'pluginConfig.json')
const pluginConfig = JSON.parse(readFileSync(pluginConfigPath, 'utf8'))
const extensionPackage = JSON.parse(readFileSync(join(extensionDir, 'package.json'), 'utf8'))
const modePackage = JSON.parse(readFileSync(join(extensionDir, 'mode', 'package.json'), 'utf8'))
const register = (list, packageName, directory) => {
  const others = list.filter((entry) => entry.packageName !== packageName)
  return [...others, { packageName, directory }]
}
pluginConfig.extensions = register(pluginConfig.extensions, extensionPackage.name, extensionDir)
pluginConfig.modes = register(pluginConfig.modes, modePackage.name, join(extensionDir, 'mode'))
writeFileSync(pluginConfigPath, `${JSON.stringify(pluginConfig, null, 2)}\n`)

log('Building the viewer (production, relative PUBLIC_URL)')
const configName = 'config/ohif-viewer-dist.js'
cpSync(join(repoRoot, 'config', 'app-config.js'), join(appDir, 'public', configName))
pnpm(appDir, ['run', 'build'], {
  NODE_ENV: 'production',
  PUBLIC_URL: './',
  APP_CONFIG: configName,
  QUICK_BUILD: 'false',
})

const distDir = join(appDir, 'dist')
if (!existsSync(join(distDir, 'index.html'))) {
  throw new Error(`OHIF build produced no index.html in ${distDir}`)
}

// A build that silently dropped the plugins would still succeed above, so
// prove they went in: the generated plugin manifest must register both, and
// the extension's id must appear in the emitted JavaScript.
log('Checking the FHIR viewer plugins made it into the bundle')
const pluginImports = readFileSync(join(appDir, 'src', 'pluginImports.js'), 'utf8')
for (const line of [
  `extensions.push("${extensionPackage.name}")`,
  `modes.push("${modePackage.name}")`,
]) {
  if (!pluginImports.includes(line)) {
    throw new Error(`pluginImports.js does not register the plugin: expected ${line}`)
  }
}
const bundled = readdirSync(distDir)
  .filter((name) => name.endsWith('.js'))
  .some((name) => readFileSync(join(distDir, name), 'utf8').includes(extensionPackage.name))
if (!bundled) {
  throw new Error(`No emitted script in ${distDir} mentions ${extensionPackage.name}`)
}

log('Packaging')
// Source maps are ~100 MB of a ~220 MB dist and nothing a deployment serves
// on purpose; drop them so the release and the Pages site stay lean.
const removeSourceMaps = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) removeSourceMaps(entryPath)
    else if (entry.name.endsWith('.map')) rmSync(entryPath)
  }
}
removeSourceMaps(distDir)
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'site'), { recursive: true })
cpSync(distDir, join(outDir, 'site'), { recursive: true })
// GitHub Pages runs Jekyll unless told not to; OHIF's dist has no underscore
// paths today, but the marker costs nothing and guards against one appearing.
writeFileSync(join(outDir, 'site', '.nojekyll'), '')
cpSync(join(repoRoot, '404.html'), join(outDir, 'site', '404.html'))
const archivePath = join(outDir, 'ohif-viewer.tar.gz')
run('tar', ['-czf', archivePath, '-C', distDir, '.'])
const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex')
writeFileSync(`${archivePath}.sha256`, `${digest}  ohif-viewer.tar.gz\n`)
log(`Done: ${archivePath} (sha256 ${digest})`)
