@echo off
setlocal enabledelayedexpansion

cd /d "C:\Users\Njabulo Sibambo 2\OneDrive - University of Johannesburg\Documents\7th semester\Final year project\APP with model"

echo ============================================
echo WiFi Congestion App - Starting...
echo ============================================
echo.

echo Step 1: Installing dependencies...
call npm install

if errorlevel 1 (
  echo.
  echo ERROR: npm install failed
  pause
  exit /b 1
)

echo.
echo ============================================
echo Starting Backend Server (port 5000)...
echo ============================================
echo.

start "Backend Server" cmd /k "npm run server"

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak

echo.
echo ============================================
echo Starting Frontend Dev Server (port 5173)...
echo ============================================
echo.

start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo ============================================
echo ✓ Application Started!
echo ============================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Opening frontend in browser...
timeout /t 3 /nobreak

start http://localhost:5173

echo.
echo App is running in separate windows!
echo Close this window when done.
echo.
pause
