@echo off
SETLOCAL
title De Slimste Mens

echo Controleer of Node.js is geinstalleerd...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [FOUT] Node.js is niet gevonden.
    echo Installeer Node.js via https://nodejs.org/em/
    pause
    exit /b
)

echo Node.js gevonden!
echo.

:: Ga naar de directory waar dit script staat, ongeacht vanaf waar het is opgeroepen
cd /d "%~dp0"

echo Map ingesteld op: %cd%

:: Controleer of server.js bestaat
if not exist "server.js" (
    echo [FOUT] server.js is niet gevonden in deze map.
    pause
    exit /b
)

:: Controleer of de 'ws' module aanwezig is (node_modules)
if not exist "node_modules\ws" (
    echo 'ws' module niet gevonden. Bezig met installeren...
    npm install ws
)

echo WebSocket Server wordt gestart...
echo.
node server.js

pause