@echo off
setlocal
title Winny Fingerprint Bridge

echo =========================================
echo    WINNY FINGERPRINT BRIDGE BOOTSTRAP
echo =========================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Node.js tidak ditemukan!
    echo Silakan install Node.js dari https://nodejs.org/
    echo Tanpa Node.js, aplikasi bridge tidak bisa berjalan.
    pause
    exit /b
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [!] node_modules tidak ditemukan di folder %CD%
    echo Mengunduh library yang diperlukan (ws)...
    call npm install
    if %errorlevel% neq 0 (
        echo [!] ERROR: Gagal menjalankan 'npm install'. 
        echo Pastikan Anda terhubung ke internet.
        pause
        exit /b
    )
)

echo [!] Memulai Bridge di port 8080...
node bridge.js
if %errorlevel% neq 0 (
    echo [!] ERROR: Aplikasi Bridge berhenti secara tidak terduga.
)

pause
