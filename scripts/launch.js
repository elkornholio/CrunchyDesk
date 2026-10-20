#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

function findElectronBinary() {
  const isWin = process.platform === 'win32';
  const home = require('os').homedir();

  // 1. Always prefer Castlabs Widevine-enabled Electron (local or user-installed in ~/.local/share/crunchyroll-desktop)
  const widevineCandidates = [
    path.join(rootDir, 'electron-widevine', isWin ? 'electron.exe' : 'electron'),
    isWin
      ? path.join(
          process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
          'Programs',
          'Crunchyroll-Desktop',
          'electron-widevine',
          'electron.exe'
        )
      : path.join(home, '.local', 'share', 'crunchyroll-desktop', 'electron-widevine', 'electron'),
    '/opt/crunchyroll-desktop/electron-widevine/electron'
  ];
  for (const candidate of widevineCandidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  // 2. On Windows, prefer direct electron.exe binary over electron.cmd to avoid cmd.exe quoting issues
  if (isWin) {
    const winExe = path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe');
    if (fs.existsSync(winExe)) return winExe;
  }

  const localBin = path.join(
    rootDir,
    'node_modules',
    '.bin',
    isWin ? 'electron.cmd' : 'electron'
  );
  if (fs.existsSync(localBin)) return localBin;

  // Check /usr/lib/electron* on Arch / CachyOS first (avoids wrapper script forcing ELECTRON_FORCE_IS_PACKAGED=true)
  if (process.platform === 'linux' && fs.existsSync('/usr/lib')) {
    try {
      const dirs = fs
        .readdirSync('/usr/lib')
        .filter((d) => /^electron\d*$/.test(d))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const dir of dirs) {
        const bin = path.join('/usr/lib', dir, 'electron');
        if (fs.existsSync(bin)) return bin;
      }
    } catch (_) {}
  }

  // Check common system Electron binaries on CachyOS / Arch / Fedora / Linux
  const candidates = [
    'electron',
    'electron43',
    'electron42',
    'electron41',
    'electron40',
    'electron39',
    'electron38',
    'electron37',
    'electron36',
    'electron35',
    'electron34',
    'electron33',
    'electron32'
  ];

  for (const cmd of candidates) {
    try {
      const resolved = execSync(isWin ? `where ${cmd}` : `command -v ${cmd}`, {
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim()
        .split(/\r?\n/)[0];
      if (resolved) return resolved;
    } catch (_) {}
  }

  return null;
}

const electronBin = findElectronBinary();
if (!electronBin) {
  console.error(
    'Error: Electron binary not found. Run `npm install` or `./install.sh --deps` first.'
  );
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const args = [rootDir, ...extraArgs];
if (process.platform === 'linux' && !args.includes('--no-sandbox')) {
  args.unshift('--no-sandbox');
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_FORCE_IS_PACKAGED;

const useShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(electronBin);

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  cwd: rootDir,
  env,
  shell: useShell
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
