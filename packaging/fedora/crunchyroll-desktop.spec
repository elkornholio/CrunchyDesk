Name:           crunchyroll-desktop
Version:        1.1.0
Release:        1%{?dist}
Summary:        Crunchyroll Desktop Client with Widevine DRM and Episode Watched/Unwatched Tracker
License:        MIT
URL:            https://github.com/elkornholio/CrunchyDesk
BuildArch:      noarch
Requires:       nodejs

%description
A sleek, high-performance Crunchyroll desktop application for Fedora, CachyOS, and Windows
featuring Widevine DRM auto-discovery, Discord Rich Presence, Anime Visual Shaders,
and episode/season Watched & Unwatched status management.

%install
mkdir -p %{buildroot}/usr/lib/crunchyroll-desktop/resources/app
mkdir -p %{buildroot}/usr/lib/crunchyroll-desktop/scripts
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/512x512/apps

install -m 644 %{_sourcedir}/main.js %{buildroot}/usr/lib/crunchyroll-desktop/main.js
install -m 644 %{_sourcedir}/preload.js %{buildroot}/usr/lib/crunchyroll-desktop/preload.js
install -m 644 %{_sourcedir}/splash.html %{buildroot}/usr/lib/crunchyroll-desktop/splash.html
install -m 644 %{_sourcedir}/package.json %{buildroot}/usr/lib/crunchyroll-desktop/package.json
install -m 755 %{_sourcedir}/scripts/launch.js %{buildroot}/usr/lib/crunchyroll-desktop/scripts/launch.js
install -m 644 %{_sourcedir}/resources/app/icon.png %{buildroot}/usr/lib/crunchyroll-desktop/resources/app/icon.png
install -m 644 %{_sourcedir}/resources/app/icon.png %{buildroot}/usr/share/icons/hicolor/512x512/apps/crunchyroll.png

cat > %{buildroot}/usr/bin/crunchyroll-desktop << 'EOF'
#!/bin/bash
exec node /usr/lib/crunchyroll-desktop/scripts/launch.js "$@"
EOF
chmod 755 %{buildroot}/usr/bin/crunchyroll-desktop

cat > %{buildroot}/usr/share/applications/crunchyroll.desktop << 'EOF'
[Desktop Entry]
Name=Crunchyroll
GenericName=Anime Streaming Client
Exec=/usr/bin/crunchyroll-desktop %U
Icon=crunchyroll
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;TV;Entertainment;
Keywords=anime;crunchyroll;streaming;video;japanese;tv;animation;
Comment=Unofficial Crunchyroll Desktop Client with Widevine DRM & Episode Tracker
StartupWMClass=crunchyroll
StartupNotify=true
EOF

%files
/usr/lib/crunchyroll-desktop
/usr/bin/crunchyroll-desktop
/usr/share/applications/crunchyroll.desktop
/usr/share/icons/hicolor/512x512/apps/crunchyroll.png
