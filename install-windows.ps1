#Requires -Version 5.1
param(
    [switch]$Uninstall,
    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"
$SrcDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$AppDir = Join-Path $env:LOCALAPPDATA "Programs\Crunchyroll-Desktop"
$IconPath = Join-Path $AppDir "resources\app\icon.ico"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Crunchyroll.lnk"
$StartMenuShortcut = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\Crunchyroll.lnk"

if ($Uninstall) {
    Write-Host "Removing Crunchyroll shortcuts and installed files..." -ForegroundColor Yellow
    if (Test-Path $DesktopShortcut) { Remove-Item $DesktopShortcut -Force }
    if (Test-Path $StartMenuShortcut) { Remove-Item $StartMenuShortcut -Force }
    if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
    Write-Host "Crunchyroll Desktop uninstalled cleanly." -ForegroundColor Green
    exit 0
}

Write-Host "=== Crunchyroll Desktop Setup for Windows ===" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not detected. Attempting install via winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Error "Please install Node.js LTS from https://nodejs.org/ and re-run this script."
        exit 1
    }
}

Write-Host "Installing application files to $AppDir..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "resources\app") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "scripts") | Out-Null
Copy-Item -Path (Join-Path $SrcDir "main.js"), (Join-Path $SrcDir "preload.js"), (Join-Path $SrcDir "splash.html"), (Join-Path $SrcDir "package.json"), (Join-Path $SrcDir "run-windows.bat") -Destination $AppDir -Force
Copy-Item -Path (Join-Path $SrcDir "resources\*") -Destination (Join-Path $AppDir "resources") -Recurse -Force
Copy-Item -Path (Join-Path $SrcDir "scripts\*") -Destination (Join-Path $AppDir "scripts") -Recurse -Force

Push-Location $AppDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Cyan
        npm install
    }

    if ($BuildInstaller) {
        Write-Host "Building Windows NSIS & Portable executables in dist/..." -ForegroundColor Cyan
        npm run build:win
    }

    $WidevineDir = Join-Path $AppDir "electron-widevine"
    $WidevineExe = Join-Path $WidevineDir "electron.exe"
    if (-not (Test-Path $WidevineExe)) {
        Write-Host "Downloading Widevine-enabled Electron (44.5.1+wvcus) for Windows..." -ForegroundColor Cyan
        $ZipUrl = "https://github.com/castlabs/electron-releases/releases/download/v44.5.1%2Bwvcus/electron-v44.5.1%2Bwvcus-win32-x64.zip"
        $ZipPath = Join-Path $AppDir "electron-widevine.zip"
        Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath
        Expand-Archive -Path $ZipPath -DestinationPath $WidevineDir -Force
        Remove-Item $ZipPath -Force
    }

    # Pre-provision WidevineCdm from system Edge/Chrome/Brave if available so DRM works immediately on first launch
    $BundledCdmDir = Join-Path $WidevineDir "WidevineCdm"
    if (-not (Test-Path (Join-Path $BundledCdmDir "manifest.json"))) {
        $CandidateRoots = @(
            (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\WidevineCdm"),
            (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\WidevineCdm"),
            (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data\WidevineCdm"),
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application",
            "$env:ProgramFiles\Google\Chrome\Application"
        )
        $FoundManifest = $null
        foreach ($Root in $CandidateRoots) {
            if (Test-Path $Root) {
                $Manifest = Get-ChildItem -Path $Root -Filter "manifest.json" -Recurse -ErrorAction SilentlyContinue |
                    Where-Object { Test-Path (Join-Path $_.DirectoryName "_platform_specific\win_x64\widevinecdm.dll") } |
                    Sort-Object FullName -Descending |
                    Select-Object -First 1
                if ($Manifest) {
                    $FoundManifest = $Manifest
                    break
                }
            }
        }
        if ($FoundManifest) {
            Write-Host "Configuring Widevine CDM from $($FoundManifest.DirectoryName)..." -ForegroundColor Cyan
            New-Item -ItemType Directory -Force -Path $BundledCdmDir | Out-Null
            Copy-Item -Path (Join-Path $FoundManifest.DirectoryName "*") -Destination $BundledCdmDir -Recurse -Force
            $AppCdmDir = Join-Path $AppDir "WidevineCdm"
            New-Item -ItemType Directory -Force -Path $AppCdmDir | Out-Null
            Copy-Item -Path (Join-Path $FoundManifest.DirectoryName "*") -Destination $AppCdmDir -Recurse -Force
            $UserDataCdm = Join-Path $env:APPDATA "Crunchyroll\WidevineCdm"
            New-Item -ItemType Directory -Force -Path $UserDataCdm | Out-Null
            $HintPath = Join-Path $UserDataCdm "latest-component-updated-widevine-cdm"
            @{ Path = $BundledCdmDir } | ConvertTo-Json -Compress | Set-Content -Path $HintPath -Encoding UTF8
        }
    }

    $ElectronExe = if (Test-Path $WidevineExe) { $WidevineExe } else { Join-Path $AppDir "node_modules\electron\dist\electron.exe" }
    $WshShell = New-Object -ComObject WScript.Shell

    foreach ($ShortcutPath in @($DesktopShortcut, $StartMenuShortcut)) {
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        if (Test-Path $ElectronExe) {
            $Shortcut.TargetPath = $ElectronExe
            $Shortcut.Arguments = "`"$AppDir`""
        } else {
            $Shortcut.TargetPath = Join-Path $AppDir "run-windows.bat"
        }
        $Shortcut.WorkingDirectory = $AppDir
        if (Test-Path $IconPath) {
            $Shortcut.IconLocation = $IconPath
        }
        $Shortcut.Description = "Crunchyroll Desktop Client"
        $Shortcut.Save()
    }

    Write-Host "Crunchyroll Desktop installed! Shortcuts created on Desktop and Start Menu." -ForegroundColor Green
} finally {
    Pop-Location
}
