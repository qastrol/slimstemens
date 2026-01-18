@echo off
SETLOCAL
title De Slimste Mens

echo ========================================
echo       DE SLIMSTE MENS - STARTUP
echo ========================================
echo.

:: 1. Controleer op Node.js
echo [1/4] Controleer of Node.js is geinstalleerd...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [FOUT] Node.js is niet gevonden!
    echo Download en installeer Node.js via: https://nodejs.org/en/download
    pause
    exit /b
)

:: 2. Ga naar de juiste map
cd /d "%~dp0"

:: 3. Controleer 'ws' module
echo [2/4] Controleer server-bestanden...
if not exist "node_modules\ws" (
    echo      'ws' module ontbreekt. Bezig met installeren...
    npm install ws
)

:: 4. Open de browser (vóór of tijdens het starten van de server)
echo [3/4] Pagina's openen in de browser...
:: Start index.html (Host Dashboard)
start "" "index.html"
:: Wacht heel even en start display.html (Kandidaat/Stream Scherm)
timeout /t 1 /nobreak >nul
start "" "display.html"

:: 5. Start de server
echo [4/4] WebSocket Server starten op poort 8081...
echo.
echo ----------------------------------------
echo DE SERVER DRAAIT NU. 
echo Sluit dit venster NIET tijdens het spelen.
echo ----------------------------------------
echo.
node server.js

pause