<div align="center">
  <img src="resources/app/icon.png" width="120" height="120" alt="Crunchyroll Desktop Logo" />
  <h1>Crunchyroll Desktop</h1>
  <p><strong>A sleek, high-performance Crunchyroll desktop application for CachyOS, Fedora, Windows, and macOS with Widevine DRM, Discord Rich Presence, and Episode Watched/Unwatched Management.</strong></p>
</div>

---

## 📖 Overview

**Crunchyroll Desktop** brings the complete anime streaming experience out of cluttered browser tabs into a standalone desktop client. Inspired by [CodesRahul96/Crunchyroll-Desktop](https://github.com/CodesRahul96/Crunchyroll-Desktop) and enhanced with the Episode Watched / Unwatched management architecture from [ThomasTavernier/Improve-Crunchyroll](https://github.com/ThomasTavernier/Improve-Crunchyroll), it combines DRM-protected playback, real-time visual enhancement shaders, Discord Rich Presence, native Wayland/X11/Windows integration, and full episode progress control.

---

## ✨ Key Highlights

### ✅ Episode & Season Watched / Unwatched Tracker (Improve-Crunchyroll Integration)
- **Episode Card Quick Toggle**: Every episode card on series pages features a one-click **`Watched` / `Mark Watched`** pill badge in the top-right corner of the thumbnail.
- **3-Dots Action Menu (Improve-Crunchyroll Style)**: Clicking the 3-dots menu on any episode card (or right-clicking the badge) opens a nested menu:
  - **Mark as watched** ▸ *Mark only this one* / *Mark all previous*
  - **Mark as not watched** ▸ *Mark only this one* / *Mark all next*
- **Season-Level Batch Controls**: Series pages include **Mark Season Watched** and **Mark Season Unwatched** buttons right next to the season selector.
- **Top Bar & Player Controls**: Use the **Watch Status** menu in the top bar, the **Command Palette (`Ctrl+K`)**, the **System Tray**, or keyboard shortcuts (`W` / `Shift+W`) while watching an episode to mark it watched or unwatched.
- **Crunchyroll Account Sync + Local Persistence**: Syncs directly with Crunchyroll's `/content/v2/{account_id}/playheads/batch` API (setting playhead to full episode duration for Watched or `0` for Unwatched) while updating card states immediately.

### 🎬 Anime Streaming & Player Power
- **Smart Cross-Platform Widevine DRM Discovery**: Automatically detects bundled or system/browser Widevine CDM across CachyOS/Arch, Fedora, Windows (Chrome/Edge/Brave), and macOS.
- **Smart Auto-Skip & Auto-Next**: Automatically skips intros and recaps and seamlessly queues up the next episode.
- **Anime Visual Enhancer (Shaders)**: Switch between custom post-processing presets (*Natural*, *Vibrant Anime*, *Crisp Detail*, *Cinematic OLED*, and *Warm Retro*).
- **Precision Speed Control**: Adjust playback rate in smooth `0.25x` increments (`0.25x` to `3.0x`) with on-screen toast feedback.
- **Fit Video to Window Mode**: Expand the active video player to fill the entire application window (`T` / `Esc` or top bar icon) without forcing OS fullscreen.
- **Picture-in-Picture & Floating Mini-Player**: Watch anime in an always-on-top floating window (`P`).
- **Power-Save Blocker**: Prevents system idle sleep and screensavers while video is playing.

### 🎮 Desktop Integration
- **CachyOS, Fedora & Windows Ready**: Native Wayland + VAAPI hardware acceleration flags on Linux (`--ozone-platform-hint=auto`), KDE Plasma 6 (`kbuildsycoca6`) & GNOME desktop integration, and Windows NSIS/Portable support.
- **Native Instant Splash Screen**: Smooth animated launch screen.
- **Discord Rich Presence (RPC)**: Broadcasts the current anime title, episode, and live playback timer on your Discord profile.
- **Universal Command Palette (`Ctrl + K` / `Cmd + K`)**: Quick-jump search for shows, simulcasts, player settings, and watched/unwatched actions.
- **OS Media Center & Hardware Keys**: Integrated with KDE Plasma, GNOME, Windows Media Control, and hardware media keys.
- **Built-in Ad & Tracker Shield**: Blocks disruptive ad networks and background telemetry.

---

## ⌨️ Keyboard & Navigation Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl + K`** / **`Cmd + K`** | Open Spotlight Command Palette & Quick Search |
| **`W`** | Mark current episode as **Watched** |
| **`Shift + W`** | Mark current episode as **Unwatched (Not Watched)** |
| **`Alt + ←`** / **`Alt + →`** | Navigate Page Back / Forward |
| **`[`** / **`]`** | Decrease / Increase playback speed (`0.25x` steps) |
| **`T`** / **`Esc`** | Toggle **Fit Video to Window** mode |
| **`P`** | Toggle Picture-in-Picture / Floating Mini-Player |
| **`Space`** / **`K`** | Play / Pause video |
| **`F`** | Toggle Fullscreen mode |
| **`M`** | Mute / Unmute audio |
| **`Media Keys`** | Hardware Play/Pause, Next Track (`+10s` / Next), Prev Track (`-10s`) |

---

## 📦 Installation & Running

### 🐧 CachyOS / Arch Linux

**Option 1: Automated Installer Script (Uses system `electron` or local `npm`)**
```bash
chmod +x install.sh
./install.sh          # Installs desktop launcher & icon for current user
# Or install dependencies automatically if needed:
./install.sh --deps
```

**Option 2: Native Arch/CachyOS `PKGBUILD`**
```bash
cd packaging/cachyos
makepkg -si
```

**Option 3: Build `.pacman` & `.AppImage` via `electron-builder`**
```bash
npm install
npm run build:cachyos
```

---

### 🎩 Fedora Linux

**Option 1: Automated Installer Script**
```bash
chmod +x install.sh
./install.sh --deps   # Installs Node/npm & dependencies via dnf and sets up desktop entry
```

**Option 2: Build `.rpm` & `.AppImage` via `electron-builder`**
```bash
npm install
npm run build:fedora
sudo dnf install ./dist/*.rpm
```

---

### 🪟 Windows (Windows 10 / 11)

**Option 1: PowerShell Installer (Creates Desktop & Start Menu Shortcuts)**
```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```
Or double-click `run-windows.bat` to launch directly.

**Option 2: Build Windows `.exe` Installer (NSIS & Portable)**
```powershell
npm install
npm run build:win
```

---

## 🛠️ Maintenance & CLI Utilities (Linux)

```bash
./install.sh              # Install for current user (~/.local/share/applications)
sudo ./install.sh --system # Install globally for all users (/usr/share/applications)
./install.sh --deps       # Install OS dependencies (pacman / dnf / apt) + npm packages
./install.sh --repair     # Clear stale session locks and cache safely
./install.sh --uninstall  # Cleanly remove application shortcuts and icons
```
