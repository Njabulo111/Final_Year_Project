@echo off
setlocal enabledelayedexpansion

REM Change to the app directory
cd /d "C:\Users\Njabulo Sibambo 2\OneDrive - University of Johannesburg\Documents\7th semester\Final year project\APP with model"

REM Check if we're in the right directory
if not exist package.json (
  echo Error: package.json not found. Make sure you're in the app directory.
  pause
  exit /b 1
)

echo ============================================
echo WiFi Congestion Monitoring App Setup
echo ============================================
echo.

REM Check if node and npm are available
where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js is not installed or not in PATH.
  echo Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

echo Found Node.js: 
node --version

echo.
echo ============================================
echo Installing npm dependencies...
echo This may take a few minutes...
echo ============================================
echo.

call npm install

if errorlevel 1 (
  echo.
  echo Error: npm install failed. Check the output above.
  pause
  exit /b 1
)

echo.
echo ============================================
echo ✓ Dependencies installed successfully!
echo ============================================
echo.
echo To start the application, run one of these commands:
echo.
echo   Option 1: npm run dev:server (for backend only)
echo   Option 2: npm run dev (for frontend only)
echo   Option 3: Double-click start.bat to run both
echo.
pause
