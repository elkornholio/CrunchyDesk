#!/bin/bash

set -e

SRC_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$HOME/.local/share/crunchyroll-desktop"
if [ "$1" == "--system" ]; then
  APP_PATH="/opt/crunchyroll-desktop"
fi
EXEC_PATH=""
MAIN_PATH="$APP_PATH/main.js"
ICON_PATH="$APP_PATH/resources/app/icon.png"

# Color codes for professional output
ORANGE='\033[0;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${ORANGE}${BOLD}"
echo "  ██████╗██████╗ ██╗   ██╗███╗   ██╗ ██████╗██╗  ██╗██╗   ██╗██████╗  ██████╗ ██╗     ██╗     "
echo " ██╔════╝██╔══██╗██║   ██║████╗  ██║██╔════╝██║  ██║╚██╗ ██╔╝██╔══██╗██╔═══██╗██║     ██║     "
echo " ██║     ██████╔╝██║   ██║██╔██╗ ██║██║     ███████║ ╚████╔╝ ██████╔╝██║   ██║██║     ██║     "
echo " ██║     ██╔══██╗██║   ██║██║╚██╗██║██║     ██╔══██║  ╚██╔╝  ██╔══██╗██║   ██║██║     ██║     "
echo " ╚██████╗██║  ██║╚██████╔╝██║ ╚████║╚██████╗██║  ██║   ██║   ██║  ██║╚██████╔╝███████╗███████╗"
echo "  ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝"
echo -e "${CYAN}         Cross-Platform Anime Desktop Client Setup (CachyOS • Fedora • Linux)${NC}\n"

# Detect Linux Distribution
DISTRO_ID="linux"
DISTRO_LIKE=""
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO_ID="${ID:-linux}"
  DISTRO_LIKE="${ID_LIKE:-}"
fi

echo -e "🖥️  Detected OS: ${BOLD}${PRETTY_NAME:-$DISTRO_ID}${NC}"

# Handle Uninstallation
if [ "$1" == "--uninstall" ] || [ "$1" == "-u" ]; then
  echo "🧹 Removing Crunchyroll desktop entries, icons, and installed runtime..."
  rm -f "$HOME/.local/share/applications/crunchyroll.desktop"
  rm -f "$HOME/.local/share/applications/crunchyroll-desktop.desktop"
  rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/crunchyroll.png"
  rm -f "$HOME/.local/bin/crunchyroll-desktop"
  rm -rf "$HOME/.local/share/crunchyroll-desktop"
  if [ -w "/usr/share/applications" ] || [ "$EUID" -eq 0 ]; then
    rm -f "/usr/share/applications/crunchyroll.desktop"
    rm -f "/usr/share/applications/crunchyroll-desktop.desktop"
    rm -f "/usr/share/icons/hicolor/512x512/apps/crunchyroll.png"
    rm -f "/usr/local/bin/crunchyroll-desktop"
    rm -rf "/opt/crunchyroll-desktop"
  fi
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
  command -v kbuildsycoca6 &>/dev/null && kbuildsycoca6 2>/dev/null || true
  echo -e "${GREEN}✅ Crunchyroll uninstalled cleanly.${NC}"
  exit 0
fi

# Detect and close any running Crunchyroll instances before updating files
WAS_RUNNING=0
RUNNING_PIDS=$(pgrep -f "$MAIN_PATH|$SRC_PATH/main.js" 2>/dev/null || true)
if [ -n "$RUNNING_PIDS" ]; then
  echo "🔄 Detected running Crunchyroll instance(s). Closing for fresh restart..."
  WAS_RUNNING=1
  pkill -15 -f "$MAIN_PATH|$SRC_PATH/main.js" 2>/dev/null || true
  sleep 1
  pkill -9 -f "$MAIN_PATH|$SRC_PATH/main.js" 2>/dev/null || true
fi

# Sync application source files to standalone install directory ($APP_PATH) so source repo / Nextcloud stays clean
echo -e "📂 Installing application files to ${CYAN}${APP_PATH}${NC}..."
if [ "$1" == "--system" ] && [ "$EUID" -ne 0 ]; then
  sudo mkdir -p "$APP_PATH"
  sudo chown -R "$USER:$USER" "$APP_PATH"
else
  mkdir -p "$APP_PATH/resources/app" "$APP_PATH/scripts"
fi

cp -f "$SRC_PATH/main.js" "$SRC_PATH/preload.js" "$SRC_PATH/splash.html" "$SRC_PATH/package.json" "$APP_PATH/"
cp -rf "$SRC_PATH/resources/"* "$APP_PATH/resources/" 2>/dev/null || true
cp -rf "$SRC_PATH/scripts/"* "$APP_PATH/scripts/" 2>/dev/null || true

# Migrate any existing Widevine Electron or CDM from source folder into $APP_PATH so source folder stays pure code
if [ "$SRC_PATH" != "$APP_PATH" ]; then
  if [ -d "$SRC_PATH/electron-widevine" ]; then
    rm -rf "$APP_PATH/electron-widevine"
    mv "$SRC_PATH/electron-widevine" "$APP_PATH/electron-widevine"
  fi
  if [ -d "$SRC_PATH/WidevineCdm" ]; then
    rm -rf "$APP_PATH/WidevineCdm"
    mv "$SRC_PATH/WidevineCdm" "$APP_PATH/WidevineCdm"
  fi
  if [ -d "$SRC_PATH/node_modules" ]; then
    rm -rf "$APP_PATH/node_modules"
    mv "$SRC_PATH/node_modules" "$APP_PATH/node_modules"
  fi
fi

# Handle Cache/Conflict Cleanup
if [ "$1" == "--clean" ] || [ "$1" == "--repair" ]; then
  echo "🔧 Resetting application cache and resolving conflict locks..."
  rm -f "$HOME/.config/Crunchyroll/SingletonLock" 2>/dev/null || true
  rm -rf "$HOME/.config/Crunchyroll/Cache" 2>/dev/null || true
  rm -rf "$HOME/.config/Crunchyroll/Code Cache" 2>/dev/null || true
  rm -f "$HOME/.config/crunchyroll-desktop/SingletonLock" 2>/dev/null || true
  rm -rf "$HOME/.config/crunchyroll-desktop/Cache" 2>/dev/null || true
  rm -rf "$HOME/.config/crunchyroll-desktop/Code Cache" 2>/dev/null || true
  echo -e "${GREEN}✅ Stale session locks and caches cleared.${NC}"
fi

# Optional Dependency Installation for CachyOS / Arch, Fedora, Debian/Ubuntu
install_distro_deps() {
  echo "📦 Installing runtime dependencies for $DISTRO_ID..."
  if [[ "$DISTRO_ID" == "cachyos" || "$DISTRO_ID" == "arch" || "$DISTRO_LIKE" == *"arch"* ]]; then
    sudo pacman -S --needed --noconfirm electron nodejs npm python curl unzip
  elif [[ "$DISTRO_ID" == "fedora" || "$DISTRO_LIKE" == *"fedora"* || "$DISTRO_LIKE" == *"rhel"* ]]; then
    sudo dnf install -y nodejs npm python3 curl unzip alsa-lib gtk3 libXScrnSaver nss libdrm mesa-libgbm
  elif [[ "$DISTRO_ID" == "ubuntu" || "$DISTRO_ID" == "debian" || "$DISTRO_LIKE" == *"debian"* ]]; then
    sudo apt-get update && sudo apt-get install -y nodejs npm python3 curl unzip libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2t64 || sudo apt-get install -y nodejs npm python3 curl unzip
  fi

  if command -v npm &>/dev/null; then
    (cd "$APP_PATH" && npm install)
  fi
}

if [ "$1" == "--deps" ]; then
  install_distro_deps
elif [ ! -d "$APP_PATH/node_modules" ] && command -v npm &>/dev/null; then
  echo "📦 Installing Node.js dependencies (discord-rpc, etc.)..."
  (cd "$APP_PATH" && npm install --no-fund --no-audit) || true
fi

# Automatically provision Castlabs Widevine-enabled Electron (ECS) and Widevine CDM so DRM streams work without KAT-6005 errors
CASTLABS_VERSION="44.5.1+wvcus"
CASTLABS_TAG="v44.5.1%2Bwvcus"
WIDEVINE_VERSION="4.10.3050.0"
WIDEVINE_CRX_URL="https://www.google.com/dl/release2/chrome_component/bywu6vkyg6gmcthxdaetzfkptm_4.10.3050.0/oimompecagnajdejgnnjijobebaeigek_4.10.3050.0_linux_aduyhcxcs7a2znuo6ss5tffn5jpa.crx3"

ensure_widevine_electron() {
  local arch_suffix="linux-x64"
  local cdm_arch="linux_x64"
  local machine_arch
  machine_arch="$(uname -m)"
  if [ "$machine_arch" == "aarch64" ] || [ "$machine_arch" == "arm64" ]; then
    arch_suffix="linux-arm64"
    cdm_arch="linux_arm64"
  fi

  if [ ! -x "$APP_PATH/electron-widevine/electron" ]; then
    local download_url="https://github.com/castlabs/electron-releases/releases/download/${CASTLABS_TAG}/electron-${CASTLABS_TAG}-${arch_suffix}.zip"
    local zip_path="$APP_PATH/electron-widevine.zip"

    echo -e "🎬 ${CYAN}Downloading Widevine-enabled Electron (${CASTLABS_VERSION} for ${arch_suffix})...${NC}"
    if command -v curl &>/dev/null; then
      curl -fL "$download_url" -o "$zip_path" || return 1
    elif command -v wget &>/dev/null; then
      wget -O "$zip_path" "$download_url" || return 1
    else
      echo -e "⚠️  Neither curl nor wget found to download Widevine Electron."
      return 1
    fi

    mkdir -p "$APP_PATH/electron-widevine"
    if command -v unzip &>/dev/null; then
      unzip -q -o "$zip_path" -d "$APP_PATH/electron-widevine"
    elif command -v python3 &>/dev/null; then
      python3 -m zipfile -e "$zip_path" "$APP_PATH/electron-widevine"
    elif command -v bsdtar &>/dev/null; then
      bsdtar -xf "$zip_path" -C "$APP_PATH/electron-widevine"
    fi
    rm -f "$zip_path"
    chmod +x "$APP_PATH/electron-widevine/electron" "$APP_PATH/electron-widevine/chrome_crashpad_handler" 2>/dev/null || true
    echo -e "${GREEN}✅ Widevine-enabled Electron installed in $APP_PATH/electron-widevine${NC}"
  fi

  # Ensure Bundled & UserData WidevineCdm library and manifest are installed for Linux Zygote CDM registration
  local bundled_cdm_dir="$APP_PATH/electron-widevine/WidevineCdm"
  if [ ! -f "$bundled_cdm_dir/_platform_specific/$cdm_arch/libwidevinecdm.so" ] || [ ! -f "$bundled_cdm_dir/manifest.json" ]; then
    echo -e "🔐 ${CYAN}Installing Widevine CDM (${WIDEVINE_VERSION}) for DRM video playback...${NC}"
    local crx_path="$APP_PATH/widevine.crx3"
    if command -v curl &>/dev/null; then
      curl -fsSL "$WIDEVINE_CRX_URL" -o "$crx_path" || return 1
    elif command -v wget &>/dev/null; then
      wget -q -O "$crx_path" "$WIDEVINE_CRX_URL" || return 1
    fi

    if [ -f "$crx_path" ] && command -v python3 &>/dev/null; then
      python3 - "$crx_path" "$bundled_cdm_dir" "$APP_PATH/WidevineCdm" "$HOME/.config/Crunchyroll/WidevineCdm" "$WIDEVINE_VERSION" << 'PYEOF'
import sys, os, io, zipfile, shutil, json

crx_path, bundled_dir, app_cdm_dir, userdata_cdm_base, wv_ver = sys.argv[1:6]
data = open(crx_path, "rb").read()
pk_idx = data.find(b"PK\x03\x04")
if pk_idx == -1:
    sys.exit(1)

os.makedirs(bundled_dir, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(data[pk_idx:])) as zf:
    zf.extractall(bundled_dir)

for target in [app_cdm_dir, os.path.join(userdata_cdm_base, wv_ver)]:
    if os.path.exists(target):
        shutil.rmtree(target)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copytree(bundled_dir, target)

hint_file = os.path.join(userdata_cdm_base, "latest-component-updated-widevine-cdm")
with open(hint_file, "w", encoding="utf-8") as f:
    json.dump({"Path": os.path.join(userdata_cdm_base, wv_ver)}, f)
PYEOF
      rm -f "$crx_path"
      chmod 755 "$bundled_cdm_dir/_platform_specific/$cdm_arch/libwidevinecdm.so" 2>/dev/null || true
      echo -e "${GREEN}✅ Widevine CDM (${WIDEVINE_VERSION}) configured for instant Zygote DRM loading.${NC}"
    fi
  fi
}

# Detect Electron executable (custom electron-widevine first for DRM support)
detect_electron() {
  ensure_widevine_electron || true

  if [ -x "$APP_PATH/electron-widevine/electron" ]; then
    EXEC_PATH="$APP_PATH/electron-widevine/electron"
    return
  elif [ -f "$APP_PATH/node_modules/.bin/electron" ]; then
    EXEC_PATH="$APP_PATH/node_modules/.bin/electron"
    return
  elif [ -f "$APP_PATH/dist/linux-unpacked/crunchyroll-desktop" ]; then
    EXEC_PATH="$APP_PATH/dist/linux-unpacked/crunchyroll-desktop"
    return
  fi

  # Check /usr/lib/electron* directly (CachyOS / Arch Linux)
  for dir in $(ls -d /usr/lib/electron* 2>/dev/null | sort -V -r); do
    if [ -x "$dir/electron" ]; then
      EXEC_PATH="$dir/electron"
      return
    fi
  done

  for bin_name in electron electron43 electron42 electron41 electron40 electron39 electron38 electron37 electron36 electron35 electron34 electron33 electron32; do
    if command -v "$bin_name" &>/dev/null; then
      EXEC_PATH="$(command -v "$bin_name")"
      return
    fi
  done
}

detect_electron

echo -e "⚡ Using Electron runtime: ${GREEN}${EXEC_PATH:-electron}${NC}"

# Clean up any obsolete desktop entries
rm -f "$HOME/.local/share/applications/crunchyroll-desktop.desktop"

# Install icon to user hicolor theme
mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps"
cp "$ICON_PATH" "$HOME/.local/share/icons/hicolor/512x512/apps/crunchyroll.png" 2>/dev/null || true

# Create CLI wrapper script in ~/.local/bin
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/crunchyroll-desktop" <<EOF
#!/bin/bash
unset ELECTRON_RUN_AS_NODE
unset ELECTRON_FORCE_IS_PACKAGED
export ELECTRON_FORCE_IS_PACKAGED=0
exec "${EXEC_PATH:-electron}" --no-sandbox "$MAIN_PATH" "\$@"
EOF
chmod +x "$HOME/.local/bin/crunchyroll-desktop"

# Choose install target: User-level (~/.local/share/applications) or System-wide (/usr/share/applications)
if [ "$1" == "--system" ]; then
  DESKTOP_DIR="/usr/share/applications"
  DESKTOP_FILE="$DESKTOP_DIR/crunchyroll.desktop"
  echo "Installing system-wide to $DESKTOP_FILE..."

  sudo mkdir -p /usr/share/icons/hicolor/512x512/apps
  sudo cp "$ICON_PATH" /usr/share/icons/hicolor/512x512/apps/crunchyroll.png 2>/dev/null || true
  sudo rm -f "/usr/share/applications/crunchyroll-desktop.desktop"

  sudo tee "$DESKTOP_FILE" > /dev/null <<EOF
[Desktop Entry]
Name=Crunchyroll
GenericName=Anime Streaming Client
Exec=env ELECTRON_FORCE_IS_PACKAGED=0 ${EXEC_PATH:-electron} --no-sandbox "$MAIN_PATH" %U
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;TV;Entertainment;
Keywords=anime;crunchyroll;streaming;video;japanese;tv;animation;
Comment=Unofficial Crunchyroll Desktop Client with Widevine DRM & Episode Tracker
StartupWMClass=crunchyroll
StartupNotify=true
EOF
else
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  DESKTOP_FILE="$DESKTOP_DIR/crunchyroll.desktop"
  echo "Installing for current user to $DESKTOP_FILE..."
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=Crunchyroll
GenericName=Anime Streaming Client
Exec=env ELECTRON_FORCE_IS_PACKAGED=0 ${EXEC_PATH:-electron} --no-sandbox "$MAIN_PATH" %U
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;TV;Entertainment;
Keywords=anime;crunchyroll;streaming;video;japanese;tv;animation;
Comment=Unofficial Crunchyroll Desktop Client with Widevine DRM & Episode Tracker
StartupWMClass=crunchyroll
StartupNotify=true
EOF
  chmod +x "$DESKTOP_FILE"
fi

# Step 2: Refresh desktop databases and icon caches (GNOME, KDE Plasma on CachyOS/Fedora, XFCE)
echo "🔄 Refreshing system desktop services, icon caches, and menus..."
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
if [ -w "/usr/share/applications" ] || [ "$EUID" -eq 0 ]; then
  update-desktop-database /usr/share/applications 2>/dev/null || true
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
fi
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
update-mime-database "$HOME/.local/share/mime" 2>/dev/null || true

# Refresh KDE Plasma 6 / 5 application launcher cache (CachyOS & Fedora KDE)
if command -v kbuildsycoca6 &>/dev/null; then
  kbuildsycoca6 2>/dev/null || true
elif command -v kbuildsycoca5 &>/dev/null; then
  kbuildsycoca5 2>/dev/null || true
fi

if command -v xdg-desktop-menu &>/dev/null; then
  xdg-desktop-menu forceupdate 2>/dev/null || true
fi

# Step 3: Relaunch app if it was running or if requested via --restart / -r
if [ "$WAS_RUNNING" -eq 1 ] || [ "$1" == "--restart" ] || [ "$2" == "--restart" ]; then
  echo "🚀 Relaunching Crunchyroll with updated services..."
  nohup "${EXEC_PATH:-electron}" --no-sandbox "$MAIN_PATH" > /dev/null 2>&1 &
fi

if command -v notify-send &>/dev/null; then
  notify-send -i "$ICON_PATH" "Crunchyroll Desktop" "Installed and ready on ${PRETTY_NAME:-Linux}!" 2>/dev/null || true
fi

echo -e "${GREEN}✅ Crunchyroll Desktop installed successfully on ${PRETTY_NAME:-Linux}!${NC}"
echo -e "   • Launch from your Application Menu (${BOLD}Crunchyroll${NC})"
echo -e "   • Or run from terminal: ${BOLD}crunchyroll-desktop${NC}"
