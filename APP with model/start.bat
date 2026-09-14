@echo off
echo ============================================
echo WiFi Congestion Monitoring App
echo ============================================
echo.
echo Installing dependencies...
call npm install

if errorlevel 1 (
  echo.
  echo Error during npm install. Please check your npm installation.
  exit /b 1
)

echo.
echo ============================================
echo Starting backend server (port 5000)...
echo ============================================
start /B node server.js

REM Give server time to start
timeout /t 2

echo.
echo ============================================
echo Starting frontend dev server (port 5173)...
echo ============================================
call npm run dev

echo.
echo App is now running!
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause
