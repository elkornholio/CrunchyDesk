@echo off
title Crunchyroll Desktop
cd /d "%~dp0"

if exist "electron-widevine\electron.exe" (
    start "" "electron-widevine\electron.exe" .
    exit /b 0
)

if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
)

if exist "node_modules\.bin\electron.cmd" (
    start "" "node_modules\.bin\electron.cmd" .
    exit /b 0
)

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Running cross-platform launcher...
    node scripts\launch.js
    exit /b 0
)

echo Node.js / Electron not found. Please run install-windows.ps1 in PowerShell or install Node.js from https://nodejs.org/
pause
