@echo off
REM Build and install debug APK for WiFi Monitor (Windows)
REM Usage: double-click or run from project root: android\build_and_install.bat

SETLOCAL
cd /d "%~dp0"

echo=== Building debug APK ===
call gradlew assembleDebug
IF %ERRORLEVEL% NEQ 0 (
  echo Build failed. Check Gradle output.
  pause
  exit /b %ERRORLEVEL%
)

set APK_PATH=app\build\outputs\apk\debug\app-debug.apk
if not exist "%APK_PATH%" (
  echo APK not found at %APK_PATH%
  pause
  exit /b 1
)

echo=== Installing APK to first connected device ===
REM Make sure adb is in PATH (platform-tools). If not, provide full path to adb.
adb devices
adb install -r "%APK_PATH%"
IF %ERRORLEVEL% NEQ 0 (
  echo adb install failed. Is a device connected and USB debugging enabled?
  pause
  exit /b %ERRORLEVEL%
)

REM Grant location permissions so scanning works without tapping settings
echo=== Granting runtime permissions ===
adb shell pm grant com.wificongestion.app android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.wificongestion.app android.permission.ACCESS_COARSE_LOCATION

REM Launch the app
echo=== Launching app ===
adb shell am start -n com.wificongestion.app/.MainActivity

echo=== Done ===
pause
ENDLOCAL
