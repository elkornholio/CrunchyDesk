const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  powerSaveBlocker,
  nativeTheme,
  session,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  components
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set application identity and isolated userData path for OS taskbars and docks (CachyOS KDE/GNOME, Fedora, Windows, macOS)
app.setName('Crunchyroll');
app.setPath('userData', path.join(app.getPath('appData'), 'Crunchyroll'));
app.setAppUserModelId('com.codesrahul.crunchyroll');
if (process.platform === 'linux') {
  app.setDesktopName('crunchyroll.desktop');
}

// Ensure single instance of the application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
}

let mainWindow = null;
let splashWindow = null;
let powerSaveBlockerId = null;
let tray = null;
let rpc = null;
let rpcReady = false;
let isPipWindowMode = false;
let prePipBounds = null;

const DISCORD_CLIENT_ID = '1150493863777599548';

// Cross-platform Widevine CDM auto-discovery (CachyOS/Arch, Fedora, Ubuntu/Debian, Windows, macOS)
function findWidevineCdm() {
  const home = os.homedir();
  const candidateDirs = [
    path.join(__dirname, 'WidevineCdm')
  ];

  if (process.platform === 'linux') {
    candidateDirs.push(
      // CachyOS / Arch Linux & Fedora system-wide paths
      '/usr/lib/chromium/WidevineCdm',
      '/usr/lib64/chromium-browser/WidevineCdm',
      '/usr/lib/brave-bin/WidevineCdm',
      '/opt/google/chrome/WidevineCdm',
      '/opt/google/chrome-beta/WidevineCdm',
      '/opt/brave.com/brave/WidevineCdm',
      '/usr/lib/vivaldi/WidevineCdm',
      '/opt/vivaldi/WidevineCdm',
      // User browser profile WidevineCdm directories
      path.join(home, '.config/google-chrome/WidevineCdm'),
      path.join(home, '.config/BraveSoftware/Brave-Browser/WidevineCdm'),
      path.join(home, '.config/chromium/WidevineCdm'),
      // Flatpak Chrome / Brave / Chromium (common on Fedora & CachyOS)
      path.join(home, '.var/app/com.google.Chrome/config/google-chrome/WidevineCdm'),
      path.join(home, '.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/WidevineCdm'),
      path.join(home, '.var/app/org.chromium.Chromium/config/chromium/WidevineCdm')
    );

    // Also scan Firefox gmp-widevinecdm folders if present
    const ffProfilesDirs = [
      path.join(home, '.mozilla/firefox'),
      path.join(home, '.var/app/org.mozilla.firefox/.mozilla/firefox')
    ];
    for (const ffDir of ffProfilesDirs) {
      if (fs.existsSync(ffDir)) {
        try {
          for (const entry of fs.readdirSync(ffDir)) {
            const gmpBase = path.join(ffDir, entry, 'gmp-widevinecdm');
            if (fs.existsSync(gmpBase)) {
              for (const ver of fs.readdirSync(gmpBase).sort().reverse()) {
                candidateDirs.push(path.join(gmpBase, ver));
              }
            }
          }
        } catch (_) {}
      }
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

    candidateDirs.push(
      path.join(localAppData, 'Google/Chrome/User Data/WidevineCdm'),
      path.join(localAppData, 'BraveSoftware/Brave-Browser/User Data/WidevineCdm'),
      path.join(localAppData, 'Microsoft/Edge/User Data/WidevineCdm'),
      path.join(localAppData, 'Chromium/User Data/WidevineCdm')
    );

    for (const pf of [programFiles, programFilesX86]) {
      for (const browserRel of ['Google/Chrome/Application', 'Microsoft/Edge/Application', 'BraveSoftware/Brave-Browser/Application']) {
        const browserApp = path.join(pf, browserRel);
        if (fs.existsSync(browserApp)) {
          try {
            for (const ver of fs.readdirSync(browserApp).sort().reverse()) {
              candidateDirs.push(path.join(browserApp, ver, 'WidevineCdm'));
            }
          } catch (_) {}
        }
      }
    }
  } else if (process.platform === 'darwin') {
    candidateDirs.push(
      '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/Current/Libraries/WidevineCdm',
      path.join(home, 'Library/Application Support/Google/Chrome/WidevineCdm'),
      path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/WidevineCdm')
    );
  }

  // Helper to resolve versioned subdirectories if a parent WidevineCdm folder has version folders
  function inspectDir(dir) {
    if (!fs.existsSync(dir)) return null;
    try {
      const manifestPath = path.join(dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return { path: dir, version: manifest.version || '4.10.2891.0' };
      }
      // Check if dir contains version subdirectories (e.g. 4.10.2891.0)
      const subs = fs
        .readdirSync(dir)
        .filter((d) => /^\d+\.\d+\.\d+/.test(d))
        .sort()
        .reverse();
      for (const sub of subs) {
        const subDir = path.join(dir, sub);
        const subManifest = path.join(subDir, 'manifest.json');
        if (fs.existsSync(subManifest)) {
          const manifest = JSON.parse(fs.readFileSync(subManifest, 'utf8'));
          return { path: subDir, version: manifest.version || sub };
        }
        return { path: subDir, version: sub };
      }
      // Or if libwidevinecdm.so exists directly
      if (fs.existsSync(path.join(dir, 'libwidevinecdm.so'))) {
        return { path: dir, version: path.basename(dir).match(/^\d+\.\d+/) ? path.basename(dir) : '4.10.2891.0' };
      }
    } catch (_) {}
    return null;
  }

  for (const candidate of candidateDirs) {
    const found = inspectDir(candidate);
    if (found) return found;
  }
  return null;
}

// Ensure WidevineCdm hint file in userData points to bundled or discovered WidevineCdm for Chromium CDM registration
function syncWidevineHintFile(detectedWidevine) {
  if (!detectedWidevine || !detectedWidevine.path) return;
  try {
    const userDataCdmDir = path.join(app.getPath('userData'), 'WidevineCdm');
    fs.mkdirSync(userDataCdmDir, { recursive: true });
    const hintFile = path.join(userDataCdmDir, 'latest-component-updated-widevine-cdm');
    fs.writeFileSync(hintFile, JSON.stringify({ Path: detectedWidevine.path }), 'utf8');
  } catch (_) {}
}

const detectedWidevine = findWidevineCdm();
if (detectedWidevine) {
  syncWidevineHintFile(detectedWidevine);
  app.commandLine.appendSwitch('widevine-cdm-path', detectedWidevine.path);
  app.commandLine.appendSwitch('widevine-cdm-version', detectedWidevine.version);
}


// Present a clean Chrome User-Agent (without Electron/x.y.z token) so Crunchyroll DRM handshake succeeds
if (app.userAgentFallback) {
  app.userAgentFallback = app.userAgentFallback
    .replace(/\s+Electron\/[^\s]+/gi, '')
    .replace(/\s+Crunchyroll(-Desktop)?\/[^\s]+/gi, '');
}

// Linux sandbox & Wayland/X11 compatibility for CachyOS, Fedora, and external/NTFS drives
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
}

// Prevent Chromium restore / crash bubble dialogs from interrupting startup
app.commandLine.appendSwitch('hide-crash-restore-bubble');
app.commandLine.appendSwitch('disable-session-crashed-bubble');
app.commandLine.appendSwitch('disable-features', 'SessionCrashedBubble');

// Hardware acceleration, video decoding, and Picture-in-Picture optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch(
  'enable-features',
  process.platform === 'linux'
    ? 'PictureInPicture,DocumentPictureInPictureAPI,VaapiVideoDecodeLinuxGL,VaapiVideoEncoder,WaylandWindowDecorations'
    : 'PictureInPicture,DocumentPictureInPictureAPI'
);

function getIconPath() {
  const iconPng = path.join(__dirname, 'resources/app/icon.png');
  const iconIco = path.join(__dirname, 'resources/app/icon.ico');
  const iconIcns = path.join(__dirname, 'resources/app/icon.icns');

  if (process.platform === 'win32' && fs.existsSync(iconIco)) return iconIco;
  if (process.platform === 'darwin' && fs.existsSync(iconIcns)) return iconIcns;
  if (fs.existsSync(iconPng)) return iconPng;
  return undefined;
}

// Create dedicated splash screen window for instant animation
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
    backgroundColor: '#00000000',
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch(() => {});
}

// Setup Ad & Tracker Shield
function setupAdBlocker() {
  const AD_FILTER = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.googlesyndication.com/*',
      '*://*.google-analytics.com/*',
      '*://*.scorecardresearch.com/*',
      '*://*.quantserve.com/*',
      '*://*.adservice.google.com/*',
      '*://*.amazon-adsystem.com/*',
      '*://*.criteo.com/*',
      '*://*.taboola.com/*',
      '*://*.outbrain.com/*',
      '*://*.adroll.com/*',
      '*://*.popads.net/*',
      '*://*.braze.com/*',
      '*://*.branch.io/*',
      '*://*.appboy.com/*',
      '*://*.adjust.com/*',
      '*://*.vungle.com/*',
      '*://*.flashtalking.com/*'
    ]
  };
  try {
    session.defaultSession.webRequest.onBeforeRequest(AD_FILTER, (details, callback) => {
      callback({ cancel: true });
    });
  } catch (e) {}
}

// Discord Rich Presence Setup
function initDiscordRPC() {
  try {
    let DiscordRPC;
    try {
      DiscordRPC = require('discord-rpc');
    } catch (e) {
      return;
    }

    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      rpcReady = true;
      updateDiscordPresence({
        details: 'Browsing Anime',
        state: 'Crunchyroll Desktop'
      });
    });

    rpc.on('error', () => {
      rpcReady = false;
    });

    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {
      rpcReady = false;
    });
  } catch (err) {
    rpcReady = false;
  }
}

function updateDiscordPresence(data) {
  if (!rpc || !rpcReady) return;
  try {
    const presence = {
      details: data.details || 'Watching Anime',
      state: data.state || 'Crunchyroll',
      largeImageKey: 'crunchyroll_logo',
      largeImageText: 'Crunchyroll Desktop',
      instance: false
    };

    if (data.isPlaying && data.duration && data.currentTime) {
      presence.startTimestamp = Math.floor(Date.now() - data.currentTime * 1000);
      presence.endTimestamp = Math.floor(Date.now() + (data.duration - data.currentTime) * 1000);
      presence.smallImageKey = 'play';
      presence.smallImageText = 'Playing';
    } else if (data.isPlaying) {
      presence.startTimestamp = Math.floor(Date.now());
      presence.smallImageKey = 'play';
      presence.smallImageText = 'Playing';
    } else {
      presence.smallImageKey = 'pause';
      presence.smallImageText = 'Paused';
    }

    if (data.watchUrl && data.watchUrl.startsWith('http')) {
      presence.buttons = [{ label: 'Watch on Crunchyroll', url: data.watchUrl }];
    }

    rpc.setActivity(presence).catch(() => {});
  } catch (e) {}
}

// System Tray Configuration
function setupTray() {
  if (tray) return;
  const iconPath = getIconPath();
  if (!iconPath) return;

  try {
    let trayIcon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'linux' || process.platform === 'win32') {
      trayIcon = trayIcon.resize({ width: 22, height: 22 });
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Crunchyroll Desktop');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Crunchyroll',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: '▶ Play / ⏸ Pause',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-play-pause');
        }
      },
      {
        label: '⏭ Next Episode',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-next');
        }
      },
      {
        label: '🔇 Mute / Unmute',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-mute');
        }
      },
      { type: 'separator' },
      {
        label: '✓ Mark Current Episode Watched',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mark-current-watched');
        }
      },
      {
        label: '✕ Mark Current Episode Unwatched',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mark-current-unwatched');
        }
      },
      { type: 'separator' },
      {
        label: '🍿 Explore Popular',
        click: () => {
          if (mainWindow) mainWindow.loadURL('https://www.crunchyroll.com/videos/popular');
        }
      },
      {
        label: '📅 Simulcasts',
        click: () => {
          if (mainWindow) mainWindow.loadURL('https://www.crunchyroll.com/simulcasts');
        }
      },
      {
        label: '🔖 Watchlist',
        click: () => {
          if (mainWindow) mainWindow.loadURL('https://www.crunchyroll.com/watchlist');
        }
      },
      { type: 'separator' },
      {
        label: '⚙️ Command Palette',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('open-preferences');
          }
        }
      },
      {
        label: '🚪 Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('System tray notice:', err);
  }
}

// Global Media Key Handlers
function setupGlobalShortcuts() {
  try {
    globalShortcut.register('MediaPlayPause', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-next');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-prev');
    });
    globalShortcut.register('MediaStop', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-stop');
    });
  } catch (e) {}
}

function isAllowedCrunchyrollUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return false;
    const allowedHosts = [
      'crunchyroll.com',
      'www.crunchyroll.com',
      'beta.crunchyroll.com',
      'accounts.crunchyroll.com',
      'static.crunchyroll.com',
      'sso.crunchyroll.com'
    ];
    return allowedHosts.some(
      (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
    );
  } catch {
    return false;
  }
}

function createWindow() {
  createSplashWindow();

  mainWindow = new BrowserWindow({
    title: 'Crunchyroll',
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    show: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: '#000000',
    icon: getIconPath(),
    webPreferences: {
      plugins: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
      sandbox: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.platform !== 'darwin') {
    mainWindow.setMenu(null);
  }

  // Load Crunchyroll
  mainWindow.loadURL('https://www.crunchyroll.com');

  // Once ready or timeout, smoothly transition from splash to main window
  let windowShown = false;
  const revealMainWindow = () => {
    if (windowShown) return;
    windowShown = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      }, 400);
    }
  };

  mainWindow.once('ready-to-show', () => {
    // Show splash animation for at least 1.2s for pleasant visual experience
    setTimeout(revealMainWindow, 1200);
  });

  // Fallback reveal in case network is slow
  setTimeout(revealMainWindow, 3000);

  // Prevent unauthorized devtools shortcuts in production unless ELECTRON_DEBUG is set
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevToolsKey =
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i');

    if (isDevToolsKey && !process.env.ELECTRON_DEBUG) {
      event.preventDefault();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedCrunchyrollUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  function checkCanGoBack() {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.webContents.navigationHistory) {
      return mainWindow.webContents.navigationHistory.canGoBack();
    }
    return mainWindow.webContents.canGoBack ? mainWindow.webContents.canGoBack() : false;
  }

  function checkCanGoForward() {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.webContents.navigationHistory) {
      return mainWindow.webContents.navigationHistory.canGoForward();
    }
    return mainWindow.webContents.canGoForward ? mainWindow.webContents.canGoForward() : false;
  }

  // Mouse Back / Forward navigation
  mainWindow.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' && checkCanGoBack()) {
      if (mainWindow.webContents.navigationHistory) mainWindow.webContents.navigationHistory.goBack();
      else mainWindow.webContents.goBack();
    } else if (cmd === 'browser-forward' && checkCanGoForward()) {
      if (mainWindow.webContents.navigationHistory) mainWindow.webContents.navigationHistory.goForward();
      else mainWindow.webContents.goForward();
    }
  });

  // Track navigation state changes
  const sendNavState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nav-state-changed', {
        canGoBack: checkCanGoBack(),
        canGoForward: checkCanGoForward()
      });
    }
  };

  mainWindow.webContents.on('did-navigate', sendNavState);
  mainWindow.webContents.on('did-navigate-in-page', sendNavState);

  // Handle renderer crashes & unresponsiveness gracefully
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.warn('Renderer process gone:', details.reason);
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.on('unresponsive', () => {
    console.warn('Crunchyroll window temporarily unresponsive.');
  });

  mainWindow.on('responsive', () => {
    console.log('Crunchyroll window responsive again.');
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && tray) {
      // Keep running in tray when tray is available
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
    }
  });
}

// Global exception safety guards to prevent unhandled crash exits
process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception caught safely:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection caught safely:', reason);
});

// Power save management during playback
ipcMain.on('playback-state-change', (event, isPlaying) => {
  if (isPlaying) {
    if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
  } else {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
    }
  }
});

// Window Navigation & Control IPCs
ipcMain.on('nav-back', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.navigationHistory && mainWindow.webContents.navigationHistory.canGoBack()) {
    mainWindow.webContents.navigationHistory.goBack();
  } else if (mainWindow.webContents.canGoBack && mainWindow.webContents.canGoBack()) {
    mainWindow.webContents.goBack();
  }
});

ipcMain.on('nav-forward', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.navigationHistory && mainWindow.webContents.navigationHistory.canGoForward()) {
    mainWindow.webContents.navigationHistory.goForward();
  } else if (mainWindow.webContents.canGoForward && mainWindow.webContents.canGoForward()) {
    mainWindow.webContents.goForward();
  }
});

ipcMain.on('nav-reload', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
});

ipcMain.on('nav-home', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL('https://www.crunchyroll.com');
});

ipcMain.on('nav-url', (event, url) => {
  if (mainWindow && !mainWindow.isDestroyed() && isAllowedCrunchyrollUrl(url)) {
    mainWindow.loadURL(url);
  }
});

ipcMain.handle('get-nav-state', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { canGoBack: false, canGoForward: false };
  const canBack = mainWindow.webContents.navigationHistory
    ? mainWindow.webContents.navigationHistory.canGoBack()
    : mainWindow.webContents.canGoBack
      ? mainWindow.webContents.canGoBack()
      : false;
  const canFwd = mainWindow.webContents.navigationHistory
    ? mainWindow.webContents.navigationHistory.canGoForward()
    : mainWindow.webContents.canGoForward
      ? mainWindow.webContents.canGoForward()
      : false;
  return {
    canGoBack: canBack,
    canGoForward: canFwd
  };
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Floating Mini-Player IPC
ipcMain.handle('toggle-pip-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  if (isPipWindowMode) {
    isPipWindowMode = false;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(800, 500);
    if (prePipBounds) {
      mainWindow.setBounds(prePipBounds);
    } else {
      mainWindow.setSize(1280, 720);
      mainWindow.center();
    }
    return false;
  } else {
    prePipBounds = mainWindow.getBounds();
    isPipWindowMode = true;
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const pipWidth = 520;
    const pipHeight = 300;

    mainWindow.setMinimumSize(320, 180);
    mainWindow.setBounds({
      x: Math.round(width - pipWidth - 24),
      y: Math.round(height - pipHeight - 24),
      width: pipWidth,
      height: pipHeight
    });
    mainWindow.setAlwaysOnTop(true, 'floating');
    return true;
  }
});

ipcMain.handle('get-theme-info', () => {
  return {
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors
  };
});

ipcMain.on('update-discord-rpc', (event, data) => {
  updateDiscordPresence(data);
});

// App Lifecycle
app.whenReady().then(async () => {
  nativeTheme.themeSource = 'system';

  // Wait for Widevine CDM component initialization if running under castLabs Electron without a pre-bundled CDM
  const execWidevineDir = path.join(path.dirname(process.execPath), 'WidevineCdm');
  const hasBundledWidevine =
    fs.existsSync(path.join(execWidevineDir, 'manifest.json')) || Boolean(detectedWidevine);
  if (components && typeof components.whenReady === 'function' && !hasBundledWidevine) {
    try {
      const targetComponents = components.WIDEVINE_CDM_ID ? [components.WIDEVINE_CDM_ID] : undefined;
      await Promise.race([
        components.whenReady(targetComponents),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
      console.log('Widevine CDM components ready:', components.status());
    } catch (err) {
      console.warn('Widevine components.whenReady notice:', err.message || err);
    }
  }

  setupAdBlocker();
  createWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents
        .executeJavaScript(
          `navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
            initDataTypes: ['cenc'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'SW_SECURE_CRYPTO' }]
          }]).then(() => 'OK').catch((e) => 'ERR:' + e.message)`
        )
        .then((res) => console.log('Widevine EME status:', res))
        .catch(() => {});
    });
  }
  setupTray();
  setupGlobalShortcuts();
  initDiscordRPC();

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme-changed', {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors
      });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (rpc) {
    try {
      rpc.destroy();
    } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
